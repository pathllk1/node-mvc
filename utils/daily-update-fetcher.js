const YahooFinance = require('yahoo-finance2');
const yahooFinance = new YahooFinance.default();
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const { db } = require('./database');

class DailyUpdateFetcher {
  constructor() {
    this.stocksFilePath = path.join(__dirname, '..', 'public', 'nifty100.json');
    this.isInitialized = false;
    this.isRunning = false;
    this.schedulerStarted = false;
  }

  async initialize() {
    try {
      console.log('Initializing daily update fetcher...');
      this.isInitialized = true;
      console.log('Daily update fetcher initialized successfully');
    } catch (error) {
      console.error('Error initializing daily update fetcher:', error.message);
      throw error;
    }
  }

  async getLatestDateForSymbol(symbol) {
    try {
      const result = db.prepare('SELECT MAX(date) as latest_date FROM historical_ohlcv WHERE symbol = ?').get(symbol);
      return result.latest_date;
    } catch (error) {
      console.error(`Error getting latest date for ${symbol}:`, error.message);
      return null;
    }
  }

  async getAllLatestDates() {
    try {
      const stocksData = await fs.readFile(this.stocksFilePath, 'utf8');
      const stocks = JSON.parse(stocksData);
      
      const latestDates = {};
      for (const stock of stocks) {
        const symbol = stock.nse;
        const latestDate = await this.getLatestDateForSymbol(symbol);
        latestDates[symbol] = latestDate;
      }
      
      return latestDates;
    } catch (error) {
      console.error('Error getting all latest dates:', error.message);
      return {};
    }
  }

  async fetchIncrementalDataForSymbol(symbol, startDate, endDate = null) {
    try {
      console.log(`Fetching incremental data for ${symbol} from ${startDate} to ${endDate || 'today'}...`);
      
      // Use the chart method directly as historical() is deprecated
      const options = {
        period1: startDate,
        interval: '1d',  // Daily interval
      };
      
      // Only add period2 if it's defined and different from period1
      // This avoids the "period1 and period2 cannot share the same value" error
      if (endDate && endDate !== startDate) {
        options.period2 = endDate;
      }
      
      // Fetch historical data using the chart method directly
      const chartData = await yahooFinance.chart(symbol, options);
      
      // Process the quotes from chart data
      const incrementalData = chartData.quotes.map(quote => ({
        symbol: symbol,
        date: quote.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        adj_close: quote.adjClose || quote.close, // Use close if adjClose is not available
        volume: quote.volume
      }));
      
      console.log(`Received ${incrementalData.length} incremental records for ${symbol}`);
      
      return incrementalData;
    } catch (error) {
      console.error(`Error fetching incremental data for ${symbol}:`, error.message);
      return []; // Return empty array on error to continue processing other stocks
    }
  }

