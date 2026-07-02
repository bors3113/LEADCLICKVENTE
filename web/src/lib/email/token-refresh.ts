import { prisma } from '@/lib/prisma';
import { GOOGLE, MICROSOFT, GOOGLE_SCOPES, MICROSOFT_SCOPES, type Provider } from './oauth-config';
import { decryptToken, encryptToken } from './tokens';

// Returns a valid access token for a mailbox, refreshing (and persisting the
// new access token) if the stored one is expired or near expiry.

interface MailboxTokenRow {
  id: string;
  provider: Provider;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: Date | null;
}

const EXPIRY_SKEW_MS = 60 * 1000; // refresh a minute before actual expiry

export async function getValidAccessToken(mailbox: MailboxTokenRow): Promise<string> {
  const notExpired =
    mailbox.token_expires_at &&
    mailbox.token_expires_at.getTime() - EXPIRY_SKEW_MS > Date.now();

  if (notExpired && mailbox.access_token_enc) {
    return decryptToken(mailbox.access_token_enc);
  }

  if (!mailbox.refresh_token_enc) {
    throw new Error('Mailbox has no refresh token; reconnect required.');
  }
  const refreshToken = decryptToken(mailbox.refresh_token_enc);
  const refreshed = await refreshAccessToken(mailbox.provider, refreshToken);

  // Persist the new access token (+ possibly rotated refresh token).
  await prisma.mailboxes.update({
    where: { id: mailbox.id },
    data: {
      access_token_enc: encryptToken(refreshed.accessToken),
      token_expires_at: new Date(Date.now() + refreshed.expiresInSec * 1000),
      ...(refreshed.refreshToken
        ? { refresh_token_enc: encryptToken(refreshed.refreshToken) }
        : {}),
    },
  });

  return refreshed.accessToken;
}

interface RefreshResult {
  accessToken: string;
  expiresInSec: number;
  refreshToken?: string;
}

async function refreshAccessToken(provider: Provider, refreshToken: string): Promise<RefreshResult> {
  const cfg = provider === 'google' ? GOOGLE : MICROSOFT;
  const params = new URLSearchParams({
    client_id: cfg.clientId(),
    client_secret: cfg.clientSecret(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  if (provider === 'microsoft') {
    // Microsoft requires the scope on refresh.
    params.set('scope', MICROSOFT_SCOPES.join(' '));
  } else {
    params.set('scope', GOOGLE_SCOPES.join(' '));
  }

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Token refresh failed for ${provider}: ${data.error_description || data.error || res.status}`
    );
  }
  return {
    accessToken: data.access_token,
    expiresInSec: Number(data.expires_in) || 3600,
    refreshToken: data.refresh_token, // Google usually omits on refresh; MS may rotate.
  };
}
