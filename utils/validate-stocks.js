const YahooFinance = require('yahoo-finance2');
const yahooFinance = new YahooFinance.default();
const fs = require('fs').promises;
const path = require('path');

class StockValidator {
  constructor() {
    this.stocksFilePath = path.join(__dirname, '..', 'public', 'nifty100.json');
    this.validStocksPath = path.join(__dirname, '..', 'public', 'nifty100-valid.json');
    this.invalidStocksPath = path.join(__dirname, '..', 'public', 'nifty100-invalid.json');
    this.validStocks = [];
    this.invalidStocks = [];
    this.totalChecked = 0;
  }

  async loadStocks() {
    try {
      const stockData = await fs.readFile(this.stocksFilePath, 'utf8');
      this.stocks = JSON.parse(stockData);
      console.log(`Loaded ${this.stocks.length} stocks for validation`);
      return this.stocks;
    } catch (error) {
      console.error('Error loading stock data:', error.message);
      throw error;
    }
  }

  async validateStock(stock, index, total) {
    const symbol = stock.nse;
    const companyName = stock.company;
    
    try {
      console.log(`Checking ${index + 1}/${total}: ${symbol} (${companyName})`);
      
      // Attempt to fetch quote data
      const quote = await yahooFinance.quote(symbol);
      
      if (quote && quote.symbol) {
        console.log(`  ✓ VALID: ${symbol} - Price: ${quote.regularMarketPrice || 'N/A'}`);
        this.validStocks.push({
          ...stock,
          yahooSymbol: quote.symbol,
          currentPrice: quote.regularMarketPrice,
          lastUpdated: new Date().toISOString()
        });
      } else {
        console.log(`  ✗ INVALID: ${symbol} - No data returned`);
        this.invalidStocks.push({
          ...stock,
          error: 'No data returned from Yahoo Finance',
          validationTime: new Date().toISOString()
        });
      }
    } catch (error) {
      console.log(`  ✗ ERROR: ${symbol} - ${error.message}`);
      this.invalidStocks.push({
        ...stock,
        error: error.message,
        validationTime: new Date().toISOString()
      });
    }
    
    this.totalChecked++;
  }

  async validateAllStocks() {
    await this.loadStocks();
    
    console.log(`\nStarting validation of ${this.stocks.length} stocks...`);
    console.log('=' .repeat(60));
    
    // Process stocks in smaller batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < this.stocks.length; i += batchSize) {
      const batch = this.stocks.slice(i, i + batchSize);
      
      // Process batch concurrently
      await Promise.all(
        batch.map((stock, batchIndex) => 
          this.validateStock(stock, i + batchIndex, this.stocks.length)
        )
      );
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < this.stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Show progress
      const progress = Math.round((this.totalChecked / this.stocks.length) * 100);
      console.log(`\nProgress: ${progress}% (${this.totalChecked}/${this.stocks.length})`);
      console.log(`Valid: ${this.validStocks.length}, Invalid: ${this.invalidStocks.length}\n`);
    }
    
    // Save results
    await this.saveResults();
    
    // Generate summary
    this.generateSummary();
  }

  async saveResults() {
    try {
      // Save valid stocks
      await fs.writeFile(this.validStocksPath, JSON.stringify(this.validStocks, null, 2));
      console.log(`\nValid stocks saved to: ${this.validStocksPath}`);
      
      // Save invalid stocks
      await fs.writeFile(this.invalidStocksPath, JSON.stringify(this.invalidStocks, null, 2));
      console.log(`Invalid stocks saved to: ${this.invalidStocksPath}`);
      
      console.log('\nFiles created successfully!');
    } catch (error) {
      console.error('Error saving results:', error.message);
      throw error;
    }
  }

  generateSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total stocks checked: ${this.totalChecked}`);
    console.log(`Valid stocks: ${this.validStocks.length} (${(this.validStocks.length/this.totalChecked*100).toFixed(2)}%)`);
    console.log(`Invalid stocks: ${this.invalidStocks.length} (${(this.invalidStocks.length/this.totalChecked*100).toFixed(2)}%)`);
    
    if (this.invalidStocks.length > 0) {
      console.log('\nSample of invalid stocks:');
      this.invalidStocks.slice(0, 10).forEach((stock, index) => {
        console.log(`  ${index + 1}. ${stock.nse} - ${stock.error}`);
      });
      if (this.invalidStocks.length > 10) {
        console.log(`  ... and ${this.invalidStocks.length - 10} more`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Next steps:');
    console.log('1. Review nifty100-invalid.json for problematic stocks');
    console.log('2. Update main list if needed: cp nifty100-valid.json nifty100.json');
    console.log('3. Check invalid stocks for alternative symbols or data sources');
    console.log('='.repeat(60));
  }
}

// Run validation if script is called directly
if (require.main === module) {
  const validator = new StockValidator();
  
  validator.validateAllStocks()
    .then(() => {
      console.log('\nValidation completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = StockValidator;