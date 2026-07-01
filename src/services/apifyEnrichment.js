const { ApifyClient } = require('apify-client');
const config = require('../config');

// Thin wrapper over the Apify client for the three LinkedIn enrichment actors.
// Each actor is pay-per-result; we batch all identifiers of a type into a single
// actor run (the actors accept arrays) and read the resulting dataset once.
//
// Every function returns:
//   { runId, byIdentifier: Map<normalizedIdentifier, actorOutputRow> }
// The caller matches rows back onto its scraped records by identifier and only
// charges credits for identifiers that actually came back.

let client = null;

function getClient() {
    if (!config.apify.token) {
        throw new Error('APIFY_TOKEN is not configured. Set it in .env to enable enrichment.');
    }
    if (!client) {
        client = new ApifyClient({ token: config.apify.token });
    }
    return client;
}

// LinkedIn URLs come in country-specific variants (br.linkedin.com, etc.) and
// with/without trailing slashes. Normalize so lookups match regardless.
function normalizeLinkedinUrl(url) {
    if (!url) return '';
    return String(url)
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^[a-z]{2}\.linkedin\.com/i, 'linkedin.com')
        .replace(/^www\./i, '')
        .replace(/\/+$/, '')
        .toLowerCase();
}

// Company/business identifiers are matched loosely (case-insensitive, trimmed).
function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

async function runActor(actorId, input) {
    const apify = getClient();
    const run = await apify.actor(actorId).call(input);
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    return { runId: run.id, items };
}

/**
 * Enrich companies via harvestapi/linkedin-company.
 * @param {string[]} identifiers - company websites or names (deduped by caller)
 */
async function enrichCompany(identifiers) {
    const clean = [...new Set(identifiers.map(normalizeKey).filter(Boolean))];
    if (clean.length === 0) return { runId: null, byIdentifier: new Map() };

    // The actor accepts company URLs (`companies`) and free-text names (`searches`).
    // We can't tell which an identifier is without inspecting it, so a value that
    // looks like a LinkedIn/company URL goes to `companies`, everything else to `searches`.
    const companies = [];
    const searches = [];
    for (const id of clean) {
        if (/^https?:\/\//i.test(id) || id.includes('linkedin.com/company')) {
            companies.push(id);
        } else {
            searches.push(id);
        }
    }

    const { runId, items } = await runActor(config.apify.companyActorId, { companies, searches });

    const byIdentifier = new Map();
    for (const item of items) {
        // Match back to whichever identifier produced this row.
        const keys = [item.website, item.name, item.universalName, item.linkedinUrl, item.input, item.query];
        for (const k of keys) {
            const nk = normalizeKey(k);
            if (nk && clean.includes(nk) && !byIdentifier.has(nk)) {
                byIdentifier.set(nk, item);
            }
        }
    }
    return { runId, byIdentifier };
}

/**
 * Enrich company employees via harvestapi/linkedin-company-employees.
 * Returns, per company identifier, an array of employee rows.
 * @param {string[]} identifiers - company websites or names
 */
async function enrichEmployees(identifiers) {
    const clean = [...new Set(identifiers.map(normalizeKey).filter(Boolean))];
    if (clean.length === 0) return { runId: null, byIdentifier: new Map() };

    const companies = [];
    const searches = [];
    for (const id of clean) {
        if (/^https?:\/\//i.test(id) || id.includes('linkedin.com/company')) {
            companies.push(id);
        } else {
            searches.push(id);
        }
    }

    // "short" profile mode keeps cost at the low end of the actor's range.
    const { runId, items } = await runActor(config.apify.employeesActorId, {
        companies,
        searches,
        profileScraperMode: 'short',
    });

    // Group employees by the company identifier they belong to.
    const byIdentifier = new Map();
    for (const item of items) {
        const keys = [item.companyWebsite, item.companyName, item.companyUniversalName, item.companyLinkedinUrl, item.input, item.query];
        for (const k of keys) {
            const nk = normalizeKey(k);
            if (nk && clean.includes(nk)) {
                if (!byIdentifier.has(nk)) byIdentifier.set(nk, []);
                byIdentifier.get(nk).push(item);
                break;
            }
        }
    }
    return { runId, byIdentifier };
}

/**
 * Enrich individual LinkedIn profiles via futurizerush/linkedin-profile-scraper.
 * @param {string[]} profileUrls - LinkedIn profile URLs
 */
async function enrichProfiles(profileUrls) {
    const clean = [...new Set(profileUrls.map(u => String(u || '').trim()).filter(Boolean))];
    if (clean.length === 0) return { runId: null, byIdentifier: new Map() };

    const { runId, items } = await runActor(config.apify.profileActorId, { profileUrls: clean });

    const byIdentifier = new Map();
    for (const item of items) {
        // The actor echoes the input URL; match on the normalized form.
        const keys = [item.inputUrl, item.linkedinUrl, item.url];
        for (const k of keys) {
            const nk = normalizeLinkedinUrl(k);
            if (!nk) continue;
            // Find the original identifier whose normalized value matches.
            const original = clean.find(c => normalizeLinkedinUrl(c) === nk);
            if (original && !byIdentifier.has(original)) {
                byIdentifier.set(original, item);
                break;
            }
        }
    }
    return { runId, byIdentifier };
}

module.exports = {
    enrichCompany,
    enrichEmployees,
    enrichProfiles,
    normalizeLinkedinUrl,
    normalizeKey,
};
