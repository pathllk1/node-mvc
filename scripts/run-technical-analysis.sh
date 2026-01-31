#!/bin/bash

# Technical Analysis Manual Runner
# Simple bash script to trigger manual technical analysis processing

echo "🚀 Technical Analysis Manual Runner"
echo "==================================="

PROJECT_DIR="/media/mint/DA7442677442470B/PROJECT/node/node_mvc"
cd "$PROJECT_DIR"

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    exit 1
fi

# Check if the automation script exists
if [ ! -f "utils/technical-analysis-automation.js" ]; then
    echo "❌ Technical analysis automation script not found"
    echo "Expected: $PROJECT_DIR/utils/technical-analysis-automation.js"
    exit 1
fi

echo "✅ Found technical analysis automation components"

# Try to run via the application first (if it's running)
echo "🔍 Checking if application is running on port 3000..."

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Application is running"
    echo "📡 Attempting to trigger manual run via API..."
    
    # Try to trigger via API
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/technical-analysis/trigger-manual-run -w "%{http_code}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    API_RESPONSE=$(echo "$RESPONSE" | head -n -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Manual run triggered successfully via API!"
        echo "Response: $API_RESPONSE"
        exit 0
    else
        echo "⚠️  API trigger failed (HTTP $HTTP_CODE), falling back to direct execution..."
    fi
else
    echo "⚠️  Application not running on port 3000"
fi

# Direct execution as fallback
echo "🔧 Running technical analysis automation directly..."

# Execute the automation process
node -e "
const TechnicalAnalysisAutomation = require('./utils/technical-analysis-automation');
const automation = new TechnicalAnalysisAutomation();

async function runManual() {
    try {
        console.log('Initializing automation system...');
        await automation.initialize();
                
        const marketStatus = automation.isMarketOpen() ? 'OPEN' : 'CLOSED';
        console.log(`Market status: ${marketStatus}`);
        console.log('⚠️  Manual run: Processing all stocks regardless of market hours...');
                
        // Override market hours check for manual run
        const originalIsMarketOpen = automation.isMarketOpen;
        automation.isMarketOpen = () => true;
                
        const startTime = Date.now();
        await automation.processAllStocks();
                
        // Restore original function
        automation.isMarketOpen = originalIsMarketOpen;
        const endTime = Date.now();
        
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(\`✅ Manual run completed in \${duration} seconds!\`);
        
    } catch (error) {
        console.error('❌ Error during manual run:', error.message);
        process.exit(1);
    }
}

runManual();
"

if [ $? -eq 0 ]; then
    echo "✅ Manual technical analysis run completed successfully!"
else
    echo "❌ Manual run failed"
    exit 1
fi