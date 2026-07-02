import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { contentTypeFor } from '@/lib/localResults';
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

function streamLocal(localName: string | null, disposition: 'attachment' | 'inline') {
  if (!localName || !/^[\w\-. ]+\.(xlsx|csv)$/.test(localName) || !localName.includes('_linkedin_')) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  const filePath = path.join(RESULTS_DIR, localName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': contentTypeFor(localName),
      'Content-Disposition': `${disposition}; filename="${localName}"`,
    },
  });
}

// By default returns a presigned R2 URL for an enriched object (by `key`), or
// streams the local file (by `file`) as a fallback when R2 is unavailable.
// With `?stream=1`, always proxies the bytes through this same-origin route
// instead — browsers can't `fetch()` presigned R2 URLs directly (no CORS on
// the bucket), so callers that need to read the bytes client-side (e.g. the
// Data Editor) must use the streaming mode rather than fetching `url` directly.
// Only serves the `enriched/` prefix and `_linkedin_` files to prevent
// arbitrary key access.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const file = searchParams.get('file');
  const stream = searchParams.get('stream') === '1';

  if (key && !/^enriched\/[\w\-. ]+\.(xlsx|csv)$/.test(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  const r2 = key ? getR2Client() : null;

  if (stream) {
    if (r2) {
      const bucket = process.env.R2_BUCKET || 'leadsclickvente';
      const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key! }));
      if (!object.Body) {
        return NextResponse.json({ error: 'Empty object returned from storage' }, { status: 502 });
      }
      const body = await object.Body.transformToByteArray();
      const filename = key!.split('/').pop()!;
      return new NextResponse(Buffer.from(body), {
        headers: {
          'Content-Type': contentTypeFor(filename),
          'Content-Disposition': `inline; filename="${filename}"`,
        },
      });
    }
    return streamLocal(file || (key ? key.split('/').pop()! : null), 'inline');
  }

  // Prefer R2 when a key is provided.
  if (key && r2) {
    const bucket = process.env.R2_BUCKET || 'leadsclickvente';
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
    return NextResponse.json({ url, filename: key.split('/').pop() });
  }

  // Local fallback: stream the file from results/.
  return streamLocal(file || (key ? key.split('/').pop()! : null), 'attachment');
}
