'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Copy, Trash2, Check, Download } from 'lucide-react';

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

      <a
        href="/api/extension/download"
        className="mb-4 inline-flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-muted/70 transition border border-border"
      >
        <Download className="h-4 w-4" />
        Download extension (.zip)
      </a>
      <ol className="mb-6 list-decimal list-inside text-xs text-muted-foreground space-y-0.5">
        <li>Unzip the file, then open <code className="bg-muted/50 px-1 rounded">chrome://extensions</code> and enable <strong>Developer mode</strong>.</li>
        <li>Click <strong>Load unpacked</strong> and select the unzipped <code className="bg-muted/50 px-1 rounded">extension</code> folder.</li>
        <li>Create an API key below, then paste it into the extension&apos;s options page.</li>
      </ol>

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
