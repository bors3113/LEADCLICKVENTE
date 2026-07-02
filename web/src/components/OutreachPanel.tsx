'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Mail,
  Send,
  Sparkles,
  Coins,
  Gift,
  FileSpreadsheet,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

type EnrichedFile = { key: string; filename: string; label: string; source: 'r2' | 'local' };
type Mailbox = { id: string; email: string; provider: 'google' | 'microsoft'; status: string | null };
type Recipient = { email: string; name: string | null; company: string | null };
type RecipientSource = 'existing' | 'upload';

export function OutreachPanel() {
  const [files, setFiles] = useState<EnrichedFile[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [wallet, setWallet] = useState<number>(0);
  const [freeRemaining, setFreeRemaining] = useState<number>(0);
  const [freeLimit, setFreeLimit] = useState<number>(1000);

  const [source, setSource] = useState<RecipientSource>('existing');
  const [selectedKey, setSelectedKey] = useState('');
  const [uploadName, setUploadName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const [subject, setSubject] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [offer, setOffer] = useState('');
  const [drafting, setDrafting] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; freeSent: number; failed: number; charged: number } | null>(null);
  const [needCredits, setNeedCredits] = useState<{ required: number; available: number } | null>(null);

  const loadQuota = useCallback(async () => {
    const w = await fetch('/api/campaigns/send').then((r) => r.json());
    setWallet(w.paidBalance ?? 0);
    setFreeRemaining(w.freeRemaining ?? 0);
    setFreeLimit(w.freeLimit ?? 1000);
  }, []);

  // Initial load: enriched files, mailboxes, quota + wallet balance.
  useEffect(() => {
    (async () => {
      try {
        const [f, m] = await Promise.all([
          fetch('/api/enriched').then((r) => r.json()),
          fetch('/api/mailboxes').then((r) => r.json()),
        ]);
        setFiles(f.results ?? []);
        setMailboxes((m.mailboxes ?? []).filter((mb: Mailbox) => mb.status === 'active'));
        await loadQuota();
      } catch {
        setError('Failed to load outreach data');
      }
    })();
  }, [loadQuota]);

  const loadRecipients = useCallback(async (value: string) => {
    if (!value) {
      setRecipients([]);
      return;
    }
    setLoadingRecipients(true);
    setError(null);
    try {
      // Local-only files are passed as `local:<basename>`; R2 files as their key.
      const query = value.startsWith('local:')
        ? `file=${encodeURIComponent(value.slice('local:'.length))}`
        : `key=${encodeURIComponent(value)}`;
      const res = await fetch(`/api/campaigns/recipients?${query}`);
      const data = await res.json();
      if (res.ok) setRecipients(data.recipients ?? []);
      else setError(data.error ?? 'Failed to load recipients');
    } catch {
      setError('Failed to load recipients');
    } finally {
      setLoadingRecipients(false);
    }
  }, []);

  const onSelectFile = (key: string) => {
    setSelectedKey(key);
    setResult(null);
    setNeedCredits(null);
    loadRecipients(key);
  };

  const onUploadFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setNeedCredits(null);
    setError(null);
    setLoadingRecipients(true);
    setUploadName(file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/campaigns/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) setRecipients(data.recipients ?? []);
      else {
        setError(data.error ?? 'Failed to parse uploaded file');
        setRecipients([]);
      }
    } catch {
      setError('Failed to parse uploaded file');
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const resetUpload = () => {
    setUploadName('');
    setRecipients([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const switchSource = (next: RecipientSource) => {
    if (next === source) return;
    setSource(next);
    setSelectedKey('');
    setRecipients([]);
    resetUpload();
    setResult(null);
    setNeedCredits(null);
  };

  const draft = async () => {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer, recipientSample: recipients[0] ?? {} }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.subject) setSubject(data.subject);
        if (data.body) setBodyTemplate(data.body);
      } else if (res.status === 402) {
        setNeedCredits({ required: data.required, available: data.available });
      } else {
        setError(data.error ?? 'Draft failed');
      }
    } catch {
      setError('Draft failed');
    } finally {
      setDrafting(false);
    }
  };

  const send = async () => {
    if (!selectedMailbox || !subject.trim() || !bodyTemplate.trim() || recipients.length === 0) return;
    setSending(true);
    setError(null);
    setResult(null);
    setNeedCredits(null);
    try {
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId: selectedMailbox,
          subject,
          bodyTemplate,
          recipients,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ sent: data.sent, freeSent: data.freeSent ?? 0, failed: data.failed, charged: data.charged });
        await loadQuota();
      } else if (res.status === 402) {
        setNeedCredits({ required: data.required, available: data.available });
      } else {
        setError(data.error ?? 'Send failed');
      }
    } catch {
      setError('Send failed');
    } finally {
      setSending(false);
    }
  };

  const freeForBatch = Math.min(recipients.length, freeRemaining);
  const paidForBatch = recipients.length - freeForBatch;
  const aiLocked = freeRemaining > 0;
  const canSend =
    selectedMailbox && subject.trim() && bodyTemplate.trim() && recipients.length > 0 && !sending;

  return (
    <div className="space-y-6">
      {/* Quota + wallet + mailbox status */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
          <Gift className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Free this month:</span>
          <span className="font-semibold text-foreground">
            {freeRemaining.toLocaleString()} / {freeLimit.toLocaleString()}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
          <Coins className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Credits:</span>
          <span className="font-semibold text-foreground">{wallet.toLocaleString()}</span>
        </div>
        {mailboxes.length === 0 && (
          <div className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            No mailbox connected.{' '}
            <Link href="/dashboard/settings" className="underline font-medium">
              Connect one in Settings
            </Link>
          </div>
        )}
      </div>

      {/* Step 1: choose recipients */}
      <section className="rounded-lg border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">1. Choose your recipients</h2>
          </div>
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => switchSource('existing')}
              className={`px-3 py-1.5 rounded ${source === 'existing' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              From a result file
            </button>
            <button
              type="button"
              onClick={() => switchSource('upload')}
              className={`px-3 py-1.5 rounded ${source === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Upload my own list
            </button>
          </div>
        </div>

        {source === 'existing' ? (
          <select
            value={selectedKey}
            onChange={(e) => onSelectFile(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select an enriched file…</option>
            {files.map((f) => (
              <option key={f.key || f.filename} value={f.key || `local:${f.filename}`}>
                {f.label} ({f.filename})
              </option>
            ))}
          </select>
        ) : (
          <div>
            <label className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center cursor-pointer hover:border-primary/50 transition">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-foreground font-medium">
                {uploadName || 'Click to upload a CSV or Excel file'}
              </span>
              <span className="text-xs text-muted-foreground">.csv, .xlsx, .xls — 10MB max</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => onUploadFile(e.target.files?.[0])}
              />
            </label>
            {uploadName && (
              <button
                type="button"
                onClick={resetUpload}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Choose a different file
              </button>
            )}
          </div>
        )}

        {loadingRecipients ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading recipients…
          </p>
        ) : recipients.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{recipients.length}</span> mailable
            recipients found ·{' '}
            <span className="font-semibold text-foreground">{freeForBatch}</span> free
            {paidForBatch > 0 && (
              <>
                {' '}+ <span className="font-semibold text-foreground">{paidForBatch}</span> credits
              </>
            )}
          </p>
        ) : null}
      </section>

      {/* Step 2: mailbox */}
      <section className="rounded-lg border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">2. Send from</h2>
        </div>
        <select
          value={selectedMailbox}
          onChange={(e) => setSelectedMailbox(e.target.value)}
          disabled={mailboxes.length === 0}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          <option value="">Select a mailbox…</option>
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email} ({m.provider === 'google' ? 'Gmail' : 'Outlook'})
            </option>
          ))}
        </select>
      </section>

      {/* Step 3: message */}
      <section className="rounded-lg border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">3. Write your message</h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="What are you offering? (for AI draft)"
              disabled={aiLocked}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-64 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={draft}
              disabled={drafting || aiLocked}
              title={aiLocked ? 'AI drafting unlocks once your free monthly emails are used' : undefined}
              className="inline-flex items-center gap-1 bg-muted text-foreground px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-muted/70 transition border border-border disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI draft
            </button>
          </div>
        </div>
        {aiLocked && (
          <p className="mb-3 text-xs text-muted-foreground">
            AI drafting unlocks once your {freeLimit.toLocaleString()} free monthly emails are used —
            write your message manually for now, or{' '}
            <Link href="/billing" className="underline font-medium">buy credits</Link> to unlock it early.
          </p>
        )}

        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (supports {{name}}, {{company}})"
          className="w-full mb-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <textarea
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          placeholder="Hi {{name}}, I noticed {{company}}…"
          rows={10}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Merge tokens: <code>{'{{name}}'}</code>, <code>{'{{company}}'}</code>, <code>{'{{email}}'}</code>.
          A compliance footer and unsubscribe link are added automatically.
        </p>
      </section>

      {/* Feedback */}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {needCredits && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-800">
          Not enough credits — need {needCredits.required}, have {needCredits.available}.{' '}
          <Link href="/billing" className="underline font-medium">
            Buy more credits
          </Link>
        </div>
      )}
      {result && (
        <div className="rounded-md border border-green-500/40 bg-green-500/5 p-4 text-sm text-foreground flex items-center gap-4">
          <span className="inline-flex items-center gap-1 text-green-700">
            <CheckCircle className="h-4 w-4" /> {result.sent} sent
          </span>
          {result.failed > 0 && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <XCircle className="h-4 w-4" /> {result.failed} failed
            </span>
          )}
          <span className="text-muted-foreground">
            · {result.freeSent} free + {result.charged} credits charged
          </span>
        </div>
      )}

      {/* Send */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Sending…' : `Send to ${recipients.length} recipients`}
        </button>
      </div>
    </div>
  );
}
