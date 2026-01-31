const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, '..', 'public', 'BANK_STATEMENT.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'BANK_STATEMENT_WITH_PARTIES.csv');

function extractPartyName(description) {
  if (!description || description.length < 2) return '';
  
  // Pattern 1: Direct party names (clear business/person names)
  if (!description.includes('/') && !description.includes(':') && 
      !description.includes('Charges') && !description.includes('GST_') && 
      !description.includes('BKID') && !description.includes('Repayment') &&
      !description.includes('TO VARIOUS') && !description.includes('DD Cancln') &&
      !description.includes('UII031900') && !description.includes('ACCOUNT') &&
      !description.includes('AnnualCharges') && !description.includes('TDS Debited') &&
      !description.match(/^\d+$/) && description.length > 3) {
    return description.trim();
  }
  
  // Pattern 2: NEFT transactions - get the actual party name from the end
  if (description.startsWith('NEFT/') && !description.includes('Charges:')) {
    const parts = description.split('/');
    if (parts.length >= 4) {
      // Get the last part which contains the actual party name
      const potentialName = parts[parts.length - 1].split(',')[0].trim();
      if (potentialName && potentialName.length >= 3 && 
          !['DR', 'CR', '999'].includes(potentialName.toUpperCase()) &&
          !potentialName.includes('BKID') &&
          !potentialName.match(/^[A-Z]{4}\d+$/) &&
          !potentialName.match(/^\d{10,}$/)) {
        return potentialName;
      }
    } else if (parts.length >= 2) {
      // Fallback for simpler NEFT formats
      const potentialName = parts[1].split(',')[0].trim();
      if (potentialName && potentialName.length >= 3 && 
          !['DR', 'CR', '999'].includes(potentialName.toUpperCase()) &&
          !potentialName.includes('BKID') &&
          !potentialName.match(/^[A-Z]{4}\d+$/) &&
          !potentialName.match(/^\d{10,}$/)) {
        return potentialName;
      }
    }
  }
  
  // Pattern 3: IBNEFT/IBRTGS transactions - exclude bank codes
  if ((description.includes('IBNEFT/') || description.includes('IBRTGS/'))) {
    const parts = description.split('/');
    if (parts.length >= 3) {
      const potentialName = parts[2].split(',')[0].trim();
      if (potentialName && potentialName.length >= 3 && 
          !['DR', 'CR', '999'].includes(potentialName.toUpperCase()) &&
          !potentialName.includes('BKID') &&
          !potentialName.match(/^[A-Z]{4}\d+$/) &&
          !potentialName.match(/^\d{10,}$/)) {
        return potentialName;
      }
    }
  }
  
  // Pattern 4: RTGS transactions - get the actual party name from the end
  if (description.includes('RTGS/')) {
    const parts = description.split('/');
    if (parts.length >= 4) {
      // Get the last part which contains the actual party name
      const potentialName = parts[parts.length - 1].split(',')[0].trim();
      if (potentialName && potentialName.length >= 3 && 
          !['DR', 'CR', '999'].includes(potentialName.toUpperCase()) &&
          !potentialName.includes('BKID') &&
          // Allow LTD/LIMITED in company names but exclude standalone bank terms
          !potentialName.match(/\b(CORP|BANK)\b/) &&
          !potentialName.match(/^(LTD|LIMITED)$/) &&
          !potentialName.match(/^[A-Z]{4}\d+$/) &&
          !potentialName.match(/^\d{10,}$/)) {
        return potentialName;
      }
    } else if (parts.length >= 3) {
      // Fallback for simpler RTGS formats
      const potentialName = parts[2].split(',')[0].trim();
      if (potentialName && potentialName.length >= 3 && 
          !['DR', 'CR', '999'].includes(potentialName.toUpperCase()) &&
          !potentialName.includes('BKID') &&
          !potentialName.match(/\b(CORP|BANK)\b/) &&
          !potentialName.match(/^(LTD|LIMITED)$/) &&
          !potentialName.match(/^[A-Z]{4}\d+$/) &&
          !potentialName.match(/^\d{10,}$/)) {
        return potentialName;
      }
    }
  }
  
  // Pattern 5: StCon/StUBP transactions - allow party identifiers but be more selective
  if ((description.includes('StCon-') || description.includes('StUBP-')) && 
      description.includes('/')) {
    const parts = description.split('/');
    if (parts.length >= 2) {
      const potentialName = parts[1].split(',')[0].trim();
      // Allow party identifiers but exclude clear system codes
      if (potentialName && potentialName.length >= 2 && 
          !['DR', 'CR', 'CC BILL', 'EMD', 'EPF', 'ESIC', 'LIC', 'TDC'].includes(potentialName.toUpperCase()) &&
          !potentialName.includes('SUPPL') && !potentialName.includes('CHARGES') &&
          !potentialName.match(/^\d{10,}$/)) {
        return potentialName;
      }
    }
  }
  
  // Pattern 6: UPI transactions
  if (description.includes('UPI/') && description.includes('/CR/')) {
    const parts = description.split('/');
    if (parts.length >= 4) {
      const potentialName = parts[2].trim();
      if (potentialName && potentialName.length >= 2 && 
          !['DR', 'CR'].includes(potentialName.toUpperCase()) &&
          !potentialName.match(/^\d{10,}$/)) {
        return potentialName;
      }
    }
  }
  
  // Pattern 7: Enhanced catch-all with stricter filtering
  if (description.includes('/') && description.length > 10) {
    const parts = description.split('/');
    // Look for party names in various positions
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].split(',')[0].trim();
      if (part && part.length >= 3 && 
          !part.match(/^\d{8,}$/) && // Exclude long numeric sequences
          !part.match(/^[A-Z]{4}\d+$/) && // Exclude bank codes
          !['DR', 'CR', '999', 'GST', 'CHARGES', 'ACCOUNT', 'MAINTENANCE', 'TDC', 'EMD', 'EPF', 'ESIC', 'LIC'].includes(part.toUpperCase()) &&
          !part.match(/\b(CORP|BANK)\b/) &&
          !part.match(/^(LTD|LIMITED)$/) &&
          !part.includes('SUPPL') && !part.includes('BILL') &&
          !part.includes('BKID')) {
        return part;
      }
    }
  }
  
  return '';
}

