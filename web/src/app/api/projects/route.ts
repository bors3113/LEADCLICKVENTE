import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

async function getOrgId(userId: string): Promise<string | null> {
  const membership = await prisma.memberships.findFirst({
    where: { user_id: userId },
    select: { organization_id: true },
  });
  return membership?.organization_id ?? null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getOrgId(user.id);
    if (!orgId) {
      return NextResponse.json({ projects: [] });
    }

    const projects = await prisma.projects.findMany({
      where: { organization_id: orgId },
      include: { _count: { select: { scraping_jobs: true } } },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ projects });
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

    const orgId = await getOrgId(user.id);
    if (!orgId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body as { name: string; description?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const project = await prisma.projects.create({
      data: {
        organization_id: orgId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
