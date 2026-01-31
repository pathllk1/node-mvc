const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', (req, res) => {
  res.render('index', { title: 'Home Page', message: 'Welcome to the Node.js MVC Application!' });
});

// Include stocks routes
router.use('/stocks', require('./stocks'));

// Include technical analysis routes
router.use('/technical-analysis', require('./technical-analysis'));

// Route for the log console
router.get('/console', (req, res) => {
  res.render('console', { title: 'Server Console' });
});

// API endpoint for recent logs
router.get('/api/console/logs', (req, res) => {
  try {
    // Use global logger instance
    const globalLogger = require('../utils/logger');
    
    const count = parseInt(req.query.count) || 100;
    const level = req.query.level;
    
    let logs;
    if (level) {
      logs = globalLogger.getLogsByLevel(level, count);
    } else {
      logs = globalLogger.getRecentLogs(count);
    }
    
    res.json({
      success: true,
      logs: logs,
      count: logs.length
    });
  } catch (error) {
    console.error('Error in /api/console/logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;