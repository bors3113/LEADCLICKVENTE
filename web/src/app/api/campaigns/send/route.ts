import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { getOrgId } from '@/lib/org';
import { sendEmail } from '@/lib/email';
import {
  renderTemplate,
  textToHtml,
  withFooter,
  unsubscribeUrl,
  type RecipientVars,
} from '@/lib/email/template';
import { creditsPerEmail, getAvailableCredits, chargeCredits } from '@/lib/email/credits';
import { getFreeQuotaRemaining, consumeFreeQuota, freeEmailsPerMonth } from '@/lib/email/quota';

interface SendBody {
  mailboxId: string;
  subject: string;
  bodyTemplate: string;
  recipients: RecipientVars[];
  campaignId?: string;
}

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function POST(request: Request) {
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
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const body = (await request.json()) as SendBody;
    const { mailboxId, subject, bodyTemplate } = body;
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];

    if (!mailboxId || !subject?.trim() || !bodyTemplate?.trim() || recipients.length === 0) {
      return NextResponse.json(
        { error: 'mailboxId, subject, bodyTemplate and at least one recipient are required' },
        { status: 400 }
      );
    }

    // Mailbox must belong to this org and be active.
    const mailbox = await prisma.mailboxes.findFirst({
      where: { id: mailboxId, organization_id: organizationId },
      select: {
        id: true,
        provider: true,
        email: true,
        display_name: true,
        status: true,
        access_token_enc: true,
        refresh_token_enc: true,
        token_expires_at: true,
        daily_send_limit: true,
        sends_today: true,
        last_send_reset: true,
      },
    });
    if (!mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }
    if (mailbox.status !== 'active') {
      return NextResponse.json({ error: 'Mailbox is not active; reconnect it.' }, { status: 409 });
    }

    // Reset the daily counter if we've rolled into a new day.
    const today = todayUtc();
    let sendsToday = mailbox.sends_today ?? 0;
    if (!mailbox.last_send_reset || mailbox.last_send_reset.getTime() < today.getTime()) {
      sendsToday = 0;
      await prisma.mailboxes.update({
        where: { id: mailbox.id },
        data: { sends_today: 0, last_send_reset: today },
      });
    }

    const dailyLimit = mailbox.daily_send_limit ?? 50;
    const remainingToday = Math.max(0, dailyLimit - sendsToday);
    if (remainingToday === 0) {
      return NextResponse.json(
        { error: `Daily send limit reached for this mailbox (${dailyLimit}/day).` },
        { status: 429 }
      );
    }

    // Suppression list.
    const suppressedRows = await prisma.unsubscribes.findMany({
      where: { organization_id: organizationId },
      select: { email: true },
    });
    const blocked = new Set(suppressedRows.map((s) => s.email.toLowerCase()));

    // De-dupe + drop suppressed + invalid, then cap at the daily remaining.
    const seen = new Set<string>();
    const queue: RecipientVars[] = [];
    for (const r of recipients) {
      const email = String(r.email || '').trim().toLowerCase();
      if (!email || seen.has(email) || blocked.has(email)) continue;
      seen.add(email);
      queue.push({ ...r, email });
    }
    const capped = queue.slice(0, remainingToday);
    const skippedForLimit = queue.length - capped.length;

    if (capped.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, charged: 0, skippedForLimit, results: [] });
    }

    // Split the queue: free monthly quota is drawn first, remainder is paid.
    const freeRemaining = await getFreeQuotaRemaining(organizationId);
    const freeSlice = capped.slice(0, freeRemaining);
    const paidSlice = capped.slice(freeRemaining);

    // Credit pre-check covers only the paid portion of this batch.
    const perEmail = creditsPerEmail();
    const required = paidSlice.length * perEmail;
    const available = await getAvailableCredits(organizationId);
    if (available < required) {
      return NextResponse.json(
        { error: 'Insufficient credits', required, available, shortfall: required - available },
        { status: 402 }
      );
    }

    // Send loop — charge/consume-quota only for successful sends.
    let sent = 0;
    let freeSent = 0;
    let failed = 0;
    let charged = 0;
    const results: { email: string; status: 'sent' | 'failed'; error?: string }[] = [];
    const freeEligible = new Set(freeSlice.map((r) => r.email));

    for (const r of capped) {
      const vars: RecipientVars = r;
      const renderedSubject = renderTemplate(subject, vars);
      const renderedText = renderTemplate(bodyTemplate, vars);
      const unsub = unsubscribeUrl(organizationId, r.email);
      const { text, html } = withFooter(
        renderedText,
        textToHtml(renderedText),
        unsub,
        mailbox.display_name
      );

      try {
        const result = await sendEmail(mailbox, {
          toEmail: r.email,
          toName: (r.name as string) ?? null,
          subject: renderedSubject,
          html,
          text,
          unsubscribeUrl: unsub,
        });

        // Draw from the free monthly pool first; fall back to a paid credit
        // charge if the pool was exhausted concurrently (race with another send).
        let isFree = false;
        let ok = true;
        if (freeEligible.has(r.email)) {
          const consumed = await consumeFreeQuota(organizationId, 1);
          isFree = consumed > 0;
        }
        if (!isFree) {
          ok = await chargeCredits(organizationId, perEmail);
        }

        if (!ok) {
          // Ran out of credits concurrently — record as sent but stop the loop.
          await prisma.email_messages.create({
            data: {
              organization_id: organizationId,
              mailbox_id: mailbox.id,
              campaign_id: body.campaignId ?? null,
              to_email: r.email,
              to_name: (r.name as string) ?? null,
              subject: renderedSubject,
              body: text,
              provider_message_id: result.providerMessageId,
              thread_id: result.threadId,
              status: 'sent',
              credits_charged: 0,
              is_free_send: false,
              sent_at: new Date(),
            },
          });
          sent += 1;
          results.push({ email: r.email, status: 'sent' });
          break;
        }

        await prisma.email_messages.create({
          data: {
            organization_id: organizationId,
            mailbox_id: mailbox.id,
            campaign_id: body.campaignId ?? null,
            to_email: r.email,
            to_name: (r.name as string) ?? null,
            subject: renderedSubject,
            body: text,
            provider_message_id: result.providerMessageId,
            thread_id: result.threadId,
            status: 'sent',
            credits_charged: isFree ? 0 : perEmail,
            is_free_send: isFree,
            sent_at: new Date(),
          },
        });
        sent += 1;
        if (isFree) freeSent += 1;
        else charged += perEmail;
        results.push({ email: r.email, status: 'sent' });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Send failed';
        await prisma.email_messages.create({
          data: {
            organization_id: organizationId,
            mailbox_id: mailbox.id,
            campaign_id: body.campaignId ?? null,
            to_email: r.email,
            to_name: (r.name as string) ?? null,
            subject: renderedSubject,
            body: text,
            status: 'failed',
            error: message,
            credits_charged: 0,
          },
        });
        failed += 1;
        results.push({ email: r.email, status: 'failed', error: message });
      }
    }

    // Bump the mailbox usage counters by however many we actually sent.
    if (sent > 0) {
      await prisma.mailboxes.update({
        where: { id: mailbox.id },
        data: {
          sends_today: { increment: sent },
          last_used_at: new Date(),
        },
      });
    }

    return NextResponse.json({ sent, freeSent, failed, charged, skippedForLimit, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed';
    console.error('Campaign send error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/campaigns/send — free-quota + paid-credit balance for the Outreach UI.
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
      return NextResponse.json({ freeRemaining: 0, freeLimit: freeEmailsPerMonth(), paidBalance: 0 });
    }

    const [freeRemaining, paidBalance] = await Promise.all([
      getFreeQuotaRemaining(organizationId),
      getAvailableCredits(organizationId),
    ]);

    return NextResponse.json({ freeRemaining, freeLimit: freeEmailsPerMonth(), paidBalance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ freeRemaining: 0, freeLimit: freeEmailsPerMonth(), paidBalance: 0, error: message });
  }
}
