const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

// Resolve a company's official LinkedIn company URL via the Serper Google Search
// API (google.serper.dev). Passing an exact linkedin.com/company URL to the
// Apify enrichment actors matches far more reliably than a fuzzy name search.
//
// Everything here degrades gracefully: with no API key, a network error, or no
// LinkedIn result, we return '' and the caller falls back to the existing
// name-search path. This module never throws.

// Canonicalize a LinkedIn company URL to https://www.linkedin.com/company/<slug>.
// Strips locale subdomains (fr.linkedin.com -> linkedin.com), query/hash, and any
// path beyond the company slug. Returns '' if the URL is not a company page.
function normalizeCompanyUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    // Drop scheme, then locale subdomain and www.
    let s = raw
        .replace(/^https?:\/\//i, '')
        .replace(/^[a-z]{2}\.linkedin\.com/i, 'linkedin.com')
        .replace(/^www\./i, '');
    // Must be a linkedin.com company page.
    const m = s.match(/^linkedin\.com\/company\/([^/?#]+)/i);
    if (!m) return '';
    const slug = m[1].toLowerCase();
    return `https://www.linkedin.com/company/${slug}`;
}

// Pull the first linkedin.com/company URL out of a Serper search response.
function extractCompanyUrlFromResponse(data) {
    if (!data || typeof data !== 'object') return '';

    const candidates = [];
    if (data.knowledgeGraph && data.knowledgeGraph.website) {
        candidates.push(data.knowledgeGraph.website);
    }
    const organic = Array.isArray(data.organic) ? data.organic : [];
    for (const item of organic) {
        if (item && item.link) candidates.push(item.link);
        const sitelinks = Array.isArray(item && item.sitelinks) ? item.sitelinks : [];
        for (const sl of sitelinks) {
            if (sl && sl.link) candidates.push(sl.link);
        }
    }

    for (const c of candidates) {
        const url = normalizeCompanyUrl(c);
        if (url) return url;
    }
    return '';
}

// Build the search query: "<company name> linkedin". Falls back to the website
// when no name is present.
function buildQuery(name, website) {
    const n = String(name || '').trim();
    return `${n || String(website || '').trim()} linkedin`;
}

// Resolve one company's LinkedIn URL. Returns '' on any failure or no match.
async function findLinkedinCompanyUrl(name, website) {
    if (!config.serper.enabled) return '';
    const q = buildQuery(name, website);
    if (!q.trim()) return '';

    try {
        const res = await axios.post(
            config.serper.endpoint,
            { q, gl: config.serper.gl, hl: config.serper.hl },
            {
                headers: {
                    'X-API-KEY': config.serper.apiKey,
                    'Content-Type': 'application/json',
                },
                timeout: config.serper.timeoutMs,
            }
        );
        return extractCompanyUrlFromResponse(res.data);
    } catch (err) {
        const detail = err.response ? `${err.response.status}` : err.message;
        logger.warn(`Serper lookup failed for "${name || website}": ${detail}`);
        return '';
    }
}

// Run an async mapper over items with a bounded concurrency.
async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            results[i] = await worker(items[i], i);
        }
    });
    await Promise.all(runners);
    return results;
}

/**
 * Resolve LinkedIn company URLs for a set of company identifiers.
 * Skips identifiers that already carry a linkedin.com/company website. Returns a
 * Map<key, linkedinUrl> containing only the ones that resolved to a URL.
 *
 * @param {{key:string, website:string, name:string}[]} identifiers
 * @param {{concurrency?:number}} [options]
 * @returns {Promise<Map<string,string>>}
 */
async function resolveLinkedinUrls(identifiers, { concurrency } = {}) {
    const out = new Map();
    if (!config.serper.enabled) return out;

    const ids = (identifiers || []).filter(id => id && id.key);
    // Only look up companies that don't already have a LinkedIn company URL.
    const toLookup = ids.filter(
        id => !String(id.website || '').includes('linkedin.com/company')
    );
    if (toLookup.length === 0) return out;

    const limit = Math.max(1, concurrency || config.serper.concurrency);
    await mapWithConcurrency(toLookup, limit, async (id) => {
        const url = await findLinkedinCompanyUrl(id.name, id.website);
        if (url) out.set(id.key, url);
    });

    logger.info(`Serper resolved ${out.size}/${toLookup.length} companies to LinkedIn URLs`);
    return out;
}

module.exports = {
    normalizeCompanyUrl,
    extractCompanyUrlFromResponse,
    findLinkedinCompanyUrl,
    resolveLinkedinUrls,
};
