import { getValidAccessToken } from './token-refresh';
import { sendGmail, type SendResult } from './google';
import { sendOutlook } from './microsoft';
import type { BuildMimeInput } from './mime';
import type { Provider } from './oauth-config';

export type { SendResult } from './google';
export type { BuildMimeInput } from './mime';

interface MailboxForSend {
  id: string;
  provider: Provider;
  email: string;
  display_name: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: Date | null;
}

// Refreshes the mailbox's access token if needed, then sends via the right provider.
export async function sendEmail(
  mailbox: MailboxForSend,
  message: Omit<BuildMimeInput, 'fromEmail' | 'fromName'>
): Promise<SendResult> {
  const accessToken = await getValidAccessToken(mailbox);
  const full: BuildMimeInput = {
    ...message,
    fromEmail: mailbox.email,
    fromName: mailbox.display_name,
  };
  return mailbox.provider === 'google'
    ? sendGmail(accessToken, full)
    : sendOutlook(accessToken, full);
}
