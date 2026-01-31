#!/usr/bin/env node

/**
 * Manual Technical Analysis Automation Runner
 * This script triggers the technical analysis automation process manually
 * without modifying any existing application files
 */

const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_ROOT = '/media/mint/DA7442677442470B/PROJECT/node/node_mvc';
const AUTOMATION_SCRIPT = path.join(PROJECT_ROOT, 'utils', 'technical-analysis-automation.js');

console.log('🚀 Technical Analysis Manual Runner');
console.log('===================================\n');

try {
  // Check if the automation script exists
  if (!require('fs').existsSync(AUTOMATION_SCRIPT)) {
    console.error('❌ Error: Technical analysis automation script not found');
    console.error(`Expected location: ${AUTOMATION_SCRIPT}`);
    process.exit(1);
  }

  console.log('✅ Found technical analysis automation script');
  
  // Check if the application is running
  console.log('🔍 Checking if application is running...');
  
  try {
    // Try to ping the application
    const result = execSync('curl -s http://localhost:3000/api/technical-analysis/status', { 
      timeout: 5000,
      stdio: 'pipe'
    });
    
    if (result.toString().includes('success') || result.toString().includes('error')) {
      console.log('✅ Application is running and accessible');
      
      // Make API call to trigger manual run
      console.log('📡 Triggering manual technical analysis run...');
      
      const triggerResult = execSync('curl -s -X POST http://localhost:3000/api/technical-analysis/trigger-manual-run', {
        timeout: 300000, // 5 minute timeout
        stdio: 'pipe'
      });
      
      const response = JSON.parse(triggerResult.toString());
      
      if (response.success) {
        console.log('✅ Manual run triggered successfully!');
        console.log(`📊 Stocks processed: ${response.stocksProcessed || 'N/A'}`);
        console.log(`⏱️  Processing time: ${response.processingTime || 'N/A'}`);
        console.log(`📈 Success rate: ${response.successRate || 'N/A'}`);
      } else {
        console.log('⚠️  Manual run completed with some issues');
        console.log(`Details: ${response.message || 'No details provided'}`);
      }
      
    } else {
      console.log('⚠️  Application responded but status unclear');
      console.log('🔧 Attempting direct script execution...');
      runDirectScript();
    }
    
  } catch (networkError) {
    console.log('⚠️  Application not accessible via HTTP');
    console.log('🔧 Running automation script directly...');
    runDirectScript();
  }

} catch (error) {
  console.error('❌ Error during manual run:', error.message);
  process.exit(1);
}

function runDirectScript() {
  try {
    console.log('🔧 Executing technical analysis automation directly...');
    
    // Change to project directory
    process.chdir(PROJECT_ROOT);
    
    // Execute the automation script directly
    const startTime = Date.now();
    
    const result = execSync(`node -e "
      const TechnicalAnalysisAutomation = require('./utils/technical-analysis-automation');
      const automation = new TechnicalAnalysisAutomation();
      
      async function runManual() {
        try {
          console.log('Initializing automation...');
          await automation.initialize();
          
          const marketStatus = automation.isMarketOpen() ? 'OPEN' : 'CLOSED';
          console.log(\`Market status: \${marketStatus}\`);
          console.log('⚠️  Manual run: Processing all stocks regardless of market hours...');
          
          // Override market hours check for manual run
          const originalIsMarketOpen = automation.isMarketOpen;
          automation.isMarketOpen = () => true;
          
          console.log('Starting manual technical analysis processing...');
          const startTime = Date.now();
          
          await automation.processAllStocks();
          
          // Restore original function
          automation.isMarketOpen = originalIsMarketOpen;
          
          const endTime = Date.now();
          const duration = ((endTime - startTime) / 1000).toFixed(2);
          
          console.log('✅ Manual run completed successfully!');
          console.log(\`⏱️  Processing time: \${duration} seconds\`);
        } catch (error) {
          console.error('❌ Error in manual run:', error.message);
          process.exit(1);
        }
      }
      
      runManual();
    "`, {
      timeout: 600000, // 10 minute timeout
      stdio: 'inherit'
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Manual technical analysis run completed successfully!`);
    console.log(`⏱️  Total execution time: ${duration} seconds`);
    
  } catch (error) {
    console.error('❌ Error running direct script execution:', error.message);
    if (error.stdout) console.log('Output:', error.stdout.toString());
    if (error.stderr) console.log('Error output:', error.stderr.toString());
    process.exit(1);
  }
}

console.log('\n✨ Manual technical analysis run script completed');