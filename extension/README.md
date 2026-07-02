# LeadClickVente LinkedIn Copilot (Chrome extension)

AI-drafted, personalized LinkedIn outreach. The extension reads the profile
page you are already viewing, asks the LeadClickVente backend for a draft, and
inserts it into LinkedIn's message box. **It never sends anything — you always
review, edit, and click Send yourself.**

## Install (unpacked, for development)

1. Open `chrome://extensions`, enable **Developer mode** (top right).
2. Click **Load unpacked** and select this `extension/` folder.
3. Right-click the extension icon → **Options**:
   - Paste an API key created in the dashboard under **Settings → API keys**.
   - Backend URL: `http://localhost:3008` for local dev.
   - Click **Test connection**.
4. Visit a LinkedIn profile (`linkedin.com/in/...`) and click the **AI Copilot**
   button in the bottom-right corner.

## Production backend

When deploying, add your API domain to `host_permissions` in `manifest.json`
(e.g. `"https://api.yourdomain.com/*"`) and set that URL in the extension
options. The backend's CORS is already permissive, so requests work either
way, but listing the host keeps things explicit.

## How it charges credits

Each draft or rewrite costs 1 enrichment credit from your organization's
balance (the same balance used for LinkedIn enrichment; top up on the billing
page). Failed generations are never charged.
