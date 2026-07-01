const config = require('./config');
const logger = require('./utils/logger');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const routes = require('./routes');
const scraperService = require('./services/scraper');
const prisma = require('./lib/prisma');

const app = express();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(globalLimiter);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', routes);

// Serve the HTML page at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Centralized error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = config.port;
const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});

// Graceful shutdown on SIGINT / SIGTERM
async function shutdown(signal) {
    logger.info(`${signal} received. Shutting down gracefully...`);
    scraperService.requestStopScraping();
    const exporter = scraperService.getRealTimeExporter();
    if (exporter) {
        try { exporter.finalize(); } catch (_) {}
    }
    server.close(async () => {
        logger.info('HTTP server closed.');
        await prisma.$disconnect();
        process.exit(0);
    });
    // Force exit if server doesn't close in 10s
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    shutdown('uncaughtException');
});

module.exports = app;
