import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

// Polled by EnrichmentPanel after POST /api/enrich returns a jobId, so
// progress survives navigation/reload — the enrichment itself runs detached
// on the backend (see runEnrichmentJob in scraperController.js) rather than
// being tied to the lifetime of the original request.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await prisma.enrichment_jobs.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        enriched_count: true,
        credits_charged: true,
        output_file: true,
        completed_at: true,
        total_rows: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      enrichedCount: job.enriched_count,
      creditsCharged: job.credits_charged,
      fileName: job.output_file,
      downloadUrl: job.output_file ? `/api/download?file=${job.output_file}` : null,
      completedAt: job.completed_at,
      // Live count of items scraped in the current Apify actor run — updates
      // every few seconds while status is "running" (see runEnrichmentJob).
      liveCount: job.total_rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
