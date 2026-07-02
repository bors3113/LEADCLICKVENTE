import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/email/template';

// Public one-click unsubscribe. The token is HMAC-signed (no auth needed).
// Handles both GET (link click) and POST (RFC 8058 one-click).
async function handle(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');
  const parsed = token ? verifyUnsubscribeToken(token) : null;
  if (!parsed) {
    return new NextResponse('Invalid or expired unsubscribe link.', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const email = parsed.email.toLowerCase();
  try {
    await prisma.unsubscribes.upsert({
      where: { organization_id_email: { organization_id: parsed.orgId, email } },
      create: { organization_id: parsed.orgId, email, reason: 'user_unsubscribe' },
      update: {},
    });
  } catch (e) {
    console.error('Unsubscribe write failed:', e instanceof Error ? e.message : e);
  }

  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;max-width:480px;margin:80px auto;text-align:center">
      <h2>You're unsubscribed</h2>
      <p>${email} will no longer receive emails from this sender.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
