import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { RESULTS_DIR, findLocalFile, contentTypeFor } from '@/lib/localResults';
import fs from 'fs';
import path from 'path';

function getR2Client() {
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

// Default: returns { url, filename } where url is a same-origin streaming URL
// (?stream=1) — browsers can't fetch R2 presigned URLs directly (no CORS on the
// bucket), so the file bytes are always proxied through this route instead.
export async function GET(
  request: Request,
  ctx: RouteContext<'/api/results/[jobId]/file'>
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await ctx.params;
    const stream = new URL(request.url).searchParams.get('stream') === '1';

    const job = await prisma.scraping_jobs.findUnique({
      where: { id: jobId },
      select: { id: true, config: true, status: true, completed_at: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const config = (job.config ?? {}) as Record<string, unknown>;
    const resultFile = config.resultFile as string | undefined;
    let localFile = config.localFile as string | undefined;
    const query = config.query as string | undefined;

    if (!resultFile && !localFile && query) {
      localFile = findLocalFile(query, job.completed_at) ?? undefined;
    }

    if (!resultFile && !localFile) {
      return NextResponse.json(
        { error: 'No result file found for this job.' },
        { status: 404 }
      );
    }

    const filename = resultFile ? resultFile.split('/').pop()! : localFile!;

    if (!stream) {
      return NextResponse.json({
        url: `/api/results/${jobId}/file?stream=1`,
        filename,
      });
    }

    let body: Uint8Array;

    if (resultFile) {
      const r2 = getR2Client();
      if (!r2) {
        return NextResponse.json(
          { error: 'R2 storage is not configured (missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY)' },
          { status: 503 }
        );
      }
      const bucket = process.env.R2_BUCKET || 'leadsclickvente';
      const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: resultFile }));
      if (!object.Body) {
        return NextResponse.json({ error: 'Empty object returned from storage' }, { status: 502 });
      }
      body = await object.Body.transformToByteArray();
    } else {
      // Local file — same sanitization as /api/download: no path traversal
      if (!/^[\w\-. ]+\.(xlsx|csv)$/.test(localFile!)) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
      }
      const filePath = path.join(RESULTS_DIR, localFile!);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
      }
      body = fs.readFileSync(filePath);
    }

    return new NextResponse(Buffer.from(body), {
      headers: {
        'Content-Type': contentTypeFor(filename),
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Result file error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
