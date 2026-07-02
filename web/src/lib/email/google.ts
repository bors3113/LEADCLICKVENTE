import { buildMime, base64Url, type BuildMimeInput } from './mime';

// Send via the Gmail API. `accessToken` must carry the gmail.send scope.
// POST /gmail/v1/users/me/messages/send  { raw: base64url(MIME) }

const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export interface SendResult {
  providerMessageId: string | null;
  threadId: string | null;
}

export async function sendGmail(
  accessToken: string,
  message: BuildMimeInput
): Promise<SendResult> {
  const mime = buildMime(message);
  const raw = base64Url(mime);

  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Gmail send failed (${res.status})`;
    throw new Error(msg);
  }
  return {
    providerMessageId: data.id ?? null,
    threadId: data.threadId ?? null,
  };
}
