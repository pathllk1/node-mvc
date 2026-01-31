const TechnicalAnalysisAutomation = require('../utils/technical-analysis-automation');

async function runManual() {
  try {
    const automation = new TechnicalAnalysisAutomation();
    
    console.log('Initializing automation...');
    await automation.initialize();
    
    const marketStatus = automation.isMarketOpen() ? 'OPEN' : 'CLOSED';
    console.log(`Market status: ${marketStatus}`);
    console.log('⚠️  Manual run: Processing all stocks regardless of market hours...');
    
    // Force processing by temporarily overriding the market check
    const originalProcessAllStocks = automation.processAllStocks.bind(automation);
    automation.processAllStocks = async function() {
      if (this.isRunning) {
        console.log('Technical analysis processing already running, skipping this cycle');
        return;
      }
      
      // Skip market hours check for manual run
      // if (!this.isMarketOpen()) {
      //   console.log('Market is closed, skipping technical analysis processing');
      //   return;
      // }
      
      this.isRunning = true;
      console.log(`Starting manual technical analysis processing for ${this.stocks.length} stocks...`);
      
      try {
        let successCount = 0;
        let errorCount = 0;
        
        // Process in batches to avoid overwhelming the system
        const batchSize = 20;
        const startTime = Date.now();
        
        for (let i = 0; i < this.stocks.length; i += batchSize) {
          const batch = this.stocks.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.stocks.length/batchSize)} (${batch.length} stocks)`);
          
          // Process batch concurrently
          const batchPromises = batch.map(stock => this.processStock(stock));
          const batchResults = await Promise.all(batchPromises);
          
          successCount += batchResults.filter(result => result === true).length;
          errorCount += batchResults.filter(result => result === false).length;
          
          // Small delay between batches to prevent resource exhaustion
          if (i + batchSize < this.stocks.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log('✅ Technical analysis processing completed!');
        console.log(`📊 Success: ${successCount}/${this.stocks.length} stocks`);
        console.log(`❌ Errors: ${errorCount} stocks`);
        console.log(`⏱️  Duration: ${duration} seconds`);
        
        const successRate = ((successCount / this.stocks.length) * 100).toFixed(2);
        console.log(`📈 Success rate: ${successRate}%`);
        
      } catch (error) {
        console.error('Error in manual technical analysis processing:', error.message);
        throw error;
      } finally {
        this.isRunning = false;
      }
    };
    
    // Override market hours check for manual run
    const originalIsMarketOpen = automation.isMarketOpen.bind(automation);
    automation.isMarketOpen = () => true;
    
    console.log('Starting manual technical analysis processing...');
    const startTime = Date.now();
    
    await automation.processAllStocks();
    
    // Restore original function
    automation.processAllStocks = originalProcessAllStocks;
    
    // Restore original function
    automation.isMarketOpen = originalIsMarketOpen;
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('✅ Manual run completed successfully!');
    console.log(`⏱️  Processing time: ${duration} seconds`);
  } catch (error) {
    console.error('❌ Error in manual run:', error.message);
    process.exit(1);
  }
}

runManual();