  async saveIncrementalData(incrementalRecords) {
    if (!incrementalRecords || incrementalRecords.length === 0) {
      return 0;
    }

    try {
      // Prepare SQL statement for inserting historical data
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO historical_ohlcv 
        (symbol, date, open, high, low, close, adj_close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let insertCount = 0;
      
      // Process records in batches to improve performance
      const batchSize = 1000;
      for (let i = 0; i < incrementalRecords.length; i += batchSize) {
        const batch = incrementalRecords.slice(i, i + batchSize);
        
        // Begin transaction for this batch
        db.exec('BEGIN TRANSACTION');
        
        try {
          for (const record of batch) {
            stmt.run(
              record.symbol,
              record.date,
              record.open,
              record.high,
              record.low,
              record.close,
              record.adj_close,
              record.volume
            );
            insertCount++;
          }
          
          // Commit transaction for this batch
          db.exec('COMMIT');
        } catch (batchError) {
          // Rollback on error
          db.exec('ROLLBACK');
          console.error('Error in batch transaction:', batchError.message);
          throw batchError;
        }
      }
      
      console.log(`Saved ${insertCount} incremental records to database`);
      return insertCount;
    } catch (error) {
      console.error('Error saving incremental data:', error.message);
      throw error;
    }
  }

  async processIncrementalUpdates() {
    if (this.isRunning) {
      console.log('Daily update fetcher is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('\\n=== Starting Daily Incremental Update ===');
      console.log('Current time in IST:', new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      // Load stock list
      const stocksData = await fs.readFile(this.stocksFilePath, 'utf8');
      const stocks = JSON.parse(stocksData);
      
      console.log(`Processing incremental updates for ${stocks.length} stocks...`);
      
      let totalRecordsProcessed = 0;
      let totalStocksProcessed = 0;
      let stocksWithNewData = 0;
      
      // Process stocks in batches to avoid overwhelming the API
      const batchSize = 5; // Conservative batch size to respect rate limits
      
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stocks.length / batchSize)}`);
        
        // Process batch concurrently
        const batchPromises = batch.map(async (stock) => {
          try {
            const symbol = stock.nse; // Use the NSE symbol from the json
            console.log(`\nProcessing incremental update for ${symbol} (${stock.company})`);
                      
            // Get the latest date for this symbol
            const latestDate = await this.getLatestDateForSymbol(symbol);
            console.log(`Latest date in database for ${symbol}: ${latestDate || 'No data'}`);
                      
            if (!latestDate) {
              console.log(`No existing data for ${symbol}, skipping incremental update`);
              return { symbol, records: 0, hasNewData: false };
            }
                      
            // Simple approach: fetch from (latest_date + 1) to today
            // This ensures no gaps regardless of when scheduler runs
            const latestDateObj = new Date(latestDate);
            const startDate = new Date(latestDateObj);
            startDate.setDate(startDate.getDate() + 1);
                      
            // Format dates
            const startDateStr = startDate.toISOString().split('T')[0];
            const todayStr = new Date().toISOString().split('T')[0];
                      
            console.log(`Fetching data from ${startDateStr} to ${todayStr} for ${symbol}`);
                      
            // Fetch incremental data for this symbol
            const incrementalData = await this.fetchIncrementalDataForSymbol(symbol, startDateStr, todayStr);
                      
            if (incrementalData.length > 0) {
              // Save the incremental data to database
              const savedCount = await this.saveIncrementalData(incrementalData);
                        
              console.log(`Successfully processed ${savedCount} incremental records for ${symbol}`);
              return { symbol, records: savedCount, hasNewData: true };
            } else {
              console.log(`No new data found for ${symbol}`);
              return { symbol, records: 0, hasNewData: false };
            }
          } catch (error) {
            console.error(`Error processing incremental update for ${stock.nse}:`, error.message);
            return { symbol: stock.nse, records: 0, hasNewData: false, error: error.message }; // Continue with other stocks
          }
        });
        
        // Wait for all stocks in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        const batchRecords = batchResults.reduce((sum, result) => sum + result.records, 0);
        const batchStocksWithData = batchResults.filter(result => result.hasNewData).length;
        
        totalRecordsProcessed += batchRecords;
        totalStocksProcessed += batchResults.length;
        stocksWithNewData += batchStocksWithData;
        
        console.log(`Completed batch: ${batchRecords} records, ${batchStocksWithData} stocks with new data`);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < stocks.length) {
          console.log('Waiting 2 seconds before next batch to respect API rate limits...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log('\\n=== Daily Incremental Update Complete ===');
      console.log(`Total stocks processed: ${totalStocksProcessed}`);
      console.log(`Stocks with new data: ${stocksWithNewData}`);
      console.log(`Total new records saved: ${totalRecordsProcessed}`);
      
      if (totalRecordsProcessed > 0) {
        console.log('✅ Successfully updated database with new data');
      } else {
        console.log('ℹ️ No new data found for any stocks');
      }
      
      return { totalStocksProcessed, stocksWithNewData, totalRecordsProcessed };
    } catch (error) {
      console.error('Error processing incremental updates:', error.message);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Schedule the daily update to run at 4 AM IST
  startDailyScheduler() {
    if (!this.isInitialized) {
      console.error('Daily update fetcher not initialized');
      return;
    }

    if (this.schedulerStarted) {
      console.log('Daily update scheduler already started, skipping...');
      return;
    }

    console.log('Starting daily update scheduler...');
    this.schedulerStarted = true;
    
    // Schedule to run at 4 AM IST every day
    // Cron format: second minute hour day month dayOfWeek
    // 0 0 4 * * * means: at 0 seconds, 0 minutes, 4 hours (4 AM) every day
    // But we need to account for timezone
    
    // For node-cron, we'll use the system time but log the IST time
    cron.schedule('0 0 4 * * *', async () => {
      console.log('\\n=== Daily Update Scheduled Task Triggered ===');
      console.log('System time:', new Date().toString());
      console.log('IST time:', new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      try {
        await this.processIncrementalUpdates();
      } catch (error) {
        console.error('Error in scheduled daily update:', error.message);
      }
    }, {
      timezone: "Asia/Kolkata" // This ensures the cron runs at 4 AM IST
    });
    
    console.log('Daily update scheduler started - will run at 4 AM IST every day');
    console.log('Current time in IST:', new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  }

  // Manual trigger for testing
  async runManualUpdate() {
    console.log('=== Manual Daily Update Triggered ===');
    return await this.processIncrementalUpdates();
  }
}

// Main execution when running the script directly
if (require.main === module) {
  const dailyFetcher = new DailyUpdateFetcher();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'schedule'; // 'schedule' or 'manual'
  
  console.log(`Starting daily update fetcher in ${mode} mode...`);
  
  dailyFetcher.initialize()
    .then(async () => {
      if (mode === 'manual') {
        // Run manual update once
        await dailyFetcher.runManualUpdate();
        console.log('Manual update completed');
        process.exit(0);
      } else {
        // Start the scheduler
        dailyFetcher.startDailyScheduler();
        console.log('Daily update fetcher is now running and will update at 4 AM IST daily');
        console.log('Press Ctrl+C to stop');
        
        // Keep the process running
        process.on('SIGINT', () => {
          console.log('\\nShutting down daily update fetcher...');
          process.exit(0);
        });
      }
    })
    .catch(error => {
      console.error('Failed to start daily update fetcher:', error);
      process.exit(1);
    });
}

module.exports = DailyUpdateFetcher;