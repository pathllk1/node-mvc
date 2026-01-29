const YahooFinance = require('yahoo-finance2');
const yahooFinance = new YahooFinance.default();

// Get fundamental data for a specific stock
exports.getFundamentalData = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }
    
    // Fetch comprehensive fundamental data
    const fundamentalData = await yahooFinance.quoteSummary(symbol, {
      modules: [
        'assetProfile',        // Company information, business summary, employees, etc.
        'summaryProfile',      // Business summary and company description
        'financialData',       // Revenue, margins, profitability ratios
        'summaryDetail',       // Market data, 52-week high/low, etc.
        'price',              // Current price and price details
        'defaultKeyStatistics', // Key financial ratios and statistics
        'earnings',           // Earnings history and estimates
        'recommendationTrend', // Analyst recommendations
        'majorHoldersBreakdown' // Major holders information
      ]
    });
    
    // Format the data for frontend consumption
    const formattedData = {
      symbol: symbol,
      companyInfo: {
        name: fundamentalData.price?.shortName || fundamentalData.assetProfile?.longName || symbol,
        exchange: fundamentalData.price?.exchange || 'N/A',
        currency: fundamentalData.price?.currency || 'USD',
        website: fundamentalData.assetProfile?.website || 'N/A',
        industry: fundamentalData.assetProfile?.industry || 'N/A',
        sector: fundamentalData.assetProfile?.sector || 'N/A',
        fullTimeEmployees: fundamentalData.assetProfile?.fullTimeEmployees || 'N/A',
        businessSummary: fundamentalData.assetProfile?.longBusinessSummary || fundamentalData.summaryProfile?.longBusinessSummary || 'No business summary available'
      },
      financials: {
        currentPrice: fundamentalData.price?.regularMarketPrice,
        previousClose: fundamentalData.price?.regularMarketPreviousClose,
        open: fundamentalData.price?.regularMarketOpen,
        dayHigh: fundamentalData.price?.regularMarketDayHigh,
        dayLow: fundamentalData.price?.regularMarketDayLow,
        fiftyTwoWeekHigh: fundamentalData.summaryDetail?.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: fundamentalData.summaryDetail?.fiftyTwoWeekLow,
        marketCap: fundamentalData.price?.marketCap || fundamentalData.summaryDetail?.marketCap,
        volume: fundamentalData.price?.regularMarketVolume,
        averageVolume: fundamentalData.summaryDetail?.averageVolume,
        peRatio: fundamentalData.summaryDetail?.trailingPE,
        forwardPE: fundamentalData.summaryDetail?.forwardPE,
        eps: fundamentalData.defaultKeyStatistics?.trailingEps,
        revenue: fundamentalData.financialData?.totalRevenue,
        grossMargins: fundamentalData.financialData?.grossMargins,
        ebitdaMargins: fundamentalData.financialData?.ebitdaMargins,
        operatingMargins: fundamentalData.financialData?.operatingMargins,
        profitMargins: fundamentalData.financialData?.profitMargins,
        freeCashflow: fundamentalData.financialData?.freeCashflow,
        operatingCashflow: fundamentalData.financialData?.operatingCashflow,
        returnOnAssets: fundamentalData.financialData?.returnOnAssets,
        returnOnEquity: fundamentalData.financialData?.returnOnEquity,
        debtToEquity: fundamentalData.financialData?.debtToEquity,
        revenuePerShare: fundamentalData.financialData?.revenuePerShare,
        earningsGrowth: fundamentalData.financialData?.earningsGrowth,
        revenueGrowth: fundamentalData.financialData?.revenueGrowth,
        targetHighPrice: fundamentalData.financialData?.targetHighPrice,
        targetLowPrice: fundamentalData.financialData?.targetLowPrice,
        targetMeanPrice: fundamentalData.financialData?.targetMeanPrice,
        targetMedianPrice: fundamentalData.financialData?.targetMedianPrice
      },
      analyst: {
        recommendation: fundamentalData.financialData?.recommendationKey,
        numberOfAnalysts: fundamentalData.financialData?.numberOfAnalystOpinions,
        recommendationTrend: fundamentalData.recommendationTrend?.trend || []
      },
      holders: {
        majorHolders: fundamentalData.majorHoldersBreakdown || {}
      },
      earnings: {
        history: fundamentalData.earnings?.earningsChart?.quarterly || [],
        estimates: fundamentalData.earnings?.earningsChart?.currentQuarterEstimate || null
      }
    };
    
    res.json(formattedData);
    
  } catch (error) {
    console.error(`Error fetching fundamental data for ${req.params.symbol}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to fetch fundamental data',
      message: error.message 
    });
  }
};

// Get technical analysis data for a specific stock
exports.technicalAnalysis = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }
    
    // Get latest 30 days of OHLCV data for technical analysis
    const db = require('../utils/database').db;
    const stockData = db.prepare(
      `SELECT close, high, low, open, volume, date 
       FROM historical_ohlcv 
       WHERE symbol = ? 
       ORDER BY date DESC 
       LIMIT 250`
    ).all(symbol);
    
    if (stockData.length < 14) {
      return res.status(400).json({ 
        error: 'Insufficient data for technical analysis',
        message: `Need at least 14 data points, got ${stockData.length}`
      });
    }
    
    // Prepare data arrays (filter out any null values)
    const validData = stockData.filter(d => 
      d.close !== null && d.high !== null && d.low !== null && d.open !== null && d.volume !== null
    );
    
    if (validData.length < 14) {
      return res.status(400).json({ 
        error: 'Insufficient valid data for technical analysis',
        message: `Need at least 14 valid data points, got ${validData.length}`
      });
    }
    
    const closes = validData.map(d => parseFloat(d.close)).reverse();
    const highs = validData.map(d => parseFloat(d.high)).reverse();
    const lows = validData.map(d => parseFloat(d.low)).reverse();
    const opens = validData.map(d => parseFloat(d.open)).reverse();
    const volumes = validData.map(d => parseInt(d.volume)).reverse();
    
    // Helper functions for technical analysis calculations
    const calculateSMA = (data, period) => {
      if (data.length < period) return null;
      const slice = data.slice(-period);
      const sum = slice.reduce((acc, val) => acc + val, 0);
      return sum / period;
    };
    
    const calculateEMA = (data, period) => {
      if (data.length < period) return null;
      const k = 2 / (period + 1);
      let ema = data[0];
      for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
      }
      return ema;
    };
    
    const calculateRSI = (data, period = 14) => {
      if (data.length <= period) return null;
      
      const gains = [];
      const losses = [];
      
      for (let i = 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
      }
      
      const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };
    
    const calculateMACD = (data) => {
      if (data.length < 26) return { macd: null, signal: null, histogram: null };
      
      // Calculate EMAs using a proper method that tracks historical values
      const ema = (prices, period) => {
        if (prices.length < period) return null;
        
        // Calculate SMA for initial value
        let sma = 0;
        for (let i = 0; i < period; i++) {
          sma += prices[i];
        }
        sma /= period;
        
        // Calculate multiplier
        const multiplier = 2 / (period + 1);
        
        // Calculate EMA
        let emaValue = sma;
        for (let i = period; i < prices.length; i++) {
          emaValue = (prices[i] - emaValue) * multiplier + emaValue;
        }
        
        return emaValue;
      };
      
      // Calculate EMA12 and EMA26 for the full data set
      const ema12 = ema(data, 12);
      const ema26 = ema(data, 26);
      
      if (ema12 === null || ema26 === null) return { macd: null, signal: null, histogram: null };
      
      const macdLine = ema12 - ema26;
      
      // To calculate the signal line (9-period EMA of MACD line), we need to generate the MACD history
      // This is a simplified approach that approximates the signal line
      const macdHistory = [];
      
      // Generate MACD values for each point in the data (using a sliding window approach)
      for (let i = 25; i < data.length; i++) {
        const slice = data.slice(0, i + 1);
        const tempEma12 = ema(slice, 12);
        const tempEma26 = ema(slice, 26);
        if (tempEma12 !== null && tempEma26 !== null) {
          macdHistory.push(tempEma12 - tempEma26);
        }
      }
      
      // Calculate signal line as 9-period EMA of MACD values
      const signalLine = macdHistory.length >= 9 ? ema(macdHistory.slice(-9), 9) : null;
      
      return {
        macd: macdLine,
        signal: signalLine,
        histogram: signalLine !== null ? macdLine - signalLine : null
      };
    };
      if (ema12 === null || ema26 === null) return { macd: null, signal: null, histogram: null };
      
      const macdLine = ema12 - ema26;
      
      // Simplified signal line calculation
      const recentData = data.slice(-9);
      const ema12Recent = calculateEMA(recentData, 12);
      const ema26Recent = calculateEMA(recentData, 26);
      const signalLine = ema12Recent - ema26Recent;
      
      return {
        macd: macdLine,
        signal: signalLine,
        histogram: macdLine - signalLine
      };
    };
    
    const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
      if (data.length < period) return { upper: null, middle: null, lower: null };
      
      const slice = data.slice(-period);
      const sma = calculateSMA(slice, period);
      
      if (sma === null) return { upper: null, middle: null, lower: null };
      
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
      const std = Math.sqrt(variance);
      
      return {
        upper: sma + (std * stdDev),
        middle: sma,
        lower: sma - (std * stdDev)
      };
    };
    
    const calculateStochastic = (highs, lows, closes, kPeriod = 5, dPeriod = 3) => {
      if (closes.length < kPeriod) return { k: null, d: null };
      
      const recentHighs = highs.slice(-kPeriod);
      const recentLows = lows.slice(-kPeriod);
      const currentClose = closes[closes.length - 1];
      
      const highestHigh = Math.max(...recentHighs);
      const lowestLow = Math.min(...recentLows);
      
      if (highestHigh === lowestLow) return { k: 50, d: 50 };
      
      const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      
      // Simple moving average of K for D
      const kValues = closes.length >= kPeriod + dPeriod - 1 ? 
        closes.slice(-(kPeriod + dPeriod - 1)).map((_, idx, arr) => {
          if (idx < kPeriod - 1) return null;
          const slice = arr.slice(idx - kPeriod + 1, idx + 1);
          const highsSlice = highs.slice(idx - kPeriod + 1, idx + 1);
          const lowsSlice = lows.slice(idx - kPeriod + 1, idx + 1);
          const current = slice[slice.length - 1];
          const hh = Math.max(...highsSlice);
          const ll = Math.min(...lowsSlice);
          return hh === ll ? 50 : ((current - ll) / (hh - ll)) * 100;
        }).filter(val => val !== null).slice(-dPeriod) : [k];
      
      const d = kValues.length > 0 ? kValues.reduce((a, b) => a + b, 0) / kValues.length : k;
      
      return { k, d };
    };
    
    const calculateATR = (highs, lows, closes, period = 14) => {
      if (highs.length < period || lows.length < period || closes.length < period) return null;
      
      // Calculate True Range values for the period
      const trueRanges = [];
      for (let i = 1; i < highs.length; i++) {
        const high = highs[i];
        const low = lows[i];
        const prevClose = closes[i - 1];
        
        const h_l = high - low;
        const h_pc = Math.abs(high - prevClose);
        const l_pc = Math.abs(low - prevClose);
        
        const tr = Math.max(h_l, h_pc, l_pc);
        trueRanges.push(tr);
      }
      
      // Calculate ATR using smoothed moving average
      // First, calculate the initial ATR using a simple average of the first period
      if (trueRanges.length < period) return null;
      
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += trueRanges[i];
      }
      let atr = sum / period;
      
      // Update ATR with remaining values using the smoothed formula
      for (let i = period; i < trueRanges.length; i++) {
        atr = ((atr * (period - 1)) + trueRanges[i]) / period;
      }
      
      return atr;
    };
    
    const calculateCCI = (highs, lows, closes, period = 14) => {
      if (highs.length < period || lows.length < period || closes.length < period) return null;
      
      // Calculate typical prices for the last period
      const typicalPrices = [];
      for (let i = highs.length - period; i < highs.length; i++) {
        typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
      }
      
      // Calculate SMA of typical prices
      const smaTp = typicalPrices.reduce((sum, price) => sum + price, 0) / period;
      
      // Calculate mean deviation
      const meanDev = typicalPrices.reduce((sum, price) => sum + Math.abs(price - smaTp), 0) / period;
      
      // Calculate current typical price
      const currentTp = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
      
      // Calculate CCI
      return (currentTp - smaTp) / (0.015 * meanDev);
    };
    
    // Calculate various technical indicators
    const indicators = {};
    
    // Calculate SMA (20-day)
    try {
      indicators.sma20 = calculateSMA(closes, 20);
    } catch (e) {
      indicators.sma20 = null;
    }
    
    // Calculate SMA (50-day)
    try {
      indicators.sma50 = calculateSMA(closes, 50);
    } catch (e) {
      indicators.sma50 = null;
    }
    
    // Calculate EMA (12-day)
    try {
      indicators.ema12 = calculateEMA(closes, 12);
    } catch (e) {
      indicators.ema12 = null;
    }
    
    // Calculate EMA (26-day)
    try {
      indicators.ema26 = calculateEMA(closes, 26);
    } catch (e) {
      indicators.ema26 = null;
    }
    
    // Calculate RSI (14-day)
    try {
      indicators.rsi = calculateRSI(closes, 14);
    } catch (e) {
      indicators.rsi = null;
    }
    
    // Calculate SMA (200-day)
    try {
      indicators.sma200 = calculateSMA(closes, 200);
    } catch (e) {
      indicators.sma200 = null;
    }
    
    // Calculate EMA (50-day)
    try {
      indicators.ema50 = calculateEMA(closes, 50);
    } catch (e) {
      indicators.ema50 = null;
    }
    
    // Calculate EMA (200-day)
    try {
      indicators.ema200 = calculateEMA(closes, 200);
    } catch (e) {
      indicators.ema200 = null;
    }
    
    // Calculate MACD
    try {
      const macdResult = calculateMACD(closes);
      indicators.macd = macdResult.macd;
      indicators.macdSignal = macdResult.signal;
      indicators.macdHist = macdResult.histogram;
    } catch (e) {
      indicators.macd = null;
      indicators.macdSignal = null;
      indicators.macdHist = null;
    }
    
    // Calculate Bollinger Bands
    try {
      const bbands = calculateBollingerBands(closes, 20, 2);
      indicators.bbUpper = bbands.upper;
      indicators.bbMiddle = bbands.middle;
      indicators.bbLower = bbands.lower;
    } catch (e) {
      indicators.bbUpper = null;
      indicators.bbMiddle = null;
      indicators.bbLower = null;
    }
    
    // Calculate Stochastic
    try {
      const stoch = calculateStochastic(highs, lows, closes, 5, 3);
      indicators.stochK = stoch.k;
      indicators.stochD = stoch.d;
    } catch (e) {
      indicators.stochK = null;
      indicators.stochD = null;
    }
    
    // Calculate ATR
    try {
      indicators.atr = calculateATR(highs, lows, closes, 14);
    } catch (e) {
      indicators.atr = null;
    }
    
    // Calculate CCI
    try {
      indicators.cci = calculateCCI(highs, lows, closes, 14);
    } catch (e) {
      indicators.cci = null;
    }
    
    // Calculate Williams %R
    const calculateWilliamR = (highs, lows, closes, period = 14) => {
      if (highs.length < period || lows.length < period || closes.length < period) return null;
      
      const recentHighs = highs.slice(-period);
      const recentLows = lows.slice(-period);
      const currentClose = closes[closes.length - 1];
      
      const highestHigh = Math.max(...recentHighs);
      const lowestLow = Math.min(...recentLows);
      
      if (highestHigh === lowestLow) return -50;
      
      return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
    };
    
    try {
      indicators.williamsR = calculateWilliamR(highs, lows, closes, 14);
    } catch (e) {
      indicators.williamsR = null;
    }
    
    // Calculate ADX (Average Directional Index)
    const calculateADX = (highs, lows, closes, period = 14) => {
      if (highs.length < period + 1) return null;
      
      // Simplified ADX calculation based on price movements
      let upMove = 0;
      let downMove = 0;
      let trSum = 0;
      
      for (let i = 1; i < period + 1; i++) {
        const high = highs[highs.length - i];
        const low = lows[lows.length - i];
        const prevHigh = highs[highs.length - i - 1];
        const prevLow = lows[lows.length - i - 1];
        
        const upMove_i = high - prevHigh;
        const downMove_i = prevLow - low;
        
        if (upMove_i > downMove_i && upMove_i > 0) {
          upMove += upMove_i;
        }
        if (downMove_i > upMove_i && downMove_i > 0) {
          downMove += downMove_i;
        }
      }
      
      const plusDM = upMove / period;
      const minusDM = downMove / period;
      
      if (plusDM + minusDM === 0) return null;
      
      const dx = Math.abs((plusDM - minusDM) / (plusDM + minusDM)) * 100;
      
      return dx; // This is DX, not ADX, but it's a reasonable approximation
    };
    
    try {
      indicators.adx = calculateADX(highs, lows, closes, 14);
    } catch (e) {
      indicators.adx = null;
    }
    
    // Calculate Rate of Change (ROC)
    const calculateROC = (closes, period = 12) => {
      if (closes.length < period + 1) return null;
      
      const currentClose = closes[closes.length - 1];
      const prevClose = closes[closes.length - 1 - period];
      
      return ((currentClose - prevClose) / prevClose) * 100;
    };
    
    try {
      indicators.roc = calculateROC(closes, 12);
    } catch (e) {
      indicators.roc = null;
    }
    
    // Calculate Money Flow Index (MFI)
    const calculateMFI = (highs, lows, closes, volumes, period = 14) => {
      if (highs.length < period || lows.length < period || closes.length < period || volumes.length < period) return null;
      
      // Calculate typical prices
      const typicalPrices = [];
      for (let i = 0; i < period; i++) {
        const idx = closes.length - period + i;
        const typicalPrice = (highs[idx] + lows[idx] + closes[idx]) / 3;
        typicalPrices.push(typicalPrice);
      }
      
      // Calculate money flows
      let positiveMF = 0;
      let negativeMF = 0;
      
      for (let i = 1; i < typicalPrices.length; i++) {
        const rawMF = typicalPrices[i] * volumes[volumes.length - period + i];
        
        if (typicalPrices[i] > typicalPrices[i - 1]) {
          positiveMF += rawMF;
        } else if (typicalPrices[i] < typicalPrices[i - 1]) {
          negativeMF += rawMF;
        }
      }
      
      if (negativeMF === 0) return 100;
      if (positiveMF === 0) return 0;
      
      const moneyFlowRatio = positiveMF / negativeMF;
      const mfi = 100 - (100 / (1 + moneyFlowRatio));
      
      return mfi;
    };
    
    try {
      indicators.mfi = calculateMFI(highs, lows, closes, volumes, 14);
    } catch (e) {
      indicators.mfi = null;
    }
    
    // Calculate On Balance Volume (OBV)
    const calculateOBV = (closes, volumes) => {
      if (closes.length < 2 || volumes.length < 2) return null;
      
      let obv = 0;
      for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) {
          obv += volumes[i];
        } else if (closes[i] < closes[i - 1]) {
          obv -= volumes[i];
        }
        // If equal, OBV remains unchanged
      }
      
      return obv;
    };
    
    try {
      indicators.obv = calculateOBV(closes, volumes);
    } catch (e) {
      indicators.obv = null;
    }
    
    // Calculate Fibonacci Retracement Levels
    const calculateFibonacciLevels = (highs, lows, closes) => {
      if (highs.length < 2 || lows.length < 2) return null;
      
      // Get the highest high and lowest low from recent period (e.g., last 20 periods)
      const lookback = Math.min(20, highs.length);
      const recentHighs = highs.slice(-lookback);
      const recentLows = lows.slice(-lookback);
      
      const high = Math.max(...recentHighs);
      const low = Math.min(...recentLows);
      const diff = high - low;
      
      // Calculate fibonacci levels
      return {
        level236: high - diff * 0.236,
        level382: high - diff * 0.382,
        level500: high - diff * 0.500,
        level618: high - diff * 0.618,
        level786: high - diff * 0.786,
        high: high,
        low: low
      };
    };
    
    try {
      indicators.fibonacci = calculateFibonacciLevels(highs, lows, closes);
    } catch (e) {
      indicators.fibonacci = null;
    }
    
    // Calculate Pivot Points
    const calculatePivotPoints = (highs, lows, closes) => {
      if (highs.length < 2 || lows.length < 2 || closes.length < 2) return null;
      
      // Get previous period's high, low, and close
      const prevHigh = highs[highs.length - 2];
      const prevLow = lows[lows.length - 2];
      const prevClose = closes[closes.length - 2];
      
      // Calculate pivot point and support/resistance levels
      const pivotPoint = (prevHigh + prevLow + prevClose) / 3;
      
      return {
        pivotPoint: pivotPoint,
        resistance1: (2 * pivotPoint) - prevLow,
        resistance2: pivotPoint + (prevHigh - prevLow),
        resistance3: prevHigh + 2 * (pivotPoint - prevLow),
        support1: (2 * pivotPoint) - prevHigh,
        support2: pivotPoint - (prevHigh - prevLow),
        support3: prevLow - 2 * (prevHigh - pivotPoint)
      };
    };
    
    try {
      indicators.pivotPoints = calculatePivotPoints(highs, lows, closes);
    } catch (e) {
      indicators.pivotPoints = null;
    }
    
    // Get the most recent current price from stocks_history table
    const currentStockData = db.prepare(
      `SELECT price 
       FROM stocks_history 
       WHERE symbol = ? 
       ORDER BY last_updated DESC 
       LIMIT 1`
    ).get(symbol);
    
    // Calculate latest price for comparison
    // Use current price from stocks_history if available, otherwise fall back to latest close from historical data
    const currentPrice = currentStockData && currentStockData.price !== null ? currentStockData.price : closes[closes.length - 1];
    
    // Format the response
    const analysis = {
      symbol: symbol,
      currentPrice: currentPrice,
      chartPeriod: "1y", // Default period for charts
      indicators: {
        // Trend Indicators
        sma20: {
          value: indicators.sma20,
          signal: indicators.sma20 !== null ? (currentPrice > indicators.sma20 ? 'Bullish' : 'Bearish') : 'N/A',
          color: indicators.sma20 !== null ? (currentPrice > indicators.sma20 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
        },
        sma50: {
          value: indicators.sma50,
          signal: indicators.sma50 !== null ? (currentPrice > indicators.sma50 ? 'Bullish' : 'Bearish') : 'N/A',
          color: indicators.sma50 !== null ? (currentPrice > indicators.sma50 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
        },
        ema12: {
          value: indicators.ema12,
          signal: indicators.ema12 !== null ? (currentPrice > indicators.ema12 ? 'Bullish' : 'Bearish') : 'N/A',
          color: indicators.ema12 !== null ? (currentPrice > indicators.ema12 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
        },
        ema26: {
          value: indicators.ema26,
          signal: indicators.ema26 !== null ? (currentPrice > indicators.ema26 ? 'Bullish' : 'Bearish') : 'N/A',
          color: indicators.ema26 !== null ? (currentPrice > indicators.ema26 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
        },
        sma200: {
          value: indicators.sma200,
          signal: indicators.sma200 !== null ? (currentPrice > indicators.sma200 ? 'Bullish' : 'Bearish') : 'N/A',
          color: indicators.sma200 !== null ? (currentPrice > indicators.sma200 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
        },
        ema50: {
          value: indicators.ema50,
          signal: indicators.ema50 !== null ? (currentPrice > indicators.ema50 ? 'Bullish' : 'Bearish') : 'N/A',
          color: indicators.ema50 !== null ? (currentPrice > indicators.ema50 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
        },
        ema200: {
          value: indicators.ema200,
          signal: indicators.ema200 !== null ? (currentPrice > indicators.ema200 ? 'Bullish' : 'Bearish') : 'N/A',
          color: indicators.ema200 !== null ? (currentPrice > indicators.ema200 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
        },
        
        // Momentum Indicators
        rsi: {
          value: indicators.rsi,
          signal: indicators.rsi !== null ? (
            indicators.rsi > 70 ? 'Overbought' : 
            indicators.rsi < 30 ? 'Oversold' : 
            'Neutral'
          ) : 'N/A',
          color: indicators.rsi !== null ? (
            indicators.rsi > 70 ? 'text-red-600' : 
            indicators.rsi < 30 ? 'text-green-600' : 
            'text-yellow-600'
          ) : 'text-gray-500'
        },
        
        macd: {
          value: indicators.macd,
          signal: indicators.macd !== null && indicators.macdHist !== null ? (
            indicators.macdHist > 0 ? 'Bullish' : 'Bearish'
          ) : 'N/A',
          color: indicators.macd !== null && indicators.macdHist !== null ? (
            indicators.macdHist > 0 ? 'text-green-600' : 'text-red-600'
          ) : 'text-gray-500'
        },

        
        macdSignal: {
          value: indicators.macdSignal,
          signal: indicators.macdSignal !== null ? "Calculated" : "N/A",
          color: "text-blue-600"
        },
        
        macdHistogram: {
          value: indicators.macdHist,
          signal: indicators.macdHist !== null ? (
            indicators.macdHist > 0 ? "Positive" : "Negative"
          ) : "N/A",
          color: indicators.macdHist !== null ? (
            indicators.macdHist > 0 ? "text-green-600" : "text-red-600"
          ) : "text-gray-500"
        },
        
        // Volatility Indicators
        bollingerBands: {
          upper: indicators.bbUpper,
          middle: indicators.bbMiddle,
          lower: indicators.bbLower,
          signal: indicators.bbUpper !== null && indicators.bbLower !== null ? (
            currentPrice > indicators.bbUpper ? 'Overbought' : 
            currentPrice < indicators.bbLower ? 'Oversold' : 
            'Normal'
          ) : 'N/A',
          color: indicators.bbUpper !== null && indicators.bbLower !== null ? (
            currentPrice > indicators.bbUpper ? 'text-red-600' : 
            currentPrice < indicators.bbLower ? 'text-green-600' : 
            'text-blue-600'
          ) : 'text-gray-500'
        },
        
        stochastic: {
          k: indicators.stochK,
          d: indicators.stochD,
          signal: indicators.stochK !== null && indicators.stochD !== null ? (
            indicators.stochK > 80 || indicators.stochD > 80 ? 'Overbought' : 
            indicators.stochK < 20 || indicators.stochD < 20 ? 'Oversold' : 
            'Neutral'
          ) : 'N/A',
          color: indicators.stochK !== null && indicators.stochD !== null ? (
            (indicators.stochK > 80 || indicators.stochD > 80) ? 'text-red-600' : 
            (indicators.stochK < 20 || indicators.stochD < 20) ? 'text-green-600' : 
            'text-yellow-600'
          ) : 'text-gray-500'
        },
        
        // Other Indicators
        atr: {
          value: indicators.atr,
          signal: indicators.atr !== null ? 'Calculated' : 'N/A',
          color: 'text-gray-600'
        },
        
        cci: {
          value: indicators.cci,
          signal: indicators.cci !== null ? (
            indicators.cci > 100 ? 'Overbought' : 
            indicators.cci < -100 ? 'Oversold' : 
            'Neutral'
          ) : 'N/A',
          color: indicators.cci !== null ? (
            indicators.cci > 100 ? 'text-red-600' : 
            indicators.cci < -100 ? 'text-green-600' : 
            'text-yellow-600'
          ) : 'text-gray-500'
        },
        
        // Additional Indicators
        williamsR: {
          value: indicators.williamsR,
          signal: indicators.williamsR !== null ? (
            indicators.williamsR > -20 ? 'Overbought' :
            indicators.williamsR < -80 ? 'Oversold' :
            'Neutral'
          ) : 'N/A',
          color: indicators.williamsR !== null ? (
            indicators.williamsR > -20 ? 'text-red-600' :
            indicators.williamsR < -80 ? 'text-green-600' :
            'text-yellow-600'
          ) : 'text-gray-500'
        },
        adx: {
          value: indicators.adx,
          signal: indicators.adx !== null ? (
            indicators.adx > 25 ? 'Strong trend' :
            indicators.adx < 20 ? 'Weak trend' :
            'Moderate trend'
          ) : 'N/A',
          color: indicators.adx !== null ? (
            indicators.adx > 25 ? 'text-blue-600' :
            indicators.adx < 20 ? 'text-gray-600' :
            'text-purple-600'
          ) : 'text-gray-500'
        },
        roc: {
          value: indicators.roc,
          signal: indicators.roc !== null ? (
            indicators.roc > 0 ? 'Bullish' : 'Bearish'
          ) : 'N/A',
          color: indicators.roc !== null ? (
            indicators.roc > 0 ? 'text-green-600' : 'text-red-600'
          ) : 'text-gray-500'
        },
        mfi: {
          value: indicators.mfi,
          signal: indicators.mfi !== null ? (
            indicators.mfi > 80 ? 'Overbought' :
            indicators.mfi < 20 ? 'Oversold' :
            'Neutral'
          ) : 'N/A',
          color: indicators.mfi !== null ? (
            indicators.mfi > 80 ? 'text-red-600' :
            indicators.mfi < 20 ? 'text-green-600' :
            'text-yellow-600'
          ) : 'text-gray-500'
        },
        
        // Volume Indicators
        obv: {
          value: indicators.obv,
          signal: indicators.obv !== null ? (
            'Volume Indicator'
          ) : 'N/A',
          color: 'text-indigo-600'
        },
        
        // Level Indicators
        fibonacci: {
          level236: indicators.fibonacci !== null ? indicators.fibonacci.level236 : null,
          level382: indicators.fibonacci !== null ? indicators.fibonacci.level382 : null,
          level500: indicators.fibonacci !== null ? indicators.fibonacci.level500 : null,
          level618: indicators.fibonacci !== null ? indicators.fibonacci.level618 : null,
          level786: indicators.fibonacci !== null ? indicators.fibonacci.level786 : null,
          high: indicators.fibonacci !== null ? indicators.fibonacci.high : null,
          low: indicators.fibonacci !== null ? indicators.fibonacci.low : null,
          signal: indicators.fibonacci !== null ? 'Calculated' : 'N/A',
          color: 'text-teal-600'
        },
        pivotPoints: {
          pivotPoint: indicators.pivotPoints !== null ? indicators.pivotPoints.pivotPoint : null,
          resistance1: indicators.pivotPoints !== null ? indicators.pivotPoints.resistance1 : null,
          resistance2: indicators.pivotPoints !== null ? indicators.pivotPoints.resistance2 : null,
          resistance3: indicators.pivotPoints !== null ? indicators.pivotPoints.resistance3 : null,
          support1: indicators.pivotPoints !== null ? indicators.pivotPoints.support1 : null,
          support2: indicators.pivotPoints !== null ? indicators.pivotPoints.support2 : null,
          support3: indicators.pivotPoints !== null ? indicators.pivotPoints.support3 : null,
          signal: indicators.pivotPoints !== null ? 'Calculated' : 'N/A',
          color: 'text-orange-600'
        }
      },
      summary: {
        trend: indicators.ema12 !== null && indicators.ema26 !== null ? (
          indicators.ema12 > indicators.ema26 ? 'Bullish' : 'Bearish'
        ) : 'Indeterminate',
        momentum: indicators.rsi !== null ? (
          indicators.rsi > 70 ? 'Bearish' : 
          indicators.rsi < 30 ? 'Bullish' : 
          'Neutral'
        ) : 'Indeterminate',
        volatility: indicators.atr !== null ? 'Calculated' : 'Indeterminate'
      },
      score: calculateTechnicalScore(indicators, currentPrice)
    };
    
    res.json(analysis);
    
  } catch (error) {
    console.error(`Error calculating technical analysis for ${req.params.symbol}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to calculate technical analysis',
      message: error.message 
    });
  }
};

