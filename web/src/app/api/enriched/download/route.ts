import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

const RESULTS_DIR = path.resolve(process.cwd(), '..', 'results');

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Returns a presigned R2 URL for an enriched object (by `key`), or streams the
// local file (by `file`) as a fallback when R2 is unavailable. Only serves the
// `enriched/` prefix and `_linkedin_` files to prevent arbitrary key access.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const file = searchParams.get('file');

  // Prefer R2 when a key is provided.
  if (key) {
    if (!/^enriched\/[\w\-. ]+\.(xlsx|csv)$/.test(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }
    const r2 = getR2Client();
    if (r2) {
      const bucket = process.env.R2_BUCKET || 'leadsclickvente';
      const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
      return NextResponse.json({ url, filename: key.split('/').pop() });
    }
    // R2 not configured — try the local copy by basename.
  }

  // Local fallback: stream the file from results/.
  const localName = file || (key ? key.split('/').pop() : null);
  if (!localName || !/^[\w\-. ]+\.(xlsx|csv)$/.test(localName) || !localName.includes('_linkedin_')) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const filePath = path.join(RESULTS_DIR, localName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const isExcel = localName.endsWith('.xlsx');
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': isExcel
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
      'Content-Disposition': `attachment; filename="${localName}"`,
    },
  });
}
