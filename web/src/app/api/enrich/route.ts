import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Credit cost per successfully enriched row, per type. These mirror the
// values in src/config/index.js — keep them in sync or move to a shared env.
const CREDIT_COST: Record<string, number> = {
  company: parseInt(process.env.APIFY_CREDIT_COST_COMPANY || '1', 10),
  employees: parseInt(process.env.APIFY_CREDIT_COST_EMPLOYEES || '2', 10),
  profile: parseInt(process.env.APIFY_CREDIT_COST_PROFILE || '4', 10),
};

type EnrichType = 'company' | 'employees' | 'profile';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { filename, types, estimatedRows } = body as {
      filename: string;
      types: EnrichType[];
      estimatedRows?: number;
    };

    if (!filename || !types || types.length === 0) {
      return NextResponse.json(
        { error: 'filename and types are required' },
        { status: 400 }
      );
    }

    // Resolve the user's organization.
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!membership?.organization_id) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 403 });
    }

    const orgId: string = membership.organization_id;
    const rowCount = estimatedRows ?? 0;

    // Estimate cost so we can gate before calling Apify (real charge is per success).
    const estimatedCredits = types.reduce((sum: number, t: EnrichType) => {
      return sum + rowCount * (CREDIT_COST[t] ?? 1);
    }, 0);

    // --- Quota check ---
    // 1. Find the org's active subscription → plan → enrichment_credit_limit.
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_sub_id, status')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let planQuota = 0;
    if (subscription) {
      const { data: plan } = await supabase
        .from('plans')
        .select('enrichment_credit_limit')
        .eq('stripe_price_id', subscription.stripe_sub_id)
        .maybeSingle();
      planQuota = plan?.enrichment_credit_limit ?? 0;
    }

    // 2. How many bundled credits have been used this billing period?
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('enrichment_credits_used')
      .eq('organization_id', orgId)
      .gte('billing_period_start', periodStart.toISOString())
      .order('billing_period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    const usedThisPeriod = usage?.enrichment_credits_used ?? 0;
    const bundledRemaining = Math.max(0, planQuota - usedThisPeriod);

    // 3. PAYG balance from the org.
    const { data: org } = await supabase
      .from('organizations')
      .select('enrichment_credit_balance')
      .eq('id', orgId)
      .single();

    const paygBalance = org?.enrichment_credit_balance ?? 0;

    const totalAvailable = bundledRemaining + paygBalance;

    if (estimatedCredits > 0 && totalAvailable < estimatedCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient enrichment credits',
          estimatedCost: estimatedCredits,
          available: totalAvailable,
          bundledRemaining,
          paygBalance,
        },
        { status: 402 }
      );
    }

    // --- Forward to Express backend for the actual Apify enrichment ---
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3008';
    const backendApiKey = process.env.API_KEY || '';

    const backendRes = await fetch(`${backendUrl}/api/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(backendApiKey ? { 'X-API-Key': backendApiKey } : {}),
      },
      body: JSON.stringify({ filename, types, organizationId: orgId }),
    });

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({ error: 'Enrichment backend error' }));
      return NextResponse.json(err, { status: backendRes.status });
    }

    const result = await backendRes.json() as {
      enrichedCount: number;
      creditsByType: Record<string, number>;
      creditsCharged: number;
      fileName: string;
      downloadUrl: string;
      jobId: string | null;
    };

    const { creditsCharged, creditsByType } = result;

    // --- Debit credits (charge on success only, from backend result) ---
    if (creditsCharged > 0) {
      // First consume bundled quota, then PAYG balance.
      const fromBundled = Math.min(creditsCharged, bundledRemaining);
      const fromPayg = creditsCharged - fromBundled;

      if (fromBundled > 0) {
        // Upsert the usage_tracking row for this billing period.
        const { data: existingRow } = await supabase
          .from('usage_tracking')
          .select('id, enrichment_credits_used')
          .eq('organization_id', orgId)
          .eq('billing_period_start', periodStart.toISOString())
          .maybeSingle();

        if (existingRow) {
          await supabase
            .from('usage_tracking')
            .update({ enrichment_credits_used: ((existingRow as { enrichment_credits_used?: number }).enrichment_credits_used ?? 0) + fromBundled })
            .eq('id', (existingRow as { id: string }).id);
        } else {
          await supabase.from('usage_tracking').insert({
            organization_id: orgId,
            billing_period_start: periodStart.toISOString(),
            enrichment_credits_used: fromBundled,
            credits_used: 0,
          });
        }
      }

      if (fromPayg > 0) {
        await supabase
          .from('organizations')
          .update({ enrichment_credit_balance: Math.max(0, paygBalance - fromPayg) })
          .eq('id', orgId);
      }
    }

    return NextResponse.json({
      ...result,
      creditsCharged,
      creditsByType,
      bundledRemaining: Math.max(0, bundledRemaining - Math.min(creditsCharged, bundledRemaining)),
      paygBalance: Math.max(0, paygBalance - Math.max(0, creditsCharged - bundledRemaining)),
    });

  } catch (error: any) {
    console.error('Enrich API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Returns the caller's current enrichment credit balances without running anything.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!membership?.organization_id) {
      return NextResponse.json({ bundledRemaining: 0, paygBalance: 0, totalAvailable: 0 });
    }

    const orgId = membership.organization_id;

    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const [{ data: usage }, { data: org }] = await Promise.all([
      supabase
        .from('usage_tracking')
        .select('enrichment_credits_used')
        .eq('organization_id', orgId)
        .gte('billing_period_start', periodStart.toISOString())
        .order('billing_period_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('organizations')
        .select('enrichment_credit_balance')
        .eq('id', orgId)
        .single(),
    ]);

    const paygBalance = org?.enrichment_credit_balance ?? 0;
    const usedThisPeriod = usage?.enrichment_credits_used ?? 0;

    // We don't know the plan limit without a subscription lookup here, so return what we have.
    return NextResponse.json({
      paygBalance,
      usedThisPeriod,
      creditCosts: CREDIT_COST,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
