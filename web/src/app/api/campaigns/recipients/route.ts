import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getOrgId } from '@/lib/org';
import { extractRecipients, filterSuppressed } from '@/lib/email/recipients';

// GET /api/campaigns/recipients?key=enriched/…  (or ?file=<basename>)
// Returns mailable recipients from a result file, minus suppressed addresses.
export async function GET(request: NextRequest) {
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

    const key = request.nextUrl.searchParams.get('key');
    const file = request.nextUrl.searchParams.get('file');
    if (!key && !file) {
      return NextResponse.json({ error: 'key or file is required' }, { status: 400 });
    }

    const all = await extractRecipients(key, file);
    const { recipients, suppressedCount } = await filterSuppressed(organizationId, all);

    return NextResponse.json({
      total: all.length,
      suppressed: suppressedCount,
      recipients,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read recipients';
    console.error('Recipients error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
