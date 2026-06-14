import { Actor } from 'apify';

/**
 * Extract the company/site token from a Lever job board URL.
 * Handles jobs.lever.co/{site} and the EU host jobs.eu.lever.co/{site}.
 * @param {string} url
 * @returns {string|null} site token or null if invalid
 */
function extractCompanyName(url) {
    const match = url.match(/lever\.co\/([^\/\?]+)/);
    return match ? match[1] : null;
}

/**
 * Fetch all public postings for a Lever site in one call.
 * mode=json returns full posting objects including descriptions, so unlike
 * Greenhouse/Ashby there is no per-job detail fetch.
 * @param {string} site
 * @returns {Promise<Array>} array of Lever posting objects
 */
async function fetchPostings(site) {
    const apiUrl = `https://api.lever.co/v0/postings/${site}?mode=json`;
    const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

/**
 * Case-insensitive membership test against a filter list.
 * Empty/absent filter list means "keep everything".
 * @param {string|null|undefined} value
 * @param {Array<string>} filters
 * @returns {boolean}
 */
function passesFilter(value, filters) {
    if (!filters || filters.length === 0) return true;
    if (!value) return false;
    const v = String(value).toLowerCase().trim();
    return filters.some((f) => String(f).toLowerCase().trim() === v);
}

/**
 * Regex salary parser for free-text descriptions, used only when Lever has no
 * structured salaryRange. Handles $80k-$120k, $80,000-$120,000, £50k-£70k, €60k-€80k.
 * @param {string} text
 * @returns {{min:number,max:number,currency:string,raw:string}|null}
 */
function parseSalaryFromText(text) {
    const salaryMatch = (text || '').match(
        /([£€$])(\d{1,3}(?:,\d{3})*|\d+)[kK]?\s*[-–]\s*\1(\d{1,3}(?:,\d{3})*|\d+)[kK]?/,
    );
    if (!salaryMatch) return null;

    const parseAmount = (str) => {
        const cleaned = str.replace(/,/g, '');
        const num = parseInt(cleaned, 10);
        return str.match(/[kK]/) || num < 1000 ? num * 1000 : num;
    };

    let currency = salaryMatch[1] === '£' ? 'GBP' : salaryMatch[1] === '€' ? 'EUR' : 'USD';
    if (salaryMatch[1] === '$') {
        const matchIndex = text.indexOf(salaryMatch[0]);
        const context = text.slice(Math.max(0, matchIndex - 200), matchIndex + 200);
        if (/\bCAD\b|Canada/i.test(context)) currency = 'CAD';
        else if (/\bAUD\b|Australia/i.test(context)) currency = 'AUD';
        else if (/\bEUR\b|Europe|Ireland/i.test(context)) currency = 'EUR';
        else if (/\bGBP\b|UK|United Kingdom/i.test(context)) currency = 'GBP';
    }

    return {
        min: parseAmount(salaryMatch[2]),
        max: parseAmount(salaryMatch[3]),
        currency,
        raw: salaryMatch[0],
    };
}

/**
 * Build salary object: prefer Lever's structured salaryRange, fall back to regex.
 * @param {Object} posting
 * @returns {Object|null}
 */
function extractSalary(posting) {
    const sr = posting.salaryRange;
    if (sr && (sr.min != null || sr.max != null)) {
        return {
            min: sr.min ?? null,
            max: sr.max ?? null,
            currency: sr.currency || 'USD',
            interval: sr.interval || null,
            raw: `${sr.currency || ''}${sr.min ?? ''}-${sr.max ?? ''}`.trim(),
        };
    }
    return parseSalaryFromText(posting.descriptionPlain || posting.description || '');
}

/**
 * Map a raw Lever posting to the standardized output shape (kept consistent with
 * the Greenhouse and Ashby actors).
 * @param {Object} posting
 * @param {string} site
 * @returns {Object}
 */
function formatJobOutput(posting, site) {
    const categories = posting.categories || {};
    const locationRaw = categories.location || '';
    const locations = Array.isArray(categories.allLocations) && categories.allLocations.length
        ? categories.allLocations
        : (locationRaw ? [locationRaw] : []);

    const workplaceType = posting.workplaceType || null; // 'remote' | 'on-site' | 'hybrid' | 'unspecified'
    const haystack = `${workplaceType || ''} ${locations.join(' ')}`.toLowerCase();
    const isRemote = workplaceType === 'remote' || haystack.includes('remote');
    const isHybrid = workplaceType === 'hybrid' || haystack.includes('hybrid');

    return {
        id: posting.id,
        company: site,
        type: categories.commitment || null,
        title: posting.text,
        description: posting.description || '',
        descriptionPlain: posting.descriptionPlain || '',

        location: locationRaw,
        locations,
        workplaceType,
        isRemote,
        isHybrid,

        salary: extractSalary(posting),

        department: categories.department || null,
        team: categories.team || null,
        country: posting.country || null,

        metadata: {
            commitment: categories.commitment || null,
            department: categories.department || null,
            team: categories.team || null,
        },

        postingUrl: posting.hostedUrl || `https://jobs.lever.co/${site}/${posting.id}`,
        applyUrl: posting.applyUrl || `${posting.hostedUrl || `https://jobs.lever.co/${site}/${posting.id}`}/apply`,
        publishedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
    };
}

await Actor.main(async () => {
    const input = await Actor.getInput() || {};
    const urls = input.urls || input.requestListSources || [];

    if (!urls || urls.length === 0) {
        throw new Error('No URLs provided. Add at least one Lever job board URL to the "urls" field.');
    }

    let totalProcessed = 0;

    for (const urlConfig of urls) {
        const url = typeof urlConfig === 'string' ? urlConfig : urlConfig.url;
        const departments = (urlConfig && urlConfig.departments) || [];
        const teams = (urlConfig && urlConfig.teams) || [];
        const maxJobs = (urlConfig && urlConfig.maxJobs) || null;
        const daysBack = (urlConfig && urlConfig.daysBack) || null;

        const site = extractCompanyName(url);
        if (!site) {
            console.log(`⚠️  Invalid Lever URL: ${url} (expected https://jobs.lever.co/company-name)`);
            continue;
        }

        // Compute date cutoff once per board. Lever exposes createdAt only, so daysBack
        // means "jobs created in the last N days" — ideal for incremental scheduled runs.
        let cutoffDate = null;
        if (daysBack && Number.isInteger(daysBack) && daysBack > 0) {
            cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        }

        console.log(`\n📋 Scraping: ${site}`);
        if (departments.length) console.log(`   🎯 Department filters: ${departments.join(', ')}`);
        if (teams.length) console.log(`   🎯 Team filters: ${teams.join(', ')}`);
        if (cutoffDate) console.log(`   📅 Date filter: created after ${cutoffDate.toISOString()}`);

        try {
            const postings = await fetchPostings(site);
            if (!postings.length) {
                console.log('   ⚠️  No postings found (site may have no active jobs or wrong token)');
                continue;
            }

            const boardResults = [];
            for (const posting of postings) {
                const categories = posting.categories || {};

                // Filter BEFORE storing so the user is only billed for jobs they keep.
                if (!passesFilter(categories.department, departments)) continue;
                if (!passesFilter(categories.team, teams)) continue;

                if (cutoffDate && posting.createdAt) {
                    if (new Date(posting.createdAt) < cutoffDate) continue;
                }

                boardResults.push(formatJobOutput(posting, site));

                if (maxJobs && boardResults.length >= maxJobs) {
                    console.log(`   Reached maxJobs limit of ${maxJobs}, stopping`);
                    break;
                }
            }

            if (boardResults.length) {
                await Actor.pushData(boardResults);
                totalProcessed += boardResults.length;
            }
            console.log(`   ✅ Stored ${boardResults.length} job(s) after filtering`);
        } catch (error) {
            console.log(`   ❌ Error scraping ${site}: ${error.message}`);
        }

        // Small delay to be polite to the API between boards.
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Scraping complete! Stored ${totalProcessed} job(s) from ${urls.length} board(s).`);
});
