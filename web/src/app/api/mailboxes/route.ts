import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { getOrgId } from '@/lib/org';

// GET /api/mailboxes — list connected mailboxes for the caller's org.
// Never returns token material.
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getOrgId(supabase, user.id);
    if (!organizationId) {
      return NextResponse.json({ mailboxes: [] });
    }

    const mailboxes = await prisma.mailboxes.findMany({
      where: { organization_id: organizationId },
      select: {
        id: true,
        provider: true,
        email: true,
        display_name: true,
        status: true,
        daily_send_limit: true,
        sends_today: true,
        last_used_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ mailboxes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Mailboxes GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
