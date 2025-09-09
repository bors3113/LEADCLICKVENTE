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
 * @param {Array} data - Array of objects to export
 * @returns {Array} - Formatted data for export
 */
function formatForExport(data) {
  return data.map(item => {
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
  });
}

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {String} filename - Name of the file (without extension)
 * @param {String} sheetName - Name of the sheet
 * @returns {String} - Path to the created file
 */
function exportToExcel(data, filename = 'scraping-results', sheetName = 'Results') {
  // Format the data for export
  const formattedData = formatForExport(data);
  
  // Create a new workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  
  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Generate filepath
  const filepath = path.join(resultsDir, `${filename}.xlsx`);
  
  // Write to file
  XLSX.writeFile(workbook, filepath);
  
  return filepath;
}

/**
 * Export data to CSV file
 * @param {Array} data - Array of objects to export
 * @param {String} filename - Name of the file (without extension)
 * @returns {String} - Path to the created file
 */
function exportToCSV(data, filename = 'scraping-results') {
  // Format the data for export
  const formattedData = formatForExport(data);
  
  // Create a new workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  
  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
  
  // Generate filepath
  const filepath = path.join(resultsDir, `${filename}.csv`);
  
  // Write to CSV file
  XLSX.writeFile(workbook, filepath, { bookType: 'csv' });
  
  return filepath;
}

module.exports = {
  exportToExcel,
  exportToCSV
}; 