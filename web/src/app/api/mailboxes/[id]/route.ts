import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { getOrgId } from '@/lib/org';
import { decryptTokenOrNull } from '@/lib/email/tokens';

// DELETE /api/mailboxes/[id] — disconnect a mailbox (best-effort provider
// token revoke, then remove the row). Scoped to the caller's org.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getOrgId(supabase, user.id);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const mailbox = await prisma.mailboxes.findFirst({
      where: { id, organization_id: organizationId },
      select: { id: true, provider: true, refresh_token_enc: true, access_token_enc: true },
    });
    if (!mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    // Best-effort Google token revoke (Microsoft has no equivalent simple endpoint).
    if (mailbox.provider === 'google') {
      const token =
        decryptTokenOrNull(mailbox.refresh_token_enc) ??
        decryptTokenOrNull(mailbox.access_token_enc);
      if (token) {
        try {
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token }).toString(),
          });
        } catch {
          // Ignore revoke failures; we still delete the local record.
        }
      }
    }

    await prisma.mailboxes.delete({ where: { id: mailbox.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Mailbox DELETE error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
