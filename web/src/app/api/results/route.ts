import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { findLocalFile } from '@/lib/localResults';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobs = await prisma.scraping_jobs.findMany({
      where: { status: 'completed' },
      include: { projects: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    const results = jobs.map(job => {
      const config = (job.config ?? {}) as Record<string, unknown>;
      const keyword = config.keyword as string | undefined;
      const location = config.location as string | undefined;
      const query = config.query as string | undefined;
      const resultFile = config.resultFile as string | undefined;
      let localFile = config.localFile as string | undefined;

      if (!localFile && !resultFile && query) {
        localFile = findLocalFile(query, job.completed_at) ?? undefined;
      }

      const label = keyword && location
        ? `${keyword} in ${location}`
        : query ?? job.id;

      return {
        jobId: job.id,
        label,
        query,
        keyword,
        location,
        resultFile: resultFile ?? null,
        localFile: localFile ?? null,
        filename: resultFile ? resultFile.split('/').pop() : (localFile ?? null),
        count: job.progress ?? 0,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        projectName: job.projects?.name ?? null,
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
