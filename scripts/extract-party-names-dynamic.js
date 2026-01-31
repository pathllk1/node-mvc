const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, '..', 'public', 'BANK_STATEMENT.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'BANK_STATEMENT_WITH_PARTIES.csv');

class DynamicPartyExtractor {
  constructor() {
    this.patterns = new Map(); // Store learned patterns
    this.partyIndicators = new Set(); // Store common party name indicators
    this.bankCodes = new Set(); // Store identified bank codes to exclude
  }

  // Analyze transaction structure to learn patterns
  analyzeStructure(descriptions) {
    console.log('=== ANALYZING TRANSACTION STRUCTURE ===');
    
    const formatCounts = new Map();
    const positionPatterns = new Map();
    
    descriptions.forEach(desc => {
      if (desc && desc.includes('/')) {
        const parts = desc.split('/');
        const formatKey = parts.length;
        
        // Count format patterns
        formatCounts.set(formatKey, (formatCounts.get(formatKey) || 0) + 1);
        
        // Analyze position patterns for party names
        parts.forEach((part, index) => {
          const cleanPart = part.split(',')[0].trim();
          if (cleanPart.length > 3 && 
              !cleanPart.match(/^\d+$/) && 
              !['DR', 'CR', '999'].includes(cleanPart.toUpperCase())) {
            
            const posKey = `${formatKey}-${index}`;
            if (!positionPatterns.has(posKey)) {
              positionPatterns.set(posKey, { count: 0, examples: [] });
            }
            const pattern = positionPatterns.get(posKey);
            pattern.count++;
            if (pattern.examples.length < 3) {
              pattern.examples.push(cleanPart);
            }
            
            // Identify common party indicators
            if (cleanPart.includes(' ') && cleanPart.length > 5) {
              const words = cleanPart.split(' ');
              words.forEach(word => {
                if (word.length > 2 && !word.match(/^\d+$/)) {
                  this.partyIndicators.add(word.toUpperCase());
                }
              });
            }
          }
        });
      }
    });
    
    console.log('Format distribution:');
    for (let [format, count] of formatCounts) {
      console.log(`  ${format} parts: ${count} transactions`);
    }
    
    console.log('\nPosition analysis for party names:');
    const sortedPatterns = Array.from(positionPatterns.entries())
      .sort((a, b) => b[1].count - a[1].count);
    
    sortedPatterns.slice(0, 10).forEach(([key, data]) => {
      console.log(`  Position ${key}: ${data.count} occurrences`);
      console.log(`    Examples: ${data.examples.join(', ')}`);
    });
    
    return { formatCounts, positionPatterns: sortedPatterns };
  }