// Function to calculate technical score based on indicators
const calculateTechnicalScore = (indicators, currentPrice) => {
  let score = 50; // Base score
  let totalWeight = 0;
  let weightedScore = 0;
  
  // Trend Indicators (higher weight)
  // SMA 20
  if (indicators.sma20 !== null) {
    const weight = 8;
    totalWeight += weight;
    const trendScore = currentPrice > indicators.sma20 ? 10 : 0; // Bullish trend gets higher score
    weightedScore += trendScore * weight;
  }
  
  // SMA 50
  if (indicators.sma50 !== null) {
    const weight = 8;
    totalWeight += weight;
    const trendScore = currentPrice > indicators.sma50 ? 10 : 0;
    weightedScore += trendScore * weight;
  }
  
  // SMA 200
  if (indicators.sma200 !== null) {
    const weight = 7;
    totalWeight += weight;
    const trendScore = currentPrice > indicators.sma200 ? 10 : 0;
    weightedScore += trendScore * weight;
  }
  
  // EMA 12
  if (indicators.ema12 !== null) {
    const weight = 7;
    totalWeight += weight;
    const trendScore = currentPrice > indicators.ema12 ? 10 : 0;
    weightedScore += trendScore * weight;
  }
  
  // EMA 26
  if (indicators.ema26 !== null) {
    const weight = 7;
    totalWeight += weight;
    const trendScore = currentPrice > indicators.ema26 ? 10 : 0;
    weightedScore += trendScore * weight;
  }
  
  // EMA 50
  if (indicators.ema50 !== null) {
    const weight = 7;
    totalWeight += weight;
    const trendScore = currentPrice > indicators.ema50 ? 10 : 0;
    weightedScore += trendScore * weight;
  }
  
  // EMA 200
  if (indicators.ema200 !== null) {
    const weight = 6;
    totalWeight += weight;
    const trendScore = currentPrice > indicators.ema200 ? 10 : 0;
    weightedScore += trendScore * weight;
  }
  
  // Momentum Indicators
  // RSI
  if (indicators.rsi !== null) {
    const weight = 10;
    totalWeight += weight;
    let momentumScore = 0;
    if (indicators.rsi >= 30 && indicators.rsi <= 70) {
      // Neutral zone - good balance
      momentumScore = 10;
    } else if (indicators.rsi > 70) {
      // Overbought - could be bearish in short term
      momentumScore = 4;
    } else if (indicators.rsi < 30) {
      // Oversold - could be bullish in short term
      momentumScore = 6;
    }
    weightedScore += momentumScore * weight;
  }
  
  // MACD
  if (indicators.macd !== null) {
    const weight = 8;
    totalWeight += weight;
    const momentumScore = indicators.macdHist !== null && indicators.macdHist > 0 ? 10 : 2; // Bullish MACD gets higher score
    weightedScore += momentumScore * weight;
  }
  
  // Stochastic
  if (indicators.stochK !== null) {
    const weight = 8;
    totalWeight += weight;
    let stochScore = 0;
    if (indicators.stochK >= 20 && indicators.stochK <= 80) {
      stochScore = 10; // Neutral zone
    } else if (indicators.stochK > 80) {
      stochScore = 3; // Overbought
    } else if (indicators.stochK < 20) {
      stochScore = 7; // Oversold
    }
    weightedScore += stochScore * weight;
  }
  
  // Volatility Indicators
  // CCI
  if (indicators.cci !== null) {
    const weight = 6;
    totalWeight += weight;
    let cciScore = 0;
    if (indicators.cci >= -100 && indicators.cci <= 100) {
      cciScore = 10; // Neutral zone
    } else if (indicators.cci > 100) {
      cciScore = 3; // Overbought
    } else if (indicators.cci < -100) {
      cciScore = 7; // Oversold
    }
    weightedScore += cciScore * weight;
  }
  
  // ADX (trend strength)
  if (indicators.adx !== null) {
    const weight = 6;
    totalWeight += weight;
    let adxScore = 0;
    if (indicators.adx > 25) {
      adxScore = 8; // Strong trend
    } else if (indicators.adx >= 20 && indicators.adx <= 25) {
      adxScore = 6; // Moderate trend
    } else {
      adxScore = 4; // Weak trend
    }
    weightedScore += adxScore * weight;
  }
  
  // Rate of Change
  if (indicators.roc !== null) {
    const weight = 6;
    totalWeight += weight;
    const rocScore = indicators.roc > 0 ? 10 : 2; // Positive ROC gets higher score
    weightedScore += rocScore * weight;
  }
  
  // Money Flow Index
  if (indicators.mfi !== null) {
    const weight = 7;
    totalWeight += weight;
    let mfiScore = 0;
    if (indicators.mfi >= 20 && indicators.mfi <= 80) {
      mfiScore = 10; // Neutral zone
    } else if (indicators.mfi > 80) {
      mfiScore = 3; // Overbought
    } else if (indicators.mfi < 20) {
      mfiScore = 7; // Oversold
    }
    weightedScore += mfiScore * weight;
  }
  
  // On Balance Volume (trend confirmation)
  if (indicators.obv !== null) {
    const weight = 5;
    totalWeight += weight;
    // OBV interpretation is complex, but generally a positive trend is good
    // For simplicity, we'll give it a moderate score
    weightedScore += 6 * weight;
  }
  
  // Calculate final score if we have any valid indicators
  if (totalWeight > 0) {
    score = Math.round((weightedScore / totalWeight));
    // Ensure score stays within 0-100 range
    score = Math.max(0, Math.min(100, score));
  }
  
  return score;
};

