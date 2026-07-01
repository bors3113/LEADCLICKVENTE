const puppeteer = require('puppeteer-core');

async function launchCloudflareBrowser() {
    const accountId = process.env.CF_ACCOUNT_ID;
    const token = process.env.CF_BROWSER_TOKEN;

    if (!accountId || !token) {
        throw new Error('CF_ACCOUNT_ID and CF_BROWSER_TOKEN must be set to use Cloudflare Browser Run');
    }

    // Direct CDP WebSocket — no Worker deployment required.
    // keep_alive=600000ms keeps the session alive up to 10 min of inactivity.
    const browserWSEndpoint = `wss://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/devtools/browser?keep_alive=600000`;

    const browser = await puppeteer.connect({
        browserWSEndpoint,
        headers: { Authorization: `Bearer ${token}` },
    });

    return browser;
}

module.exports = { launchCloudflareBrowser };
