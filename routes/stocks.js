const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// Route for the stock dashboard
router.get('/dashboard', (req, res) => {
  res.render('stocks/dashboard', { title: 'Stock Dashboard' });
});

// API routes for stock data
router.get('/api/fundamental/:symbol', stockController.getFundamentalData);
router.get('/api/quote/:symbol', stockController.getQuoteData);
router.get('/api/chart/:symbol', stockController.getChartData);
router.get('/api/technical-analysis/:symbol', stockController.technicalAnalysis);

module.exports = router;