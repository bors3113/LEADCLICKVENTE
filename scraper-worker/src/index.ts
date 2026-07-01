import puppeteer from '@cloudflare/puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { scrapeCurrentView, extractPlaceDetails } from './scraper';

export interface Env {
  MYBROWSER: puppeteer.BrowserWorker;
  RESULTS_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

const DEFAULT_LIMIT = 50;
// How often to push the live scraped count to the DB during detail extraction.
const PROGRESS_UPDATE_EVERY = 3;

/** Build a minimal CSV string from an array of result objects. */
function toCSV(rows: any[]): string {
  if (rows.length === 0) return '';
  const headers = ['name', 'address', 'phone', 'website', 'rating', 'category'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/status') {
        return new Response('Worker is running and ready to scrape.', { status: 200 });
      }

      if (request.method === 'POST' && url.pathname === '/scrape') {
        const body: any = await request.json();
        const { query, jobId, limit } = body;

        if (!query) {
          return new Response('Query parameter is required', { status: 400 });
        }

        const parsedLimit = Math.max(1, Math.min(1000, parseInt(String(limit), 10) || DEFAULT_LIMIT));

        ctx.waitUntil(this.runScraperJob(env, query, jobId, parsedLimit));
        return new Response(`Started scraping job for: ${query} (limit ${parsedLimit})`, { status: 202 });
      }

      return new Response('Method not allowed or endpoint not found', { status: 404 });
    } catch (error: any) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },

  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const jobData = message.body;
        const limit = Math.max(1, Math.min(1000, parseInt(String(jobData.limit), 10) || DEFAULT_LIMIT));
        console.log(`Processing job ${jobData.jobId} for query: ${jobData.query} (limit ${limit})`);

        await this.runScraperJob(env, jobData.query, jobData.jobId, limit);
        message.ack();
      } catch (error) {
        console.error(`Failed to process message:`, error);
        message.retry();
      }
    }
  },

  async runScraperJob(env: Env, query: string, jobId: string | undefined, limit: number): Promise<void> {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    if (jobId) {
      await supabase
        .from('scraping_jobs')
        .update({ status: 'running', progress: 0 })
        .eq('id', jobId);
    }

    try {
      // runScraper streams progress into scraping_jobs.progress as it extracts.
      const results = await this.runScraper(env, query, limit, supabase, jobId);

      if (jobId && results.length > 0) {
        const recordsToInsert = results.map((r: any) => ({
          job_id: jobId,
          business_name: r.name,
          address: r.address,
          phone: r.phone,
          website: r.link,
          rating: r.rating,
          raw_data: r,
        }));
        await supabase.from('extracted_records').insert(recordsToInsert);

        const r2Key = `results/${jobId}.csv`;
        await env.RESULTS_BUCKET.put(r2Key, toCSV(results), {
          httpMetadata: { contentType: 'text/csv' },
        });

        const { data: currentJob } = await supabase
          .from('scraping_jobs')
          .select('config')
          .eq('id', jobId)
          .single();

        const updatedConfig = { ...((currentJob?.config as object) ?? {}), resultFile: r2Key };
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'completed',
            progress: results.length,
            completed_at: new Date().toISOString(),
            config: updatedConfig,
          })
          .eq('id', jobId);
      } else if (jobId) {
        await supabase
          .from('scraping_jobs')
          .update({ status: 'completed', progress: 0, completed_at: new Date().toISOString() })
          .eq('id', jobId);
      }
    } catch (err) {
      if (jobId) {
        await supabase.from('scraping_jobs').update({ status: 'failed' }).eq('id', jobId);
      }
      throw err;
    }
  },

  async runScraper(
    env: Env,
    query: string,
    limit: number,
    supabase?: SupabaseClient,
    jobId?: string
  ): Promise<any[]> {
    console.log(`Starting Cloudflare browser for query: ${query} (limit ${limit})`);
    let browser;
    try {
      browser = await puppeteer.launch(env.MYBROWSER);
      const page = await browser.newPage();

      const formattedQuery = encodeURIComponent(query);
      await page.goto(`https://www.google.com/maps/search/${formattedQuery}?hl=en`, {
        waitUntil: 'domcontentloaded',
      });

      await new Promise(r => setTimeout(r, 3000));

      // Collect up to `limit` basic results (name + link) from the map feed.
      const basicResults = await scrapeCurrentView(page as any, limit);
      console.log(`Found ${basicResults.length} basic results. Extracting details...`);

      const enrichedResults: any[] = [];
      for (const result of basicResults) {
        if (enrichedResults.length >= limit) break;
        if (result.link) {
          const details = await extractPlaceDetails(browser as any, result.link);
          enrichedResults.push({ ...result, ...details });

          // Stream the live count so the dashboard's realtime table ticks up.
          if (
            supabase &&
            jobId &&
            enrichedResults.length % PROGRESS_UPDATE_EVERY === 0
          ) {
            await supabase
              .from('scraping_jobs')
              .update({ progress: enrichedResults.length })
              .eq('id', jobId);
          }
        }
      }

      await browser.close();
      return enrichedResults;
    } catch (error) {
      console.error(`Scraping error:`, error);
      if (browser) await browser.close();
      throw error;
    }
  },
};
