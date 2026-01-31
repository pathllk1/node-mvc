const logger = require('./logger');

class TechnicalAnalysisDB {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      logger.info('Technical analysis database already initialized');
      return;
    }

    try {
      await this.createTechnicalAnalysisTable();
      logger.info('✓ Technical analysis database initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize technical analysis database:', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  createTechnicalAnalysisTable() {
    return new Promise((resolve, reject) => {
      // Strict SQLite table with proper data types
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS technical_analysis_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          calculation_timestamp TEXT NOT NULL,
          technical_score INTEGER NOT NULL,
          sma20 REAL,
          sma50 REAL,
          sma200 REAL,
          ema12 REAL,
          ema26 REAL,
          ema50 REAL,
          ema200 REAL,
          rsi REAL,
          macd REAL,
          macd_signal REAL,
          macd_histogram REAL,
          bollinger_upper REAL,
          bollinger_middle REAL,
          bollinger_lower REAL,
          stochastic_k REAL,
          stochastic_d REAL,
          atr REAL,
          cci REAL,
          williams_r REAL,
          adx REAL,
          roc REAL,
          mfi REAL,
          obv REAL,
          fibonacci_level0 REAL,
          fibonacci_level236 REAL,
          fibonacci_level382 REAL,
          fibonacci_level500 REAL,
          fibonacci_level618 REAL,
          fibonacci_level786 REAL,
          fibonacci_level100 REAL,
          pivot_point REAL,
          pivot_resistance1 REAL,
          pivot_resistance2 REAL,
          pivot_resistance3 REAL,
          pivot_support1 REAL,
          pivot_support2 REAL,
          pivot_support3 REAL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Performance indexes with strict SQLite compliance
        CREATE INDEX IF NOT EXISTS idx_ta_symbol_timestamp ON technical_analysis_records (symbol, calculation_timestamp);
        CREATE INDEX IF NOT EXISTS idx_ta_timestamp ON technical_analysis_records (calculation_timestamp);
        CREATE INDEX IF NOT EXISTS idx_ta_score ON technical_analysis_records (technical_score);
        CREATE INDEX IF NOT EXISTS idx_ta_symbol ON technical_analysis_records (symbol);
      `;

      const { db } = require('./database');
      db.serialize(() => {
        db.exec(createTableSQL, (err) => {
          if (err) {
            logger.error('Error creating technical analysis table:', { 
              error: err.message, 
              stack: err.stack 
            });
            reject(err);
          } else {
            logger.info('✓ Technical analysis records table created/verified successfully');
            resolve();
          }
        });
      });
    });
  }

  saveTechnicalAnalysisRecord(record) {
    return new Promise((resolve, reject) => {
      if (!record || !record.symbol) {
        reject(new Error('Invalid record: symbol is required'));
        return;
      }

      const insertSQL = `
        INSERT INTO technical_analysis_records 
        (symbol, calculation_timestamp, technical_score, sma20, sma50, sma200, ema12, ema26, ema50, ema200, 
         rsi, macd, macd_signal, macd_histogram, bollinger_upper, bollinger_middle, bollinger_lower,
         stochastic_k, stochastic_d, atr, cci, williams_r, adx, roc, mfi, obv,
         fibonacci_level0, fibonacci_level236, fibonacci_level382, fibonacci_level500, 
         fibonacci_level618, fibonacci_level786, fibonacci_level100,
         pivot_point, pivot_resistance1, pivot_resistance2, pivot_resistance3,
         pivot_support1, pivot_support2, pivot_support3)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        record.symbol,
        record.calculation_timestamp,
        record.technical_score,
        record.sma20,
        record.sma50,
        record.sma200,
        record.ema12,
        record.ema26,
        record.ema50,
        record.ema200,
        record.rsi,
        record.macd,
        record.macd_signal,
        record.macd_histogram,
        record.bollinger_upper,
        record.bollinger_middle,
        record.bollinger_lower,
        record.stochastic_k,
        record.stochastic_d,
        record.atr,
        record.cci,
        record.williams_r,
        record.adx,
        record.roc,
        record.mfi,
        record.obv,
        record.fibonacci_level0,
        record.fibonacci_level236,
        record.fibonacci_level382,
        record.fibonacci_level500,
        record.fibonacci_level618,
        record.fibonacci_level786,
        record.fibonacci_level100,
        record.pivot_point,
        record.pivot_resistance1,
        record.pivot_resistance2,
        record.pivot_resistance3,
        record.pivot_support1,
        record.pivot_support2,
        record.pivot_support3
      ];

      const { db } = require('./database');
      db.run(insertSQL, params, function(err) {
        if (err) {
          logger.error('Error saving technical analysis record:', { 
            error: err.message, 
            stack: err.stack,
            symbol: record.symbol
          });
          reject(err);
        } else {
          logger.info(`✓ Saved technical analysis record for ${record.symbol} (ID: ${this.lastID})`);
          resolve(this.lastID);
        }
      });
    });
  }

  getLatestTechnicalAnalysis(symbol) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM technical_analysis_records 
        WHERE symbol = ? 
        ORDER BY calculation_timestamp DESC 
        LIMIT 1
      `;

      const { db } = require('./database');
      db.get(sql, [symbol], (err, row) => {
        if (err) {
          logger.error('Error getting latest technical analysis:', { 
            error: err.message, 
            stack: err.stack,
            symbol: symbol
          });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getTechnicalAnalysisHistory(symbol, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM technical_analysis_records 
        WHERE symbol = ? 
        ORDER BY calculation_timestamp DESC 
        LIMIT ?
      `;

      const { db } = require('./database');
      db.all(sql, [symbol, limit], (err, rows) => {
        if (err) {
          logger.error('Error getting technical analysis history:', { 
            error: err.message, 
            stack: err.stack,
            symbol: symbol
          });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getLatestRecordsForAllStocks() {
    return new Promise((resolve, reject) => {
      const { db } = require('./database');
      const sql = `
        SELECT t1.* FROM technical_analysis_records t1
        INNER JOIN (
          SELECT symbol, MAX(calculation_timestamp) as latest_timestamp
          FROM technical_analysis_records
          GROUP BY symbol
        ) t2 ON t1.symbol = t2.symbol AND t1.calculation_timestamp = t2.latest_timestamp
        ORDER BY t1.technical_score DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          logger.error('Error getting latest records for all stocks:', { 
            error: err.message, 
            stack: err.stack
          });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getTopPerformingStocks(limit = 20) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT t1.* FROM technical_analysis_records t1
        INNER JOIN (
          SELECT symbol, MAX(calculation_timestamp) as latest_timestamp
          FROM technical_analysis_records
          GROUP BY symbol
        ) t2 ON t1.symbol = t2.symbol AND t1.calculation_timestamp = t2.latest_timestamp
        ORDER BY t1.technical_score DESC
        LIMIT ?
      `;

      const { db } = require('./database');
      db.all(sql, [limit], (err, rows) => {
        if (err) {
          logger.error('Error getting top performing stocks:', { 
            error: err.message, 
            stack: err.stack
          });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = TechnicalAnalysisDB;