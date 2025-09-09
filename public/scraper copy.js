const puppeteer = require('puppeteer');
const fs = require('fs');
const { Cluster } = require('puppeteer-cluster');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

puppeteerExtra.use(StealthPlugin());

// HTTP client configuration for scraping
const getHttpHeaders = () => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
});

// Create axios instance with common config
const httpClient = axios.create({
    timeout: 30000,
    headers: getHttpHeaders(),
    maxRedirects: 5,
});

// Copy all your existing functions here (scrapeInitialData, scrapeGoogleMapsData, etc.)
// Remove the direct execution code (runFullScrape() call)
function formatSearchQuery(query) {
    return query.trim().replace(/\s+/g, '+');
  }

  async function scrapeCurrentView(page) {
    const results = [];
    const observedNames = new Set();
    const processedLinks = new Set();
    const CONCURRENT_LIMIT = 10;
    
    const scrollAndCollect = async () => {
        // Set cookie once for the session
        await page.setCookie({
            name: 'CONSENT',
            value: 'YES+',
            domain: '.google.com'
        });
        
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
    const maxUnchangedScrolls = 3; // Reduced from 5 to 3 for faster completion
    
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
                
                await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
                
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
                
                if (processingQueue.length >= CONCURRENT_LIMIT) {
                    const batch = processingQueue.splice(0, CONCURRENT_LIMIT);
                    await processBatch(batch);
                    
                    // Check if stop was requested after processing a batch
                    if (isStopRequestedGlobal) {
                        console.log('Stop requested after batch processing. Returning collected results so far.');
                        break;
                    }
                }
            }
        }
        
        // Check again if stop was requested during this scroll iteration
        if (isStopRequestedGlobal) {
            break;
        }

        if (!foundNew) {
            unchangedScrolls++;
        } else {
            unchangedScrolls = 0;
        }

        // Reduced inter-scroll delay
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50))); // Reduced from 100ms
    }

    // Process any remaining items in the queue if there are any and we haven't been asked to stop
    if (processingQueue.length > 0 && !isStopRequestedGlobal) {
        await processBatch(processingQueue);
    }

    // After collecting initial results, set the total
    if (results.length > 0 && totalItemsToScrape === 0) {
        totalItemsToScrape = Math.max(results.length * 2, 50); // Estimate based on initial findings
    }

    return results;
}

