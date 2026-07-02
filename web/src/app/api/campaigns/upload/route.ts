import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getOrgId } from '@/lib/org';
import { extractRecipientsFromBuffer, filterSuppressed } from '@/lib/email/recipients';

// POST /api/campaigns/upload  (multipart/form-data, field "file")
// Lets a user bring their own CSV/Excel lead list instead of picking from an
// existing scrape/enrichment result file. Parsed in-memory only — nothing is
// written to R2 or disk. Response shape matches GET /api/campaigns/recipients
// so the frontend can treat both recipient sources identically.

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = /\.(csv|xlsx|xls)$/i;

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

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'A "file" upload is required' }, { status: 400 });
    }
    if (!ALLOWED_EXTENSIONS.test(file.name)) {
      return NextResponse.json({ error: 'Only .csv, .xlsx, or .xls files are supported' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large (10MB max)' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const all = await extractRecipientsFromBuffer(buffer, file.name);
    const { recipients, suppressedCount } = await filterSuppressed(organizationId, all);

    return NextResponse.json({
      total: all.length,
      suppressed: suppressedCount,
      recipients,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse uploaded file';
    console.error('Upload recipients error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
