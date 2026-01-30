// Logger utility for the Node.js MVC application
const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor(io = null) {
    this.io = io;
    this.logs = [];
    this.maxLogs = 1000; // Keep only last 1000 logs in memory
  }

  // Initialize logger with Socket.IO instance
  setSocketIO(io) {
    this.io = io;
  }

  // Log a message with level
  log(level, message, metadata = {}) {
    const timestamp = new Date();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      metadata
    };

    // Add to internal logs array
    this.logs.push(logEntry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Emit to all connected WebSocket clients if available
    if (this.io) {
      try {
        this.io.emit('server-log', {
          timestamp: timestamp,
          level: level.toUpperCase(),
          message: `[${timestamp.toLocaleString()}] ${message}`
        });
      } catch (error) {
        console.error('Error emitting log to WebSocket:', error);
      }
    }

    // Output to console
    const formattedMessage = `[${timestamp.toLocaleString()}] [${level.toUpperCase()}] ${message}`;
    switch (level.toLowerCase()) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
      case 'warning':
        console.warn(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'debug':
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  // Convenience methods
  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }

  // Get recent logs
  getRecentLogs(count = 100) {
    return this.logs.slice(-count);
  }

  // Get logs by level
  getLogsByLevel(level, count = 100) {
    const levelUpper = level.toUpperCase();
    return this.logs
      .filter(log => log.level === levelUpper)
      .slice(-count);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }
}

// Create a singleton logger instance
const logger = new Logger();

module.exports = logger;