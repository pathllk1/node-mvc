const express = require('express');
const serverless = require('serverless-http');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const methodOverride = require('./middleware/methodOverride');
const securityMiddleware = require('./middleware/security');
const StockDataFetcher = require('./utils/stock-data-fetcher');
const DailyUpdateFetcher = require('./utils/daily-update-fetcher');
const logger = require('./utils/logger');
const path = require('path');
const app = express();

// Create HTTP server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, specify your frontend origin
    methods: ["GET", "POST"]
  }
});

// Initialize logger with Socket.IO
logger.setSocketIO(io);

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', require('ejs-mate'));

// Middleware
app.use(securityMiddleware);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride);
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));

// Error handling
app.use((req, res, next) => {
  logger.warn('Page not found', { url: req.url, method: req.method });
  res.status(404).render('error/404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  logger.error('Server error', { url: req.url, method: req.method, error: err.message });
  res.status(err.status || 500);
  res.render('error/error', { title: 'Server Error', error: err });
});

// Export for serverless
module.exports.handler = serverless(app);

// For local development
if (require.main === module) {
  const PORT = parseInt(process.env.PORT) || 3000;
  httpServer.listen(PORT, async () => {
    logger.info(`Server is running on port ${PORT}`);
    
    // Initialize and start the stock data fetcher after the app is fully initialized
    try {
        const stockFetcher = new StockDataFetcher(io);
        await stockFetcher.initialize();
        await stockFetcher.startFetching();
        logger.info('Stock data fetcher initialized and started');
    } catch (error) {
        logger.error('Failed to start stock data fetcher:', error);
    }
    
    // Initialize and start the daily update scheduler
    try {
        logger.info('Initializing daily update scheduler...');
        const dailyUpdater = new DailyUpdateFetcher();
        await dailyUpdater.initialize();
        dailyUpdater.startDailyScheduler();
        logger.info('✓ Daily update scheduler started and will run at 4 AM IST every day');
    } catch (error) {
        logger.error('Failed to start daily update scheduler:', error);
    }
  });
  
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    logger.info('Client connected:', { socketId: socket.id });
    
    // Send initial data when client connects
    socket.on('request-initial-data', async () => {
      try {
        const data = await require('fs').promises.readFile('./public/stock-data.json', 'utf8');
        const stockData = JSON.parse(data);
        socket.emit('stock-data-update', stockData);
      } catch (err) {
        logger.error('Error sending initial data:', err);
      }
    });
    
    socket.on('disconnect', () => {
      logger.info('Client disconnected:', { socketId: socket.id });
    });
  });
}

// Export for serverless (keep original handler for serverless compatibility)
module.exports.handler = serverless(app);