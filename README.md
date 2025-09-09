# LeadGen ClickVente - Google Maps Scraper

A powerful web scraping application designed for lead generation that extracts business information from Google Maps. This tool helps businesses collect contact details, addresses, and other valuable data from Google Maps listings for marketing and sales purposes.

## 🚀 Features

- **Google Maps Scraping**: Extract business listings from Google Maps with detailed information
- **Multiple Search Modes**: Support for single location or multiple location searches
- **Real-time Progress Tracking**: Monitor scraping progress with live updates
- **Flexible Output Formats**: Export results to Excel (.xlsx) or CSV formats
- **Contact Information Extraction**: Enhanced processing to extract contact details
- **Batch Processing**: Process multiple queries with configurable limits
- **Real-time File Export**: Files are updated in real-time as data is scraped
- **Web Interface**: User-friendly dashboard for easy operation
- **API Endpoints**: RESTful API for programmatic access

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager
- Chrome/Chromium browser (for Puppeteer)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LEADGEN.CLICKVENTE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

4. **Access the application**
   - Open your browser and navigate to `http://localhost:3008`
   - The web interface will be available for easy scraping operations

## 🎯 Usage

### Web Interface

1. **Access the Dashboard**: Navigate to `http://localhost:3008`
2. **Choose Search Mode**:
   - **Single Location**: Search for businesses in one specific location
   - **Multiple Locations**: Search across multiple locations simultaneously
3. **Enter Search Queries**: 
   - For single mode: Enter one search query (e.g., "restaurants in Paris")
   - For multiple mode: Enter multiple queries, one per line
4. **Configure Options**:
   - Set result limits (optional)
   - Choose between per-query or global limits
   - Select output format (Excel or CSV)
5. **Start Scraping**: Click "Start Scraping" to begin the process
6. **Monitor Progress**: Watch real-time progress updates
7. **Download Results**: Download the generated file when complete

### API Usage

#### Scrape Data
```bash
POST /api/scrape
Content-Type: application/json

{
  "query": "restaurants in Paris",
  "limit": 50,
  "format": "excel",
  "globalLimit": false
}
```

#### Multiple Queries
```bash
POST /api/scrape
Content-Type: application/json

{
  "queries": [
    "restaurants in Paris",
    "restaurants in London",
    "restaurants in Berlin"
  ],
  "limit": 100,
  "format": "csv",
  "globalLimit": true
}
```

#### Process JSON Files
```bash
POST /api/process-json
Content-Type: application/json

{
  "filename": "scraped_data.json",
  "outputFormat": "excel"
}
```

#### Process with Contact Info
```bash
POST /api/process-json-contact
Content-Type: application/json

{
  "filename": "scraped_data.json",
  "outputFormat": "excel"
}
```

#### Download Files
```bash
GET /api/download?file=filename.xlsx
```

#### Stop Scraping
```bash
POST /api/stop-scrape
```

#### Get Scraping Status
```bash
GET /api/scrape-status
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serve the main dashboard interface |
| `POST` | `/api/scrape` | Start scraping with search queries |
| `POST` | `/api/process-json` | Process existing JSON files |
| `POST` | `/api/process-json-contact` | Process JSON files with contact extraction |
| `GET` | `/api/download` | Download generated files |
| `POST` | `/api/stop-scrape` | Stop current scraping process |
| `GET` | `/api/scrape-status` | Get current scraping status |
| `POST` | `/api/scrape-urls` | Legacy endpoint for URL-based scraping |
| `POST` | `/api/stop-scraping` | Legacy endpoint to stop scraping |

## 📁 Project Structure

```
LEADGEN.CLICKVENTE/
├── public/
│   ├── index.html          # Web interface
│   └── scraper.js          # Frontend scraping logic
├── src/
│   ├── app.js              # Main application entry point
│   ├── server.js           # Server configuration
│   ├── controllers/
│   │   └── scraperController.js  # API route handlers
│   ├── routes/
│   │   └── index.js        # Route definitions
│   ├── services/
│   │   └── scraper.js      # Core scraping logic
│   └── utils/
│       ├── excelExporter.js     # Excel export functionality
│       └── realTimeExporter.js  # Real-time file updates
├── results/                # Generated output files
├── package.json
└── README.md
```

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: 3008)

### Scraping Options

- **Limit Types**:
  - `Per Query`: Each search query gets its own limit
  - `Global`: Limit applies across all queries combined
- **Output Formats**: Excel (.xlsx) or CSV
- **Real-time Export**: Files are updated continuously during scraping

## 📈 Features in Detail

### Real-time Progress Tracking
- Live updates on scraping progress
- Element count and elapsed time display
- Automatic status polling every 2 seconds

### Flexible Search Options
- Single location searches for focused results
- Multiple location searches for broader coverage
- Configurable result limits per query or globally

### Advanced Data Processing
- Standard JSON processing for basic data extraction
- Enhanced contact information extraction
- Automatic file format conversion

### User Experience
- Clean, responsive web interface
- Real-time feedback and progress indicators
- One-click file downloads
- Error handling with user-friendly messages

## 🚨 Important Notes

- **Rate Limiting**: The scraper includes built-in delays to respect Google's terms of service
- **Legal Compliance**: Ensure you comply with Google's Terms of Service and applicable laws
- **Data Usage**: Use scraped data responsibly and in accordance with privacy regulations
- **Performance**: Large scraping operations may take time; use the stop functionality if needed

## 🛡️ Security Features

- Path traversal protection for file downloads
- Input validation and sanitization
- CORS configuration for cross-origin requests
- Error handling to prevent information disclosure

## 📝 Output Data

The scraper extracts the following information from Google Maps listings:

- Business name
- Address
- Phone number
- Website
- Rating and review count
- Business hours
- Category/type
- Additional contact information (when available)

## 🔄 Development

### Running in Development Mode
```bash
npm run dev
```

### Project Dependencies
- **Express**: Web framework
- **Puppeteer**: Browser automation
- **Puppeteer-Cluster**: Parallel processing
- **Puppeteer-Extra**: Enhanced Puppeteer with stealth plugins
- **XLSX**: Excel file generation
- **Cheerio**: HTML parsing
- **Axios**: HTTP client
- **CORS**: Cross-origin resource sharing

## 📞 Support

For issues, questions, or contributions, please refer to the project documentation or contact the development team.

## ⚖️ Legal Disclaimer

This tool is for educational and legitimate business purposes only. Users are responsible for ensuring their use complies with:
- Google's Terms of Service
- Applicable data protection laws (GDPR, CCPA, etc.)
- Local regulations regarding web scraping
- Business ethics and best practices

Always respect website terms of service and implement appropriate rate limiting to avoid overloading servers.
