const apiKeyInput = document.getElementById('apiKey');
const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const statusEl = document.getElementById('status');

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = ok ? 'ok' : 'err';
}

chrome.storage.local.get(['apiKey', 'apiBaseUrl']).then(({ apiKey, apiBaseUrl }) => {
  if (apiKey) apiKeyInput.value = apiKey;
  apiBaseUrlInput.value = apiBaseUrl || 'http://localhost:3008';
});

document.getElementById('save').addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const apiBaseUrl = apiBaseUrlInput.value.trim() || 'http://localhost:3008';
  if (apiKey && !apiKey.startsWith('lcv_')) {
    setStatus('That does not look like a LeadClickVente key (should start with lcv_).', false);
    return;
  }
  await chrome.storage.local.set({ apiKey, apiBaseUrl });
  setStatus('Saved.', true);
});

document.getElementById('test').addEventListener('click', async () => {
  setStatus('Testing…', true);
  const res = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
  if (res && res.ok) setStatus('Connected to the backend.', true);
  else setStatus((res && res.error) || 'Connection failed.', false);
});
