const config = require('../config');
const puppeteer = require('puppeteer');
const { launchCloudflareBrowser } = require('./cloudflare-browser');
const fs = require('fs');
const fsp = require('fs/promises');
const { Cluster } = require('puppeteer-cluster');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { RealTimeExporter } = require('../utils/realTimeExporter');

puppeteerExtra.use(StealthPlugin());

// HTTP client configuration for scraping
const getHttpHeaders = () => ({
    'User-Agent': config.browser.userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
});

// Create axios instance with common config
const httpClient = axios.create({
    timeout: config.scraper.httpTimeoutMs,
    headers: getHttpHeaders(),
    maxRedirects: 5,
});

// Copy all your existing functions here (scrapeInitialData, scrapeGoogleMapsData, etc.)
// Remove the direct execution code (runFullScrape() call)
function formatSearchQuery(query) {
    return query.trim().replace(/\s+/g, '+');
  }

  // Unwrap Google's redirect wrapper so the Excel "website" column shows the
  // real destination, not "https://www.google.com/url?q=...". Google uses this
  // wrapper on localized/consent pages: the real URL sits in the `q` (or `url`)
  // query param, URL-encoded. Returns the cleaned URL, or the input unchanged
  // if it isn't a Google redirect.
  function cleanWebsiteUrl(url) {
      if (!url || url === 'N/A') return url;
      try {
          const parsed = new URL(url);
          const isGoogleRedirect =
              /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname) &&
              (parsed.pathname === '/url' || parsed.pathname.startsWith('/url'));
          if (isGoogleRedirect) {
              const real = parsed.searchParams.get('q') || parsed.searchParams.get('url');
              if (real) return real;
          }
          return url;
      } catch {
          // Not a parseable URL — try a regex fallback for the ?q= param.
          const m = url.match(/[?&](?:q|url)=([^&]+)/);
          return m ? decodeURIComponent(m[1]) : url;
      }
  }

  // Read the current map viewport center (lat/lng/zoom) from the page URL.
  // Google rewrites the URL to include "@<lat>,<lng>,<zoom>z" once the map
  // settles, so this lets us re-center deterministically instead of mouse drags.
  // Returns null if the URL doesn't yet contain coordinates.
  function getMapCenter(page) {
      const match = page.url().match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/);
      if (!match) return null;
      return {
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2]),
          zoom: parseFloat(match[3])
      };
  }

  // Build an overlapping grid of viewport centers around a start point.
  // Tile size is derived from the Web Mercator meters-per-pixel formula so the
  // grid adapts to zoom and latitude rather than using fixed pixel offsets.
  // ringCount controls how far out the grid extends (ringCount=1 => 3x3 grid).
  function buildTiledCenters(centerLat, centerLng, zoom, ringCount = 1, viewport = config.browser.defaultViewport) {
      // Meters per pixel at this zoom/latitude (standard Web Mercator).
      const metersPerPixel = (156543.03392 * Math.cos(centerLat * Math.PI / 180)) / Math.pow(2, zoom);

      // Width/height of one viewport in meters. Overlap tiles at 60% of the
      // viewport so businesses near a tile boundary aren't missed.
      const overlapFactor = 0.6;
      const stepMetersX = viewport.width * metersPerPixel * overlapFactor;
      const stepMetersY = viewport.height * metersPerPixel * overlapFactor;

      // Convert a meters offset to a lat/lng delta.
      const metersToLat = (m) => m / 111320;
      const metersToLng = (m) => m / (111320 * Math.cos(centerLat * Math.PI / 180));

      const centers = [];
      for (let row = -ringCount; row <= ringCount; row++) {
          for (let col = -ringCount; col <= ringCount; col++) {
              centers.push({
                  lat: centerLat + metersToLat(row * stepMetersY),
                  lng: centerLng + metersToLng(col * stepMetersX),
                  zoom
              });
          }
      }
      return centers;
  }

  // Detect Google CAPTCHA / blocking / rate-limit pages by inspecting body text.
  // Reused after the first load and after every tile navigation.
  async function checkForBlocking(page) {
      const indicators = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return {
              hasCaptcha: bodyText.includes('captcha') || bodyText.includes('verify'),
              hasBlocked: bodyText.includes('blocked') || bodyText.includes('access denied'),
              hasRateLimit: bodyText.includes('rate limit') || bodyText.includes('too many requests')
          };
      });
      indicators.isBlocked = indicators.hasCaptcha || indicators.hasBlocked || indicators.hasRateLimit;
      return indicators;
  }

  // Detect and dismiss Google's cookie-consent interstitial. Non-US Cloudflare
  // egress IPs trigger a "Before you go to Google Maps" wall that hijacks the
  // DOM so every Maps selector fails. We look for the wall (by title/host or a
  // consent form), click a consent button (accept preferred, reject as
  // fallback), then re-navigate to the original search URL. Returns true if a
  // consent page was handled.
  async function handleConsentPage(page, searchUrl) {
      try {
          const url = page.url();
          const title = (await page.title()) || '';
          const looksLikeConsent =
              url.includes('consent.google.') ||
              url.includes('/consent') ||
              /before you go|antes de ir|bevor sie|avant de continuer|prima di|voordat je/i.test(title);

          if (!looksLikeConsent) {
              // Also check for an in-page consent form even if the title looks normal.
              const hasForm = await page.evaluate(() =>
                  !!document.querySelector('form[action*="consent"], button[aria-label*="Accept"], button[aria-label*="Aceptar"], #L2AGLb')
              );
              if (!hasForm) return false;
          }

          console.log('Consent interstitial detected. Attempting to dismiss...');

          // Try common "accept all" buttons across locales, then "reject all".
          const clicked = await page.evaluate(() => {
              const trySelectors = [
                  '#L2AGLb',                                  // "Accept all" (id used on consent.google.com)
                  'button[aria-label*="Accept all"]',
                  'button[aria-label*="Aceptar todo"]',
                  'form[action*="consent"] button',
                  'button[jsname="b3VHJd"]',                  // reject-all fallback
              ];
              for (const sel of trySelectors) {
                  const el = document.querySelector(sel);
                  if (el) { el.click(); return sel; }
              }
              // Last resort: click first button inside a consent form.
              const formBtn = document.querySelector('form[action*="consent"] button, form[action*="save"] button');
              if (formBtn) { formBtn.click(); return 'form-button'; }
              return null;
          });

          if (clicked) {
              console.log(`Clicked consent button: ${clicked}`);
          } else {
              console.log('No consent button found to click.');
          }

          // Wait for navigation/settle, then force back to the search URL so we
          // land on Maps regardless of where the consent redirect sent us.
          await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));
          console.log(`Re-navigated after consent. New title: ${await page.title().catch(() => '?')}`);
          return true;
      } catch (err) {
          console.log(`handleConsentPage error (non-fatal): ${err.message}`);
          return false;
      }
  }

  async function scrapeCurrentView(page, limit = null) {
    const results = [];
    const observedNames = new Set();
    const processedLinks = new Set();
    const CONCURRENT_LIMIT = config.scraper.concurrentLimit;
    let limitReached = false;
    let uniqueItemsFound = 0;
    const DEDUPLICATION_INTERVAL = 10;

    // Fix: seed totalItemsToScrape from the limit immediately so the counter
    // denominator is correct before any incrementScrapedCount() calls happen.
    if (limit && limit > 0 && totalItemsToScrape === 0) {
        totalItemsToScrape = limit;
    }
    
    const scrollAndCollect = async () => {
        // Combined evaluation to reduce round trips to the browser
        return await page.evaluate(async () => {
            // Try multiple selectors for the results container
            const containerSelectors = [
                '[role="feed"]',
                '[role="main"]',
                '.section-layout',
                '.section-scrollbox',
                '[data-js-log-root]'
            ];
            
            let targetDiv = null;
            for (const selector of containerSelectors) {
                targetDiv = document.querySelector(selector);
                if (targetDiv) {
                    console.log(`Found results container with selector: ${selector}`);
                    break;
                }
            }
            
            if (!targetDiv) {
                console.log('No results container found, trying body');
                targetDiv = document.body;
            }
            
            // Scroll faster and more aggressively
            for (let i = 0; i < 3; i++) {
                targetDiv.scrollBy(0, 1000);
                await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 300ms
            }

            // Try multiple selectors for result links
            const linkSelectors = [
                'a.hfpxzc',
                'a[href*="/maps/place/"]',
                'a[data-result-index]',
                'div[role="article"] a',
                'div[jsaction*="placeCard"] a'
            ];
            
            let results = [];
            for (const selector of linkSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`Found ${elements.length} results with selector: ${selector}`);
                    results = Array.from(elements).reduce((acc, element) => {
                        const name = element.getAttribute('aria-label') || element.textContent.trim();
                        const link = element.getAttribute('href');
                        if (name && link && link.includes('/maps/place/')) {
                            acc.push({ name, link });
                        }
                        return acc;
                    }, []);
                    if (results.length > 0) break;
                }
            }
            
            return results;
        });
    };

    let unchangedScrolls = 0;
    const maxUnchangedScrolls = config.scraper.maxUnchangedScrolls;

    // Detect Google's "You've reached the end of the list" sentinel so we can
    // stop the moment the feed is exhausted instead of guessing with
    // maxUnchangedScrolls (which can stop early or spin needlessly).
    const reachedEndOfList = async () => {
        return await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            if (text.includes("you've reached the end of the list") ||
                text.includes('reached the end of the list') ||
                text.includes("vous êtes arrivé à la fin de la liste") ||
                text.includes('fin de la liste')) {
                return true;
            }
            // Fallback: Google renders an end-of-feed spacer with class p2Du4d /
            // an empty .HlvSq node at the bottom of a fully-loaded feed.
            return document.querySelector('.PbZDve, .m6QErb .p2Du4d') !== null;
        });
    };

    const processingQueue = [];

    // In your scrapeCurrentView function, modify the processBatch function:
    async function processBatch(batch) {
        const promises = batch.map(async (result) => {
            if (isStopRequestedGlobal) {
                console.log('Stop requested during batch processing.');
                return;
            }
            
            try {
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
                
                const newPage = await page.browser().newPage();
                
                await newPage.setRequestInterception(true);
                newPage.on('request', (req) => {
                    const resourceType = req.resourceType();
                    if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
                
                await newPage.setUserAgent(config.browser.userAgent);
                
                await newPage.goto(result.link, { 
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
                
                await newPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
                
                // FIX: Change this line from additionalData to scrapedData
                const scrapedData = await scrapeGoogleMapsData(newPage);
                Object.assign(result, scrapedData);
                
                // Extract contact information from website if available
                if (scrapedData.website && scrapedData.website !== "N/A") {
                    try {
                        console.log(`Visiting website: ${scrapedData.website} to extract contact info`);
                        const contactInfo = await extractContactInfo(scrapedData.website);
                        result.contactInfo = contactInfo;
                        
                        if (contactInfo.emails.length > 0) {
                            console.log(`Found emails: ${contactInfo.emails.join(', ')}`);
                        }
                        
                        Object.entries(contactInfo.socialMedia).forEach(([platform, links]) => {
                            if (links.length > 0) {
                                console.log(`Found ${platform}: ${links.length} links`);
                            }
                        });
                    } catch (websiteError) {
                        console.error(`Error extracting contact info from website: ${websiteError.message}`);
                        result.contactInfo = {
                            emails: [],
                            socialMedia: {
                                facebook: [],
                                instagram: [],
                                twitter: [],
                                linkedin: []
                            }
                        };
                    }
                } else {
                    result.contactInfo = {
                        emails: [],
                        socialMedia: {
                            facebook: [],
                            instagram: [],
                            twitter: [],
                            linkedin: []
                        }
                    };
                }
                
                await newPage.close();
                processedLinks.add(result.link);
                incrementScrapedCount();
                
                // Save to real-time export
                if (realTimeExporter) {
                    realTimeExporter.addItem(result);
                }
                
                console.log(`Processed: ${result.name}`);
            } catch (error) {
                console.error(`Error collecting data for ${result.name}:`, error.message);
                processedLinks.add(result.link);
                
                result.contactInfo = {
                    emails: [],
                    socialMedia: {
                        facebook: [],
                        instagram: [],
                        twitter: [],
                        linkedin: []
                    }
                };
                
                incrementScrapedCount();
            }
        });
        
        if (isStopRequestedGlobal) {
            console.log('Stop requested before starting batch processing.');
            return;
        }
        
        await Promise.all(promises);
    }

    while (unchangedScrolls < maxUnchangedScrolls) {
        // Check if stop was requested
        if (isStopRequestedGlobal) {
            console.log('Stop requested during scrolling. Returning collected results so far.');
            break;
        }
        
        const newResults = await scrollAndCollect();
        let foundNew = false;
        
        for (const result of newResults) {
            if (!observedNames.has(result.name) && !processedLinks.has(result.link)) {
                observedNames.add(result.name);
                results.push(result);
                processingQueue.push(result);
                foundNew = true;
                uniqueItemsFound++;
                
                console.log(`Found unique item ${uniqueItemsFound}: ${result.name}`);
                
                // Check if we've reached the limit based on unique items
                if (limit && limit > 0 && uniqueItemsFound >= limit) {
                    console.log(`Reached limit of ${limit} unique results. Stopping scraping.`);
                    limitReached = true;
                    break;
                }
                
                if (processingQueue.length >= CONCURRENT_LIMIT) {
                    const batch = processingQueue.splice(0, CONCURRENT_LIMIT);
                    await processBatch(batch);
                    
                    // Check if stop was requested after processing a batch
                    if (isStopRequestedGlobal) {
                        console.log('Stop requested after batch processing. Returning collected results so far.');
                        break;
                    }
                    
                    // Check if we've reached the limit after processing batch
                    if (limit && limit > 0 && uniqueItemsFound >= limit) {
                        console.log(`Reached limit of ${limit} unique results after batch processing. Stopping scraping.`);
                        limitReached = true;
                        break;
                    }
                }
                
                // Periodic deduplication check every 10 items
                if (uniqueItemsFound % DEDUPLICATION_INTERVAL === 0 && uniqueItemsFound > 0) {
                    console.log(`Periodic deduplication check at ${uniqueItemsFound} items...`);
                    
                    // Count actual unique items in results array
                    const actualUniqueCount = new Set(results.map(r => r.name)).size;
                    const actualUniqueLinks = new Set(results.map(r => r.link)).size;
                    
                    console.log(`Current tracking: ${uniqueItemsFound} unique items`);
                    console.log(`Actual unique names: ${actualUniqueCount}, Actual unique links: ${actualUniqueLinks}`);
                    
                    // If there's a discrepancy, update the tracking
                    if (actualUniqueCount !== uniqueItemsFound) {
                        console.log(`Updating uniqueItemsFound from ${uniqueItemsFound} to ${actualUniqueCount}`);
                        uniqueItemsFound = actualUniqueCount;
                        
                        // Check if we've reached the limit after correction
                        if (limit && limit > 0 && uniqueItemsFound >= limit) {
                            console.log(`Reached limit of ${limit} unique results after deduplication check. Stopping scraping.`);
                            limitReached = true;
                            break;
                        }
                    }
                }
            }
        }
        
        // Check again if stop was requested during this scroll iteration
        if (isStopRequestedGlobal || limitReached) {
            console.log('Stopping scraping due to stop request or limit reached.');
            break;
        }

        if (!foundNew) {
            unchangedScrolls++;
            // Only trust the end-of-list sentinel after a scroll yielded nothing
            // new, so we don't bail while the feed is still lazy-loading.
            if (await reachedEndOfList()) {
                console.log('Reached end of results list. Stopping scroll.');
                break;
            }
        } else {
            unchangedScrolls = 0;
        }

        // Reduced inter-scroll delay
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50))); // Reduced from 100ms
    }

    // Process any remaining items in the queue if there are any and we haven't been asked to stop
    if (processingQueue.length > 0 && !isStopRequestedGlobal) {
        console.log(`Processing remaining ${processingQueue.length} items in queue...`);
        await processBatch(processingQueue);
    }

    // Check for duplicates and ensure we have the right number of unique items
    if (limit && limit > 0) {
        console.log(`Checking for duplicates after collection. Current items: ${results.length}, Target: ${limit}`);
        
        // Remove duplicates from results array
        const uniqueResults = [];
        const seenNames = new Set();
        const seenLinks = new Set();
        
        for (const result of results) {
            if (!seenNames.has(result.name) && !seenLinks.has(result.link)) {
                seenNames.add(result.name);
                seenLinks.add(result.link);
                uniqueResults.push(result);
                
                // Stop when we reach the limit
                if (uniqueResults.length >= limit) {
                    break;
                }
            }
        }
        
        const removedCount = results.length - uniqueResults.length;
        if (removedCount > 0) {
            console.log(`Removed ${removedCount} duplicate items. Now have ${uniqueResults.length} unique items.`);
        }
        
        // Update results array with deduplicated items
        results.length = 0;
        results.push(...uniqueResults);
        
        // Update tracking variables
        uniqueItemsFound = uniqueResults.length;
        observedNames.clear();
        processedLinks.clear();
        for (const result of uniqueResults) {
            observedNames.add(result.name);
            processedLinks.add(result.link);
        }
        
        console.log(`After deduplication: ${uniqueItemsFound} unique items (target: ${limit})`);
        
        // IMPORTANT: Don't continue scraping if we've reached the limit
        if (uniqueItemsFound >= limit) {
            console.log(`Reached limit of ${limit} unique results. Stopping scraping.`);
            limitReached = true;
        }
    }

    // Final check to ensure we don't exceed the limit
    if (limit && limit > 0 && results.length > limit) {
        console.log(`Trimming results to exact limit of ${limit} items (had ${results.length})`);
        results = results.slice(0, limit);
        uniqueItemsFound = results.length; // Update the tracking variable
    }

    // When no limit was given, estimate total from what we found (limit case already seeded above).
    if (results.length > 0 && totalItemsToScrape === 0) {
        totalItemsToScrape = Math.max(results.length * 2, 50);
    }

    console.log(`Returning ${results.length} unique results (requested limit: ${limit || 'none'})`);
    // Fix #3: expose whether the feed was fully exhausted so callers (navigateTiles)
    // can abort remaining tiles instead of navigating them needlessly.
    results._feedExhausted = !limitReached && !isStopRequestedGlobal;
    return results;
}

