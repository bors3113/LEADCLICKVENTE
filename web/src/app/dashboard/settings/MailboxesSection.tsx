'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Trash2 } from 'lucide-react';

type Mailbox = {
  id: string;
  provider: 'google' | 'microsoft';
  email: string;
  display_name: string | null;
  status: 'active' | 'revoked' | 'error' | null;
  daily_send_limit: number | null;
  sends_today: number | null;
  last_used_at: string | null;
  created_at: string | null;
};

function providerLabel(p: Mailbox['provider']) {
  return p === 'google' ? 'Gmail' : 'Outlook';
}

export default function MailboxesSection() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mailboxes');
      const data = await res.json();
      if (res.ok) setMailboxes(data.mailboxes ?? []);
      else setError(data.error ?? 'Failed to load mailboxes');
    } catch {
      setError('Failed to load mailboxes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Surface the connect/error result carried back on the settings URL.
    const sp = new URLSearchParams(window.location.search);
    const connected = sp.get('mailbox_connected');
    const err = sp.get('mailbox_error');
    if (connected) setNotice(`Connected ${connected}.`);
    if (err) setError(err);
    if (connected || err) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [load]);

  const disconnect = async (id: string, email: string) => {
    if (!window.confirm(`Disconnect ${email}? You will need to reconnect to send from it.`)) return;
    const res = await fetch(`/api/mailboxes/${id}`, { method: 'DELETE' });
    if (res.ok) setMailboxes((prev) => prev.filter((m) => m.id !== id));
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Failed to disconnect');
    }
  };

  return (
    <section className="bg-background rounded-lg border border-border p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Sending mailboxes</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Connect a Gmail or Outlook inbox to send outreach from your own address. Replies land
        in your real inbox. Each sent email costs enrichment credits.
      </p>

      {notice && <p className="mb-3 text-sm text-green-600">{notice}</p>}
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {/* These are OAuth redirect endpoints (they 302 to Google/Microsoft), so a
          plain <a> full-navigation is intended — not a prefetched next/link page. */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/mailboxes/connect?provider=google"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 transition"
        >
          <Mail className="h-4 w-4" /> Connect Gmail
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/mailboxes/connect?provider=microsoft"
          className="inline-flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-muted/70 transition border border-border"
        >
          <Mail className="h-4 w-4" /> Connect Outlook
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : mailboxes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No mailboxes connected yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {mailboxes.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {m.email}{' '}
                  <span className="text-xs text-muted-foreground">({providerLabel(m.provider)})</span>
                  {m.status !== 'active' && (
                    <span className="ml-2 text-xs text-red-500">· {m.status}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Sent today {m.sends_today ?? 0}/{m.daily_send_limit ?? 50}
                </div>
              </div>
              <button
                type="button"
                onClick={() => disconnect(m.id, m.email)}
                className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition"
              >
                <Trash2 className="h-4 w-4" />
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
