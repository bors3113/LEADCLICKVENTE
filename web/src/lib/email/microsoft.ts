import { MICROSOFT } from './oauth-config';
import type { BuildMimeInput } from './mime';
import type { SendResult } from './google';

// Send via Microsoft Graph. `accessToken` must carry Mail.Send.
// POST /me/sendMail with a JSON message object. Graph returns 202 Accepted
// with no body and no message id, so providerMessageId is null here.

export async function sendOutlook(
  accessToken: string,
  message: BuildMimeInput
): Promise<SendResult> {
  const headers: { name: string; value: string }[] = [];
  if (message.unsubscribeUrl) {
    headers.push({ name: 'List-Unsubscribe', value: `<${message.unsubscribeUrl}>` });
    headers.push({ name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' });
  }

  const payload = {
    message: {
      subject: message.subject,
      body: { contentType: 'HTML', content: message.html },
      toRecipients: [
        {
          emailAddress: {
            address: message.toEmail,
            ...(message.toName ? { name: message.toName } : {}),
          },
        },
      ],
      ...(headers.length ? { internetMessageHeaders: headers } : {}),
    },
    saveToSentItems: true,
  };

  const res = await fetch(MICROSOFT.sendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status !== 202 && !res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message || `Outlook send failed (${res.status})`;
    throw new Error(msg);
  }
  // Graph sendMail does not return a message id.
  return { providerMessageId: null, threadId: null };
}
