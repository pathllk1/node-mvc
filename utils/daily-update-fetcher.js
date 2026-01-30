const YahooFinance = require('yahoo-finance2');
const logger = require('./logger');
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
      logger.info('Initializing daily update fetcher...');
      this.isInitialized = true;
      logger.info('Daily update fetcher initialized successfully');
    } catch (error) {
      logger.error('Error initializing daily update fetcher:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  getLatestDateForSymbol(symbol) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT MAX(date) as latest_date FROM historical_ohlcv WHERE symbol = ?';
      db.get(sql, [symbol], (err, row) => {
        if (err) {
          logger.error(`Error getting latest date for ${symbol}:`, { error: err.message, stack: err.stack });
          resolve(null);
        } else {
          resolve(row ? row.latest_date : null);
        }
      });
    });
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
      logger.error('Error getting all latest dates:', { error: error.message, stack: error.stack });
      return {};
    }
  }

  async fetchIncrementalDataForSymbol(symbol, startDate, endDate = null) {
    try {
      logger.info(`Fetching incremental data for ${symbol} from ${startDate} to ${endDate || 'today'}...`);
      
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
      
      logger.info(`Received ${incrementalData.length} incremental records for ${symbol}`);
      
      return incrementalData;
    } catch (error) {
      logger.error(`Error fetching incremental data for ${symbol}:`, { error: error.message, stack: error.stack });
      return []; // Return empty array on error to continue processing other stocks
    }
  }

  saveIncrementalData(incrementalRecords) {
    return new Promise((resolve, reject) => {
      if (!incrementalRecords || incrementalRecords.length === 0) {
        resolve(0);
        return;
      }

      // Process records one by one without explicit transaction management
      // SQLite will handle atomicity for individual inserts
      
      // Prepare SQL statement for inserting historical data
      const insertSQL = `
        INSERT OR IGNORE INTO historical_ohlcv 
        (symbol, date, open, high, low, close, adj_close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      let insertCount = 0;
      
      // Process records one by one
      let processedCount = 0;
      
      if (incrementalRecords.length === 0) {
        logger.info('No records to save');
        resolve(0);
        return;
      }
      
      for (const record of incrementalRecords) {
        db.run(insertSQL, [
          record.symbol,
          record.date,
          record.open,
          record.high,
          record.low,
          record.close,
          record.adj_close,
          record.volume
        ], (err) => {
          processedCount++;
          
          if (err) {
            logger.error('Error inserting record:', { error: err.message, stack: err.stack });
            reject(err);
            return;
          } else {
            insertCount++;
          }
          
          // Check if all records have been processed
          if (processedCount === incrementalRecords.length) {
            logger.info(`Saved ${insertCount} incremental records to database`);
            resolve(insertCount);
          }
        });
      }
    });
  }

  async processIncrementalUpdates() {
    if (this.isRunning) {
      logger.info('Daily update fetcher is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
    
      logger.info('\n=== Starting Daily Incremental Update ===');
      logger.info('Current time in IST:', { istTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) });
      
      // Load stock list
      const stocksData = await fs.readFile(this.stocksFilePath, 'utf8');
      const stocks = JSON.parse(stocksData);
      
      logger.info(`Processing incremental updates for ${stocks.length} stocks...`);
      
      let totalRecordsProcessed = 0;
      let totalStocksProcessed = 0;
      let stocksWithNewData = 0;
      
      // Process stocks in batches to avoid overwhelming the API
      const batchSize = 5; // Conservative batch size to respect rate limits
      
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stocks.length / batchSize)}`);
        
        // Process batch concurrently
        const batchPromises = batch.map(async (stock) => {
          try {
            const symbol = stock.nse; // Use the NSE symbol from the json
            logger.info(`\nProcessing incremental update for ${symbol} (${stock.company})`);
                      
            // Get the latest date for this symbol
            const latestDate = await this.getLatestDateForSymbol(symbol);
            logger.info(`Latest date in database for ${symbol}: ${latestDate || 'No data'}`);
                      
            if (!latestDate) {
              logger.info(`No existing data for ${symbol}, skipping incremental update`);
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
                      
            logger.info(`Fetching data from ${startDateStr} to ${todayStr} for ${symbol}`);
                      
            // Fetch incremental data for this symbol
            const incrementalData = await this.fetchIncrementalDataForSymbol(symbol, startDateStr, todayStr);
                      
            if (incrementalData.length > 0) {
              // Save the incremental data to database
              const savedCount = await this.saveIncrementalData(incrementalData);
                        
              logger.info(`Successfully processed ${savedCount} incremental records for ${symbol}`);
              return { symbol, records: savedCount, hasNewData: true };
            } else {
              logger.info(`No new data found for ${symbol}`);
              return { symbol, records: 0, hasNewData: false };
            }
          } catch (error) {
            logger.error(`Error processing incremental update for ${stock.nse}:`, { error: error.message, stack: error.stack });
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
        
        logger.info(`Completed batch: ${batchRecords} records, ${batchStocksWithData} stocks with new data`);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < stocks.length) {
          logger.info('Waiting 2 seconds before next batch to respect API rate limits...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      logger.info('\n=== Daily Incremental Update Complete ===');
      logger.info(`Total stocks processed: ${totalStocksProcessed}`);
      logger.info(`Stocks with new data: ${stocksWithNewData}`);
      logger.info(`Total new records saved: ${totalRecordsProcessed}`);
      
      if (totalRecordsProcessed > 0) {
        logger.info('✅ Successfully updated database with new data');
      } else {
        logger.info('ℹ️ No new data found for any stocks');
      }
      
      return { totalStocksProcessed, stocksWithNewData, totalRecordsProcessed };
    } catch (error) {
      logger.error('Error processing incremental updates:', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Schedule the daily update to run at 4 AM IST
  startDailyScheduler() {
    if (!this.isInitialized) {
      logger.error('Daily update fetcher not initialized');
      return;
    }

    if (this.schedulerStarted) {
      logger.info('Daily update scheduler already started, skipping...');
      return;
    }

    logger.info('Starting daily update scheduler...');
    this.schedulerStarted = true;
    
    // Schedule to run at 4 AM IST every day
    // Cron format: second minute hour day month dayOfWeek
    // 0 0 4 * * * means: at 0 seconds, 0 minutes, 4 hours (4 AM) every day
    // But we need to account for timezone
    
    // For node-cron, we'll use the system time but log the IST time
    cron.schedule('0 0 4 * * *', async () => {
      logger.info('\n=== Daily Update Scheduled Task Triggered ===');
      logger.info('System time:', { systemTime: new Date().toString() });
      logger.info('IST time:', { istTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) });
      
      try {
        await this.processIncrementalUpdates();
      } catch (error) {
        logger.error('Error in scheduled daily update:', { error: error.message, stack: error.stack });
      }
    }, {
      timezone: "Asia/Kolkata" // This ensures the cron runs at 4 AM IST
    });
    
    logger.info('Daily update scheduler started - will run at 4 AM IST every day');
    logger.info('Current time in IST:', { istTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) });
  }

  // Manual trigger for testing
  async runManualUpdate() {
    logger.info('=== Manual Daily Update Triggered ===');
    return await this.processIncrementalUpdates();
  }
}

// Main execution when running the script directly
if (require.main === module) {
  const dailyFetcher = new DailyUpdateFetcher();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'schedule'; // 'schedule' or 'manual'
  
  logger.info(`Starting daily update fetcher in ${mode} mode...`);
  
  dailyFetcher.initialize()
    .then(async () => {
      if (mode === 'manual') {
        // Run manual update once
        await dailyFetcher.runManualUpdate();
        logger.info('Manual update completed');
        process.exit(0);
      } else {
        // Start the scheduler
        dailyFetcher.startDailyScheduler();
        logger.info('Daily update fetcher is now running and will update at 4 AM IST daily');
        logger.info('Press Ctrl+C to stop');
        
        // Keep the process running
        process.on('SIGINT', () => {
          logger.info('\nShutting down daily update fetcher...');
          process.exit(0);
        });
      }
    })
    .catch(error => {
      logger.error('Failed to start daily update fetcher:', { error: error.message, stack: error.stack });
      process.exit(1);
    });
}

module.exports = DailyUpdateFetcher;