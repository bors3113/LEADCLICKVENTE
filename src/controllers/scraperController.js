const { scrapeInitialData,
    processJsonFile,
    processJsonFileWithContactInfo} = require('../services/scraper');
const { exportToExcel, exportToCSV } = require('../utils/excelExporter');
const path = require('path');
const fs = require('fs');
const scraperService = require('../services/scraper');

const scraperController = {
    // Handle single or multiple search queries
    async scrapeQuery(req, res) {
        try {
            const { query, queries, limit, format = 'excel', globalLimit = false } = req.body;
            
            // Support both single query and multiple queries
            let searchQueries = [];
            if (queries && Array.isArray(queries) && queries.length > 0) {
                searchQueries = queries;
            } else if (query) {
                searchQueries = [query];
            } else {
                return res.status(400).json({ error: 'Search query or queries array is required' });
            }

            const allResults = [];
            const queryResults = [];

            // Process each query sequentially
            for (let i = 0; i < searchQueries.length; i++) {
                const currentQuery = searchQueries[i];
                console.log(`Processing query ${i + 1}/${searchQueries.length}: ${currentQuery}`);
                
                // Calculate remaining limit for this query
                let remainingLimit = limit;
                if (globalLimit && limit) {
                    remainingLimit = limit - allResults.length;
                    
                    // Skip if we've already reached the global limit
                    if (remainingLimit <= 0) {
                        console.log(`Global limit of ${limit} reached. Skipping remaining queries.`);
                        break;
                    }
                }
                
                try {
                    const results = await scrapeInitialData(currentQuery, remainingLimit, format);
                    
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
                    if (globalLimit && limit && allResults.length >= limit) {
                        console.log(`Global limit of ${limit} reached after query ${i + 1}. Stopping further queries.`);
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
            const scraperService = require('../services/scraper');
            const realTimeExporter = scraperService.getRealTimeExporter();
            
            let filePath, justFileName;
            if (realTimeExporter) {
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
            
            res.json({
                success: true,
                queries: searchQueries,
                queryResults: queryResults,
                totalResultsCount: allResults.length,
                fileName: justFileName,
                downloadUrl: `/api/download?file=${justFileName}`,
                limit: limit || 'No limit'
            });
        } catch (error) {
            console.error('Scraping error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // Handle JSON file processing
    async processJson(req, res) {
        try {
            const { filename, outputFormat = 'excel' } = req.body;
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            // Process the JSON file
            const processedData = await processJsonFile(filename);
            
            // Generate output filename
            const baseFilename = path.basename(filename, '.json');
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
            const { filename, outputFormat = 'excel' } = req.body;
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            // Process the JSON file with contact info
            const processedData = await processJsonFileWithContactInfo(filename);
            
            // Generate output filename
            const baseFilename = path.basename(filename, '.json');
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
            const filePath = path.join(__dirname, '../../results', sanitizedFilename);
            
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

    // Add this function to handle stopping the scraper
    stopScraping(req, res) {
        try {
            // Call the stopScraping function and ensure it returns a response
            const result = scraperService.requestStopScraping() || { success: true, message: "Scraping process stopped" };
            res.json(result);
        } catch (error) {
            console.error('Error stopping scraper:', error);
            res.status(500).json({ success: false, message: 'Failed to stop scraping process' });
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
    }
};

module.exports = scraperController; 