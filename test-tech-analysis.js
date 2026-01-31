const { technicalAnalysis } = require('./controllers/stockController');

const mockReq = { params: { symbol: 'RELIANCE.NS' } };
const mockRes = {
  json: (data) => {
    console.log('Technical Analysis Result for RELIANCE.NS:');
    console.log('Score:', data.score);
    console.log('Has Indicators:', !!data.indicators);
    console.log('Indicators Count:', Object.keys(data.indicators || {}).length);
    console.log('Symbol:', data.symbol);
    process.exit(0);
  },
  status: () => ({ json: (cb) => cb() }),
  statusValue: 200
};

// Add error handling
const mockNext = () => {};

console.log('Testing technical analysis for RELIANCE.NS...');
technicalAnalysis(mockReq, mockRes, mockNext);