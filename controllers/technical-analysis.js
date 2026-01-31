const logger = require('../utils/logger');
const TechnicalAnalysisDB = require('../utils/technical-analysis-db');

class TechnicalAnalysisController {
  constructor() {
    this.db = new TechnicalAnalysisDB();
    
    // Bind methods to ensure proper 'this' context
    this.getLatestRecords = this.getLatestRecords.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getTopPerforming = this.getTopPerforming.bind(this);
    this.getScoreTrends = this.getScoreTrends.bind(this);
    this.searchRecords = this.searchRecords.bind(this);
    this.getSummary = this.getSummary.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.triggerManualRun = this.triggerManualRun.bind(this);
    this.renderDashboard = this.renderDashboard.bind(this);
    this.renderHistory = this.renderHistory.bind(this);
    this.renderSettings = this.renderSettings.bind(this);
  }

  async getLatestRecords(req, res) {
    try {
      await this.db.initialize();
      const records = await this.db.getLatestRecordsForAllStocks();
      
      res.json({
        success: true,
        count: records.length,
        data: records,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting latest technical analysis records:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch latest records',
        message: error.message
      });
    }
  }

  async getHistory(req, res) {
    try {
      const { symbol } = req.params;
      const { limit = 50 } = req.query;
      
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      await this.db.initialize();
      const history = await this.db.getTechnicalAnalysisHistory(symbol, parseInt(limit));
      
      res.json({
        success: true,
        symbol: symbol,
        count: history.length,
        data: history,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting technical analysis history:', { 
        error: error.message, 
        stack: error.stack,
        symbol: req.params.symbol
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch history',
        message: error.message
      });
    }
  }

  async getTopPerforming(req, res) {
    try {
      const { limit = 20 } = req.query;
      
      await this.db.initialize();
      const topStocks = await this.db.getTopPerformingStocks(parseInt(limit));
      
      res.json({
        success: true,
        count: topStocks.length,
        limit: parseInt(limit),
        data: topStocks,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting top performing stocks:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch top performing stocks',
        message: error.message
      });
    }
  }

