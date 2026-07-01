import puppeteer from '@cloudflare/puppeteer';
import { createClient } from '@supabase/supabase-js';
import { scrapeCurrentView, extractPlaceDetails } from './scraper';

export interface Env {
  MYBROWSER: puppeteer.BrowserWorker;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export default {
  // HTTP fetch handler for testing or direct job invocation
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      
      // Simple status check
      if (url.pathname === '/status') {
        return new Response('Worker is running and ready to scrape.', { status: 200 });
      }

      // Test scraper via HTTP (not recommended for long jobs, but good for testing)
      if (request.method === 'POST' && url.pathname === '/scrape') {
        const body: any = await request.json();
        const query = body.query;
        
        if (!query) {
          return new Response('Query parameter is required', { status: 400 });
        }
        
        // Spawn the background scraping task
        ctx.waitUntil(this.runScraper(env, query));
        return new Response(`Started scraping job for: ${query}`, { status: 202 });
      }
      
      return new Response('Method not allowed or endpoint not found', { status: 404 });
    } catch (error: any) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },

  // Queue consumer handler
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const jobData = message.body;
        console.log(`Processing job ${jobData.jobId} for query: ${jobData.query}`);
        
        // Setup Supabase client
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
        
        // Update job status to running
        await supabase
          .from('scraping_jobs')
          .update({ status: 'running' })
          .eq('id', jobData.jobId);
          
        // Run the actual scraper logic
        const results = await this.runScraper(env, jobData.query);
        
        // Save extracted records individually
        if (results && results.length > 0) {
          const recordsToInsert = results.map((r: any) => ({
            job_id: jobData.jobId,
            business_name: r.name,
            website: r.link,
            raw_data: r
          }));
          
          await supabase.from('extracted_records').insert(recordsToInsert);
        }
        
        await supabase
          .from('scraping_jobs')
          .update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() })
          .eq('id', jobData.jobId);
          
        message.ack();
      } catch (error) {
        console.error(`Failed to process message:`, error);
        // Do not ack the message so it goes back to the queue for retry
        message.retry();
      }
    }
  },
  
  // Core scraping logic using Cloudflare Browser Rendering API
  async runScraper(env: Env, query: string): Promise<any[]> {
    console.log(`Starting Cloudflare browser for query: ${query}`);
    let browser;
    try {
      browser = await puppeteer.launch(env.MYBROWSER);
      const page = await browser.newPage();
      
      // Navigate to Google Maps
      const formattedQuery = encodeURIComponent(query);
      await page.goto(`https://www.google.com/maps/search/${formattedQuery}?hl=en`, {
        waitUntil: 'domcontentloaded',
      });
      
      await new Promise(r => setTimeout(r, 3000));
      
      // Use our abstracted scraping logic
      const basicResults = await scrapeCurrentView(page as any, 10); // limited to 10 for safety in tests
      console.log(`Found ${basicResults.length} basic results. Extracting details...`);
      
      // Optional: Enrich with details
      const enrichedResults = [];
      for (const result of basicResults) {
        if (result.link) {
          const details = await extractPlaceDetails(browser as any, result.link);
          enrichedResults.push({ ...result, ...details });
        }
      }
      
      await browser.close();
      return enrichedResults;
    } catch (error) {
      console.error(`Scraping error:`, error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
};
