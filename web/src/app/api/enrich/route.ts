import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

type EnrichType = 'employees' | 'profile';
type CascadeScope = 'all' | 'capped' | 'decision-makers';

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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { filename, types, scope, profileCap } = body as {
      filename: string;
      types: EnrichType[];
      scope?: CascadeScope;
      profileCap?: number;
    };

    if (!filename || !types || types.length === 0) {
      return NextResponse.json({ error: 'filename and types are required' }, { status: 400 });
    }

    const organizationId = await getOrgId(supabase, user.id);

    const backendUrl = process.env.SCRAPER_URL || process.env.BACKEND_URL || 'http://localhost:3008';
    const backendApiKey = process.env.SCRAPER_API_KEY || process.env.API_KEY || '';

    const backendRes = await fetch(`${backendUrl}/api/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(backendApiKey ? { 'X-API-Key': backendApiKey } : {}),
      },
      body: JSON.stringify({
        filename,
        types,
        ...(scope ? { scope } : {}),
        ...(Number.isInteger(profileCap) ? { profileCap } : {}),
        ...(organizationId ? { organizationId } : {}),
      }),
    });

    const result = await backendRes.json().catch(() => ({ error: 'Enrichment backend error' }));

    // Pass the backend status through — notably 402 (insufficient credits) so the
    // UI can prompt the user to buy more, using result.required/available/shortfall.
    // On success the backend responds as soon as the job is created (202) and
    // keeps enriching in the background — see runEnrichmentJob in
    // scraperController.js — so this resolves quickly regardless of how long
    // the underlying Apify run takes. The frontend polls GET
    // /api/enrich/status?jobId= for progress instead of waiting on this call.
    if (!backendRes.ok) {
      return NextResponse.json(result, { status: backendRes.status });
    }

    return NextResponse.json(result, { status: backendRes.status });

  } catch (error: any) {
    console.error('Enrich API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getOrgId(supabase, user.id);
    if (!organizationId) {
      return NextResponse.json({ paygBalance: 0, bundledRemaining: 0, totalAvailable: 0 });
    }

    // PAYG enrichment credit balance (top-ups). Same source the backend enforces.
    const { data: org } = await supabase
      .from('organizations')
      .select('enrichment_credit_balance')
      .eq('id', organizationId)
      .single();

    const paygBalance = org?.enrichment_credit_balance ?? 0;

    return NextResponse.json({
      paygBalance,
      bundledRemaining: 0,
      totalAvailable: paygBalance,
    });
  } catch (error: any) {
    return NextResponse.json({ paygBalance: 0, bundledRemaining: 0, totalAvailable: 0, error: error.message });
  }
}
