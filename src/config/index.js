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
        profileActorId: process.env.APIFY_PROFILE_ACTOR || 'harvestapi/linkedin-profile-scraper',
        // Credits charged per successfully enriched row, by enrichment type.
        creditCost: {
            company: parseInt(process.env.APIFY_CREDIT_COST_COMPANY, 10) || 1,
            employees: parseInt(process.env.APIFY_CREDIT_COST_EMPLOYEES, 10) || 2,
            profile: parseInt(process.env.APIFY_CREDIT_COST_PROFILE, 10) || 4,
        },
        // Cascade pricing: when "profile" runs the company -> employees -> profiles
        // cascade, each company is charged a flat base plus a per-scraped-profile fee.
        // The per-profile fee varies by cascade scope: decision-makers (pre-filtered
        // to Founders/C-level/VP/Director/Head) carry a premium over bulk scopes,
        // since they're higher business value than an unfiltered employee list.
        cascadeBasePerCompany: parseInt(process.env.APIFY_CASCADE_BASE_PER_COMPANY, 10) || 2,
        cascadePerProfileByScope: {
            all: parseInt(process.env.APIFY_CASCADE_PER_PROFILE_ALL, 10) || 3,
            capped: parseInt(process.env.APIFY_CASCADE_PER_PROFILE_CAPPED, 10) || 3,
            'decision-makers': parseInt(process.env.APIFY_CASCADE_PER_PROFILE_DECISION_MAKERS, 10) || 5,
        },
        // Default cap for the "capped" cascade scope when no profileCap is supplied.
        cascadeDefaultCap: parseInt(process.env.APIFY_CASCADE_DEFAULT_CAP, 10) || 10,
        // The linkedin-company-employees actor does NOT crawl at all unless
        // `maxItems` (or `takePages`) is set on its input — with neither set it
        // logs a "no limits" warning and exits without scraping anything. This
        // caps total employees returned per batched run (companies.length * this),
        // matching the actor's own schema prefill of 25 per company.
        maxEmployeesPerCompany: parseInt(process.env.APIFY_MAX_EMPLOYEES_PER_COMPANY, 10) || 25,
    },

    // Serper (google.serper.dev) is used to resolve each company's official
    // LinkedIn company URL before enrichment, so the Apify actors receive an
    // exact linkedin.com/company URL instead of a fuzzy name search. Disabled
    // (falls back to name search) when no API key is configured.
    serper: {
        apiKey: process.env.SERPER_API_KEY || '',
        endpoint: process.env.SERPER_ENDPOINT || 'https://google.serper.dev/search',
        gl: process.env.SERPER_GL || 'us',
        hl: process.env.SERPER_HL || 'en',
        concurrency: parseInt(process.env.SERPER_CONCURRENCY, 10) || 4,
        timeoutMs: parseInt(process.env.SERPER_TIMEOUT_MS, 10) || 15000,
        enabled: !!process.env.SERPER_API_KEY,
    },

    // OpenRouter (openrouter.ai) powers the LinkedIn copilot's AI message
    // drafts. Any OpenAI-compatible model can be selected via OPENROUTER_MODEL
    // without code changes. Disabled when no API key is configured.
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS, 10) || 500,
        timeoutMs: parseInt(process.env.OPENROUTER_TIMEOUT_MS, 10) || 30000,
        enabled: !!process.env.OPENROUTER_API_KEY,
    },

    // LinkedIn copilot (Chrome extension). Each draft or rewrite is one
    // OpenRouter call, charged against the org's enrichment credit balance.
    copilot: {
        creditCostDraft: parseInt(process.env.COPILOT_CREDIT_COST_DRAFT, 10) || 1,
    },

    scraper: {
        navigationTimeoutMs: parseInt(process.env.NAV_TIMEOUT_MS, 10) || 30000,
        httpTimeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS, 10) || 30000,
        concurrentLimit: parseInt(process.env.CONCURRENT_LIMIT, 10) || 10,
        maxUnchangedScrolls: parseInt(process.env.MAX_UNCHANGED_SCROLLS, 10) || 20,
        // Higher no-new-results stall ceiling used only when no limit is set, so a
        // long lazy-loading feed reaches its end-of-list sentinel before giving up.
        maxUnchangedScrollsExhaust: parseInt(process.env.MAX_UNCHANGED_SCROLLS_EXHAUST, 10) || 40,
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
