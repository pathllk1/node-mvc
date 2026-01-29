const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database with foreign_keys=ON and journal_mode=WAL for better performance
const dbPath = path.join(dbDir, 'stock_data.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Create the stocks_history table with strict typing
function initializeDatabase() {
  // Create stocks_history table with proper data types
  db.exec(`
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
    ) STRICT;
    
    -- Create index for faster queries by symbol and timestamp
    CREATE INDEX IF NOT EXISTS idx_stocks_symbol_updated ON stocks_history (symbol, last_updated);
    
    -- Create index for faster queries by timestamp
    CREATE INDEX IF NOT EXISTS idx_stocks_updated ON stocks_history (last_updated);
  `);
  
  console.log('Database initialized successfully');
}

// Initialize the database immediately when this module is loaded
initializeDatabase();

module.exports = {
  db,
  initializeDatabase
};