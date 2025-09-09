const express = require('express');
const router = express.Router();
const scraperController = require('../controllers/scraperController');
const path = require('path');

// Route for single search query
router.post('/scrape', scraperController.scrapeQuery);

// Route for processing JSON file
router.post('/process-json', scraperController.processJson);

// Route for processing JSON with contact info
router.post('/process-json-contact', scraperController.processJsonContact);

// Route for downloading files
router.get('/download', scraperController.downloadFile);

// Add the new route for stopping the scraper
router.post('/stop-scrape', scraperController.stopScraping);

// Add new route for getting scraper status
router.get('/scrape-status', scraperController.getScrapeStatus);

module.exports = router; 