async function continuousDrag(page, startX, startY, dragSequence, limit = null) {
    // Safety check for limit parameter
    if (limit !== null && (limit <= 0 || isNaN(limit))) {
        console.log(`Invalid limit value: ${limit}. Skipping map dragging.`);
        return [];
    }
    
    const allResults = new Set();
    let lastDragEnd = Date.now(); // Track last drag time for more adaptive timing
    let limitReached = false;

    for (const { x, y } of dragSequence) {
        // Check if stop was requested or limit reached
        if (isStopRequestedGlobal || limitReached) {
            console.log('Stop requested or limit reached during map dragging. Halting further operations.');
            break;
        }
        
        try {
            // Adaptive timing - if we just did a drag recently, wait less time
            const timeSinceLastDrag = Date.now() - lastDragEnd;
            if (timeSinceLastDrag < 500) {
                await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
            }
            
            // Perform drag operation with more optimized parameters
            await page.mouse.move(startX, startY, { steps: 10 }); // Reduced from 50
            await page.mouse.down();
            
            // Use a single smooth motion with fewer steps
            await page.mouse.move(startX + x, startY + y, { 
                steps: 15, // Reduced from 25
                delay: 0  // No delay between moves
            });
            await page.mouse.up();
            
            // Update last drag time
            lastDragEnd = Date.now();
            
            // Adaptive wait time based on distance moved
            const dragDistance = Math.sqrt(x*x + y*y);
            const settleTime = Math.min(Math.max(dragDistance / 4, 500), 1000); // Between 500-1000ms
            await page.evaluate(time => new Promise(resolve => setTimeout(resolve, time)), settleTime);

            // More aggressive scraping strategy with faster abandonment of low-yield positions
            let keepScraping = true;
            let consecutiveEmptyScrolls = 0;
            const MAX_EMPTY_SCROLLS = 2;  // Reduced from 3 for faster abandonment

            while (keepScraping) {
                // Check if stop was requested or limit reached
                if (isStopRequestedGlobal || limitReached) {
                    console.log('Stop requested or limit reached during position scraping. Halting further scraping.');
                    keepScraping = false;
                    break;
                }
                
                console.log('Scraping at current position...');
                const previousSize = allResults.size;
                
                // Scrape elements in current view
                const remainingLimit = limit ? limit - allResults.size : null;
                const results = await scrapeCurrentView(page, remainingLimit);
                results.forEach(result => {
                    allResults.add(JSON.stringify(result));
                });

                const newItemsFound = allResults.size - previousSize;
                console.log(`Found ${newItemsFound} new items in this view. Total unique items: ${allResults.size}`);
                
                // Check if we've reached the limit
                if (limit && allResults.size >= limit) {
                    console.log(`Reached limit of ${limit} unique results during map interaction. Stopping.`);
                    limitReached = true;
                    break;
                }

                if (newItemsFound === 0) {
                    consecutiveEmptyScrolls++;
                    if (consecutiveEmptyScrolls >= MAX_EMPTY_SCROLLS) {
                        console.log('No new results found after multiple scrolls, moving to next position...');
                        keepScraping = false;
                    }
                } else {
                    // If we found more items but fewer than a threshold, reduce the number of required empty scrolls
                    if (newItemsFound <= 2) {
                        consecutiveEmptyScrolls += 0.5; // Partial increment as a compromise
                    } else {
                        consecutiveEmptyScrolls = 0; // Reset only if we found a significant number
                    }
                }

                // Further reduced delay before next scroll
                await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200))); // Reduced from 300
            }

        } catch (error) {
            console.error('Drag operation error:', error);
        }
        
        // Check again if stop was requested after processing this position
        if (isStopRequestedGlobal || limitReached) {
            break;
        }
    }

    return Array.from(allResults).map(item => JSON.parse(item));
}



