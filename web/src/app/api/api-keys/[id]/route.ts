import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

async function getOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .single();
  return membership?.organization_id ?? null;
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

    const organizationId = await getOrgId(supabase, user.id);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found for this account' }, { status: 400 });
    }

    const { id } = await params;

    // Org-scoped delete: a key belonging to another org is simply not found.
    const result = await prisma.api_keys.deleteMany({
      where: { id, organization_id: organizationId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('API keys DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
