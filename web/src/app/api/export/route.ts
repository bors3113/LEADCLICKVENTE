import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
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

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Fetch extracted records for the job
    const { data: records, error } = await supabase
      .from('extracted_records')
      .select('*')
      .eq('job_id', jobId);

    if (error) {
      throw error;
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No records found for this job' }, { status: 404 });
    }

    // Format data for CSV
    const formattedData = records.map(record => ({
      BusinessName: record.business_name || '',
      Address: record.address || record.raw_data?.address || '',
      Phone: record.phone || record.raw_data?.phone || '',
      Website: record.website || record.raw_data?.link || '',
      Rating: record.rating || record.raw_data?.rating || '',
      ExtractedAt: record.created_at,
    }));

    const csvStr = Papa.unparse(formattedData);

    // Upload to Supabase Storage
    const fileName = `exports/job_${jobId}_${Date.now()}.csv`;
    
    // Note: This requires a bucket named 'exports' to exist in Supabase
    // If the bucket doesn't exist, we can just return the CSV string directly,
    // but the task specifically says "Integrate Supabase Storage for file exports".
    
    const { error: uploadError } = await supabase
      .storage
      .from('exports') // Requires bucket setup
      .upload(fileName, csvStr, {
        contentType: 'text/csv',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      
      // Fallback: Return raw CSV directly if storage upload fails (e.g., bucket missing)
      return new NextResponse(csvStr, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="job_${jobId}.csv"`,
        },
      });
    }

    // Get signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('exports')
      .createSignedUrl(fileName, 60 * 60); // 1 hour expiry

    if (signedUrlError) {
      throw signedUrlError;
    }

    return NextResponse.json({ url: signedUrlData.signedUrl });

  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