async function interactWithMap(page, mapElement, limit = null) {
    // Safety check for limit parameter
    if (limit !== null && (limit <= 0 || isNaN(limit))) {
        console.log(`Invalid limit value: ${limit}. Skipping map interaction.`);
        return [];
    }
    
    const boundingBox = await mapElement.boundingBox();
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;

    // Optimize zoom operation - clicking twice with minimal wait time
    for (let i = 0; i < 2; i++) {
        await page.evaluate(() => {
            const zoomInButton = document.querySelector('#widget-zoom-in');
            if (zoomInButton) zoomInButton.click();
        });
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500))); // Reduced from 1000
    }

    // Define a more efficient drag sequence with adaptive distances
    // This pattern preserves the overall coverage but reduces redundant movements
    const dragSequence = [
      { x: 1000, y: 0 },    // Right
      { x: 1000, y: 500 },  // Right + slight down (combined movement)
      { x: 0, y: 1000 },    // Bottom
      { x: -500, y: 500 },  // Left + down (combined diagonal)
      { x: -1000, y: 0 },   // Left
      { x: -1000, y: 0 },   // Left
      { x: -500, y: -500 }, // Left + up (combined diagonal)
      { x: 0, y: -1000 },   // Top
      { x: 0, y: -1000 },   // Top
      { x: 500, y: -500 },  // Right + up (combined diagonal)
      { x: 1000, y: 0 },    // Right
      { x: 1000, y: 0 },    // Right
      { x: 500, y: 500 },   // Right + down (combined diagonal)
      { x: 0, y: 1000 },    // Bottom
    ];

    // Perform drag operations and collect results
    console.log('Starting map interaction with optimized drag sequence...');
    return await continuousDrag(page, centerX, centerY, dragSequence, limit);
}


