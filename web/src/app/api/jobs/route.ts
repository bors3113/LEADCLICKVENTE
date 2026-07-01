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
    const { query, projectId } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Insert job into database
    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert({
        project_id: projectId || '00000000-0000-0000-0000-000000000000', // Use a default or require valid ID
        status: 'queued',
        config: { query },
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job insertion error:', jobError);
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    // Trigger the Cloudflare Worker
    // In production, this would likely be pushed to a Cloudflare Queue via API or SDK
    // Here we use the HTTP trigger we built in the worker
    const workerUrl = process.env.WORKER_URL || 'http://localhost:8787';
    
    // We do this non-await so we don't block the response, letting it run in background
    // (Note: in Vercel Edge, background promises need special handling, but this is a standard API route)
    fetch(`${workerUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query, 
        jobId: job.id 
      }),
    }).catch(err => console.error('Failed to trigger worker:', err));

    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job queued successfully' 
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
      // Get specific job
      const { data, error } = await supabase
        .from('scraping_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
        
      if (error) throw error;
      return NextResponse.json({ job: data });
    } else {
      // List all jobs
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
