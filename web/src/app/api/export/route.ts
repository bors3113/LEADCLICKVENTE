import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const format = searchParams.get('format') ?? 'csv';

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const records = await prisma.extracted_records.findMany({
      where: { job_id: jobId },
    });

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No records found for this job' }, { status: 404 });
    }

    const rows = records.map(record => {
      const raw = (record.raw_data ?? {}) as Record<string, any>;
      const emails: string[] = raw.contactInfo?.emails ?? [];
      const social = raw.contactInfo?.socialMedia ?? {};
      return {
        BusinessName: record.business_name || raw.name || '',
        Address: record.address || raw.address || '',
        Phone: record.phone || raw.phone || '',
        Website: record.website || raw.link || '',
        Email: emails.slice(0, 3).join('; '),
        Facebook: (social.facebook ?? []).join('; '),
        Instagram: (social.instagram ?? []).join('; '),
        LinkedIn: (social.linkedin ?? []).join('; '),
        Rating: record.rating || raw.rating || '',
        ExtractedAt: record.created_at,
      };
    });

    if (format === 'excel' || format === 'sql') {
      return NextResponse.json({ rows });
    }

    // CSV: return directly as download (Supabase Storage removed)
    const csvStr = Papa.unparse(rows);
    return new NextResponse(csvStr, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="job_${jobId}.csv"`,
      },
    });

  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
