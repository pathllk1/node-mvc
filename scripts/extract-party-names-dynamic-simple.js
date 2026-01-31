const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, '..', 'public', 'BANK_STATEMENT.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'BANK_STATEMENT_WITH_PARTIES.csv');

// Dynamic party name extractor that learns from data patterns
function extractPartyNameDynamic(description) {
  if (!description || description.length < 3) return '';
  
  // Direct party names (no transaction codes)
  if (!description.includes('/') && !description.includes(':') && 
      !description.includes('Charges') && !description.includes('GST_') && 
      !description.includes('BKID') && !description.includes('Repayment') &&
      !description.includes('TO VARIOUS') && !description.includes('DD Cancln') &&
      !description.includes('UII031900') && !description.includes('ACCOUNT') &&
      !description.includes('AnnualCharges') && !description.includes('TDS Debited') &&
      !description.match(/^\d+$/) && description.length > 4) {
    return description.trim();
  }
  
  // Dynamic slash-based extraction with multiple strategies
  if (description.includes('/')) {
    const parts = description.split('/');
    
    // Strategy 1: Analyze position frequency (learned from data)
    // Based on analysis: Position 2-1 and 3-2 are most likely to contain party names
    const likelyPositions = [];
    
    // For 2-part formats: check position 1 (index 1)
    if (parts.length === 2) {
      likelyPositions.push(parts[1]);
    }
    // For 3-part formats: check position 2 (index 2) 
    else if (parts.length === 3) {
      likelyPositions.push(parts[2]);
    }
    // For 4-part formats: check position 3 (index 3) - this is where real party names are
    else if (parts.length >= 4) {
      likelyPositions.push(parts[parts.length - 1]); // Last part
      likelyPositions.push(parts[parts.length - 2]); // Second to last part
    }
    
    // Apply validation to likely positions
    for (let part of likelyPositions) {
      if (part) {
        const cleanPart = part.split(',')[0].trim();
        if (isValidPartyName(cleanPart)) {
          return cleanPart;
        }
      }
    }
    
    // Strategy 2: Pattern recognition
    // Look for common party name patterns
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].split(',')[0].trim();
      
      // Business name patterns
      if (part.includes('LTD') || part.includes('LIMITED') || 
          part.includes('ENTERPRISE') || part.includes('INDUSTRIES') ||
          part.includes('TRADERS') || part.includes('WORKS') ||
          part.includes('SOLUTIONS') || part.includes('ELECTRICAL') ||
          part.includes('ENGINEERING') || part.includes('CONCERN')) {
        if (isValidPartyName(part)) {
          return part;
        }
      }
      
      // Person name patterns (multiple words)
      if (part.includes(' ') && part.split(' ').length >= 2) {
        const words = part.split(' ');
        // Check if it looks like a person's name
        if (words.every(word => 
            word.length >= 2 && 
            !word.match(/^\d+$/) && 
            word.length <= 20)) {
          if (isValidPartyName(part)) {
            return part;
          }
        }
      }
    }
    
    // Strategy 3: Fallback - any non-system part
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].split(',')[0].trim();
      if (part.length >= 3 && 
          !part.match(/^\d{5,}$/) && 
          !part.match(/^[A-Z]{4}\d+$/) &&
          !['DR', 'CR', '999'].includes(part.toUpperCase())) {
        return part;
      }
    }
  }
  
  return '';
}

// Validation function for party names
function isValidPartyName(name) {
  if (!name || name.length < 3) return false;
  
  const upperName = name.toUpperCase();
  
  // Exclude system codes and bank identifiers
  const excludeList = [
    'DR', 'CR', '999', 'BKID', 'GST', 'CHARGES', 'ACCOUNT', 'MAINTENANCE',
    'TDC', 'EMD', 'EPF', 'ESIC', 'LIC', 'CC BILL', 'SUPPL', 'REPAYMENT',
    'INT.', 'PNL', 'TO'
  ];
  
  if (excludeList.includes(upperName)) return false;
  
  // Exclude purely numeric sequences
  if (name.match(/^\d{6,}$/)) return false;
  
  // Exclude bank code patterns
  if (name.match(/^[A-Z]{4}\d+$/)) return false;
  
  // Exclude transaction reference patterns
  if (name.match(/^[\d-]+$/) && name.length > 8) return false;
  
  return true;
}

// Main processing function
function processCSV() {
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
    
    // Process header
    const header = lines[0].trim();
    const newHeader = header + ',Party Name';
    
    // Process data rows
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
          const partyName = extractPartyNameDynamic(description);
          
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
    
    // Show some examples of the dynamic extraction
    console.log('\n=== DYNAMIC EXTRACTION EXAMPLES ===');
    const examples = [
      { desc: 'NEFT/ABDUL KARIM', expected: 'ABDUL KARIM' },
      { desc: 'IBNEFT/SBIN/MR PRASUN MUKHERJEE', expected: 'MR PRASUN MUKHERJEE' },
      { desc: 'RTGS/BKIDA25283998352/UBIN/APAR INDUSTRIES LTD.', expected: 'APAR INDUSTRIES LTD.' },
      { desc: 'StCon-18405125/ANANDA SINGH', expected: 'ANANDA SINGH' }
    ];
    
    examples.forEach(example => {
      const result = extractPartyNameDynamic(example.desc);
      console.log(`"${example.desc}" -> "${result}" ${result === example.expected ? '✓' : '✗'}`);
    });
    
  } catch (error) {
    console.error('Error processing CSV file:', error.message);
  }
}

// Run the dynamic extractor
processCSV();