import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    // Clamp the per-job limit to a sane range (default 50).
    const parsedLimit = Math.max(1, Math.min(1000, parseInt(String(limit), 10) || 50));

    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert({
        project_id: projectId || null,
        status: 'queued',
        config: {
          query: resolvedQuery,
          keyword: keyword || null,
          location: location || null,
          limit: parsedLimit,
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job insertion error:', jobError);
      return NextResponse.json({ error: jobError.message, details: jobError }, { status: 500 });
    }

    const workerUrl = process.env.WORKER_URL || 'http://localhost:8787';

    fetch(`${workerUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: resolvedQuery, jobId: job.id, limit: parsedLimit }),
    }).catch(err => console.error('Failed to trigger worker:', err));

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
      const { data, error } = await supabase
        .from('scraping_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return NextResponse.json({ job: data });
    } else {
      const { data, error } = await supabase
        .from('scraping_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return NextResponse.json({ jobs: data });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
