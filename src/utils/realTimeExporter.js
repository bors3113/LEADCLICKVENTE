const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Ensure the results directory exists
const resultsDir = path.join(__dirname, '../../results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Format data for export, processing nested contact information
 * @param {Object} item - Single object to format
 * @returns {Object} - Formatted data for export
 */
function formatItemForExport(item) {
  // Create a new object with basic properties
  const formattedItem = { ...item };
  
  // Handle contactInfo if it exists
  if (item.contactInfo) {
    // Add email information
    formattedItem.emails = item.contactInfo.emails ? item.contactInfo.emails.join(', ') : '';
    
    // Add social media information
    if (item.contactInfo.socialMedia) {
      Object.entries(item.contactInfo.socialMedia).forEach(([platform, links]) => {
        if (links && links.length > 0) {
          formattedItem[`${platform}_links`] = links.join(', ');
        } else {
          formattedItem[`${platform}_links`] = '';
        }
      });
    }
    
    // Remove the nested contactInfo object
    delete formattedItem.contactInfo;
  }
  
  return formattedItem;
}

class RealTimeExporter {
  constructor(filename, format = 'excel') {
    this.filename = filename;
    this.format = format;
    this.filepath = path.join(resultsDir, `${filename}.${format === 'csv' ? 'csv' : 'xlsx'}`);
    this.workbook = XLSX.utils.book_new();
    this.worksheet = XLSX.utils.json_to_sheet([]);
    this.data = [];
    this.isInitialized = false;
  }

  /**
   * Initialize the file with headers
   */
  initialize() {
    if (this.isInitialized) return;
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(this.workbook, this.worksheet, 'Results');
    
    // Write initial empty file
    this.saveFile();
    this.isInitialized = true;
    
    console.log(`Real-time export initialized: ${this.filepath}`);
  }

  /**
   * Add a single item to the export
   * @param {Object} item - Data item to add
   */
  addItem(item) {
    try {
      // Format the item
      const formattedItem = formatItemForExport(item);
      
      // Add to data array
      this.data.push(formattedItem);
      
      // Update worksheet with all data
      this.worksheet = XLSX.utils.json_to_sheet(this.data);
      
      // Update workbook
      this.workbook.Sheets['Results'] = this.worksheet;
      
      // Save to file
      this.saveFile();
      
      console.log(`Added item to real-time export: ${item.name || 'Unknown'}`);
    } catch (error) {
      console.error('Error adding item to real-time export:', error);
    }
  }

  /**
   * Add multiple items at once
   * @param {Array} items - Array of data items to add
   */
  addItems(items) {
    try {
      items.forEach(item => {
        const formattedItem = formatItemForExport(item);
        this.data.push(formattedItem);
      });
      
      // Update worksheet with all data
      this.worksheet = XLSX.utils.json_to_sheet(this.data);
      
      // Update workbook
      this.workbook.Sheets['Results'] = this.worksheet;
      
      // Save to file
      this.saveFile();
      
      console.log(`Added ${items.length} items to real-time export`);
    } catch (error) {
      console.error('Error adding items to real-time export:', error);
    }
  }

  /**
   * Save the current data to file
   */
  saveFile() {
    try {
      if (this.format === 'csv') {
        XLSX.writeFile(this.workbook, this.filepath, { bookType: 'csv' });
      } else {
        XLSX.writeFile(this.workbook, this.filepath);
      }
    } catch (error) {
      console.error('Error saving real-time export file:', error);
    }
  }

  /**
   * Get the current file path
   * @returns {String} - Path to the current file
   */
  getFilePath() {
    return this.filepath;
  }

  /**
   * Get the current data count
   * @returns {Number} - Number of items in the export
   */
  getDataCount() {
    return this.data.length;
  }

  /**
   * Finalize the export (optional, for cleanup)
   */
  finalize() {
    this.saveFile();
    console.log(`Real-time export finalized: ${this.data.length} items saved to ${this.filepath}`);
  }
}

module.exports = {
  RealTimeExporter
};
