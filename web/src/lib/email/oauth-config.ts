import crypto from 'crypto';

// OAuth configuration for the two supported mailbox providers.
// Verify scopes/endpoints against current Google & Microsoft docs before prod.

export type Provider = 'google' | 'microsoft';

export function isProvider(v: string | null | undefined): v is Provider {
  return v === 'google' || v === 'microsoft';
}

function baseUrl(): string {
  // Public origin of the web app, used to build OAuth redirect URIs.
  return (
    process.env.OAUTH_REDIRECT_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function redirectUri(provider: Provider): string {
  return `${baseUrl()}/api/mailboxes/callback/${provider}`;
}

// Minimal scopes: send-only for MVP (no inbox read → avoids restricted-scope review).
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
  'profile',
];

export const MICROSOFT_SCOPES = [
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
  'openid',
  'email',
  'profile',
];

export const GOOGLE = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
  clientId: () => process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  clientSecret: () => process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
};

export const MICROSOFT = {
  // /common supports both work/school and personal Microsoft accounts.
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  meUrl: 'https://graph.microsoft.com/v1.0/me',
  sendUrl: 'https://graph.microsoft.com/v1.0/me/sendMail',
  clientId: () => process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
  clientSecret: () => process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '',
};

export function providerConfigured(provider: Provider): boolean {
  return provider === 'google'
    ? Boolean(GOOGLE.clientId() && GOOGLE.clientSecret())
    : Boolean(MICROSOFT.clientId() && MICROSOFT.clientSecret());
}

// --- Signed OAuth `state` (binds org/user + CSRF nonce) -------------------
// HMAC-signed with the token encryption key so we don't need a DB round-trip.

interface StatePayload {
  orgId: string;
  userId: string;
  provider: Provider;
  nonce: string;
  iat: number;
}

function stateSecret(): string {
  const s = process.env.EMAIL_TOKEN_ENC_KEY;
  if (!s) throw new Error('EMAIL_TOKEN_ENC_KEY is required to sign OAuth state.');
  return s;
}

export function signState(input: Omit<StatePayload, 'nonce' | 'iat'>): string {
  const payload: StatePayload = {
    ...input,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export function verifyState(state: string): StatePayload | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  // Constant-time compare.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
    if (Date.now() - payload.iat > STATE_MAX_AGE_MS) return null;
    if (!isProvider(payload.provider)) return null;
    return payload;
  } catch {
    return null;
  }
}