async function continuousDrag(page, startX, startY, dragSequence) {
    const allResults = new Set();
    let lastDragEnd = Date.now(); // Track last drag time for more adaptive timing

    for (const { x, y } of dragSequence) {
        // Check if stop was requested
        if (isStopRequestedGlobal) {
            console.log('Stop requested during map dragging. Halting further operations.');
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
                // Check if stop was requested
                if (isStopRequestedGlobal) {
                    console.log('Stop requested during position scraping. Halting further scraping.');
                    keepScraping = false;
                    break;
                }
                
                console.log('Scraping at current position...');
                const previousSize = allResults.size;
                
                // Scrape elements in current view
                const results = await scrapeCurrentView(page);
                results.forEach(result => {
                    allResults.add(JSON.stringify(result));
                });

                const newItemsFound = allResults.size - previousSize;
                console.log(`Found ${newItemsFound} new items in this view. Total unique items: ${allResults.size}`);

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
        if (isStopRequestedGlobal) {
            break;
        }
    }

    return Array.from(allResults).map(item => JSON.parse(item));
}



async function interactWithMap(page, mapElement) {
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
    return await continuousDrag(page, centerX, centerY, dragSequence);
}


async function scrapeInitialData(searchQuery) {
    console.log('Starting initial scraping...');
    
    // Reset stop flag and scraping stats at the beginning of a new scrape
    resetStopRequest();
    resetScrapingStats();
    
    // Set current query and scraping status
    currentScrapingQuery = searchQuery;
    isScrapingActive = true;
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-gpu', 
          '--disable-extensions',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disk-cache-size=33554432' // 32MB disk cache
        ],
        defaultViewport: { width: 1280, height: 800 }
    });
    
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    const formattedQuery = formatSearchQuery(searchQuery);
    const searchUrl = `https://www.google.com/maps/search/${formattedQuery}/`;
    
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
            await browser.close();
            return [];
        }
        
        // Wait for page to be interactive
        try {
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
            console.log('Page is now interactive');
        } catch (error) {
            console.log('Error during page wait:', error.message);
        }
        
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
        const errorIndicators = await page.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            return {
                hasCaptcha: bodyText.includes('captcha') || bodyText.includes('verify'),
                hasBlocked: bodyText.includes('blocked') || bodyText.includes('access denied'),
                hasError: bodyText.includes('error') || bodyText.includes('not found'),
                hasRateLimit: bodyText.includes('rate limit') || bodyText.includes('too many requests')
            };
        });
        
        if (errorIndicators.hasCaptcha || errorIndicators.hasBlocked || errorIndicators.hasRateLimit) {
            console.log('Page appears to be blocked or showing error:', errorIndicators);
            throw new Error('Page is blocked or showing error: ' + JSON.stringify(errorIndicators));
        }
        
        // Check if stop was requested
        if (isStopRequestedGlobal) {
            console.log('Stop requested. Terminating scrape.');
            await browser.close();
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
            await browser.close();
            return [];
        }

        // First, get initial results from scrolling
        console.log('Getting initial results from scrolling...');
        let results = [];
        
        // Try multiple times to get results
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`Attempt ${attempt} to get initial results...`);
                results = await scrapeCurrentView(page);
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
        
        // Set the estimated total to be scraped
        totalItemsToScrape = results.length;

        // Check if stop was requested after initial scrolling
        if (isStopRequestedGlobal) {
            console.log('Stop requested after initial scrolling. Returning partial results.');
            isScrapingActive = false;
            await browser.close();
            return results;
        }

        // Then interact with the map to get more results
        console.log('Starting map interaction to find more locations...');
        let mapResults = [];
        
        try {
            mapResults = await interactWithMap(page, mapElement);
            console.log(`Found ${mapResults.length} additional results from map interaction`);
        } catch (error) {
            console.log(`Map interaction failed: ${error.message}`);
            console.log('Proceeding with initial results only');
            mapResults = [];
        }
        
        // Combine results and remove duplicates
        const allResults = new Set([...results.map(r => JSON.stringify(r)), ...mapResults.map(r => JSON.stringify(r))]);
        const combinedResults = Array.from(allResults).map(r => JSON.parse(r));
        
        console.log(`Total unique locations found: ${combinedResults.length}`);

        await browser.close();
        return combinedResults;
    } catch (error) {
        console.error('Error during scraping:', error);
        isScrapingActive = false;
        try {
            await browser.close();
        } catch (closeError) {
            console.error('Error closing browser:', closeError);
        }
        return [];
    } finally {
        isScrapingActive = false;
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


    async function extractContactInfo(websiteUrl) {
        try {
            console.log(`Extracting contact info from: ${websiteUrl}`);
            
            const response = await httpClient.get(websiteUrl);
            const html = response.data;
            
            // Use regex patterns (same as before)
            const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9-]{2,})/gi;
            const socialMediaPatterns = {
                facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[a-zA-Z0-9._%+-]+/gi,
                instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^/?&#]+/gi,
                twitter: /(?:https?:\/\/)?(?:www\.)?twitter\.com\/[^/?&#]+/gi,
                linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/[^/?&#]+/gi
            };
            
            const emails = [...new Set(html.match(emailRegex) || [])];
            const socialMedia = {};
            
            for (const [platform, regex] of Object.entries(socialMediaPatterns)) {
                socialMedia[platform] = [...new Set(html.match(regex) || [])];
            }
            
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
        const browser = await puppeteer.launch({ 
            headless: false,
            args: ['--start-maximized'],
            defaultViewport: null
        });
        const page = await browser.newPage();
    
        try {
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
            await browser.close();
        }
    } 
    

    async function processJsonFileWithContactInfo(filename) {
        const browser = await puppeteer.launch({ 
            headless: false,
            args: ['--start-maximized'],
            defaultViewport: null
        });
        const page = await browser.newPage();
    
        try {
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
            await browser.close();
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
        await fs.mkdir(dir, { recursive: true }); // Ensure directory exists
        let existingData = [];
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
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
        await fs.writeFile(filePath, JSON.stringify(updatedData, null, 2), 'utf-8');
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
    scrapeGoogleMapsData,
    formatSearchQuery,
    interactWithMap,
    scrapeCurrentView,
    continuousDrag,
    scrapeGoogleMapsData,
    extractContactInfo,
    formatSearchQuery,
    scrapeAmazon,
    stopScraping,
    isScrapingActive: () => isScrapingActive,
    getScrapingStats,
    resetScrapingStats,
    incrementScrapedCount
}; 