  async getScoreTrends(req, res) {
    try {
      const { symbol } = req.params;
      const { days = 30 } = req.query;
      
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      await this.db.initialize();
      
      // Get historical records for the specified period
      const sql = `
        SELECT symbol, technical_score, calculation_timestamp 
        FROM technical_analysis_records 
        WHERE symbol = ? 
        AND calculation_timestamp >= datetime('now', '-${days} days')
        ORDER BY calculation_timestamp ASC
      `;
      
      const { db } = require('../utils/database');
      const trends = await new Promise((resolve, reject) => {
        db.all(sql, [symbol], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      res.json({
        success: true,
        symbol: symbol,
        days: parseInt(days),
        count: trends.length,
        data: trends,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting score trends:', { 
        error: error.message, 
        stack: error.stack,
        symbol: req.params.symbol
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch score trends',
        message: error.message
      });
    }
  }

  async searchRecords(req, res) {
    try {
      const { symbol, minScore, maxScore, startDate, endDate, limit = 100 } = req.body;
      
      await this.db.initialize();
      
      let sql = 'SELECT * FROM technical_analysis_records WHERE 1=1';
      const params = [];
      
      if (symbol) {
        sql += ' AND symbol = ?';
        params.push(symbol);
      }
      
      if (minScore !== undefined) {
        sql += ' AND technical_score >= ?';
        params.push(minScore);
      }
      
      if (maxScore !== undefined) {
        sql += ' AND technical_score <= ?';
        params.push(maxScore);
      }
      
      if (startDate) {
        sql += ' AND calculation_timestamp >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        sql += ' AND calculation_timestamp <= ?';
        params.push(endDate);
      }
      
      sql += ' ORDER BY calculation_timestamp DESC LIMIT ?';
      params.push(parseInt(limit));
      
      const { db } = require('../utils/database');
      const records = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      res.json({
        success: true,
        count: records.length,
        criteria: { symbol, minScore, maxScore, startDate, endDate, limit },
        data: records,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error searching technical analysis records:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to search records',
        message: error.message
      });
    }
  }

  async getSummary(req, res) {
    try {
      await this.db.initialize();
      
      const { db } = require('../utils/database');
      
      // Get summary statistics
      const summarySql = `
        SELECT 
          COUNT(DISTINCT symbol) as total_stocks,
          AVG(technical_score) as avg_score,
          MIN(technical_score) as min_score,
          MAX(technical_score) as max_score,
          COUNT(*) as total_records
        FROM technical_analysis_records
        WHERE calculation_timestamp >= datetime('now', '-1 day')
      `;
      
      const summary = await new Promise((resolve, reject) => {
        db.get(summarySql, [], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      // Get score distribution
      const distributionSql = `
        SELECT 
          CASE 
            WHEN technical_score >= 70 THEN 'Strong (70-100)'
            WHEN technical_score >= 50 THEN 'Moderate (50-69)'
            ELSE 'Weak (0-49)'
          END as category,
          COUNT(*) as count
        FROM technical_analysis_records
        WHERE calculation_timestamp >= datetime('now', '-1 day')
        GROUP BY 
          CASE 
            WHEN technical_score >= 70 THEN 'Strong (70-100)'
            WHEN technical_score >= 50 THEN 'Moderate (50-69)'
            ELSE 'Weak (0-49)'
          END
        ORDER BY category
      `;
      
      const distribution = await new Promise((resolve, reject) => {
        db.all(distributionSql, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      res.json({
        success: true,
        summary: summary,
        distribution: distribution,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting technical analysis summary:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch summary',
        message: error.message
      });
    }
  }

  async getStatus(req, res) {
    try {
      // Import the automation class to get status
      const TechnicalAnalysisAutomation = require('../utils/technical-analysis-automation');
      const automation = new TechnicalAnalysisAutomation();
      
      const status = automation.getStatus();
      
      res.json({
        success: true,
        status: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting automation status:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch status',
        message: error.message
      });
    }
  }

  async triggerManualRun(req, res) {
    try {
      logger.info('Manual technical analysis run triggered');
      
      // Import and initialize automation
      const TechnicalAnalysisAutomation = require('../utils/technical-analysis-automation');
      const automation = new TechnicalAnalysisAutomation();
      
      await automation.initialize();
      
      const startTime = Date.now();
      await automation.processAllStocks();
      const endTime = Date.now();
      
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      res.json({
        success: true,
        message: 'Manual technical analysis run completed successfully',
        stocksProcessed: 581,
        processingTime: `${duration} seconds`,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Manual run completed in ${duration} seconds`);
    } catch (error) {
      logger.error('Error in manual technical analysis run:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        error: 'Manual run failed',
        message: error.message
      });
    }
  }

  // View rendering methods
  async renderDashboard(req, res) {
    try {
      await this.db.initialize();
      
      // Get latest records for dashboard
      const records = await this.db.getLatestRecordsForAllStocks();
      
      res.render('technical-analysis/dashboard', {
        title: 'Technical Analysis Dashboard',
        records: records,
        totalStocks: records.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error rendering technical analysis dashboard:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).render('error/error', {
        title: 'Server Error',
        error: error
      });
    }
  }

  async renderHistory(req, res) {
    try {
      const { symbol } = req.params;
      
      await this.db.initialize();
      
      let history = [];
      if (symbol) {
        history = await this.db.getTechnicalAnalysisHistory(symbol, 50);
      }
      
      res.render('technical-analysis/history', {
        title: 'Technical Analysis History',
        symbol: symbol || '',
        history: history,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error rendering technical analysis history:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).render('error/error', {
        title: 'Server Error',
        error: error
      });
    }
  }

  async renderSettings(req, res) {
    try {
      await this.db.initialize();
      
      // Get system status
      const TechnicalAnalysisAutomation = require('../utils/technical-analysis-automation');
      const automation = new TechnicalAnalysisAutomation();
      const status = automation.getStatus();
      
      res.render('technical-analysis/settings', {
        title: 'Technical Analysis Settings',
        status: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error rendering technical analysis settings:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).render('error/error', {
        title: 'Server Error',
        error: error
      });
    }
  }
}

module.exports = new TechnicalAnalysisController();