// Maximize coverage by re-centering the map viewport across a deterministic,
// zoom-aware grid of points (via the Maps URL) and re-scraping the feed at each.
// Replaces blind pixel-based mouse dragging. Returns an array of unique results.
async function navigateTiles(page, query, startCenter, limit = null, ringCount = config.scraper.tileRings) {
    if (limit !== null && (limit <= 0 || isNaN(limit))) {
        console.log(`Invalid limit value: ${limit}. Skipping tiled navigation.`);
        return [];
    }

    const formattedQuery = formatSearchQuery(query);
    const centers = buildTiledCenters(startCenter.lat, startCenter.lng, startCenter.zoom, ringCount);
    console.log(`Tiled navigation: ${centers.length} tiles (ringCount=${ringCount}) around @${startCenter.lat},${startCenter.lng},${startCenter.zoom}z`);

    const allResults = new Set();
    let limitReached = false;

    for (const center of centers) {
        if (isStopRequestedGlobal || limitReached) {
            console.log('Stop requested or limit reached during tiled navigation. Halting.');
            break;
        }

        const tileUrl = `https://www.google.com/maps/search/${formattedQuery}/@${center.lat},${center.lng},${center.zoom}z?hl=en&gl=US`;
        console.log(`Navigating tile @${center.lat.toFixed(6)},${center.lng.toFixed(6)},${center.zoom}z`);

        try {
            await retryOperation(async () => {
                await page.goto(tileUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: config.scraper.navigationTimeoutMs
                });
                // Let the feed settle.
                await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

                // Bail out (and let retryOperation back off) if Google blocks us.
                const blocking = await checkForBlocking(page);
                if (blocking.isBlocked) {
                    throw new Error('Blocked during tiled navigation: ' + JSON.stringify(blocking));
                }
            }, 3, 5000);
        } catch (navError) {
            console.error(`Tile navigation failed, skipping this tile: ${navError.message}`);
            // If we're being persistently blocked, stop the whole run and return
            // what we have rather than hammering Google further.
            if (navError.message.includes('Blocked during tiled navigation')) {
                console.log('Persistent blocking detected. Aborting tiled navigation with partial results.');
                break;
            }
            continue;
        }

        const remainingLimit = limit ? Math.max(0, limit - allResults.size) : null;
        const results = await scrapeCurrentView(page, remainingLimit);
        results.forEach(result => allResults.add(JSON.stringify(result)));

        console.log(`Tile yielded ${results.length} results. Total unique so far: ${allResults.size}`);

        if (limit && allResults.size >= limit) {
            console.log(`Reached limit of ${limit} unique results during tiled navigation. Stopping.`);
            limitReached = true;
            break;
        }

        // Fix #3: if this tile's feed was fully exhausted (end-of-list reached) and
        // yielded nothing new, the area is sparse — no point visiting further tiles.
        if (results._feedExhausted && results.length === 0 && allResults.size > 0) {
            console.log('Feed exhausted with no new results on this tile. Aborting remaining tiles.');
            break;
        }

        // Randomized jitter between tiles to reduce rate-limiting.
        const { tileJitterMinMs, tileJitterMaxMs } = config.scraper;
        const jitter = tileJitterMinMs + Math.random() * (tileJitterMaxMs - tileJitterMinMs);
        await page.evaluate(ms => new Promise(resolve => setTimeout(resolve, ms)), jitter);
    }

    return Array.from(allResults).map(item => JSON.parse(item));
}


