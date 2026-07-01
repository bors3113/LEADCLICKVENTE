import puppeteer, { Page, Browser } from '@cloudflare/puppeteer';

// Helper to format search query
export function formatSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, '+');
}

// Adapted scrape function for Cloudflare Workers
export async function scrapeCurrentView(page: Page, limit: number | null = null): Promise<any[]> {
  const results: any[] = [];
  
  // This is a simplified version of the logic for the edge environment
  // A full implementation would need to handle infinite scrolling and deduplication
  
  const scrollAndCollect = async () => {
    return await page.evaluate(async () => {
      const containerSelectors = ['[role="feed"]', '[role="main"]', '.section-scrollbox'];
      let targetDiv: Element | null = null;
      
      for (const selector of containerSelectors) {
        targetDiv = document.querySelector(selector);
        if (targetDiv) break;
      }
      
      if (!targetDiv) targetDiv = document.body;
      
      // Scroll to trigger lazy loading
      for (let i = 0; i < 3; i++) {
        targetDiv.scrollBy(0, 1000);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Extract results
      const linkSelectors = ['a.hfpxzc', 'a[href*="/maps/place/"]'];
      let extracted = [];
      
      for (const selector of linkSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          extracted = Array.from(elements).map(element => {
            return {
              name: element.getAttribute('aria-label') || element.textContent?.trim(),
              link: element.getAttribute('href')
            };
          }).filter(item => item.name && item.link && item.link.includes('/maps/place/'));
          
          if (extracted.length > 0) break;
        }
      }
      
      return extracted;
    });
  };

  const maxUnchangedScrolls = 3;
  let unchangedScrolls = 0;
  const observedNames = new Set<string>();

  while (unchangedScrolls < maxUnchangedScrolls) {
    const newResults = await scrollAndCollect();
    let foundNew = false;
    
    for (const result of newResults) {
      if (!observedNames.has(result.name!)) {
        observedNames.add(result.name!);
        results.push(result);
        foundNew = true;
        
        if (limit && results.length >= limit) {
          return results;
        }
      }
    }
    
    if (!foundNew) {
      unchangedScrolls++;
    } else {
      unchangedScrolls = 0;
    }
  }

  return results;
}

// Function to extract detailed information for a specific place
export async function extractPlaceDetails(browser: Browser, url: string): Promise<any> {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const details = await page.evaluate(() => {
      // Very basic extraction logic
      const addressEl = document.querySelector('button[data-item-id="address"]');
      const phoneEl = document.querySelector('button[data-item-id^="phone:"]');
      const websiteEl = document.querySelector('a[data-item-id="authority"]');
      
      return {
        address: addressEl?.getAttribute('aria-label')?.replace('Address: ', '').trim() || '',
        phone: phoneEl?.getAttribute('aria-label')?.replace('Phone: ', '').trim() || '',
        website: websiteEl?.getAttribute('href') || ''
      };
    });
    
    return details;
  } catch (error) {
    console.error(`Error extracting details for ${url}:`, error);
    return { address: '', phone: '', website: '' };
  } finally {
    await page.close();
  }
}
