import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

export const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:3008';
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';

export function scraperHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SCRAPER_API_KEY) h['x-api-key'] = SCRAPER_API_KEY;
  return h;
}

export async function scraperBusy(): Promise<boolean> {
  try {
    const res = await fetch(`${SCRAPER_URL}/api/scrape-status`, { headers: scraperHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.isActive);
  } catch {
    return false;
  }
}

type RunOutcome =
  | { status: 'done'; count: number; fileName?: string; r2Key?: string }
  | { status: 'busy' };

export async function runJob(job: {
  id: string;
  config: Record<string, unknown>;
}): Promise<RunOutcome> {
  const cfg = job.config || {};
  const query = (cfg.query as string) || '';
  const limit = (cfg.limit as number) || 50;

  const res = await fetch(`${SCRAPER_URL}/api/scrape`, {
    method: 'POST',
    headers: scraperHeaders(),
    body: JSON.stringify({ query, jobId: job.id, limit }),
  });

  if (res.status === 409) return { status: 'busy' };

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Scraper returned ${res.status}: ${text}`);
  }

  const data = await res.json().catch(() => ({}));
  return {
    status: 'done',
    count: (data.totalResultsCount as number) ?? 0,
    fileName: (data.fileName as string) ?? undefined,
    r2Key: (data.r2Key as string) ?? undefined,
  };
}

export async function dispatchQueue(): Promise<void> {
  // Auth check kept for session context only — queue dispatch itself is server-internal.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (await scraperBusy()) return;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = await prisma.scraping_jobs.findFirst({
      where: { status: 'queued' },
      orderBy: { created_at: 'asc' },
      select: { id: true, config: true },
    });

    if (!next) break;

    await prisma.scraping_jobs.update({
      where: { id: next.id },
      data: { status: 'running', progress: 0 },
    });

    try {
      const outcome = await runJob(next as { id: string; config: Record<string, unknown> });

      if (outcome.status === 'busy') {
        await prisma.scraping_jobs.update({ where: { id: next.id }, data: { status: 'queued' } });
        break;
      }

      const configPatch: Record<string, unknown> = {};
      if (outcome.fileName) configPatch.localFile = outcome.fileName;
      if (outcome.r2Key) configPatch.resultFile = outcome.r2Key;

      const mergedConfig = Object.keys(configPatch).length > 0
        ? { ...(next.config as Record<string, unknown>), ...configPatch }
        : undefined;

      await prisma.scraping_jobs.update({
        where: { id: next.id },
        data: {
          status: 'completed',
          progress: outcome.count,
          completed_at: new Date(),
          ...(mergedConfig !== undefined ? { config: mergedConfig as any } : {}),
        },
      });
    } catch (err) {
      console.error(`Failed to run job ${next.id}:`, err);
      await prisma.scraping_jobs.update({ where: { id: next.id }, data: { status: 'failed' } });
    }
  }
}
