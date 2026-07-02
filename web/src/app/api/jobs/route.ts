import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { dispatchQueue } from '@/lib/scraperQueue';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, keyword, location, projectId, limit } = body;

    if (!query && !keyword) {
      return NextResponse.json({ error: 'Query or keyword is required' }, { status: 400 });
    }

    const resolvedQuery = query || (location ? `${keyword} in ${location}` : keyword);
    const parsedLimit = Math.max(1, Math.min(1000, parseInt(String(limit), 10) || 50));

    const job = await prisma.scraping_jobs.create({
      data: {
        project_id: projectId || null,
        status: 'queued',
        config: {
          query: resolvedQuery,
          keyword: keyword || null,
          location: location || null,
          limit: parsedLimit,
        },
      },
    });

    dispatchQueue().catch(err => console.error('Queue dispatch error:', err));

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Job queued successfully',
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (jobId) {
      const job = await prisma.scraping_jobs.findUnique({ where: { id: jobId } });
      if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ job });
    } else {
      const jobs = await prisma.scraping_jobs.findMany({
        orderBy: { created_at: 'desc' },
        take: 20,
      });
      return NextResponse.json({ jobs });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
