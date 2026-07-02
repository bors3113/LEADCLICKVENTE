const { ApifyClient } = require('apify-client');
const config = require('../config');

// Thin wrapper over the Apify client for the three LinkedIn enrichment actors.
// Each actor is pay-per-result; we batch all identifiers of a type into a single
// actor run (the actors accept arrays) and read the resulting dataset once.
//
// These actors do NOT echo the input back in their output rows and don't
// guarantee output order, so we can't match by input string. Instead we match
// each output row back to a scraped company by identity: website domain first,
// then a fuzzy company-name comparison. Callers pass structured identifiers
// ({ key, website, name }) and get back Map<key, actorOutput> keyed on the
// caller's own `key`, so only companies we actually found are charged/merged.

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

// Reduce a URL to a comparable registrable host: strip scheme, `www.`, path,
// query and trailing dot. e.g. "https://www.growthroom.co/contact" -> "growthroom.co".
// Returns '' for non-URLs (bare company names).
function extractDomain(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    let host = raw;
    // Only treat things that look like URLs/hosts as domains.
    if (/^https?:\/\//i.test(host)) {
        host = host.replace(/^https?:\/\//i, '');
    } else if (!/\.[a-z]{2,}(\/|$|:)/i.test(host)) {
        // No scheme and no dotted TLD -> it's a plain name, not a domain.
        return '';
    }
    host = host.split(/[/?#]/)[0];           // drop path/query/fragment
    host = host.replace(/^www\./i, '');      // drop leading www.
    host = host.replace(/:\d+$/, '');        // drop port
    host = host.replace(/\.$/, '');          // drop trailing dot
    return host.toLowerCase();
}

// Words that carry no identity signal when comparing company names.
const NAME_STOPWORDS = new Set([
    'the', 'and', 'of', 'for',
    'agence', 'agency', 'cabinet', 'groupe', 'group',
    'sarl', 'sas', 'sasu', 'eurl', 'sa', 'spa', 'srl',
    'inc', 'llc', 'ltd', 'limited', 'gmbh', 'co', 'company', 'corp',
]);

// Tokenize a company name into meaningful lowercase words.
function nameTokens(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, ' ')   // punctuation -> space
        .split(/\s+/)
        .filter(t => t && t.length > 1 && !NAME_STOPWORDS.has(t));
}

// Fuzzy company-name match: true when one name's meaningful tokens are a subset
// of the other's. Handles Google-Maps names ("Growth Room - Agence Growth
// Marketing") vs LinkedIn names ("Growth Room").
function fuzzyNameMatch(a, b) {
    const ta = nameTokens(a);
    const tb = nameTokens(b);
    if (ta.length === 0 || tb.length === 0) return false;
    const setA = new Set(ta);
    const setB = new Set(tb);
    const smaller = ta.length <= tb.length ? ta : tb;
    const larger = ta.length <= tb.length ? setB : setA;
    const overlap = smaller.filter(t => larger.has(t)).length;
    // Require the smaller name to be essentially contained in the larger.
    return overlap > 0 && overlap === smaller.length;
}

// Given an output item and the pool of not-yet-matched input identifiers, find
// the identifier that best corresponds to it. Website domain wins; name fuzzy
// match is the fallback. `getItemDomains`/`getItemNames` return candidate
// strings from the item (an actor may expose several).
function matchItemToIdentifier(item, identifiers, matched, getItemDomains, getItemNames) {
    const itemDomains = getItemDomains(item).map(extractDomain).filter(Boolean);
    const itemNames = getItemNames(item).filter(Boolean);

    // Normalized linkedin.com/company path (e.g. "linkedin.com/company/apple")
    // for URL matching, from the resolved linkedinUrl or a LinkedIn website.
    const companyPath = (id) => {
        const url = String(id.linkedinUrl || '').trim() ||
            (String(id.website || '').includes('linkedin.com/company') ? id.website : '');
        const m = String(url).match(/linkedin\.com\/company\/([^/?#]+)/i);
        return m ? `linkedin.com/company/${m[1].toLowerCase()}` : '';
    };
    const itemCompanyPaths = getItemDomains(item)
        .map(v => {
            const m = String(v || '').match(/linkedin\.com\/company\/([^/?#]+)/i);
            return m ? `linkedin.com/company/${m[1].toLowerCase()}` : '';
        })
        .filter(Boolean);

    // 1a. LinkedIn company URL match — strongest signal when we resolved one.
    for (const id of identifiers) {
        if (matched.has(id.key)) continue;
        const idPath = companyPath(id);
        if (idPath && itemCompanyPaths.includes(idPath)) return id;
    }
    // 1b. Domain match — the strongest signal for real websites.
    for (const id of identifiers) {
        if (matched.has(id.key)) continue;
        const idDomain = extractDomain(id.website);
        if (idDomain && itemDomains.includes(idDomain)) return id;
    }
    // 2. Fuzzy name match — but only when domains don't actively contradict.
    // If both the input and the item expose a domain and they disagree, this is
    // a different company that merely shares a name (e.g. French "Junto" vs
    // Brazilian "Junto Seguros"), so we skip it.
    for (const id of identifiers) {
        if (matched.has(id.key)) continue;
        const idDomain = extractDomain(id.website);
        const domainsContradict =
            idDomain && itemDomains.length > 0 && !itemDomains.includes(idDomain);
        if (domainsContradict) continue;
        if (itemNames.some(n => fuzzyNameMatch(n, id.name))) return id;
    }
    return null;
}

// A resolved LinkedIn company URL, if one is present on the identifier. Set by
// the Serper resolver (see services/serperLookup.js) so we prefer the exact
// company URL over a fuzzy name search.
function companyUrl(id) {
    const linkedinUrl = String(id.linkedinUrl || '').trim();
    if (linkedinUrl.includes('linkedin.com/company')) return linkedinUrl;
    const website = String(id.website || '').trim();
    if (website.includes('linkedin.com/company')) return website;
    return '';
}

// Split structured identifiers into the actor's `companies` (LinkedIn company
// URLs) and `searches` (names / websites the actor can search for).
function partitionForSearch(identifiers) {
    const companies = [];
    const searches = [];
    for (const id of identifiers) {
        const url = companyUrl(id);
        const website = String(id.website || '').trim();
        const name = String(id.name || '').trim();
        if (url) {
            companies.push(url);
        } else if (name) {
            searches.push(name);
        } else if (website) {
            searches.push(website);
        }
    }
    return { companies: [...new Set(companies)], searches: [...new Set(searches)] };
}

async function runActor(actorId, input) {
    const apify = getClient();
    const run = await apify.actor(actorId).call(input);
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    return { runId: run.id, items };
}

/**
 * Enrich companies via harvestapi/linkedin-company.
 * @param {{key:string, website:string, name:string}[]} identifiers - deduped by caller
 * @returns {Promise<{runId:string|null, byIdentifier:Map<string,object>}>}
 */
async function enrichCompany(identifiers) {
    const ids = (identifiers || []).filter(id => id && id.key);
    if (ids.length === 0) return { runId: null, byIdentifier: new Map() };

    const { companies, searches } = partitionForSearch(ids);
    if (companies.length === 0 && searches.length === 0) {
        return { runId: null, byIdentifier: new Map() };
    }

    const { runId, items } = await runActor(config.apify.companyActorId, { companies, searches });

    const byIdentifier = new Map();
    for (const item of items) {
        const id = matchItemToIdentifier(
            item, ids, byIdentifier,
            it => [it.website, it.linkedinUrl],
            it => [it.name, it.universalName],
        );
        if (id) byIdentifier.set(id.key, item);
    }
    return { runId, byIdentifier };
}

/**
 * Enrich company employees via harvestapi/linkedin-company-employees.
 * The actor takes a single `companies` array (LinkedIn URLs OR names); there is
 * no separate `searches` field. Returns, per company identifier, an array of
 * employee rows.
 * @param {{key:string, website:string, name:string}[]} identifiers
 * @returns {Promise<{runId:string|null, byIdentifier:Map<string,object[]>}>}
 */
async function enrichEmployees(identifiers) {
    const ids = (identifiers || []).filter(id => id && id.key);
    if (ids.length === 0) return { runId: null, byIdentifier: new Map() };

    // Both LinkedIn company URLs and plain names go in the same `companies` array.
    // Prefer a resolved LinkedIn company URL (Serper) over a name search.
    const companies = [];
    for (const id of ids) {
        const url = companyUrl(id);
        const website = String(id.website || '').trim();
        const name = String(id.name || '').trim();
        if (url) companies.push(url);
        else if (name) companies.push(name);
        else if (website) companies.push(website);
    }
    const deduped = [...new Set(companies)];
    if (deduped.length === 0) return { runId: null, byIdentifier: new Map() };

    // "short" profile mode keeps cost at the low end of the actor's range.
    const { runId, items } = await runActor(config.apify.employeesActorId, {
        companies: deduped,
        profileScraperMode: 'short',
    });

    // Each employee row nests its company under currentPosition[0] / experience[0].
    // Match on the company's LinkedIn URL / name and group employees by identifier.
    const getItemDomains = (it) => {
        const exp = Array.isArray(it.experience) ? it.experience : [];
        return [
            it.companyWebsite,
            it.companyLinkedinUrl,
            ...exp.slice(0, 3).map(e => e && e.companyLinkedinUrl),
        ].filter(Boolean);
    };
    const getItemNames = (it) => {
        const pos = Array.isArray(it.currentPosition) ? it.currentPosition : [];
        const exp = Array.isArray(it.experience) ? it.experience : [];
        return [
            it.companyName,
            ...pos.slice(0, 2).map(p => p && p.companyName),
            ...exp.slice(0, 2).map(e => e && e.companyName),
        ].filter(Boolean);
    };

    const byIdentifier = new Map();
    for (const item of items) {
        // Don't mark identifiers as "used" — many employees map to one company,
        // so pass a never-full `matched` set and allow repeats.
        const id = matchItemToIdentifier(item, ids, new Map(), getItemDomains, getItemNames);
        if (!id) continue;
        if (!byIdentifier.has(id.key)) byIdentifier.set(id.key, []);
        byIdentifier.get(id.key).push(item);
    }
    return { runId, byIdentifier };
}

/**
 * Enrich individual LinkedIn profiles via harvestapi/linkedin-profile-scraper.
 * @param {string[]} profileUrls - LinkedIn profile URLs
 */
async function enrichProfiles(profileUrls) {
    const clean = [...new Set((profileUrls || []).map(u => String(u || '').trim()).filter(Boolean))];
    if (clean.length === 0) return { runId: null, byIdentifier: new Map() };

    // No-email mode ($4/1k) — the $10/1k email-search mode is not used here.
    const { runId, items } = await runActor(config.apify.profileActorId, {
        profileScraperMode: 'Profile details no email ($4 per 1k)',
        urls: clean,
    });

    // This actor does not echo the input URL back; it returns its own canonical
    // `linkedinUrl` per profile, so match on that (normalized) instead.
    const byIdentifier = new Map();
    for (const item of items) {
        const nk = normalizeLinkedinUrl(item.linkedinUrl);
        if (!nk) continue;
        const original = clean.find(c => normalizeLinkedinUrl(c) === nk);
        if (original && !byIdentifier.has(original)) {
            byIdentifier.set(original, item);
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
    extractDomain,
    fuzzyNameMatch,
};