  // Dynamic extraction based on learned patterns
  extractPartyName(description) {
    if (!description || description.length < 3) return '';
    
    // Direct party names (no slashes)
    if (!description.includes('/') && !description.includes(':') && 
        !description.includes('Charges') && !description.includes('GST_') && 
        !description.includes('BKID') && !description.includes('Repayment') &&
        !description.includes('TO VARIOUS') && !description.includes('DD Cancln') &&
        !description.includes('UII031900') && !description.includes('ACCOUNT') &&
        !description.includes('AnnualCharges') && !description.includes('TDS Debited') &&
        !description.match(/^\d+$/) && description.length > 4) {
      return description.trim();
    }
    
    // Dynamic slash-based extraction
    if (description.includes('/')) {
      const parts = description.split('/');
      
      // Try different strategies based on format length
      const strategies = [
        // Strategy 1: Get the last part (most common for party names)
        () => {
          if (parts.length >= 3) {
            const lastPart = parts[parts.length - 1].split(',')[0].trim();
            if (this.isValidPartyName(lastPart)) {
              return lastPart;
            }
          }
          return null;
        },
        
        // Strategy 2: Look for parts with spaces and meaningful words
        () => {
          for (let i = parts.length - 1; i >= 1; i--) {
            const part = parts[i].split(',')[0].trim();
            if (this.isValidPartyName(part) && 
                (part.includes(' ') || this.containsPartyIndicator(part))) {
              return part;
            }
          }
          return null;
        },
        
        // Strategy 3: Look for common business name patterns
        () => {
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i].split(',')[0].trim();
            if (this.isValidPartyName(part) && 
                (part.includes('LTD') || part.includes('ENTERPRISE') || 
                 part.includes('INDUSTRIES') || part.includes('TRADERS') ||
                 part.includes('WORKS') || part.includes('SOLUTIONS'))) {
              return part;
            }
          }
          return null;
        },
        
        // Strategy 4: Simple fallback - any non-code part
        () => {
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i].split(',')[0].trim();
            if (part.length >= 3 && 
                !part.match(/^\d{5,}$/) && 
                !part.match(/^[A-Z]{4}\d+$/) &&
                !['DR', 'CR', '999'].includes(part.toUpperCase())) {
              return part;
            }
          }
          return null;
        }
      ];
      
      // Try each strategy in order
      for (let strategy of strategies) {
        const result = strategy();
        if (result) return result;
      }
    }
    
    return '';
  }
  
  // Check if a string is a valid party name
  isValidPartyName(name) {
    if (!name || name.length < 3) return false;
    
    const upperName = name.toUpperCase();
    
    // Exclude system codes and bank identifiers
    if (['DR', 'CR', '999', 'BKID', 'GST', 'CHARGES', 'ACCOUNT', 'MAINTENANCE', 
         'TDC', 'EMD', 'EPF', 'ESIC', 'LIC', 'CC BILL', 'SUPPL'].includes(upperName)) {
      return false;
    }
    
    // Exclude purely numeric sequences
    if (name.match(/^\d{6,}$/)) return false;
    
    // Exclude bank code patterns
    if (name.match(/^[A-Z]{4}\d+$/)) return false;
    
    // Exclude common system prefixes
    if (name.match(/^(CHARGES|INT\.|PNL|REPAYMENT|TO )/i)) return false;
    
    return true;
  }
  
  // Check if name contains party indicators
  containsPartyIndicator(name) {
    const words = name.toUpperCase().split(' ');
    return words.some(word => this.partyIndicators.has(word));
  }
  
  // Process the entire CSV file
  processCSV() {
    try {
      if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Error: Input file not found at ${INPUT_FILE}`);
        return;
      }
      
      const data = fs.readFileSync(INPUT_FILE, 'utf8');
      const lines = data.split('\n');
      
      if (lines.length < 2) {
        console.error('Error: CSV file is empty or invalid');
        return;
      }
      
      // First pass: Analyze structure and learn patterns
      console.log('Learning from transaction data...\n');
      const descriptions = [];
      for (let i = 1; i < Math.min(200, lines.length); i++) {
        const line = lines[i].trim();
        if (line) {
          const parts = line.split(',');
          if (parts.length >= 3) {
            const description = parts[2] || '';
            if (description) descriptions.push(description);
          }
        }
      }
      
      this.analyzeStructure(descriptions);
      
      // Second pass: Apply dynamic extraction
      console.log('\n=== DYNAMIC EXTRACTION PROCESSING ===');
      
      const header = lines[0].trim();
      const newHeader = header + ',Party Name';
      const processedLines = [newHeader];
      
      let extractedCount = 0;
      let totalCount = 0;
      const partyNames = new Set();
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const parts = line.split(',');
          if (parts.length >= 3) {
            totalCount++;
            const description = parts[2] || '';
            const partyName = this.extractPartyName(description);
            
            if (partyName) {
              extractedCount++;
              partyNames.add(partyName);
            }
            
            const newLine = line + ',' + (partyName || '');
            processedLines.push(newLine);
          } else {
            const newLine = line + ',';
            processedLines.push(newLine);
          }
        }
      }
      
      // Write output file
      const outputData = processedLines.join('\n');
      fs.writeFileSync(OUTPUT_FILE, outputData);
      
      console.log('=== DYNAMIC PARTY NAME EXTRACTION COMPLETE ===');
      console.log(`Input file: ${INPUT_FILE}`);
      console.log(`Output file: ${OUTPUT_FILE}`);
      console.log(`Total transactions processed: ${totalCount}`);
      console.log(`Successfully extracted: ${extractedCount}`);
      console.log(`Extraction rate: ${((extractedCount/totalCount)*100).toFixed(1)}%`);
      console.log(`Unique party names found: ${partyNames.size}`);
      
      if (partyNames.size > 0) {
        console.log('\n=== SAMPLE PARTY NAMES ===');
        const sortedNames = Array.from(partyNames).sort();
        sortedNames.slice(0, 20).forEach((name, index) => {
          console.log(`  ${index + 1}. ${name}`);
        });
        if (partyNames.size > 20) {
          console.log(`  ... and ${partyNames.size - 20} more`);
        }
      }
      
      // Show learning results
      console.log('\n=== LEARNING RESULTS ===');
      console.log(`Identified party indicators: ${Array.from(this.partyIndicators).slice(0, 10).join(', ')}`);
      if (this.partyIndicators.size > 10) {
        console.log(`  ... and ${this.partyIndicators.size - 10} more indicators`);
      }
      
    } catch (error) {
      console.error('Error processing CSV file:', error.message);
    }
  }
}

// Run the dynamic extractor
const extractor = new DynamicPartyExtractor();
extractor.processCSV();