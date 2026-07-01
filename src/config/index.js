require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3008,
    logLevel: process.env.LOG_LEVEL || 'info',
    apiKey: process.env.API_KEY || '',

    browser: {
        headless: process.env.BROWSER_HEADLESS !== 'false',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disk-cache-size=33554432',
        ],
        defaultViewport: { width: 1280, height: 800 },
        userAgent: process.env.USER_AGENT ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    },

    cloudflare: {
        accountId: process.env.CF_ACCOUNT_ID,
        browserToken: process.env.CF_BROWSER_TOKEN,
        useCloudflareBrowser: process.env.USE_CLOUDFLARE_BROWSER === 'true',
    },

    r2: {
        accountId: process.env.R2_ACCOUNT_ID || '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        bucket: process.env.R2_BUCKET || 'leadsclickvente',
        enabled: !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
    },

    // Apify LinkedIn enrichment. Actors are pay-per-result; we resell as credits
    // at ~3-5x the raw Apify cost. Credit costs per enriched row are configurable
    // so pricing can be tuned without code changes.
    apify: {
        token: process.env.APIFY_TOKEN || '',
        companyActorId: process.env.APIFY_COMPANY_ACTOR || 'harvestapi/linkedin-company',
        employeesActorId: process.env.APIFY_EMPLOYEES_ACTOR || 'harvestapi/linkedin-company-employees',
        profileActorId: process.env.APIFY_PROFILE_ACTOR || 'futurizerush/linkedin-profile-scraper',
        // Credits charged per successfully enriched row, by enrichment type.
        creditCost: {
            company: parseInt(process.env.APIFY_CREDIT_COST_COMPANY, 10) || 1,
            employees: parseInt(process.env.APIFY_CREDIT_COST_EMPLOYEES, 10) || 2,
            profile: parseInt(process.env.APIFY_CREDIT_COST_PROFILE, 10) || 4,
        },
    },

    scraper: {
        navigationTimeoutMs: parseInt(process.env.NAV_TIMEOUT_MS, 10) || 30000,
        httpTimeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS, 10) || 30000,
        concurrentLimit: parseInt(process.env.CONCURRENT_LIMIT, 10) || 10,
        maxUnchangedScrolls: parseInt(process.env.MAX_UNCHANGED_SCROLLS, 10) || 20,
        maxQueriesPerRequest: parseInt(process.env.MAX_QUERIES_PER_REQUEST, 10) || 50,

        // Tiled map coverage: re-center the viewport across a grid of points to
        // find more businesses than a single viewport shows. tileRings controls
        // how far the grid extends (1 => 3x3, 2 => 5x5).
        tileRings: parseInt(process.env.TILE_RINGS, 10) || 1,
        // Randomized delay between tile navigations to avoid rate-limiting.
        tileJitterMinMs: parseInt(process.env.TILE_JITTER_MIN_MS, 10) || 800,
        tileJitterMaxMs: parseInt(process.env.TILE_JITTER_MAX_MS, 10) || 2000,
    },
};
