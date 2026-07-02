const { z } = require('zod');
const config = require('../config');
const { scrapeInitialData,
    processJsonFile,
    processJsonFileWithContactInfo,
    enrichScrapedFile} = require('../services/scraper');
const { exportToExcel, exportToCSV } = require('../utils/excelExporter');
const path = require('path');
const fs = require('fs');
const scraperService = require('../services/scraper');
const prisma = require('../lib/prisma');
const { uploadToR2 } = require('../lib/r2');

const scrapeSchema = z.object({
    query: z.string().min(1).max(300).optional(),
    queries: z.array(z.string().min(1).max(300)).max(50).optional(),
    limit: z.coerce.number().int().min(1).max(10000).optional(),
    format: z.enum(['excel', 'csv']).default('excel'),
    globalLimit: z.boolean().default(false),
    tileRings: z.coerce.number().int().min(0).max(5).optional(),
    // Optional existing job row id (created by the web app's /api/jobs). When
    // present with a single query, the scraper updates that row rather than
    // creating its own, so the web dashboard tracks the job in realtime.
    jobId: z.string().uuid().optional(),
}).refine(d => d.query || (d.queries && d.queries.length > 0), {
    message: 'Provide query or queries array',
});

const jsonSchema = z.object({
    filename: z.string().min(1).max(255).regex(/^[\w\-. ]+\.json$/, 'Invalid filename'),
    outputFormat: z.enum(['excel', 'csv']).default('excel'),
});

