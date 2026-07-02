import { type NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/email/callback';

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, 'google');
}