async function scrapeInitialData(searchQuery, limit = null, format = 'excel', tileRings = config.scraper.tileRings) {
    console.log('Starting initial scraping...');
    
    // Reset stop flag and scraping stats at the beginning of a new scrape
    resetStopRequest();
    resetScrapingStats();
    
    // Set current query and scraping status
    currentScrapingQuery = searchQuery;
    isScrapingActive = true;
    
    // Initialize real-time exporter
    const sanitizedQuery = searchQuery.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${sanitizedQuery}_${timestamp}`;
    
    realTimeExporter = new RealTimeExporter(filename, format);
    realTimeExporter.initialize();
    
    console.log(`Real-time export initialized: ${realTimeExporter.getFilePath()}`);
    
    let browser;
    if (config.cloudflare.useCloudflareBrowser) {
        console.log('Launching remote Cloudflare browser...');
        browser = await launchCloudflareBrowser();
    } else {
        browser = await puppeteer.launch(config.browser);
    }
    
    const page = await browser.newPage();
    
    // Block unnecessary resources to speed up page loads
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
            req.abort();
        } else {
            req.continue();
        }
    });
    
    // Set a realistic user agent
    await page.setUserAgent(config.browser.userAgent);

    // Must be set before the first navigation — Cloudflare edge IPs are non-US
    // so Google serves the GDPR consent wall without these cookies.
    // Google migrated from the old CONSENT cookie to SOCS; set both. The SOCS
    // value below records "consent accepted", which suppresses the interstitial.
    await page.setCookie(
        {
            name: 'SOCS',
            value: 'CAISHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiA_LyaBg',
            domain: '.google.com',
            path: '/',
        },
        {
            name: 'CONSENT',
            value: 'YES+cb.20210328-17-p0.en+FX+910',
            domain: '.google.com',
            path: '/',
        }
    );

    // Force English + US locale so the served UI matches our selectors (e.g.
    // "Liste"/"List" labels). Without gl=US the non-US edge IP yields a
    // localized (Spanish here) consent page and layout.
    const formattedQuery = formatSearchQuery(searchQuery);
    const searchUrl = `https://www.google.com/maps/search/${formattedQuery}/?hl=en&gl=US`;
    
    console.log(`Searching: ${searchUrl}`);
    
    try {
        console.log('Navigating to Google Maps...');
        await page.goto(searchUrl, {
            waitUntil: 'domcontentloaded', // Changed to domcontentloaded for faster loading
            timeout: 30000
        });
        
        console.log('Page loaded successfully');

        // Check if stop was requested
        if (isStopRequestedGlobal) {
            console.log('Stop requested. Terminating scrape.');
            return [];
        }

        // Wait for page to be interactive
        try {
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
            console.log('Page is now interactive');
        } catch (error) {
            console.log('Error during page wait:', error.message);
        }

        // Fallback: if the cookies didn't suppress the consent interstitial
        // (Google shows "Before you go to Google Maps" / "Antes de ir a..."),
        // click the accept/reject button and re-navigate to the search URL.
        await handleConsentPage(page, searchUrl);

        // Check if page loaded properly
        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);
        
        // Check if we're on a Google Maps page
        if (!pageTitle.includes('Google Maps') && !pageTitle.includes('Google')) {
            console.log('Warning: Page title suggests we might not be on Google Maps');
        }
        
        // Try to find and click the list view button with multiple selectors
        const listViewSelectors = [
            'div.YVHLQ',
            'button[data-value="Liste"]',
            'button[aria-label*="Liste"]',
            'button[aria-label*="List"]',
            'div[role="button"][aria-label*="List"]',
            'div[jsaction*="list"]'
        ];
        
        let listViewClicked = false;
        for (const selector of listViewSelectors) {
            try {
                console.log(`Trying list view selector: ${selector}`);
                await page.waitForSelector(selector, { timeout: 5000 });
                await page.click(selector);
                console.log(`Clicked list view with selector: ${selector}`);
                listViewClicked = true;
                break;
            } catch (error) {
                console.log(`List view selector ${selector} failed: ${error.message}`);
                continue;
            }
        }
        
        if (!listViewClicked) {
            console.log('Could not find list view button, proceeding anyway...');
        }
        
        // Check for common error pages or blocking
        const errorIndicators = await checkForBlocking(page);

        if (errorIndicators.isBlocked) {
            console.log('Page appears to be blocked or showing error:', errorIndicators);
            throw new Error('Page is blocked or showing error: ' + JSON.stringify(errorIndicators));
        }
        
        // Check if stop was requested
        if (isStopRequestedGlobal) {
            console.log('Stop requested. Terminating scrape.');
            return [];
        }

        // Wait for map to load with multiple fallback selectors
        let mapElement = null;
        const mapSelectors = [
            'div.iBPHvd.widget-scene',
            'div[role="main"]',
            'div[data-js-log-root]',
            'div[jsaction*="pane"]',
            'div[data-ved]',
            'div[jscontroller]'
        ];
        
        for (const selector of mapSelectors) {
            try {
                console.log(`Trying map selector: ${selector}`);
                await page.waitForSelector(selector, { timeout: 10000 });
                mapElement = await page.$(selector);
                if (mapElement) {
                    console.log(`Found map element with selector: ${selector}`);
                    break;
                }
            } catch (error) {
                console.log(`Selector ${selector} failed: ${error.message}`);
                continue;
            }
        }
        
        if (!mapElement) {
            console.log('All map selectors failed, trying to proceed without specific map element...');
            // Try to continue without the specific map element
            mapElement = await page.$('body');
        }

        // Check if stop was requested
        if (isStopRequestedGlobal) {
            console.log('Stop requested. Terminating scrape.');
            return [];
        }

        // First, get initial results from scrolling
        console.log('Getting initial results from scrolling...');
        let results = [];
        
        // Try multiple times to get results
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`Attempt ${attempt} to get initial results...`);
                results = await scrapeCurrentView(page, limit);
                console.log(`Found ${results.length} results from initial scroll (attempt ${attempt})`);
                
                if (results.length > 0) {
                    break;
                }
                
                // Wait a bit before retrying
                await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
            } catch (error) {
                console.log(`Attempt ${attempt} failed: ${error.message}`);
                if (attempt === 3) {
                    console.log('All attempts to get initial results failed');
                    results = [];
                }
            }
        }
        
        // Set the total: prefer the explicit limit (already seeded in scrapeCurrentView),
        // otherwise fall back to the initial result count as an estimate.
        if (totalItemsToScrape === 0) {
            totalItemsToScrape = limit && limit > 0 ? limit : results.length;
        }

        // Check if stop was requested after initial scrolling
        if (isStopRequestedGlobal) {
            console.log('Stop requested after initial scrolling. Returning partial results.');
            return results;
        }

        // Fix #4: scale tileRings down dynamically based on initial yield so we
        // don't burn time navigating a large grid when the area is clearly sparse.
        let effectiveTileRings = tileRings;
        if (results._feedExhausted) {
            // Feed was fully exhausted on the first view — skip tiled navigation entirely.
            effectiveTileRings = 0;
            console.log(`Initial feed exhausted with ${results.length} results. Setting tileRings=0 to skip grid navigation.`);
        } else if (results.length <= 5) {
            effectiveTileRings = Math.min(tileRings, 1);
            console.log(`Sparse initial yield (${results.length}). Capping tileRings at 1.`);
        } else if (results.length <= 20) {
            effectiveTileRings = Math.min(tileRings, 1);
            console.log(`Moderate initial yield (${results.length}). Capping tileRings at 1.`);
        }

        // Then interact with the map to get more results (only if we haven't reached the limit)
        let mapResults = [];
        // Check if we've reached the limit after initial scraping
        const hasReachedLimit = limit && limit > 0 && results.length >= limit;

        if (!hasReachedLimit && effectiveTileRings > 0) {
            console.log('Starting map interaction to find more locations...');

            try {
                // Calculate remaining limit and ensure it's not negative
                const remainingLimit = limit ? Math.max(0, limit - results.length) : null;

                // Prefer deterministic, zoom-aware tiled re-centering. Fall back
                // to blind mouse-dragging only if we can't read the map center
                // from the URL (e.g. Google didn't write @lat,lng for this query).
                const startCenter = getMapCenter(page);
                if (startCenter) {
                    mapResults = await navigateTiles(page, searchQuery, startCenter, remainingLimit, effectiveTileRings);
                    console.log(`Found ${mapResults.length} additional results from tiled navigation`);
                } else {
                    console.log('Map center unavailable from URL; falling back to mouse-drag interaction.');
                    mapResults = await interactWithMap(page, mapElement, remainingLimit);
                    console.log(`Found ${mapResults.length} additional results from map interaction`);
                }
            } catch (error) {
                console.log(`Map interaction failed: ${error.message}`);
                console.log('Proceeding with initial results only');
                mapResults = [];
            }
        } else if (hasReachedLimit) {
            console.log(`Already reached limit of ${limit} unique results. Skipping map interaction.`);
        } else {
            console.log(`tileRings=0 after dynamic scaling. Skipping map interaction.`);
        }
        
        // Combine results and remove duplicates
        const allResults = new Set([...results.map(r => JSON.stringify(r)), ...mapResults.map(r => JSON.stringify(r))]);
        let combinedResults = Array.from(allResults).map(r => JSON.parse(r));
        
        // Ensure we don't exceed the limit if one was specified
        if (limit && limit > 0 && combinedResults.length > limit) {
            console.log(`Limiting results to ${limit} unique items (found ${combinedResults.length} total unique items)`);
            combinedResults = combinedResults.slice(0, limit);
        }
        
        console.log(`Total unique locations found: ${combinedResults.length} (requested limit: ${limit || 'none'})`);

        // Sync the live counter to the authoritative final count before marking
        // the scrape inactive. This prevents any in-flight status poll from
        // reading a stale intermediate value (e.g. 40 instead of 50) in the
        // window between the last batch completing and the response being sent.
        scrapedItemsCount = combinedResults.length;

        return combinedResults;
    } catch (error) {
        console.error('Error during scraping:', error);
        return [];
    } finally {
        isScrapingActive = false;
        try {
            await browser.close();
        } catch (closeError) {
            console.error('Error closing browser:', closeError);
        }
    }
}


