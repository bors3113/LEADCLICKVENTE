import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import path from 'path';
import fs from 'fs';

const RESULTS_DIR = path.resolve(process.cwd(), '..', 'results');

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');

  if (!file) return NextResponse.json({ error: 'file param required' }, { status: 400 });

  // Sanitize: only allow alphanumeric, dash, underscore, dot — no path traversal
  if (!/^[\w\-. ]+\.(xlsx|csv)$/.test(file)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(RESULTS_DIR, file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const isExcel = file.endsWith('.xlsx');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': isExcel
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
      'Content-Disposition': `attachment; filename="${file}"`,
    },
  });
}
