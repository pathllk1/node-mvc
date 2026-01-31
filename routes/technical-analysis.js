const express = require('express');
const router = express.Router();
const technicalAnalysisController = require('../controllers/technical-analysis');

// View routes
router.get('/dashboard', technicalAnalysisController.renderDashboard);
router.get('/history', technicalAnalysisController.renderHistory);
router.get('/history/:symbol', technicalAnalysisController.renderHistory);
router.get('/settings', technicalAnalysisController.renderSettings);

// API routes
router.get('/latest', technicalAnalysisController.getLatestRecords);
router.get('/history-api/:symbol', technicalAnalysisController.getHistory);
router.get('/top-performing', technicalAnalysisController.getTopPerforming);
router.get('/score/:symbol', technicalAnalysisController.getScoreTrends);
router.post('/search', technicalAnalysisController.searchRecords);
router.get('/summary', technicalAnalysisController.getSummary);
router.get('/status', technicalAnalysisController.getStatus);
router.post('/trigger-manual-run', technicalAnalysisController.triggerManualRun);

module.exports = router;