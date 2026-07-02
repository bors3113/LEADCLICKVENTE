// Minimal RFC-822 MIME builder for a single HTML+text email.
// Includes a List-Unsubscribe header (RFC 2369 / one-click RFC 8058).

export interface BuildMimeInput {
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
}

function encodeHeaderWord(value: string): string {
  // RFC 2047 encode if non-ASCII, else pass through.
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function formatAddress(email: string, name?: string | null): string {
  if (!name) return email;
  return `${encodeHeaderWord(name)} <${email}>`;
}

function boundary(): string {
  return `----=_LCV_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function buildMime(input: BuildMimeInput): string {
  const b = boundary();
  const headers: string[] = [
    `From: ${formatAddress(input.fromEmail, input.fromName)}`,
    `To: ${formatAddress(input.toEmail, input.toName)}`,
    `Subject: ${encodeHeaderWord(input.subject)}`,
    'MIME-Version: 1.0',
  ];
  if (input.unsubscribeUrl) {
    headers.push(`List-Unsubscribe: <${input.unsubscribeUrl}>`);
    headers.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  }
  headers.push(`Content-Type: multipart/alternative; boundary="${b}"`);

  const body = [
    `--${b}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(input.text, 'utf8').toString('base64'),
    '',
    `--${b}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(input.html, 'utf8').toString('base64'),
    '',
    `--${b}--`,
    '',
  ].join('\r\n');

  return headers.join('\r\n') + '\r\n\r\n' + body;
}

export function base64Url(raw: string): string {
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
