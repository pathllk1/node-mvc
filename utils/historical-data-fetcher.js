const YahooFinance = require('yahoo-finance2');
const logger = require('./logger');
const yahooFinance = new YahooFinance.default();
const fs = require('fs').promises;
const path = require('path');
const { db } = require('./database');

class HistoricalDataFetcher {
  constructor() {
    this.stocksFilePath = path.join(__dirname, '..', 'public', 'nifty100.json');
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Create the historical_ohlcv table
      await this.createHistoricalTable();
      logger.info('Historical data fetcher initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Error initializing historical data fetcher:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  createHistoricalTable() {
    return new Promise((resolve, reject) => {
      // Create the historical_ohlcv table with proper data types
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS historical_ohlcv (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          date TEXT NOT NULL,
          open REAL,
          high REAL,
          low REAL,
          close REAL,
          adj_close REAL,
          volume INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(symbol, date)  -- Prevent duplicate entries for same symbol and date
        );
        
        -- Create indexes for faster queries
        CREATE INDEX IF NOT EXISTS idx_historical_symbol ON historical_ohlcv (symbol);
        CREATE INDEX IF NOT EXISTS idx_historical_date ON historical_ohlcv (date);
        CREATE INDEX IF NOT EXISTS idx_historical_symbol_date ON historical_ohlcv (symbol, date);
      `;
      
      db.serialize(() => {
        db.exec(createTableSQL, (err) => {
          if (err) {
            logger.error('Error creating historical table:', { error: err.message, stack: err.stack });
            reject(err);
          } else {
            logger.info('Historical OHLCV table created/verified successfully');
            resolve();
          }
        });
      });
    });
  }

  async fetchHistoricalDataForSymbol(symbol, startDate = null, endDate = null) {
    try {
      // If no start date is specified, try to fetch maximum historical data
      if (!startDate) {
        startDate = '2000-01-01'; // Using 2000 as a more realistic start date
      }
      
      logger.info(`Fetching historical data for ${symbol} from ${startDate} to ${endDate || 'today'}...`);
      
      // Use the chart method directly as historical() is deprecated
      const options = {
        period1: startDate,
        interval: '1d',  // Daily interval for maximum historical data
      };
      
      // Only add period2 if it's defined to avoid the undefined issue
      if (endDate) {
        options.period2 = endDate;
      }
      
      // Fetch historical data using the chart method directly
      const chartData = await yahooFinance.chart(symbol, options);
      
      // Process the quotes from chart data
      const historicalData = chartData.quotes.map(quote => ({
        symbol: symbol,
        date: quote.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        adj_close: quote.adjClose || quote.close, // Use close if adjClose is not available
        volume: quote.volume
      }));
      
      logger.info(`Received ${historicalData.length} records for ${symbol}`);
      
      return historicalData;
    } catch (error) {
      logger.error(`Error fetching historical data for ${symbol}:`, { error: error.message, stack: error.stack });
      return []; // Return empty array on error to continue processing other stocks
    }
  }

  saveHistoricalData(historicalRecords) {
    return new Promise((resolve, reject) => {
      if (!historicalRecords || historicalRecords.length === 0) {
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
      
      if (historicalRecords.length === 0) {
        logger.info('No records to save');
        resolve(0);
        return;
      }
      
      for (const record of historicalRecords) {
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
          if (processedCount === historicalRecords.length) {
            logger.info(`Saved ${insertCount} historical records to database`);
            resolve(insertCount);
          }
        });
      }
    });
  }

  async processAllStocks(startDate = null, endDate = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Load stock list
      const stockData = await fs.readFile(this.stocksFilePath, 'utf8');
      const stocks = JSON.parse(stockData);
      
      logger.info(`Processing historical data for ${stocks.length} stocks...`);
      
      let totalRecordsProcessed = 0;
      let totalStocksProcessed = 0;
      
      // Process stocks in batches to avoid overwhelming the API
      const batchSize = 5; // Conservative batch size to respect rate limits
      
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stocks.length / batchSize)}`);
        
        // Process batch concurrently
        const batchPromises = batch.map(async (stock) => {
          try {
            const symbol = stock.nse; // Use the NSE symbol from the json
            logger.info(`Processing ${symbol} (${stock.company})`);
            
            // Fetch historical data for this symbol (with automatic max date range)
            const historicalData = await this.fetchHistoricalDataForSymbol(symbol, startDate, endDate);
            
            if (historicalData.length > 0) {
              // Save the historical data to database
              await this.saveHistoricalData(historicalData);
              
              logger.info(`Successfully processed ${historicalData.length} records for ${symbol}`);
              return historicalData.length;
            } else {
              logger.info(`No historical data found for ${symbol}`);
              return 0;
            }
          } catch (error) {
            logger.error(`Error processing ${stock.nse}:`, { error: error.message, stack: error.stack });
            return 0; // Continue with other stocks
          }
        });
        
        // Wait for all stocks in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        totalRecordsProcessed += batchResults.reduce((sum, count) => sum + count, 0);
        totalStocksProcessed += batch.filter(() => true).length; // Count attempted stocks
        
        logger.info(`Completed batch, processed ${batchResults.reduce((sum, count) => sum + count, 0)} total records`);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < stocks.length) {
          logger.info('Waiting 2 seconds before next batch to respect API rate limits...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      logger.info('\n=== Processing Complete ===');
      logger.info(`Total stocks processed: ${totalStocksProcessed}`);
      logger.info(`Total records saved: ${totalRecordsProcessed}`);
      logger.info(`Average records per stock: ${(totalRecordsProcessed / totalStocksProcessed).toFixed(2)}`);
      
      return { totalStocksProcessed, totalRecordsProcessed };
    } catch (error) {
      logger.error('Error processing all stocks:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  getStocksWithoutHistoricalData(limit = 100) {
    return new Promise(async (resolve, reject) => {
      try {
        // Find stocks that don't have historical data in the database
        const stocksData = await fs.readFile(this.stocksFilePath, 'utf8');
        const stocks = JSON.parse(stocksData);
        
        // Get symbols that already have historical data
        const sql = 'SELECT DISTINCT symbol FROM historical_ohlcv';
        db.all(sql, [], (err, rows) => {
          if (err) {
            logger.error('Error getting existing symbols:', { error: err.message, stack: err.stack });
            resolve([]);
            return;
          }
          
          const existingSymbols = new Set(rows.map(row => row.symbol));
          
          // Filter stocks that don't have historical data
          const missingStocks = stocks.filter(stock => !existingSymbols.has(stock.nse)).slice(0, limit);
          
          logger.info(`Found ${missingStocks.length} stocks without historical data out of ${stocks.length} total`);
          
          resolve(missingStocks);
        });
      } catch (error) {
        logger.error('Error finding stocks without historical data:', { error: error.message, stack: error.stack });
        resolve([]);
      }
    });
  }

  async processMissingStocks(startDate = null, endDate = null, limit = 100) {
    try {
      const missingStocks = await this.getStocksWithoutHistoricalData(limit);
      
      if (missingStocks.length === 0) {
        logger.info('All stocks already have historical data');
        return { totalStocksProcessed: 0, totalRecordsProcessed: 0 };
      }
      
      logger.info(`Processing historical data for ${missingStocks.length} missing stocks...`);
      
      let totalRecordsProcessed = 0;
      let totalStocksProcessed = 0;
      
      // Process missing stocks in batches
      const batchSize = 5;
      
      for (let i = 0; i < missingStocks.length; i += batchSize) {
        const batch = missingStocks.slice(i, i + batchSize);
        
        logger.info(`Processing missing stocks batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(missingStocks.length / batchSize)}`);
        
        const batchPromises = batch.map(async (stock) => {
          try {
            const symbol = stock.nse;
            logger.info(`Processing missing stock: ${symbol} (${stock.company})`);
            
            const historicalData = await this.fetchHistoricalDataForSymbol(symbol, startDate, endDate);
            
            if (historicalData.length > 0) {
              await this.saveHistoricalData(historicalData);
              logger.info(`Saved ${historicalData.length} records for ${symbol}`);
              return historicalData.length;
            } else {
              logger.info(`No historical data found for ${symbol}`);
              return 0;
            }
          } catch (error) {
            logger.error(`Error processing missing stock ${stock.nse}:`, { error: error.message, stack: error.stack });
            return 0;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        totalRecordsProcessed += batchResults.reduce((sum, count) => sum + count, 0);
        totalStocksProcessed += batch.length;
        
        if (i + batchSize < missingStocks.length) {
          logger.info('Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      logger.info('\n=== Missing Stocks Processing Complete ===');
      logger.info(`Total missing stocks processed: ${totalStocksProcessed}`);
      logger.info(`Total records saved: ${totalRecordsProcessed}`);
      
      return { totalStocksProcessed, totalRecordsProcessed };
    } catch (error) {
      logger.error('Error processing missing stocks:', { error: error.message, stack: error.stack });
      throw error;
    }
  }
}

// Main execution when running the script directly
if (require.main === module) {
  const historicalFetcher = new HistoricalDataFetcher();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const startDateArg = args.find(arg => arg.startsWith('--start='))?.split('=')[1];
  const endDate = args.find(arg => arg.startsWith('--end='))?.split('=')[1] || null;
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'all'; // 'all' or 'missing'
  
  // Use the provided start date or null to fetch maximum available history
  const startDate = startDateArg || null;
  
  logger.info(`Starting historical data fetcher...`);
  logger.info(`Mode: ${mode}`);
  logger.info(`Start date: ${startDate || 'automatic (maximum available)'}`);
  logger.info(`End date: ${endDate || 'today'}`);
  
  // Process stocks based on mode
  const processPromise = mode === 'missing' 
    ? historicalFetcher.processMissingStocks(startDate, endDate)
    : historicalFetcher.processAllStocks(startDate, endDate);
  
  processPromise
    .then(result => {
      logger.info('\nHistorical data fetching completed successfully!');
      logger.info(`Processed ${result.totalStocksProcessed} stocks`);
      logger.info(`Saved ${result.totalRecordsProcessed} records`);
    })
    .catch(error => {
      logger.error('Historical data fetching failed:', { error: error.message, stack: error.stack });
      process.exit(1);
    });
}

module.exports = HistoricalDataFetcher;