// Background service worker: the only place that holds the API key and talks
// to the LeadClickVente backend. The content script never sees the key, and
// requests from here don't appear in the page's network context.

const DEFAULT_BASE_URL = 'http://localhost:3008';

async function getSettings() {
  const { apiKey = '', apiBaseUrl = DEFAULT_BASE_URL } =
    await chrome.storage.local.get(['apiKey', 'apiBaseUrl']);
  return { apiKey, apiBaseUrl: apiBaseUrl.replace(/\/+$/, '') };
}

function friendlyError(status, data) {
  if (status === 401) return 'Invalid API key — check it in the extension options.';
  if (status === 402) {
    return (data && data.error) || 'Out of credits — top up in the dashboard billing page.';
  }
  if (status === 429) return 'Too many requests — wait a minute and try again.';
  return (data && data.error) || `Request failed (${status}).`;
}

async function generateDraft(payload) {
  const { apiKey, apiBaseUrl } = await getSettings();
  if (!apiKey) {
    return { ok: false, error: 'No API key set — open the extension options and paste your key.' };
  }

  let res;
  try {
    res = await fetch(`${apiBaseUrl}/api/copilot/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, error: `Could not reach the backend at ${apiBaseUrl}. Is it running?` };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, status: res.status, error: friendlyError(res.status, data) };
  }
  return { ok: true, data };
}

async function testConnection() {
  const { apiBaseUrl } = await getSettings();
  try {
    const res = await fetch(`${apiBaseUrl}/api/health`);
    if (!res.ok) return { ok: false, error: `Backend responded ${res.status}.` };
    return { ok: true };
  } catch {
    return { ok: false, error: `Could not reach ${apiBaseUrl}.` };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'GENERATE_DRAFT') {
    generateDraft(message.payload).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  if (message && message.type === 'TEST_CONNECTION') {
    testConnection().then(sendResponse);
    return true;
  }
  return false;
});
