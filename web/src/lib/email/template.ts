import crypto from 'crypto';

// Merge-token rendering and compliance footer for outreach emails.

export interface RecipientVars {
  email: string;
  name?: string | null;
  company?: string | null;
  [key: string]: unknown;
}

// Replace {{name}}, {{company}}, {{email}}, and any {{raw_column}} token.
export function renderTemplate(template: string, vars: RecipientVars): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, keyRaw: string) => {
    const key = keyRaw.toLowerCase();
    if (key === 'email') return vars.email ?? '';
    if (key === 'name') return (vars.name as string) ?? '';
    if (key === 'company') return (vars.company as string) ?? '';
    const v = vars[keyRaw] ?? vars[key];
    return v != null ? String(v) : '';
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Turn a plain-text body into simple HTML (newlines → <br>).
export function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>\n');
}

function baseUrl(): string {
  return (
    process.env.OAUTH_REDIRECT_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

// Signed one-click unsubscribe URL (no DB lookup needed to validate).
export function unsubscribeUrl(organizationId: string, email: string): string {
  const body = Buffer.from(JSON.stringify({ o: organizationId, e: email })).toString('base64url');
  const secret = process.env.EMAIL_TOKEN_ENC_KEY || '';
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${baseUrl()}/unsubscribe?token=${body}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): { orgId: string; email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const secret = process.env.EMAIL_TOKEN_ENC_KEY || '';
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { o, e } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!o || !e) return null;
    return { orgId: String(o), email: String(e) };
  } catch {
    return null;
  }
}

// Append the compliance footer (text + html variants).
export function withFooter(
  text: string,
  html: string,
  unsubUrl: string,
  senderName?: string | null
): { text: string; html: string } {
  const who = senderName ? `${senderName}` : 'the sender';
  const textFooter =
    `\n\n—\nYou received this email because it was sent by ${who}. ` +
    `If you'd prefer not to receive these, unsubscribe here: ${unsubUrl}`;
  const htmlFooter =
    `<br><br><hr style="border:none;border-top:1px solid #ddd">` +
    `<p style="font-size:12px;color:#888">You received this email because it was sent by ` +
    `${escapeHtml(who)}. <a href="${unsubUrl}">Unsubscribe</a>.</p>`;
  return { text: text + textFooter, html: html + htmlFooter };
}
