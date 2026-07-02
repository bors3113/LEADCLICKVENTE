import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { SCRAPER_URL, scraperHeaders, dispatchQueue } from '@/lib/scraperQueue';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId } = await params;
    const { action } = await request.json();

    if (!['stop', 'pause', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const job = await prisma.scraping_jobs.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, config: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (action === 'stop') {
      await fetch(`${SCRAPER_URL}/api/stop-scrape`, {
        method: 'POST',
        headers: scraperHeaders(),
        body: JSON.stringify({ jobId }),
      }).catch(() => null);

      await prisma.scraping_jobs.update({
        where: { id: jobId },
        data: { status: 'stopped' },
      });

      return NextResponse.json({ success: true, status: 'stopped' });
    }

    if (action === 'pause') {
      await fetch(`${SCRAPER_URL}/api/pause-scrape`, {
        method: 'POST',
        headers: scraperHeaders(),
        body: JSON.stringify({ jobId }),
      }).catch(() => null);

      await prisma.scraping_jobs.update({
        where: { id: jobId },
        data: { status: 'paused' },
      });

      return NextResponse.json({ success: true, status: 'paused' });
    }

    if (action === 'resume') {
      await prisma.scraping_jobs.update({
        where: { id: jobId },
        data: { status: 'queued', progress: 0 },
      });

      dispatchQueue().catch(err => console.error('Queue dispatch error on resume:', err));

      return NextResponse.json({ success: true, status: 'queued' });
    }

  } catch (error: any) {
    console.error('Job control error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId } = await params;

    // 1. Try to stop if running (ignores failures)
    await fetch(`${SCRAPER_URL}/api/stop-scrape`, {
      method: 'POST',
      headers: scraperHeaders(),
      body: JSON.stringify({ jobId }),
    }).catch(() => null);

    // 2. Delete from database
    await prisma.scraping_jobs.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Job deletion error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
