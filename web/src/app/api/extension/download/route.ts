import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ZipArchive } from 'archiver';
import path from 'path';
import fs from 'fs';
import { PassThrough } from 'stream';

// Streams the extension/ folder (repo root, one level up from web/) as a zip
// so users can "Load unpacked" it in chrome://extensions without needing the
// full repo checked out.
const EXTENSION_DIR = path.resolve(process.cwd(), '..', 'extension');

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!fs.existsSync(EXTENSION_DIR)) {
    return NextResponse.json({ error: 'Extension bundle not found' }, { status: 404 });
  }

  const stream = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err: Error) => stream.destroy(err));
  archive.pipe(stream);
  // Nest under "extension/" so unzipping doesn't dump files loose into Downloads.
  archive.directory(EXTENSION_DIR, 'extension');
  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="leadclickvente-linkedin-copilot.zip"',
    },
  });
}
