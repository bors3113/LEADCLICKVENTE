import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getOrgId } from '@/lib/org';
import { chargeCredits, getAvailableCredits } from '@/lib/email/credits';
import { getFreeQuotaRemaining } from '@/lib/email/quota';

// POST /api/campaigns/draft — generate a cold-email subject + body with
// {{name}}/{{company}} merge tokens via OpenRouter. Costs 1 credit (like the
// LinkedIn copilot draft).

interface DraftBody {
  offer?: string;
  tone?: string;
  recipientSample?: { name?: string | null; company?: string | null };
}

const DRAFT_COST = 1;

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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI drafting is not configured.' }, { status: 501 });
    }

    // AI drafting is a paid-tier feature: blocked while the org still has
    // unused free monthly emails, so a free campaign can't use AI.
    const freeRemaining = await getFreeQuotaRemaining(organizationId);
    if (freeRemaining > 0) {
      return NextResponse.json(
        {
          error: 'AI drafting unlocks once your free monthly emails are used. Buy credits or keep sending manually.',
          freeRemaining,
        },
        { status: 403 }
      );
    }

    const { offer, tone, recipientSample } = (await request.json()) as DraftBody;

    const available = await getAvailableCredits(organizationId);
    if (available < DRAFT_COST) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: DRAFT_COST, available, shortfall: DRAFT_COST - available },
        { status: 402 }
      );
    }

    const system =
      'You write concise, high-converting B2B cold emails. Return STRICT JSON only, ' +
      'no markdown, shaped as {"subject": string, "body": string}. Use the merge tokens ' +
      '{{name}} and {{company}} where appropriate. Keep the body under 120 words, plain text, ' +
      'with a clear single call to action. Do not include a signature or unsubscribe line.';

    const user_prompt =
      `Offer / value proposition: ${offer || 'a relevant B2B service'}\n` +
      `Desired tone: ${tone || 'professional and friendly'}\n` +
      `Example recipient: name=${recipientSample?.name ?? 'unknown'}, ` +
      `company=${recipientSample?.company ?? 'unknown'}.`;

    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user_prompt },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));
    const content = data?.choices?.[0]?.message?.content;
    if (!res.ok || !content) {
      return NextResponse.json({ error: 'AI drafting failed' }, { status: 502 });
    }

    let subject = '';
    let body = '';
    try {
      const parsed = JSON.parse(
        String(content).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
      );
      subject = String(parsed.subject || '').trim();
      body = String(parsed.body || '').trim();
    } catch {
      // Model didn't return clean JSON; fall back to using the raw text as body.
      body = String(content).trim();
    }
    if (!subject && !body) {
      return NextResponse.json({ error: 'AI returned an empty draft' }, { status: 502 });
    }

    // Charge only after we have a usable draft.
    await chargeCredits(organizationId, DRAFT_COST);

    return NextResponse.json({ subject, body });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Draft failed';
    console.error('Campaign draft error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
