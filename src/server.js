const express = require('express');
const path = require('path');
const routes = require('./routes');
// Import the specific functions needed, including the control functions
const { scrapeAndSaveData, requestStopScraping, resetStopRequest } = require('./services/scraper');

const app = express();
const port = process.env.PORT || 3008;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api', routes);

// Keep track of scraping status
let isScraping = false;

// Endpoint to trigger scraping
app.post('/api/scrape-urls', async (req, res) => {
    if (isScraping) {
        return res.status(409).send({ message: 'Scraping is already in progress.' });
    }

    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).send({ message: 'Please provide a non-empty array of URLs.' });
    }

    isScraping = true;
    console.log('Received scrape request for URLs:', urls);

    // Reset the stop flag before starting a new scrape
    resetStopRequest();

    // Send immediate response to the client
    res.status(202).send({ message: 'Scraping process started. Results will be saved to data/scraped_data.json.' });

    // Run scraping in the background
    try {
        console.log('Starting background scraping...');
        await scrapeAndSaveData(urls); // Wait for scraping to complete or be stopped
        console.log('Background scraping finished.');
    } catch (error) {
        console.error('Error during background scraping:', error);
    } finally {
        isScraping = false; // Reset status when done or errored
        console.log('Scraping status set to false.');
    }
});

// Endpoint to request stopping the current scrape
app.post('/api/stop-scraping', (req, res) => {
    if (!isScraping) {
        return res.status(400).send({ message: 'No scraping process is currently running.' });
    }
    try {
        requestStopScraping(); // Signal the scraper to stop
        res.status(200).send({ message: 'Scraping stop requested. The process will halt after the current URL and save collected data.' });
    } catch (error) {
        console.error("Error requesting stop:", error);
        res.status(500).send({ message: 'Failed to request stop.' });
    }
});

// Endpoint to serve the main dashboard page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

module.exports = app; 