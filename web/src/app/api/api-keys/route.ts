import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// API keys for the LinkedIn Copilot Chrome extension. The plaintext key
// (lcv_...) is returned once at creation; only its SHA-256 hash is stored.

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

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getOrgId(supabase, user.id);
    if (!organizationId) {
      return NextResponse.json({ keys: [] });
    }

    const keys = await prisma.api_keys.findMany({
      where: { organization_id: organizationId },
      select: { id: true, name: true, created_at: true, last_used_at: true },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ keys });
  } catch (error: any) {
    console.error('API keys GET error:', error);
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

    const organizationId = await getOrgId(supabase, user.id);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found for this account' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    if (!name || name.length > 100) {
      return NextResponse.json({ error: 'A key name (max 100 chars) is required' }, { status: 400 });
    }

    const key = `lcv_${crypto.randomBytes(32).toString('base64url')}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const record = await prisma.api_keys.create({
      data: {
        organization_id: organizationId,
        name,
        key_hash: keyHash,
      },
      select: { id: true, name: true, created_at: true },
    });

    // The plaintext key exists only in this response — it is never retrievable again.
    return NextResponse.json({ ...record, key });
  } catch (error: any) {
    console.error('API keys POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
