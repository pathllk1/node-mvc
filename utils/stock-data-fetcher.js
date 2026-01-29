const YahooFinance = require('yahoo-finance2');
const yahooFinance = new YahooFinance.default();
const fs = require('fs').promises;
const path = require('path');
const { db, initializeDatabase } = require('./database');

class StockDataFetcher {
  constructor(io = null) {
    this.stocksFilePath = path.join(__dirname, '..', 'public', 'nifty100.json');
    this.dataFilePath = path.join(__dirname, '..', 'public', 'stock-data.json');
    this.io = io; // Store reference to Socket.IO instance
    this.isRunning = false;
  }

  async initialize() {
    try {
      // Load the stock list
      const stockData = await fs.readFile(this.stocksFilePath, 'utf8');
      this.stocks = JSON.parse(stockData);
      console.log(`Loaded ${this.stocks.length} stocks for monitoring`);
    } catch (error) {
      console.error('Error initializing stock data fetcher:', error.message);
      throw error;
    }
  }

  async fetchStockData(symbol) {
    try {
      // Map incorrect symbols to correct ones for Indian stocks
      let correctedSymbol = symbol;
      
      // Correct mappings for problematic Indian stocks
      const symbolMap = {
        'MCDOWELL-N.NS': 'UNITDSPR.NS',  // United Spirits Limited (McDowell's)
        'PIDILITE.NS': 'PIDILITIND.NS',  // Pidilite Industries
        'GMRINFRA.NS': 'GMRINFRA.NS',    // GMR Infrastructure (this should work)
        'INOXLEISUR.NS': 'INOXLEISUR.NS', // Inox Leisure (this should work)
        'INFRATEL.NS': 'INFRATEL.NS',   // Bharti Infratel (now merged with Bharti Airtel)
        'KOTAKMFF.NS': 'KOTAKBANK.NS',  // Possibly refers to Kotak Mahindra Bank
        'SRTRANSFIN.NS': 'SRTRANSFIN.NS' // Shriram Transport Finance
      };
      
      if (symbolMap[symbol]) {
        correctedSymbol = symbolMap[symbol];
      }
      
      const quote = await yahooFinance.quote(correctedSymbol);
      
      // Check if quote exists and has the required properties
      if (!quote || typeof quote !== 'object') {
        console.warn(`Invalid response for ${symbol} (tried ${correctedSymbol}):`, quote);
        return null;
      }
      
      return {
        symbol: quote.symbol || symbol,
        price: quote.regularMarketPrice,
        currency: quote.currency,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
        peRatio: quote.trailingPE,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        open: quote.regularMarketOpen || null,
        high: quote.regularMarketDayHigh || null,
        low: quote.regularMarketDayLow || null,
        close: quote.regularMarketPreviousClose || null,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.warn(`Error fetching data for ${symbol}:`, error.message);
      return null;
    }
  }

  async fetchAllStocksData() {
    console.log(`Starting to fetch data for ${this.stocks.length} stocks...`);
    const results = [];
    
    // Process stocks in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < this.stocks.length; i += batchSize) {
      const batch = this.stocks.slice(i, i + batchSize);
      
      // Fetch data for this batch concurrently
      const batchResults = await Promise.all(
        batch.map(stock => this.fetchStockData(stock.nse))
      );
      
      // Filter out null results and add to results
      batchResults.forEach(result => {
        if (result) {
          results.push(result);
        }
      });
      
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(this.stocks.length / batchSize)}`);
      
      // Wait a bit between batches to avoid rate limiting
      if (i + batchSize < this.stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Save the results to file
    await fs.writeFile(this.dataFilePath, JSON.stringify(results, null, 2));
    console.log(`Successfully fetched and saved data for ${results.length} stocks at ${new Date().toISOString()}`);
    
    // Emit the updated data to all connected WebSocket clients
    if (this.io) {
      this.io.emit('stock-data-update', results);
      console.log(`Emitted stock data update to ${this.io.engine.clientsCount} connected clients`);
    }
    
    // Store data in database
    await this.storeStockDataInDatabase(results);
    
    return results;
  }
  
  async storeStockDataInDatabase(stocks) {
    return new Promise((resolve, reject) => {
      try {
        // Prepare the SQL statement for inserting stock data
        const insertStmt = `INSERT INTO stocks_history 
          (symbol, price, currency, change, change_percent, volume, market_cap, pe_ratio, 
           fifty_two_week_high, fifty_two_week_low, open, high, low, close, last_updated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        // Insert each stock record individually
        let count = 0;
        if (stocks.length === 0) {
          console.log('No stocks to store');
          resolve();
          return;
        }
        
        for (const stock of stocks) {
          db.run(insertStmt, [
            stock.symbol,
            stock.price || null,
            stock.currency || null,
            stock.change || null,
            stock.changePercent || null,
            stock.volume != null ? Math.round(stock.volume) : null,
            stock.marketCap || null,
            stock.peRatio || null,
            stock.fiftyTwoWeekHigh || null,
            stock.fiftyTwoWeekLow || null,
            stock.open || null,
            stock.high || null,
            stock.low || null,
            stock.close || null,
            stock.lastUpdated
          ], (err) => {
            if (err) {
              console.error('Error inserting stock record:', err.message);
            }
            
            count++;
            if (count === stocks.length) {
              console.log(`Stored ${stocks.length} stock records in database`);
              resolve();
            }
          });
        }
      } catch (error) {
        console.error('Error storing stock data in database:', error);
        reject(error);
      }
    });
  }
  
  // Helper function to check if market is open in Asia/Kolkata timezone
  isMarketOpen() {
    // Get current time in Asia/Kolkata timezone
    const options = { timeZone: 'Asia/Kolkata', weekday: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false };
    const nowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const indiaTime = new Date(nowStr);
    
    const dayOfWeek = indiaTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = indiaTime.getHours();
    const minute = indiaTime.getMinutes();
    
    // Adjust day of week: we want Monday = 1, Sunday = 0
    // But getDay() returns Sunday = 0, Monday = 1, ..., Saturday = 6
    // So Monday-Friday is 1-5
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    
    // Market hours: 8:30 AM to 4:00 PM (8:30 to 16:00 in 24-hour format)
    const marketStartTime = 8 * 60 + 30; // 8:30 AM in minutes
    const marketEndTime = 16 * 60 + 0;   // 4:00 PM in minutes
    
    const currentTimeInMinutes = hour * 60 + minute;
    
    return isWeekday && 
           currentTimeInMinutes >= marketStartTime && 
           currentTimeInMinutes < marketEndTime;
  }
  
  // Helper function to calculate next market opening time
  getNextMarketOpeningTime() {
    // System is already in India timezone, so we can work directly with current time
    const now = new Date();
    
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Calculate current time in minutes from midnight
    const currentTimeInMinutes = hours * 60 + minutes;
    const marketStartTimeInMinutes = 8 * 60 + 30; // 8:30 AM = 510 minutes
    const marketEndTimeInMinutes = 16 * 60 + 0;   // 4:00 PM = 960 minutes
    
    let nextOpening;
    
    if (day >= 1 && day <= 5) { // Monday to Friday
      if (currentTimeInMinutes < marketStartTimeInMinutes) {
        // Market hasn't opened yet today, so it opens today at 8:30 AM
        nextOpening = new Date(now);
        nextOpening.setHours(8, 30, 0, 0); // Set to 8:30 AM today
      } else if (currentTimeInMinutes >= marketEndTimeInMinutes) {
        // Market is already closed for the day
        // Next opening is the next market day at 8:30 AM
        nextOpening = new Date(now);
        nextOpening.setDate(nextOpening.getDate() + 1);
        
        // Skip to next business day if we land on weekend
        let nextDay = nextOpening.getDay();
        while (nextDay === 0 || nextDay === 6) { // Sunday or Saturday
          nextOpening.setDate(nextOpening.getDate() + 1);
          nextDay = nextOpening.getDay();
        }
        
        nextOpening.setHours(8, 30, 0, 0); // Set to 8:30 AM
      } else {
        // Market is currently open, so next opening is tomorrow at 8:30 AM
        nextOpening = new Date(now);
        nextOpening.setDate(nextOpening.getDate() + 1);
        
        // Skip to next business day if we land on weekend
        let nextDay = nextOpening.getDay();
        while (nextDay === 0 || nextDay === 6) { // Sunday or Saturday
          nextOpening.setDate(nextOpening.getDate() + 1);
          nextDay = nextOpening.getDay();
        }
        
        nextOpening.setHours(8, 30, 0, 0); // Set to 8:30 AM
      }
    } else { // Weekend (Saturday or Sunday)
      // Find next Monday
      nextOpening = new Date(now);
      let nextDay = nextOpening.getDay();
      while (nextDay === 0 || nextDay === 6) { // While it's Sunday or Saturday
        nextOpening.setDate(nextOpening.getDate() + 1);
        nextDay = nextOpening.getDay();
      }
      nextOpening.setHours(8, 30, 0, 0); // Set to 8:30 AM
    }
    
    return nextOpening;
  }
  
  async startFetching() {
    if (this.isRunning) {
      console.log('Stock data fetcher is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting periodic stock data fetching with market hours...');
    
    // Fetch data immediately if market is open
    if (this.isMarketOpen()) {
      console.log('Market is currently open, fetching data...');
      await this.fetchAllStocksData();
    } else {
      console.log('Market is currently closed, waiting for next opening...');
      const nextOpening = this.getNextMarketOpeningTime();
      console.log(`Next market opening: ${nextOpening.toISOString()}`);
    }
    
    // Start the recursive scheduling
    this.scheduleNextFetch();
    
    console.log('Periodic stock data fetching scheduled with market hours consideration');
  }
  
  // Recursive function to schedule the next fetch based on market hours
  scheduleNextFetch() {
    if (!this.isRunning) return;
    
    const now = new Date();
    let nextCheckDelay;
    
    if (this.isMarketOpen()) {
      // Market is open, fetch every 5 minutes
      nextCheckDelay = 5 * 60 * 1000; // 5 minutes
      console.log(`Market is open. Next fetch in 5 minutes at ${new Date(now.getTime() + nextCheckDelay).toISOString()}`);
    } else {
      // Market is closed, check when market opens next
      const nextOpening = this.getNextMarketOpeningTime();
      nextCheckDelay = nextOpening.getTime() - now.getTime();
      
      // Ensure delay is not negative
      if (nextCheckDelay <= 0) {
        // Fallback to 1 minute if calculation went wrong
        nextCheckDelay = 60 * 1000;
      }
      
      console.log(`Market is closed. Next fetch at market opening: ${nextOpening.toISOString()} (in ${(nextCheckDelay / 1000 / 60).toFixed(2)} minutes)`);
    }
    
    // Schedule the next fetch
    setTimeout(async () => {
      try {
        if (this.isMarketOpen()) {
          console.log('Market is open, fetching stock data...');
          await this.fetchAllStocksData();
        } else {
          console.log('Market is closed, skipping fetch...');
        }
        
        // Schedule the next check
        this.scheduleNextFetch();
      } catch (error) {
        console.error('Error during scheduled fetch:', error);
        // Even if there's an error, continue with the schedule
        this.scheduleNextFetch();
      }
    }, nextCheckDelay);
  }
  
  stopFetching() {
    this.isRunning = false;
    console.log('Stock data fetching stopped');
  }
}

module.exports = StockDataFetcher;