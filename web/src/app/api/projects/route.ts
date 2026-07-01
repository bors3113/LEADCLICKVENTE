import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .single();
  return membership?.organization_id ?? null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getOrgId(supabase, user.id);
    if (!orgId) {
      return NextResponse.json({ projects: [] });
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, description, created_at, scraping_jobs(count)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ projects: projects ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getOrgId(supabase, user.id);
    if (!orgId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body as { name: string; description?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ organization_id: orgId, name: name.trim(), description: description?.trim() || null })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
