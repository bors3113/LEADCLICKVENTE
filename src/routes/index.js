const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const scraperController = require('../controllers/scraperController');
const requireApiKey = require('../middleware/auth');

const scrapeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scrape requests, please slow down.' },
});

// Health check (public)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// All routes below require a valid API key when API_KEY is set in the environment
router.use(requireApiKey);

router.post('/scrape', scrapeLimiter, scraperController.scrapeQuery);
router.post('/process-json', scraperController.processJson);
router.post('/process-json-contact', scraperController.processJsonContact);
router.get('/download', scraperController.downloadFile);
router.post('/stop-scrape', scraperController.stopScraping);
router.get('/scrape-status', scraperController.getScrapeStatus);
router.post('/enrich', scraperController.enrichFile);

module.exports = router;