function processCSV() {
  try {
    // Check if input file exists
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(`Error: Input file not found at ${INPUT_FILE}`);
      console.log('Please ensure BANK_STATEMENT.csv exists in the public folder');
      return;
    }
    
    // Read the CSV file
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
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const description = parts[2] || '';
          const partyName = extractPartyName(description);
          const newLine = line + ',' + (partyName || '');
          processedLines.push(newLine);
        } else {
          // Handle lines with insufficient columns
          const newLine = line + ',';
          processedLines.push(newLine);
        }
      }
    }
    
    // Write output file
    const outputData = processedLines.join('\n');
    fs.writeFileSync(OUTPUT_FILE, outputData);
    
    console.log('=== FINAL PARTY NAME EXTRACTION COMPLETE ===');
    console.log(`Input file: ${INPUT_FILE}`);
    console.log(`Output file: ${OUTPUT_FILE}`);
    console.log(`Total rows processed: ${lines.length - 1}`);
    console.log(`File with party names created successfully!`);
    
    // Show comprehensive statistics
    const partyNames = new Set();
    let extractedCount = 0;
    let totalCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 3) {
        totalCount++;
        const description = parts[2] || '';
        const partyName = extractPartyName(description);
        if (partyName) {
          extractedCount++;
          partyNames.add(partyName);
        }
      }
    }
    
    console.log(`\n=== EXTRACTION STATISTICS ===`);
    console.log(`Total transactions: ${totalCount}`);
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
    
    // Show examples of corrected extractions
    console.log('\n=== CORRECTION EXAMPLES ===');
    [136, 138, 140].forEach(lineNum => {
      if (lineNum < lines.length) {
        const parts = lines[lineNum].split(',');
        if (parts.length >= 3) {
          const desc = parts[2] || '';
          const extracted = extractPartyName(desc);
          console.log(`Line ${lineNum + 1}: "${desc}" -> "${extracted}"`);
        }
      }
    });
    
  } catch (error) {
    console.error('Error processing CSV file:', error.message);
  }
}

// Run the script
processCSV();