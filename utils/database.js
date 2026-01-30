const sqlite3 = require('sqlite3').verbose();
const logger = require('./logger');
const path = require('path');
const fs = require('fs');

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database with foreign_keys=ON and journal_mode=WAL for better performance
const dbPath = path.join(dbDir, 'stock_data.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Error opening database:', { error: err.message, stack: err.stack });
  } else {
    logger.info('Connected to the SQLite database.');
    // Enable foreign keys and WAL mode
    db.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) {
        logger.error('Error enabling foreign keys:', { error: err.message, stack: err.stack });
      }
    });
    
    db.run('PRAGMA journal_mode = WAL;', (err) => {
      if (err) {
        logger.error('Error setting journal mode to WAL:', { error: err.message, stack: err.stack });
      }
    });
  }
});

// Create the stocks_history table with strict typing
function initializeDatabase(callback) {
  // Create stocks_history table with proper data types
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS stocks_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      price REAL,
      currency TEXT,
      change REAL,
      change_percent REAL,
      volume INTEGER,
      market_cap REAL,
      pe_ratio REAL,
      fifty_two_week_high REAL,
      fifty_two_week_low REAL,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      last_updated TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create index for faster queries by symbol and timestamp
    CREATE INDEX IF NOT EXISTS idx_stocks_symbol_updated ON stocks_history (symbol, last_updated);
    
    -- Create index for faster queries by timestamp
    CREATE INDEX IF NOT EXISTS idx_stocks_updated ON stocks_history (last_updated);
  `;
  
  db.serialize(() => {
    db.exec(createTableSQL, (err) => {
      if (err) {
        logger.error('Error creating tables:', { error: err.message, stack: err.stack });
        if (callback) callback(err);
      } else {
        logger.info('Database initialized successfully');
        if (callback) callback(null);
      }
    });
  });
}

// Export db immediately, but note that it might not be fully initialized yet
module.exports = {
  db,
  initializeDatabase
};

// Initialize the database asynchronously when this module is loaded
initializeDatabase((err) => {
  if (err) {
    logger.error('Failed to initialize database:', { error: err.message, stack: err.stack });
  }
});