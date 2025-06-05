const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const yaml = require('js-yaml');

class DocumentParser {
  constructor() {
    this.supportedFormats = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'text/plain',
      'text/markdown',
      'application/x-yaml',
      'text/yaml',
      'application/json'
    ];
  }

  /**
   * Check if file format is supported
   */
  isSupported(mimetype) {
    return this.supportedFormats.includes(mimetype);
  }

  /**
   * Get supported file extensions for display
   */
  getSupportedExtensions() {
    return [
      '.pdf', '.docx', '.doc', '.xlsx', '.xls',
      '.csv', '.txt', '.md', '.yaml', '.yml', '.json'
    ];
  }

  /**
   * Parse document from buffer (for memory-stored files)
   */
  async parseBuffer(buffer, mimetype, originalName) {
    try {
      console.log(`📄 Parsing document from buffer: ${originalName} (${mimetype})`);

      switch (mimetype) {
        case 'application/pdf':
          return await this.parsePDFBuffer(buffer);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.parseWordBuffer(buffer);

        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          return await this.parseExcelBuffer(buffer);

        case 'text/csv':
          return await this.parseCSVBuffer(buffer);

        case 'text/plain':
        case 'text/markdown':
          return await this.parseTextBuffer(buffer);

        case 'application/x-yaml':
        case 'text/yaml':
          return await this.parseYAMLBuffer(buffer);

        case 'application/json':
          return await this.parseJSONBuffer(buffer);

        default:
          throw new Error(`Unsupported file format: ${mimetype}`);
      }
    } catch (error) {
      console.error(`❌ Error parsing ${originalName}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse document and extract text content
   */
  async parseDocument(filePath, mimetype, originalName) {
    try {
      console.log(`📄 Parsing document: ${originalName} (${mimetype})`);

      switch (mimetype) {
        case 'application/pdf':
          return await this.parsePDF(filePath);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.parseWord(filePath);

        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          return await this.parseExcel(filePath);

        case 'text/csv':
          return await this.parseCSV(filePath);

        case 'text/plain':
        case 'text/markdown':
          return await this.parseText(filePath);

        case 'application/x-yaml':
        case 'text/yaml':
          return await this.parseYAML(filePath);

        case 'application/json':
          return await this.parseJSON(filePath);

        default:
          throw new Error(`Unsupported file format: ${mimetype}`);
      }
    } catch (error) {
      console.error(`❌ Error parsing ${originalName}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse PDF files from buffer
   */
  async parsePDFBuffer(buffer) {
    const data = await pdfParse(buffer);

    return {
      text: data.text,
      pages: data.numpages,
      metadata: {
        format: 'PDF',
        pages: data.numpages,
        author: data.info?.Author || 'Unknown',
        title: data.info?.Title || 'Untitled'
      }
    };
  }

  /**
   * Parse PDF files
   */
  async parsePDF(filePath) {
    const buffer = fs.readFileSync(filePath);
    return await this.parsePDFBuffer(buffer);
  }

  /**
   * Parse Word documents from buffer
   */
  async parseWordBuffer(buffer) {
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
      pages: 'N/A',
      metadata: {
        format: 'Word Document',
        hasImages: result.messages.some(m => m.type === 'warning' && m.message.includes('image')),
        warnings: result.messages.length
      }
    };
  }

  /**
   * Parse Word documents (.docx, .doc)
   */
  async parseWord(filePath) {
    const buffer = fs.readFileSync(filePath);
    return await this.parseWordBuffer(buffer);
  }

  /**
   * Parse Excel files from buffer
   */
  async parseExcelBuffer(buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    let combinedText = '';
    const sheets = [];

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetText = xlsx.utils.sheet_to_csv(worksheet);
      combinedText += `\n--- Sheet: ${sheetName} ---\n${sheetText}\n`;
      sheets.push({
        name: sheetName,
        rows: sheetText.split('\n').length - 1
      });
    });

    return {
      text: combinedText,
      pages: workbook.SheetNames.length,
      metadata: {
        format: 'Excel Spreadsheet',
        sheets: sheets,
        totalSheets: workbook.SheetNames.length
      }
    };
  }

  /**
   * Parse Excel files (.xlsx, .xls)
   */
  async parseExcel(filePath) {
    const buffer = fs.readFileSync(filePath);
    return await this.parseExcelBuffer(buffer);
  }

  /**
   * Parse CSV files from buffer
   */
  async parseCSVBuffer(buffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const textDecoder = new TextDecoder('utf-8');
      const csvText = textDecoder.decode(buffer);

      // Simple CSV parsing for buffers
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',');
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });
          results.push(row);
        }
      }

      const combinedText = lines.join('\n');

      resolve({
        text: combinedText,
        pages: 1,
        metadata: {
          format: 'CSV',
          rows: results.length,
          columns: headers.length,
          headers: headers
        }
      });
    });
  }

  /**
   * Parse CSV files
   */
  async parseCSV(filePath) {
    const buffer = fs.readFileSync(filePath);
    return await this.parseCSVBuffer(buffer);
  }

  /**
   * Parse text files from buffer
   */
  async parseTextBuffer(buffer) {
    const textDecoder = new TextDecoder('utf-8');
    const text = textDecoder.decode(buffer);

    return {
      text: text,
      pages: 1,
      metadata: {
        format: 'Text',
        lines: text.split('\n').length,
        characters: text.length
      }
    };
  }

  /**
   * Parse text files
   */
  async parseText(filePath) {
    const buffer = fs.readFileSync(filePath);
    return await this.parseTextBuffer(buffer);
  }

  /**
   * Parse YAML files from buffer
   */
  async parseYAMLBuffer(buffer) {
    const textDecoder = new TextDecoder('utf-8');
    const yamlText = textDecoder.decode(buffer);
    const data = yaml.load(yamlText);

    return {
      text: JSON.stringify(data, null, 2),
      pages: 1,
      metadata: {
        format: 'YAML',
        parsed: true,
        keys: Object.keys(data || {}).length
      }
    };
  }

  /**
   * Parse YAML files
   */
  async parseYAML(filePath) {
    const buffer = fs.readFileSync(filePath);
    return await this.parseYAMLBuffer(buffer);
  }

  /**
   * Parse JSON files from buffer
   */
  async parseJSONBuffer(buffer) {
    const textDecoder = new TextDecoder('utf-8');
    const jsonText = textDecoder.decode(buffer);
    const data = JSON.parse(jsonText);

    return {
      text: JSON.stringify(data, null, 2),
      pages: 1,
      metadata: {
        format: 'JSON',
        parsed: true,
        keys: Object.keys(data || {}).length
      }
    };
  }

  /**
   * Parse JSON files
   */
  async parseJSON(filePath) {
    const buffer = fs.readFileSync(filePath);
    return await this.parseJSONBuffer(buffer);
  }

  /**
   * Get file format from mimetype
   */
  getFormatName(mimetype) {
    const formatMap = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
      'application/msword': 'Word Document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
      'application/vnd.ms-excel': 'Excel Spreadsheet',
      'text/csv': 'CSV',
      'text/plain': 'Text',
      'text/markdown': 'Markdown',
      'application/x-yaml': 'YAML',
      'text/yaml': 'YAML',
      'application/json': 'JSON'
    };

    return formatMap[mimetype] || 'Unknown';
  }
}

module.exports = new DocumentParser();