async function scrapeGoogleMapsData(page) {
    try {
        // Wait for the page to load properly
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
        
        const data = await page.evaluate(() => {
            // Multiple selector strategies for name
            const getBusinessName = () => {
                const selectors = [
                    'h1.DUwDvf.lfPIob',
                    'h1[data-attrid="title"]',
                    'h1.x3AX1-LfntMc-header-title-title',
                    'h1.fontHeadlineLarge',
                    '[data-attrid="title"] span',
                    '.x3AX1-LfntMc-header-title-title',
                    'h1'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return element.textContent.trim();
                    }
                }
                return "N/A";
            };

            // More robust rating extraction
            const getRating = () => {
                const selectors = [
                    'div.F7nice > span > span[aria-hidden="true"]',
                    'span.ceNzKf',
                    '[data-value] span',
                    '.MW4etd'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        const text = element.textContent.trim();
                        if (text.match(/^\d+[.,]\d+$/)) {
                            return text;
                        }
                    }
                }
                return "N/A";
            };

            // More robust address extraction
            const getAddress = () => {
                const selectors = [
                    'button[data-item-id="address"] div.Io6YTe.fontBodyMedium',
                    '[data-item-id="address"] .Io6YTe',
                    '.QSFF4-text',
                    '[data-attrid="kc:/location/location:address"] span'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return element.textContent.trim();
                    }
                }
                return "N/A";
            };

            return {
                name: getBusinessName(),
                rating: getRating(),
                reviewsCount: document.querySelector('div.F7nice span[aria-label*="avis"]')?.textContent.trim() || 
                            document.querySelector('span.UY7F9')?.textContent.trim() || "N/A",
                address: getAddress(),
                website: document.querySelector('a[data-item-id="authority"]')?.href || 
                        document.querySelector('a[href^="http"]')?.href || "N/A",
                phone: document.querySelector('button[data-item-id^="phone:tel:"] div.Io6YTe.fontBodyMedium')?.textContent.trim() ||
                      document.querySelector('[data-item-id*="phone"] span')?.textContent.trim() || "N/A",
                openingHours: document.querySelector('div.OqCZI[jslog] div.MkV9 span.ZDu9vd')?.textContent.trim() ||
                            document.querySelector('.t39EBf')?.textContent.trim() || "N/A"
            };
        });

        // Post-process the data
        if (data.rating !== "N/A" && data.rating.match(/^\d+[.,]\d+$/)) {
            data.rating = parseFloat(data.rating.replace(',', '.'));
        }
        
        if (data.reviewsCount !== "N/A") {
            const match = data.reviewsCount.match(/\d+/);
            if (match) {
                data.reviewsCount = parseInt(match[0]);
            }
        }

        // Unwrap any Google redirect wrapper so the website column is clean.
        data.website = cleanWebsiteUrl(data.website);

        return data;
    } catch (error) {
        console.error("Error scraping detailed data:", error);
        return {
            name: "Extraction Error",
            rating: "N/A",
            reviewsCount: "N/A", 
            address: "N/A",
            website: "N/A",
            phone: "N/A",
            openingHours: "N/A"
        };
    }
}


  // --- Contact-info extraction helpers -------------------------------------
  // Asset/file extensions that must never be treated as an email TLD. This is
  // what catches retina image names like "logo@2x.png" being scraped as emails.
  const NON_EMAIL_TLDS = new Set([
      'png','jpg','jpeg','gif','svg','webp','bmp','ico','tif','tiff','avif','heic',
      'css','js','mjs','json','xml','map','mp4','webm','mov','avi','mp3','wav',
      'woff','woff2','ttf','otf','eot','pdf','zip','gz'
  ]);

  // Placeholder / library / telemetry domains that appear in markup but are
  // never a real business email.
  const BLOCKED_EMAIL_DOMAINS = new Set([
      'example.com','example.org','example.net','domain.com','yourdomain.com',
      'email.com','sentry.io','wixpress.com','schema.org','w3.org'
  ]);

  // Path first-segments that are navigation/sharing/content, never a profile.
  const SOCIAL_BLOCKLIST = new Set([
      'sharer','share','share.php','intent','plugins','tr','dialog','l.php',
      'home','login','signup','help','about','privacy','policies','tos','legal',
      'hashtag','search','explore','watch','events','marketplace','groups',
      'stories','reel','reels','p','tv','embed','oembed','status','i','messages',
      'notifications','settings','compose','story','media','photo','photos','videos','posts'
  ]);

  // Validate and clean candidate email strings; drops asset names and placeholders.
  function normalizeEmails(candidates) {
      const out = new Set();
      for (const raw of candidates || []) {
          if (!raw) continue;
          const email = String(raw).trim().toLowerCase()
              .replace(/^mailto:/, '')
              .replace(/[?#].*$/, '')      // drop ?subject=... / #frag
              .replace(/^[^a-z0-9]+/, '')  // strip leading junk
              .replace(/[^a-z0-9]+$/, ''); // strip trailing junk (>, quotes, ., ))
          const m = email.match(/^([a-z0-9._%+-]+)@([a-z0-9.-]+)\.([a-z]{2,24})$/);
          if (!m) continue;
          const tld = m[3];
          if (NON_EMAIL_TLDS.has(tld)) continue;          // logo@2x.png, hero@3x.webp, ...
          const fullDomain = `${m[2]}.${tld}`;
          if (BLOCKED_EMAIL_DOMAINS.has(fullDomain)) continue;
          if (email.length > 100) continue;
          out.add(email);
      }
      return [...out].slice(0, 25);
  }

  // Normalize/filter candidate URLs into profile links per platform.
  function normalizeSocialLinks(urls) {
      const acc = { facebook: new Set(), instagram: new Set(), twitter: new Set(), linkedin: new Set() };
      for (let raw of urls || []) {
          if (!raw) continue;
          let u = String(raw).trim().replace(/&amp;/gi, '&');
          if (u.startsWith('//')) u = 'https:' + u;
          if (!/^https?:\/\//i.test(u)) {
              if (/^(?:www\.)?(?:facebook|instagram|twitter|x|linkedin)\.com/i.test(u)) u = 'https://' + u;
              else continue;
          }
          let parsed;
          try { parsed = new URL(u); } catch { continue; }
          const host = parsed.hostname.toLowerCase();
          const segs = parsed.pathname.split('/').filter(Boolean);
          const seg0 = (segs[0] || '').toLowerCase();

          if (/(?:^|\.)linkedin\.com$/.test(host)) {
              if (['company','in','school','showcase'].includes(seg0) && segs[1]) {
                  acc.linkedin.add(`https://www.linkedin.com/${seg0}/${segs[1]}`);
              }
          } else if (/(?:^|\.)facebook\.com$/.test(host)) {
              if (parsed.pathname.toLowerCase().startsWith('/profile.php') && parsed.searchParams.get('id')) {
                  acc.facebook.add(`https://www.facebook.com/profile.php?id=${parsed.searchParams.get('id')}`);
              } else if (seg0 && !SOCIAL_BLOCKLIST.has(seg0)) {
                  acc.facebook.add(`https://www.facebook.com/${segs[0]}`);
              }
          } else if (/(?:^|\.)instagram\.com$/.test(host)) {
              if (seg0 && !SOCIAL_BLOCKLIST.has(seg0)) {
                  acc.instagram.add(`https://www.instagram.com/${segs[0]}`);
              }
          } else if (/(?:^|\.)(?:twitter|x)\.com$/.test(host)) {
              if (seg0 && !SOCIAL_BLOCKLIST.has(seg0)) {
                  acc.twitter.add(`https://twitter.com/${segs[0]}`);
              }
          }
      }
      return {
          facebook: [...acc.facebook].slice(0, 10),
          instagram: [...acc.instagram].slice(0, 10),
          twitter: [...acc.twitter].slice(0, 10),
          linkedin: [...acc.linkedin].slice(0, 10),
      };
  }

    async function extractContactInfo(websiteUrl) {
        try {
            console.log(`Extracting contact info from: ${websiteUrl}`);
            
            const response = await httpClient.get(websiteUrl);
            const html = response.data;
            
            // Robustly extract emails + social links. Parse the DOM with cheerio so we
            // read real mailto:/href values and visible text instead of raw HTML —
            // this stops asset names like "logo@2x.png" from being scraped as emails.
            const $ = cheerio.load(html);
            const hrefs = $('a[href]').map((_, el) => $(el).attr('href')).get();
            const mailtos = hrefs
                .filter(h => /^mailto:/i.test(h))
                .map(h => h.replace(/^mailto:/i, ''));
            const bodyText = $('body').text() || '';

            // Emails: only from mailto: links and visible text (never raw markup),
            // then validated/filtered by normalizeEmails().
            const emailCandidates = [
                ...mailtos,
                ...(bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g) || []),
            ];
            const emails = normalizeEmails(emailCandidates);

            // Social: anchor hrefs plus any URLs in markup, normalized/filtered so
            // tracking/share/plugin links are dropped and only profiles remain.
            const urlCandidates = [
                ...hrefs,
                ...(html.match(/https?:\/\/[^\s"'<>()]+/gi) || []),
            ];
            const socialMedia = normalizeSocialLinks(urlCandidates);

            return { emails, socialMedia };
        } catch (error) {
            console.error(`Error extracting contact info from ${websiteUrl}:`, error.message);
            return {
                emails: [],
                socialMedia: {
                    facebook: [],
                    instagram: [],
                    twitter: [],
                    linkedin: []
                }
            };
        }
    }
      

      async function retryOperation(operation, maxRetries = 3, delay = 3000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                console.log(`Attempt ${attempt} failed: ${error.message}`);
                lastError = error;
                
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const backoffDelay = delay * Math.pow(2, attempt - 1);
                    console.log(`Retrying in ${backoffDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
            }
        }
        
        throw lastError;
    }

    async function processJsonFile(filename) {
        let browser;
        try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--start-maximized'],
            defaultViewport: null
        });
        const page = await browser.newPage();
            // Read and parse JSON file
            const jsonContent = JSON.parse(fs.readFileSync(filename, 'utf8'));
            const results = jsonContent.results;
            
            console.log(`Processing ${results.length} entries...`);
            
            const enrichedResults = [];
            const extractedData = [];  // New array for extracted data only
            
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                console.log(`Processing ${i + 1}/${results.length}: ${result.name}`);
                console.log(`Attempting to navigate to: ${result.link}`); // Log the URL

                try {
                    // Use retry logic for the navigation
                    await retryOperation(async () => {
                        console.log('Attempting page.goto...');
                        await page.goto(result.link, { 
                            // waitUntil: 'load', // Try 'load' or 'domcontentloaded' instead of 'networkidle2'
                            waitUntil: 'networkidle2', 
                            timeout: 90000 // Increase timeout further if needed
                        }); 
                        console.log('page.goto resolved. Capturing initial state...');

                        // Capture state IMMEDIATELY after goto resolves
                        const initialHtml = await page.content();
                        fs.writeFileSync(`debug_initial_page_${i}.html`, initialHtml);
                        await page.screenshot({ path: `debug_initial_screenshot_${i}.png` });
                        console.log(`Initial state captured for item ${i}. Current URL: ${page.url()}`);

                        // Add a longer manual delay for visual inspection (when headless: false)
                        console.log('Waiting for 10 seconds for visual inspection...');
                        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10000))); 
                        console.log('Wait finished.');

                        // Temporarily comment out the title check to see if the page loads *at all*
                        // const title = await page.title();
                        // console.log(`Page title: ${title}`);
                        // if (!title.includes(result.name.substring(0, 10))) {
                        //     console.error('Title does not match expected name fragment.');
                        //     // Optionally capture state again here if title mismatch
                        //     await page.screenshot({ path: `debug_title_mismatch_${i}.png` });
                        //     throw new Error('Not on the expected page - Title mismatch');
                        // }
                        console.log('Page loaded (title check skipped for debugging).');

                    }, 3, 5000); // Retries with increasing delay

                    console.log(`Navigation successful for ${result.name}. Scraping data...`);
                    const additionalData = await scrapeGoogleMapsData(page);
                    
                    // Save to enriched results (original + new data)
                    enrichedResults.push({
                        ...result,
                        ...additionalData
                    });
                    
                    // Save to extracted data (just the new data + name for reference)
                    extractedData.push({
                        name: result.name,
                        ...additionalData
                    });
                    
                } catch (error) {
                    console.error(`Error processing ${result.name} during/after navigation:`, error);
                    // Capture error state again if needed
                    try {
                        await page.screenshot({ path: `error_screenshot_${i}_${Date.now()}.png` });
                        const errorHtml = await page.content();
                        fs.writeFileSync(`error_page_${i}_${Date.now()}.html`, errorHtml);
                    } catch (captureError) {
                        console.error('Failed to capture error state:', captureError);
                    }

                    const errorData = {
                        address: 'Error',
                        website: 'Error',
                        phone: 'Error'
                    };
                    
                    enrichedResults.push({
                        ...result,
                        ...errorData
                    });
                    
                    extractedData.push({
                        name: result.name,
                        ...errorData
                    });
                }
            }
            
            // Save enriched data
            const enrichedFilename = filename.replace('.json', '_enriched.json');
            fs.writeFileSync(enrichedFilename, JSON.stringify({
                ...jsonContent,
                results: enrichedResults
            }, null, 2));
            
            // Save extracted data separately
            const extractedFilename = filename.replace('.json', '_extracted.json');
            fs.writeFileSync(extractedFilename, JSON.stringify({
                searchQuery: jsonContent.searchQuery,
                formattedQuery: jsonContent.formattedQuery,
                totalCount: results.length,
                scrapedAt: new Date().toISOString(),
                results: extractedData
            }, null, 2));
            
            console.log(`\nEnriched data saved to ${enrichedFilename}`);
            console.log(`Extracted data saved to ${extractedFilename}`);
            
            // Return the extracted data for Excel/CSV export
            return extractedData;
            
        } catch (error) {
            console.error('Error processing JSON file:', error);
            throw error;
        } finally {
            if (browser) await browser.close();
        }
    }


    async function processJsonFileWithContactInfo(filename) {
        let browser;
        try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--start-maximized'],
            defaultViewport: null
        });
        const page = await browser.newPage();
            // Read and parse JSON file
            const jsonContent = JSON.parse(fs.readFileSync(filename, 'utf8'));
            const results = jsonContent.results;
            
            console.log(`Processing ${results.length} entries...`);
            
            const enrichedResults = [];
            const extractedData = [];
            
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                console.log(`Processing ${i + 1}/${results.length}: ${result.name}`);
                
                try {
                    // First get Google Maps data
                    await page.goto(result.link, { 
                        waitUntil: 'networkidle2', 
                        timeout: 30000 
                    });
                    // Replace waitForTimeout with evaluate
                    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
                    
                    const mapsData = await scrapeGoogleMapsData(page);
                    
                    // Then try to get contact info from website if available
                    let websiteData = {
                        emails: [],
                        socialMedia: {
                            facebook: [],
                            instagram: [],
                            twitter: [],
                            linkedin: []
                        }
                    };
    
                    if (mapsData.website && mapsData.website !== "N/A") {
                        try {
                            await page.goto(mapsData.website, { 
                                waitUntil: 'networkidle2', 
                                timeout: 30000 
                            });
                            // Replace waitForTimeout with evaluate
                            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
                            
                            websiteData = await extractContactInfo(page);
                        } catch (websiteError) {
                            console.error(`Error processing website for ${result.name}:`, websiteError.message);
                        }
                    }
    
                    // Combine all data
                    const combinedData = {
                        ...result,
                        ...mapsData,
                        contactInfo: websiteData
                    };
                    
                    enrichedResults.push(combinedData);
                    
                    extractedData.push({
                        name: result.name,
                        ...mapsData,
                        contactInfo: websiteData
                    });
                    
                } catch (error) {
                    console.error(`Error processing ${result.name}:`, error.message);
                    const errorData = {
                        address: 'Error',
                        website: 'Error',
                        phone: 'Error',
                        contactInfo: {
                            emails: [],
                            socialMedia: {
                                facebook: [],
                                instagram: [],
                                twitter: [],
                                linkedin: []
                            }
                        }
                    };
                    
                    enrichedResults.push({
                        ...result,
                        ...errorData
                    });
                    
                    extractedData.push({
                        name: result.name,
                        ...errorData
                    });
                }
            }
            
            // Save enriched data
            const enrichedFilename = filename.replace('.json', '_enriched_with_contact.json');
            fs.writeFileSync(enrichedFilename, JSON.stringify({
                ...jsonContent,
                results: enrichedResults
            }, null, 2));
            
            // Save extracted data separately
            const extractedFilename = filename.replace('.json', '_extracted_with_contact.json');
            fs.writeFileSync(extractedFilename, JSON.stringify({
                searchQuery: jsonContent.searchQuery,
                formattedQuery: jsonContent.formattedQuery,
                totalCount: results.length,
                scrapedAt: new Date().toISOString(),
                results: extractedData
            }, null, 2));
            
            console.log(`\nEnriched data saved to ${enrichedFilename}`);
            console.log(`Extracted data saved to ${extractedFilename}`);
            
        } catch (error) {
            console.error('Error processing JSON file:', error);
        } finally {
            if (browser) await browser.close();
        }
    }

// --- New Code ---
// Flags and tracking variables
let isStopRequestedGlobal = false;
let isScrapingActive = false;
let currentScrapingJob = null;
let scrapedItemsCount = 0;
let totalItemsToScrape = 0;
let scrapingStartTime = null;
let currentScrapingQuery = '';
let realTimeExporter = null;

// Reset scraping stats
function resetScrapingStats() {
  scrapedItemsCount = 0;
  totalItemsToScrape = 0;
  scrapingStartTime = new Date();
}

// Get current scraping stats
function getScrapingStats() {
  const elapsedTime = scrapingStartTime ? Math.floor((new Date() - scrapingStartTime) / 1000) : 0;
  
  return {
    isActive: isScrapingActive,
    itemsScraped: scrapedItemsCount,
    totalItems: totalItemsToScrape,
    elapsedTimeSeconds: elapsedTime,
    query: currentScrapingQuery
  };
}

// Increment scraped items counter
function incrementScrapedCount() {
  scrapedItemsCount++;
  console.log(`Scraped items count: ${scrapedItemsCount}/${totalItemsToScrape}`);
}

// Function to request stopping the scrape
function requestStopScraping() {
  console.log("Stop request received by scraper module.");
  isStopRequestedGlobal = true;
  isScrapingActive = false;
  if (currentScrapingJob) {
    // Signal to the scraping job that it should stop
    currentScrapingJob.stop = true;
  }
  return { success: true, message: "Scraping process stopped" };
}

// Function to reset the stop flag (usually called before starting a new scrape)
function resetStopRequest() {
  console.log("Resetting stop request flag.");
  isStopRequestedGlobal = false;
}

// Alias for requestStopScraping to maintain compatibility with both naming conventions
const stopScraping = requestStopScraping;

async function saveDataToJson(data, filePath = 'data/scraped_data.json') {
    const dir = path.dirname(filePath);
    try {
        await fsp.mkdir(dir, { recursive: true }); // Ensure directory exists
        let existingData = [];
        try {
            const fileContent = await fsp.readFile(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
            if (!Array.isArray(existingData)) {
                console.warn("Existing data file is not an array. Overwriting.");
                existingData = [];
            }
        } catch (readError) {
            if (readError.code !== 'ENOENT') {
                console.error("Error reading existing data file:", readError);
            }
            // If file doesn't exist or is invalid, start with an empty array
            existingData = [];
        }

        // Append new data
        const updatedData = existingData.concat(data);

        // Write updated data back to the file
        await fsp.writeFile(filePath, JSON.stringify(updatedData, null, 2), 'utf-8');
        console.log(`Data successfully saved/appended to ${filePath}`);

    } catch (error) {
        console.error(`Error saving data to ${filePath}:`, error);
    }
}

async function scrapeAndSaveData(urls) {
    // --- New Code ---
    // Reset stop flag at the beginning of a full scrape job
    // resetStopRequest(); // Moved reset to server endpoint before calling this
    // --- End New Code ---

    let browser;
    const allScrapedData = [];
    console.log(`Starting scrape for ${urls.length} URLs...`);

    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        // Optional: Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');


        for (const url of urls) {
            // --- New Code ---
            // Check if a stop has been requested before processing the next URL
            if (isStopRequestedGlobal) {
                console.log('Stop requested. Halting further URL processing.');
                break; // Exit the loop
            }
            // --- End New Code ---

            console.log(`Navigating to ${url}...`);
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // Wait for network activity to cease

                // Optional: Add a small delay or wait for a specific element that indicates page load
                await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000))); // Wait 3 seconds
                // Example: await page.waitForSelector('h1.DUwDvf', { timeout: 30000 }); // Wait for title element

                console.log(`Scraping data for ${url}...`);
                const scrapedData = await scrapeGoogleMapsData(page); // Use the detailed scraper

                if (scrapedData) {
                    scrapedData.url = url; // Add the source URL
                    console.log('Scraped data:', scrapedData);
                    allScrapedData.push(scrapedData);
                } else {
                    console.log(`No data extracted for ${url}`);
                }

            } catch (error) {
                console.error(`Failed to process ${url}: ${error.message}`);
                // Optionally add placeholder data for failed URLs
                 allScrapedData.push({
                    url: url,
                    name: "Scrape Error",
                    rating: "N/A",
                    reviewsCount: "N/A",
                    address: "N/A",
                    website: "N/A",
                    phone: "N/A",
                    openingHours: "N/A",
                    error: error.message
                 });
            }
             // Optional: Add a delay between requests to avoid rate limiting
             await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))); // Wait 1-3 seconds
        }

    } catch (error) {
        console.error('An error occurred during the scraping process:', error);
    } finally {
        if (browser) {
            await browser.close();
            console.log('Browser closed.');
        }
        // --- Updated Code ---
        // Save whatever data was collected, even if stopped early or an error occurred
        if (allScrapedData.length > 0) {
             console.log(`Saving ${allScrapedData.length} scraped items...`);
             await saveDataToJson(allScrapedData);
        } else {
             console.log("No data collected to save.");
        }
        // Reset the flag after the process finishes (or is stopped)
        // It's better to reset *before* starting the next scrape in the server endpoint
        // resetStopRequest();
        // --- End Updated Code ---
    }
    console.log('Scraping process finished.');
    return allScrapedData; // Return collected data
}

const scrapeAmazon = async (searchTerm, numberOfPages, callback) => {
  isScrapingActive = true;
  currentScrapingJob = { stop: false };
  const job = currentScrapingJob;
  
  try {
    // ... existing code ...
    
    for (let i = 1; i <= numberOfPages; i++) {
      // Check if scraping should be stopped
      if (job.stop) {
        console.log("Scraping stopped by user");
        break;
      }
      
      // ... existing scraping code ...
      
      // After each page is scraped, check again if we should stop
      if (job.stop) {
        console.log("Scraping stopped by user after page", i);
        break;
      }
      
      // ... existing code for pagination ...
    }
    
    // ... existing code ...
  } catch (error) {
    // ... existing error handling ...
  } finally {
    isScrapingActive = false;
    currentScrapingJob = null;
  }
  
  // ... existing code ...
};

// Export the control functions
module.exports = {
    scrapeAndSaveData,
    requestStopScraping,
    resetStopRequest,
    scrapeInitialData,
    processJsonFile,
    processJsonFileWithContactInfo,
    extractContactInfo,
    normalizeEmails,
    normalizeSocialLinks,
    cleanWebsiteUrl,
    scrapeGoogleMapsData,
    formatSearchQuery,
    interactWithMap,
    navigateTiles,
    getMapCenter,
    buildTiledCenters,
    checkForBlocking,
    scrapeCurrentView,
    continuousDrag,
    scrapeAmazon,
    stopScraping,
    isScrapingActive: () => isScrapingActive,
    getScrapingStats,
    resetScrapingStats,
    incrementScrapedCount,
    getRealTimeExporter: () => realTimeExporter
}; 