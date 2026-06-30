const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { formatItemForExport } = require('./formatExportItem');

// Ensure the results directory exists
const resultsDir = path.join(process.cwd(), 'results');
fs.mkdirSync(resultsDir, { recursive: true });

const SAVE_BATCH_SIZE = 5; // flush to disk every N items

class RealTimeExporter {
  constructor(filename, format = 'excel') {
    this.filename = filename;
    this.format = format;
    this.filepath = path.join(resultsDir, `${filename}.${format === 'csv' ? 'csv' : 'xlsx'}`);
    this.workbook = XLSX.utils.book_new();
    this.worksheet = XLSX.utils.json_to_sheet([]);
    this.data = [];
    this.isInitialized = false;
    this._pendingSave = 0;
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
      this.data.push(formatItemForExport(item));
      this._pendingSave++;
      if (this._pendingSave >= SAVE_BATCH_SIZE) {
        this._flush();
      }
    } catch (error) {
      console.error('Error adding item to real-time export:', error);
    }
  }

  _flush() {
    this.worksheet = XLSX.utils.json_to_sheet(this.data);
    this.workbook.Sheets['Results'] = this.worksheet;
    this.saveFile();
    this._pendingSave = 0;
  }

  /**
   * Add multiple items at once
   * @param {Array} items - Array of data items to add
   */
  addItems(items) {
    try {
      items.forEach(item => this.data.push(formatItemForExport(item)));
      this._flush();
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
    if (this._pendingSave > 0) this._flush();
    console.log(`Real-time export finalized: ${this.data.length} items saved to ${this.filepath}`);
  }
}

module.exports = {
  RealTimeExporter
};