const scraperController = {
    // Handle single or multiple search queries
    async scrapeQuery(req, res) {
        if (scraperService.isScrapingActive()) {
            return res.status(409).json({ error: 'A scrape is already in progress. Stop it first via /api/stop-scrape.' });
        }

        try {
            const parsed = scrapeSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: parsed.error.issues[0].message });
            }
            const { query, queries, limit: parsedLimit, format, globalLimit, tileRings, jobId } = parsed.data;

            let searchQueries = [];
            if (queries && queries.length > 0) {
                searchQueries = queries
                    .map(q => q.trim())
                    .filter(q => q.length > 0)
                    .slice(0, config.scraper.maxQueriesPerRequest);
            } else if (query) {
                const trimmed = query.trim();
                if (trimmed) searchQueries = [trimmed];
            }

            const parsedTileRings = tileRings !== undefined ? tileRings : config.scraper.tileRings;

            const allResults = [];
            const queryResults = [];

            // Process each query sequentially
            for (let i = 0; i < searchQueries.length; i++) {
                const currentQuery = searchQueries[i];
                console.log(`Processing query ${i + 1}/${searchQueries.length}: ${currentQuery}`);
                
                // Calculate remaining limit for this query
                let remainingLimit = parsedLimit;
                if (globalLimit && parsedLimit) {
                    remainingLimit = parsedLimit - allResults.length;

                    // Skip if we've already reached the global limit
                    if (remainingLimit <= 0) {
                        console.log(`Global limit of ${parsedLimit} reached. Skipping remaining queries.`);
                        break;
                    }
                }
                
                try {
                    // Only adopt a caller-supplied jobId when there is a single
                    // query (the web app submits one job per request).
                    const adoptJobId = jobId && searchQueries.length === 1 ? jobId : null;
                    const results = await scrapeInitialData(currentQuery, remainingLimit, format, parsedTileRings, adoptJobId);
                    
                    // Add query identifier to each result
                    const resultsWithQuery = results.map(result => ({
                        ...result,
                        searchQuery: currentQuery,
                        queryIndex: i + 1
                    }));
                    
                    allResults.push(...resultsWithQuery);
                    queryResults.push({
                        query: currentQuery,
                        resultsCount: results.length,
                        success: true
                    });
                    
                    console.log(`Completed query ${i + 1}: ${results.length} results found`);
                    
                    // Check if we've reached the global limit after adding results
                    if (globalLimit && parsedLimit && allResults.length >= parsedLimit) {
                        console.log(`Global limit of ${parsedLimit} reached after query ${i + 1}. Stopping further queries.`);
                        break;
                    }
                    
                } catch (error) {
                    console.error(`Error processing query "${currentQuery}":`, error);
                    queryResults.push({
                        query: currentQuery,
                        resultsCount: 0,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            // Get the real-time export file path
            const realTimeExporter = scraperService.getRealTimeExporter();

            let filePath, justFileName;
            if (realTimeExporter) {
                realTimeExporter.finalize();
                filePath = realTimeExporter.getFilePath();
                justFileName = path.basename(filePath);
            } else {
                // Fallback to traditional export if real-time exporter is not available
                const queryNames = searchQueries.map(q => q.replace(/[^a-z0-9]/gi, '_').toLowerCase()).join('_');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `${queryNames}_${timestamp}`;
                
                if (format.toLowerCase() === 'csv') {
                    filePath = exportToCSV(allResults, filename);
                } else {
                    filePath = exportToExcel(allResults, filename);
                }
                justFileName = path.basename(filePath);
            }
            
            // Upload result file to R2 (best-effort; non-blocking on failure)
            let r2Key = null;
            try {
                r2Key = await uploadToR2(filePath);
            } catch (r2Err) {
                console.warn('R2 upload failed (non-fatal):', r2Err.message);
            }

            // Fix #2: expose whether the area was exhausted before the limit was reached
            const areaExhausted = parsedLimit
                ? allResults.length < parsedLimit
                : false;

            res.json({
                success: true,
                jobId: scraperService.getCurrentJobId(),
                queries: searchQueries,
                queryResults: queryResults,
                totalResultsCount: allResults.length,
                fileName: justFileName,
                downloadUrl: `/api/download?file=${justFileName}`,
                r2Key: r2Key || null,
                limit: parsedLimit || 'No limit',
                requestedLimit: parsedLimit || null,
                areaExhausted
            });
        } catch (error) {
            console.error('Scraping error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // Handle JSON file processing
    async processJson(req, res) {
        try {
            const parsed = jsonSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: parsed.error.issues[0].message });
            }
            const { filename, outputFormat } = parsed.data;

            // Process the JSON file
            const processedData = await processJsonFile(filename);

            // Generate output filename
            const baseFilename = path.basename(filename, '.json').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFilename = `${baseFilename}_processed_${timestamp}`;
            
            // Export to requested format
            let filePath;
            if (outputFormat.toLowerCase() === 'csv') {
                filePath = exportToCSV(processedData, outputFilename);
            } else {
                filePath = exportToExcel(processedData, outputFilename);
            }
            
            // Get just the filename for the response
            const justFileName = path.basename(filePath);
            
            res.json({
                success: true,
                message: 'JSON file processed successfully',
                fileName: justFileName,
                downloadUrl: `/api/download?file=${justFileName}`
            });
        } catch (error) {
            console.error('Processing error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // Handle JSON file processing with contact info
    async processJsonContact(req, res) {
        try {
            const parsed = jsonSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: parsed.error.issues[0].message });
            }
            const { filename, outputFormat } = parsed.data;

            // Process the JSON file with contact info
            const processedData = await processJsonFileWithContactInfo(filename);

            // Generate output filename
            const baseFilename = path.basename(filename, '.json').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFilename = `${baseFilename}_with_contacts_${timestamp}`;
            
            // Export to requested format
            let filePath;
            if (outputFormat.toLowerCase() === 'csv') {
                filePath = exportToCSV(processedData, outputFilename);
            } else {
                filePath = exportToExcel(processedData, outputFilename);
            }
            
            // Get just the filename for the response
            const justFileName = path.basename(filePath);
            
            res.json({
                success: true,
                message: 'JSON file processed successfully with contact info',
                fileName: justFileName,
                downloadUrl: `/api/download?file=${justFileName}`
            });
        } catch (error) {
            console.error('Processing error:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    // Handle file downloads
    downloadFile(req, res) {
        try {
            const { file } = req.query;
            if (!file) {
                return res.status(400).json({ error: 'File parameter is required' });
            }
            
            // Prevent path traversal attacks
            const sanitizedFilename = path.basename(file);
            const filePath = path.join(process.cwd(), 'results', sanitizedFilename);
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }
            
            res.download(filePath);
        } catch (error) {
            console.error('Download error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // Handle stopping the scraper and marking the job as stopped in the DB
    stopScraping(req, res) {
        try {
            const { jobId } = req.body || {};
            const result = scraperService.requestStopScraping() || { success: true, message: "Scraping process stopped" };
            if (jobId) {
                prisma.scraping_jobs.update({
                    where: { id: jobId },
                    data: { status: 'stopped' },
                }).catch(err => console.error('Failed to mark job stopped:', err.message));
            }
            res.json(result);
        } catch (error) {
            console.error('Error stopping scraper:', error);
            res.status(500).json({ success: false, message: 'Failed to stop scraping process' });
        }
    },

    // Handle pausing the scraper and marking the job as paused in the DB
    async pauseScraping(req, res) {
        try {
            const { jobId } = req.body || {};
            scraperService.requestStopScraping();
            if (jobId) {
                await prisma.scraping_jobs.update({
                    where: { id: jobId },
                    data: { status: 'paused' },
                });
            }
            res.json({ success: true, message: 'Scraping paused' });
        } catch (error) {
            console.error('Error pausing scraper:', error);
            res.status(500).json({ success: false, message: 'Failed to pause scraping process' });
        }
    },
    
    // Add this function to get the current scraping status
    getScrapeStatus(req, res) {
        try {
            const status = scraperService.getScrapingStats();
            res.json(status);
        } catch (error) {
            console.error('Error getting scraper status:', error);
            res.status(500).json({ success: false, message: 'Failed to get scraping status' });
        }
    },

    // Enrich an existing scraped Excel/CSV file with LinkedIn data via Apify.
    // Expects: { filename, types, outputFormat?, organizationId? }
    // - filename: basename of a file in results/ (e.g. "search_2024.xlsx")
    // - types: array from ['company','employees','profile']
    // - outputFormat: 'excel' | 'csv' (defaults to the input format)
    // - organizationId: used to record the enrichment_job in the DB
    async enrichFile(req, res) {
        const enrichSchema = z.object({
            filename: z.string().min(1).max(255).regex(/^[\w\-. ]+\.(xlsx|csv)$/i, 'Must be an .xlsx or .csv file'),
            types: z.array(z.enum(['employees', 'profile'])).min(1),
            outputFormat: z.enum(['excel', 'csv']).optional(),
            organizationId: z.string().uuid().optional(),
            // Cascade scope for the 'profile' type. Defaults to a capped run.
            scope: z.enum(['all', 'capped', 'decision-makers']).optional(),
            profileCap: z.coerce.number().int().min(1).max(1000).optional(),
        });

        const parsed = enrichSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.issues[0].message });
        }

        const { filename, types, organizationId } = parsed.data;
        const scope = parsed.data.scope || 'capped';
        const profileCap = parsed.data.profileCap;
        const isCascade = types.includes('profile');

        // Read the org's available enrichment credits (PAYG balance). The
        // enrichment_credit_balance column lives in the Supabase SQL migration but
        // is not in prisma/schema.prisma, so we read it with raw SQL to avoid
        // depending on the generated client being regenerated. (There is no
        // subscription->plan link in the schema, so bundled quota isn't resolvable
        // here; PAYG balance is the enforced source, matching the billing page.)
        const getAvailableCredits = async () => {
            if (!organizationId) return null; // no org => billing not enforced
            const rows = await prisma.$queryRaw`
                SELECT COALESCE(enrichment_credit_balance, 0) AS payg
                FROM organizations
                WHERE id = ${organizationId}::uuid
                LIMIT 1`;
            if (!rows || rows.length === 0) return 0;
            return Number(rows[0].payg) || 0;
        };

        // Cascade pre-check: run the (cheaper) employees stage to learn the exact
        // profile count, price the run, and BLOCK before scraping profiles if the
        // org can't afford it. plannedCascade is reused by the enrich run so the
        // employees actor isn't called twice.
        let plannedCascade = null;
        if (isCascade) {
            try {
                plannedCascade = await scraperService.planCascade(filename, { scope, profileCap });
            } catch (planErr) {
                return res.status(500).json({ error: planErr.message });
            }

            const perProfileRate = config.apify.cascadePerProfileByScope[scope]
                ?? config.apify.cascadePerProfileByScope.all;
            const estimate =
                plannedCascade.companyCount * config.apify.cascadeBasePerCompany +
                plannedCascade.profileCount * perProfileRate;

            const available = await getAvailableCredits();
            if (available !== null && estimate > available) {
                return res.status(402).json({
                    error: 'Insufficient enrichment credits for this cascade.',
                    required: estimate,
                    available,
                    shortfall: estimate - available,
                    companyCount: plannedCascade.companyCount,
                    profileCount: plannedCascade.profileCount,
                });
            }
        }

        // Create a DB tracking record if an org is provided.
        let jobRecord = null;
        if (organizationId) {
            try {
                jobRecord = await prisma.enrichment_jobs.create({
                    data: {
                        organization_id: organizationId,
                        source_file: filename,
                        types,
                        scope: isCascade ? scope : null,
                        status: 'running',
                    },
                });
            } catch (dbErr) {
                // DB tracking is best-effort — don't block enrichment if DB fails.
                console.error('Failed to create enrichment_job record:', dbErr);
            }
        }

        // Respond immediately once the job is recorded, then keep running the
        // actual Apify work in the background. This is deliberate: enrichment
        // (especially the profile cascade) can take minutes, and previously the
        // HTTP response — and therefore the work itself — was tied to the
        // lifetime of the browser's fetch, so navigating away from the enrich
        // page killed the job. Detaching here matches how scraping jobs are
        // dispatched (see web/src/lib/scraperQueue.ts dispatchQueue).
        res.status(202).json({
            success: true,
            jobId: jobRecord?.id || null,
            status: 'running',
        });

        runEnrichmentJob({ filename, types, scope, profileCap, plannedCascade, organizationId, jobRecord })
            .catch((err) => console.error('Background enrichment job failed:', err));
    },
};

// Runs the actual enrichment work after the HTTP response has already been
// sent (see enrichFile above). Persists success/failure to enrichment_jobs so
// the frontend can poll for status independent of any single request.
async function runEnrichmentJob({ filename, types, scope, profileCap, plannedCascade, organizationId, jobRecord }) {
    try {
        // Live progress: total_rows is otherwise-unused on enrichment_jobs, so it
        // doubles here as "items scraped so far in the current Apify run" — polled
        // by the frontend via GET /api/enrich/status. Writes are best-effort and
        // never allowed to fail the enrichment itself.
        const onProgress = jobRecord
            ? (count) => {
                prisma.enrichment_jobs
                    .update({ where: { id: jobRecord.id }, data: { total_rows: count } })
                    .catch(() => {});
            }
            : undefined;

        const { enrichedCount, creditsByType, cascade, outputPath, r2Key } =
            await enrichScrapedFile(filename, types, { scope, profileCap, plannedCascade, onProgress });

        const outputBasename = path.basename(outputPath);

        // Compute total credits charged (success only — counted inside enrichScrapedFile).
        // Cascade uses flat-base-per-company + per-scraped-profile pricing; the
        // non-cascade types keep their per-row credit costs.
        let creditsCharged =
            (creditsByType.company || 0) * config.apify.creditCost.company +
            (creditsByType.employees || 0) * config.apify.creditCost.employees;
        if (cascade) {
            const perProfileRate = config.apify.cascadePerProfileByScope[cascade.scope]
                ?? config.apify.cascadePerProfileByScope.all;
            creditsCharged +=
                cascade.companyCount * config.apify.cascadeBasePerCompany +
                cascade.profilesScraped * perProfileRate;
        } else {
            creditsCharged += (creditsByType.profile || 0) * config.apify.creditCost.profile;
        }

        // Deduct the charge from the org's PAYG balance (best-effort, raw SQL —
        // see getAvailableCredits for why the column isn't via the Prisma model).
        if (organizationId && creditsCharged > 0) {
            try {
                await prisma.$executeRaw`
                    UPDATE organizations
                    SET enrichment_credit_balance = COALESCE(enrichment_credit_balance, 0) - ${creditsCharged}
                    WHERE id = ${organizationId}::uuid`;
            } catch (balErr) {
                console.error('Failed to decrement enrichment_credit_balance:', balErr);
            }
        }

        // Persist enrichment_results summary and mark job completed.
        if (jobRecord) {
            try {
                // Write one result row per type as a summary entry.
                const resultRows = Object.entries(creditsByType).map(([type, count]) => ({
                    job_id: jobRecord.id,
                    identifier: `${type}:batch`,
                    type,
                    linkedin_data: { enrichedCount: count },
                }));
                if (resultRows.length > 0) {
                    await prisma.enrichment_results.createMany({ data: resultRows });
                }
                await prisma.enrichment_jobs.update({
                    where: { id: jobRecord.id },
                    data: {
                        status: 'completed',
                        enriched_count: enrichedCount,
                        credits_charged: creditsCharged,
                        output_file: outputBasename,
                        completed_at: new Date(),
                    },
                });
            } catch (dbErr) {
                console.error('Failed to update enrichment_job record:', dbErr);
            }
        }
    } catch (error) {
        console.error('Enrichment error:', error);

        if (jobRecord) {
            try {
                await prisma.enrichment_jobs.update({
                    where: { id: jobRecord.id },
                    data: { status: 'failed', completed_at: new Date() },
                });
            } catch (_) {}
        }
    }
}

module.exports = scraperController; 