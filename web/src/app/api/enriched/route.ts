import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const RESULTS_DIR = path.resolve(process.cwd(), '..', 'results');

// Enriched files are written by the backend with a `_linkedin_<timestamp>` infix
// and uploaded to R2 under the `enriched/` prefix.
const ENRICHED_PREFIX = 'enriched/';
const LINKEDIN_MARKER = '_linkedin_';

type EnrichedEntry = {
  key: string;            // R2 object key, or '' when local-only
  filename: string;       // basename, e.g. "agence_..._linkedin_....xlsx"
  label: string;          // human-friendly source label
  source: 'r2' | 'local';
  size: number | null;
  createdAt: string;      // ISO
};

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Turn "agence_marketing_in_paris_2026-07-01T15-08-40-640Z_linkedin_2026-07-01T15-41-20-560Z.xlsx"
// into "agence marketing in paris" for display.
function labelFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.(xlsx|csv)$/i, '');
  const base = withoutExt.split(LINKEDIN_MARKER)[0];
  // Drop the trailing ISO timestamp the scraper appends to source files.
  const withoutTimestamp = base.replace(/_\d{4}-\d{2}-\d{2}t[\d-]+z$/i, '');
  const cleaned = withoutTimestamp.replace(/_/g, ' ').trim();
  return cleaned || withoutExt;
}

async function listFromR2(r2: S3Client): Promise<EnrichedEntry[]> {
  const bucket = process.env.R2_BUCKET || 'leadsclickvente';
  const out: EnrichedEntry[] = [];
  let ContinuationToken: string | undefined;
  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: ENRICHED_PREFIX,
      ContinuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      const key = obj.Key ?? '';
      const filename = key.slice(ENRICHED_PREFIX.length);
      if (!filename || !/\.(xlsx|csv)$/i.test(filename)) continue;
      out.push({
        key,
        filename,
        label: labelFromFilename(filename),
        source: 'r2',
        size: obj.Size ?? null,
        createdAt: (obj.LastModified ?? new Date()).toISOString(),
      });
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return out;
}

function listFromLocal(): EnrichedEntry[] {
  try {
    if (!fs.existsSync(RESULTS_DIR)) return [];
    return fs.readdirSync(RESULTS_DIR)
      .filter(f => f.includes(LINKEDIN_MARKER) && /\.(xlsx|csv)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(RESULTS_DIR, f));
        return {
          key: '',
          filename: f,
          label: labelFromFilename(f),
          source: 'local' as const,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      });
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const r2 = getR2Client();
    const r2Entries = r2 ? await listFromR2(r2) : [];
    const localEntries = listFromLocal();

    // Merge, preferring the R2 copy when the same file exists in both.
    const byFilename = new Map<string, EnrichedEntry>();
    for (const e of localEntries) byFilename.set(e.filename, e);
    for (const e of r2Entries) byFilename.set(e.filename, e); // R2 wins

    const results = [...byFilename.values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error('Enriched list error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list enriched files';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
