'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Copy, Trash2, Check, Download, ChevronDown } from 'lucide-react';

type ApiKey = {
  id: string;
  name: string;
  created_at: string | null;
  last_used_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/api-keys');
      const data = await res.json();
      if (res.ok) setKeys(data.keys ?? []);
      else setError(data.error ?? 'Failed to load keys');
    } catch {
      setError('Failed to load keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createKey = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create key');
        return;
      }
      setNewKey(data.key);
      setName('');
      try {
        await navigator.clipboard.writeText(data.key);
        setCopied(true);
      } catch {
        setCopied(false);
      }
      await load();
    } catch {
      setError('Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string, keyName: string) => {
    if (!window.confirm(`Revoke the key "${keyName}"? The extension using it will stop working immediately.`)) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
    if (res.ok) setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const copyNewKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
  };

  return (
    <section className="bg-background rounded-lg border border-border p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">API keys</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Use API keys to connect the LinkedIn Copilot Chrome extension. Each draft costs 1 enrichment credit.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <a
          href="/api/extension/download"
          className="inline-flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-muted/70 transition border border-border"
        >
          <Download className="h-4 w-4" />
          Download extension (.zip)
        </a>
        <button
          type="button"
          onClick={() => setShowTutorial((v) => !v)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showTutorial ? 'rotate-180' : ''}`} />
          {showTutorial ? 'Hide' : 'Show'} manual install tutorial
        </button>
      </div>

      {showTutorial && (
        <div className="mb-6 rounded-md border border-border bg-muted/20 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            How to install the extension manually
          </h3>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-3">
            <li>
              <span className="text-foreground font-medium">Download and unzip.</span>{' '}
              Click <strong>Download extension (.zip)</strong> above, then unzip it
              anywhere on your computer (e.g. your Desktop). Keep the folder — Chrome
              loads the extension from it directly, so don&apos;t delete it after
              installing.
            </li>
            <li>
              <span className="text-foreground font-medium">Open the extensions page.</span>{' '}
              In Chrome (or any Chromium browser — Edge, Brave), go to{' '}
              <code className="bg-muted/50 px-1 rounded">chrome://extensions</code>, or
              menu → <strong>More tools → Extensions</strong>.
            </li>
            <li>
              <span className="text-foreground font-medium">Enable Developer mode.</span>{' '}
              Toggle <strong>Developer mode</strong> in the top-right corner of the
              extensions page.
            </li>
            <li>
              <span className="text-foreground font-medium">Load the extension.</span>{' '}
              Click <strong>Load unpacked</strong> (top-left) and select the unzipped{' '}
              <code className="bg-muted/50 px-1 rounded">extension</code> folder — pick
              the folder itself, the one containing{' '}
              <code className="bg-muted/50 px-1 rounded">manifest.json</code>, not the
              zip file.
            </li>
            <li>
              <span className="text-foreground font-medium">Create an API key.</span>{' '}
              Use the form below to create a key (e.g. name it &quot;My Chrome
              extension&quot;) and copy it — it&apos;s only shown once.
            </li>
            <li>
              <span className="text-foreground font-medium">Configure the extension.</span>{' '}
              Click the extensions puzzle-piece icon in Chrome&apos;s toolbar, find{' '}
              <strong>LeadClickVente LinkedIn Copilot</strong>, and open its{' '}
              <strong>Options</strong> (right-click the icon → Options, or the Details
              button on the extensions page → Extension options). Paste your API key,
              set the backend URL, and click <strong>Test connection</strong> to
              confirm it works.
            </li>
            <li>
              <span className="text-foreground font-medium">Use it.</span>{' '}
              Visit any LinkedIn profile at{' '}
              <code className="bg-muted/50 px-1 rounded">linkedin.com/in/...</code> and
              click the <strong>AI Copilot</strong> button in the bottom-right corner
              to draft a message. Nothing is ever sent automatically — you always
              review and click Send yourself.
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Tip: Chrome disables unpacked extensions after an update sometimes — if it
            stops working, revisit <code className="bg-muted/50 px-1 rounded">chrome://extensions</code> and toggle it back on.
          </p>
        </div>
      )}

      {newKey && (
        <div className="mb-4 rounded-md border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground mb-2">
            {copied
              ? 'Your new key was copied to the clipboard — paste it into the extension options. It won’t be shown again.'
              : 'Your new key — copy it now, it won’t be shown again:'}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-muted/50 px-2 py-1.5 text-xs text-foreground">{newKey}</code>
            <button
              type="button"
              onClick={copyNewKey}
              className="shrink-0 inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-primary/90 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
          >
            I saved it — dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createKey(); }}
          placeholder="Key name (e.g. My Chrome extension)"
          maxLength={100}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={createKey}
          disabled={!name.trim() || creating}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-foreground">{k.name}</div>
                <div className="text-xs text-muted-foreground">
                  Created {formatDate(k.created_at)} · Last used {formatDate(k.last_used_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revokeKey(k.id, k.name)}
                className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition"
              >
                <Trash2 className="h-4 w-4" />
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
