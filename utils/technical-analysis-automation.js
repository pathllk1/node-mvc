const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const TechnicalAnalysisDB = require('./technical-analysis-db');
const { technicalAnalysis } = require('../controllers/stockController');

class TechnicalAnalysisAutomation {
  constructor() {
    this.db = new TechnicalAnalysisDB();
    this.isRunning = false;
    this.stocksFilePath = path.join(__dirname, '..', 'public', 'nifty100.json');
    this.stocks = [];
    this.cronJob = null;
  }

  async initialize() {
    try {
      // Initialize database
      await this.db.initialize();
      
      // Load stock list
      const stockData = await fs.readFile(this.stocksFilePath, 'utf8');
      this.stocks = JSON.parse(stockData);
      
      logger.info(`✓ Technical analysis automation initialized with ${this.stocks.length} stocks`);
      return true;
    } catch (error) {
      logger.error('Failed to initialize technical analysis automation:', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  // Check if market is open (same logic as existing StockDataFetcher)
  isMarketOpen() {
    const options = { timeZone: 'Asia/Kolkata', weekday: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false };
    const nowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const indiaTime = new Date(nowStr);
    
    const dayOfWeek = indiaTime.getDay();
    const hour = indiaTime.getHours();
    const minute = indiaTime.getMinutes();
    
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    const marketStartTime = 9 * 60 + 0; // 9:00 AM in minutes
    const marketEndTime = 16 * 60 + 0;   // 4:00 PM in minutes
    const currentTimeInMinutes = hour * 60 + minute;
    
    return isWeekday && 
           currentTimeInMinutes >= marketStartTime && 
           currentTimeInMinutes < marketEndTime;
  }

  // Process a single stock through technical analysis
  async processStock(stock) {
    try {
      const symbol = stock.nse;
      logger.info(`Processing technical analysis for ${symbol} (${stock.company})`);
      
      // Call existing technical analysis function
      let result = null;
      const hasError = await new Promise((resolve) => {
        const mockRes = {
          json: (data) => {
            result = data;
            resolve(false); // No error
          },
          status: (statusCode) => ({
            json: (data) => {
              result = data;
              resolve(true); // Has error
            }
          }),
          locals: {}
        };
        
        technicalAnalysis({ params: { symbol: symbol } }, mockRes).catch(err => {
          logger.error(`Error in technical analysis for ${symbol}:`, err);
          resolve(true); // Has error
        });
        
        // Timeout after 10 seconds to prevent hanging
        setTimeout(() => {
          if (result === null) {
            logger.warn(`Timeout for ${symbol} - no response from technical analysis`);
            resolve(true); // Consider as error
          }
        }, 10000);
      });
      
      // If there was an error or no result, continue to next stock
      if (hasError || result === null) {
        logger.warn(`No technical analysis data available for ${symbol}`);
        return false;
      }
      
      if (result && result.score !== undefined) {
        // Extract indicator values from the result
        const record = {
          symbol: symbol,
          calculation_timestamp: new Date().toISOString(),
          technical_score: result.score,
          sma20: result.indicators?.sma20?.value || null,
          sma50: result.indicators?.sma50?.value || null,
          sma200: result.indicators?.sma200?.value || null,
          ema12: result.indicators?.ema12?.value || null,
          ema26: result.indicators?.ema26?.value || null,
          ema50: result.indicators?.ema50?.value || null,
          ema200: result.indicators?.ema200?.value || null,
          rsi: result.indicators?.rsi?.value || null,
          macd: result.indicators?.macd?.value || null,
          macd_signal: result.indicators?.macdSignal?.value || null,
          macd_histogram: result.indicators?.macdHistogram?.value || null,
          bollinger_upper: result.indicators?.bollingerBands?.upper || null,
          bollinger_middle: result.indicators?.bollingerBands?.middle || null,
          bollinger_lower: result.indicators?.bollingerBands?.lower || null,
          stochastic_k: result.indicators?.stochastic?.k || null,
          stochastic_d: result.indicators?.stochastic?.d || null,
          atr: result.indicators?.atr?.value || null,
          cci: result.indicators?.cci?.value || null,
          williams_r: result.indicators?.williamsR?.value || null,
          adx: result.indicators?.adx?.value || null,
          roc: result.indicators?.roc?.value || null,
          mfi: result.indicators?.mfi?.value || null,
          obv: result.indicators?.obv?.value || null,
          fibonacci_level0: result.indicators?.fibonacci?.level0 || null,
          fibonacci_level236: result.indicators?.fibonacci?.level236 || null,
          fibonacci_level382: result.indicators?.fibonacci?.level382 || null,
          fibonacci_level500: result.indicators?.fibonacci?.level500 || null,
          fibonacci_level618: result.indicators?.fibonacci?.level618 || null,
          fibonacci_level786: result.indicators?.fibonacci?.level786 || null,
          fibonacci_level100: result.indicators?.fibonacci?.level100 || null,
          pivot_point: result.indicators?.pivotPoints?.pivotPoint || null,
          pivot_resistance1: result.indicators?.pivotPoints?.resistance1 || null,
          pivot_resistance2: result.indicators?.pivotPoints?.resistance2 || null,
          pivot_resistance3: result.indicators?.pivotPoints?.resistance3 || null,
          pivot_support1: result.indicators?.pivotPoints?.support1 || null,
          pivot_support2: result.indicators?.pivotPoints?.support2 || null,
          pivot_support3: result.indicators?.pivotPoints?.support3 || null
        };
        
        // Save to database
        await this.db.saveTechnicalAnalysisRecord(record);
        return true;
      } else {
        logger.debug(`Skipping ${symbol} - no technical analysis data available`);
        return false;
      }
    } catch (error) {
      logger.error(`Error processing ${stock.nse}:`, { 
        error: error.message, 
        stack: error.stack 
      });
      return false; // Continue processing other stocks
    }
  }

  // Process all stocks (called by scheduler)
  async processAllStocks() {
    if (this.isRunning) {
      logger.info('Technical analysis processing already running, skipping this cycle');
      return;
    }

    if (!this.isMarketOpen()) {
      logger.info('Market is closed, skipping technical analysis processing');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting technical analysis processing for ${this.stocks.length} stocks...`);

    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Process in batches to avoid overwhelming the system
      const batchSize = 20;
      const startTime = Date.now();
      
      for (let i = 0; i < this.stocks.length; i += batchSize) {
        const batch = this.stocks.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.stocks.length/batchSize)}`);
        
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
      
      const totalTime = Date.now() - startTime;
      logger.info(`✓ Technical analysis processing completed in ${totalTime/1000}s`);
      logger.info(`Successfully processed: ${successCount}/${this.stocks.length} stocks`);
      logger.info(`Errors: ${errorCount} stocks`);
      
    } catch (error) {
      logger.error('Error in technical analysis processing:', { 
        error: error.message, 
        stack: error.stack 
      });
    } finally {
      this.isRunning = false;
    }
  }

  // Start the automated scheduler
  startScheduler() {
    if (this.cronJob) {
      logger.info('Technical analysis scheduler already running');
      return;
    }

    // Schedule: Every 30 minutes during market hours (9AM-4PM) on weekdays
    // 0,30 9-16 * * 1-5
    this.cronJob = cron.schedule('0,30 9-16 * * 1-5', async () => {
      logger.info('Technical analysis scheduler triggered');
      await this.processAllStocks();
    }, {
      timezone: "Asia/Kolkata"
    });

    logger.info('✓ Technical analysis scheduler started');
    logger.info('Schedule: Every 30 minutes, 9AM-4PM IST, Monday-Friday');
  }

  // Stop the scheduler
  stopScheduler() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Technical analysis scheduler stopped');
    }
    this.isRunning = false;
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      isSchedulerActive: !!this.cronJob,
      stockCount: this.stocks.length,
      marketOpen: this.isMarketOpen(),
      nextRun: this.getNextRunTime()
    };
  }

  // Calculate next run time
  getNextRunTime() {
    if (!this.isMarketOpen()) {
      // Find next market opening
      const now = new Date();
      const day = now.getDay();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      let nextOpening = new Date(now);
      
      if (day >= 1 && day <= 5) { // Weekday
        if (hours < 9 || (hours === 9 && minutes < 30)) {
          // Market opens today at 9:00 AM
          nextOpening.setHours(9, 0, 0, 0);
        } else {
          // Next market day
          nextOpening.setDate(nextOpening.getDate() + 1);
          let nextDay = nextOpening.getDay();
          while (nextDay === 0 || nextDay === 6) { // Weekend
            nextOpening.setDate(nextOpening.getDate() + 1);
            nextDay = nextOpening.getDay();
          }
          nextOpening.setHours(9, 0, 0, 0);
        }
      } else { // Weekend
        // Find next Monday
        let nextDay = nextOpening.getDay();
        while (nextDay === 0 || nextDay === 6) {
          nextOpening.setDate(nextOpening.getDate() + 1);
          nextDay = nextOpening.getDay();
        }
        nextOpening.setHours(9, 0, 0, 0);
      }
      
      return nextOpening;
    }
    
    // If market is open, next run is in 30 minutes
    const nextRun = new Date();
    nextRun.setMinutes(nextRun.getMinutes() + 30);
    return nextRun;
  }
}

module.exports = TechnicalAnalysisAutomation;