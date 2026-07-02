import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  GOOGLE,
  MICROSOFT,
  GOOGLE_SCOPES,
  MICROSOFT_SCOPES,
  redirectUri,
  verifyState,
  type Provider,
} from './oauth-config';
import { encryptToken } from './tokens';

// Shared OAuth callback: verify state, exchange code, fetch the account email,
// store encrypted tokens, and redirect back to settings.

function settingsRedirect(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/dashboard/settings', request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

interface TokenExchange {
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number;
  scope: string | null;
}

async function exchangeCode(provider: Provider, code: string): Promise<TokenExchange> {
  const cfg = provider === 'google' ? GOOGLE : MICROSOFT;
  const params = new URLSearchParams({
    client_id: cfg.clientId(),
    client_secret: cfg.clientSecret(),
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(provider),
  });
  if (provider === 'microsoft') params.set('scope', MICROSOFT_SCOPES.join(' '));

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token exchange failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresInSec: Number(data.expires_in) || 3600,
    scope: data.scope ?? null,
  };
}

async function fetchAccount(
  provider: Provider,
  accessToken: string
): Promise<{ email: string; name: string | null }> {
  if (provider === 'google') {
    const res = await fetch(GOOGLE.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.email) throw new Error('Failed to fetch Google account email.');
    return { email: String(data.email).toLowerCase(), name: data.name ?? null };
  }
  const res = await fetch(MICROSOFT.meUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  const email = data.mail || data.userPrincipalName;
  if (!res.ok || !email) throw new Error('Failed to fetch Microsoft account email.');
  return { email: String(email).toLowerCase(), name: data.displayName ?? null };
}

export async function handleOAuthCallback(
  request: NextRequest,
  provider: Provider
): Promise<NextResponse> {
  const sp = request.nextUrl.searchParams;
  const error = sp.get('error');
  if (error) {
    return settingsRedirect(request, { mailbox_error: sp.get('error_description') || error });
  }

  const code = sp.get('code');
  const state = sp.get('state');
  if (!code || !state) {
    return settingsRedirect(request, { mailbox_error: 'Missing code or state.' });
  }

  const payload = verifyState(state);
  if (!payload || payload.provider !== provider) {
    return settingsRedirect(request, { mailbox_error: 'Invalid or expired authorization state.' });
  }

  try {
    const tokens = await exchangeCode(provider, code);
    const account = await fetchAccount(provider, tokens.accessToken);

    const scopes = (tokens.scope ?? (provider === 'google' ? GOOGLE_SCOPES : MICROSOFT_SCOPES).join(' '))
      .split(' ')
      .filter(Boolean);

    const data = {
      organization_id: payload.orgId,
      user_id: payload.userId,
      provider,
      email: account.email,
      display_name: account.name,
      access_token_enc: encryptToken(tokens.accessToken),
      token_expires_at: new Date(Date.now() + tokens.expiresInSec * 1000),
      scopes,
      status: 'active' as const,
      // Only overwrite the stored refresh token if the provider returned one
      // (Google omits it when the user has previously consented).
      ...(tokens.refreshToken ? { refresh_token_enc: encryptToken(tokens.refreshToken) } : {}),
    };

    await prisma.mailboxes.upsert({
      where: { organization_id_email: { organization_id: payload.orgId, email: account.email } },
      create: data,
      update: data,
    });

    return settingsRedirect(request, { mailbox_connected: account.email });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to connect mailbox.';
    return settingsRedirect(request, { mailbox_error: message });
  }
}
