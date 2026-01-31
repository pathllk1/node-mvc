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
    
    // Format message with metadata if present
    let formattedMessage = message;
    if (metadata && Object.keys(metadata).length > 0) {
      formattedMessage = `${message} ${JSON.stringify(metadata)}`;
    }
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message: formattedMessage,
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
          message: `[${timestamp.toLocaleString()}] [${level.toUpperCase()}] ${formattedMessage}`
        });
      } catch (error) {
        console.error('Error emitting log to WebSocket:', error);
      }
    }

    // Output to console
    const consoleMessage = `[${timestamp.toLocaleString()}] [${level.toUpperCase()}] ${formattedMessage}`;
    switch (level.toLowerCase()) {
      case 'error':
        console.error(consoleMessage);
        break;
      case 'warn':
      case 'warning':
        console.warn(consoleMessage);
        break;
      case 'info':
        console.info(consoleMessage);
        break;
      case 'debug':
        console.debug(consoleMessage);
        break;
      default:
        console.log(consoleMessage);
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