// Get chart data for a specific stock
exports.getChartData = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1mo' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }
    
    // Map period to yahoo-finance2 interval and date range
    let interval, period1;
    const now = new Date();
    
    switch(period) {
      case '1d':
        interval = '5m';
        period1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        break;
      case '1wk':
        interval = '1d';
        period1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1mo':
        interval = '1d';
        period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        interval = '1wk';
        period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'max':
        interval = '1mo';
        period1 = '2000-01-01'; // Maximum available data
        break;
      default:
        interval = '1d';
        period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Fetch chart data
    const chartData = await yahooFinance.chart(symbol, {
      period1: period1,
      interval: interval
    });
    
    // Format data for Chart.js
    const formattedData = {
      labels: chartData.quotes.map(quote => 
        interval === '5m' || interval === '1d' 
          ? quote.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : quote.date.toISOString().split('T')[0]
      ),
      datasets: [
        {
          label: 'Price',
          data: chartData.quotes.map(quote => quote.close),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.1
        }
      ],
      meta: {
        symbol: chartData.meta.symbol,
        currency: chartData.meta.currency,
        interval: interval
      }
    };
    
    res.json(formattedData);
    
  } catch (error) {
    console.error(`Error fetching chart data for ${req.params.symbol}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to fetch chart data',
      message: error.message 
    });
  }
};

// Get basic quote data for a stock (used for real-time updates)
exports.getQuoteData = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }
    
    const quote = await yahooFinance.quote(symbol);
    
    if (!quote || !quote.symbol) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    const quoteData = {
      symbol: quote.symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      volume: quote.regularMarketVolume,
      marketCap: quote.marketCap,
      peRatio: quote.trailingPE,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      open: quote.regularMarketOpen || null,
      high: quote.regularMarketDayHigh || null,
      low: quote.regularMarketDayLow || null,
      close: quote.regularMarketPreviousClose || null,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(quoteData);
    
  } catch (error) {
    console.error(`Error fetching quote data for ${req.params.symbol}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to fetch quote data',
      message: error.message 
    });
  }
};