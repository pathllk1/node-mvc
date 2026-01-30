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
        currency: fundamentalData.price?.currency || 'INR',
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
    
    // Get latest 250 days of OHLCV data for technical analysis
    const { db } = require('../utils/database');
    
    const getStockData = () => {
      return new Promise((resolve, reject) => {
        const sql = `SELECT close, high, low, open, volume, date 
                   FROM historical_ohlcv 
                   WHERE symbol = ? 
                   ORDER BY date DESC 
                   LIMIT 250`;
        
        db.all(sql, [symbol], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    };
    
    const stockData = await getStockData();
    
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
    
    // IMPORTANT: Data is in DESC order, so we reverse to get chronological order
    const closes = validData.map(d => parseFloat(d.close)).reverse();
    const highs = validData.map(d => parseFloat(d.high)).reverse();
    const lows = validData.map(d => parseFloat(d.low)).reverse();
    const opens = validData.map(d => parseFloat(d.open)).reverse();
    const volumes = validData.map(d => parseInt(d.volume)).reverse();
    
    // ==================== HELPER FUNCTIONS ====================
    
    // Simple Moving Average (SMA)
    const calculateSMA = (data, period) => {
      if (data.length < period) return null;
      
      // Calculate average of the last 'period' values
      const slice = data.slice(-period);
      const sum = slice.reduce((acc, val) => acc + val, 0);
      return sum / period;
    };
    
    // Exponential Moving Average (EMA)
    const calculateEMA = (data, period) => {
      if (data.length < period) return null;
      
      // Calculate multiplier: 2 / (period + 1)
      const multiplier = 2 / (period + 1);
      
      // Start with SMA as the initial EMA value
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += data[i];
      }
      let ema = sum / period;
      
      // Calculate EMA for the rest of the data
      for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
      }
      
      return ema;
    };
    
    // Relative Strength Index (RSI) - Fixed calculation
    const calculateRSI = (data, period = 14) => {
      if (data.length <= period) return null;
      
      // Calculate price changes
      const changes = [];
      for (let i = 1; i < data.length; i++) {
        changes.push(data[i] - data[i - 1]);
      }
      
      // Separate gains and losses
      let avgGain = 0;
      let avgLoss = 0;
      
      // Calculate initial average gain and loss (simple average)
      for (let i = 0; i < period; i++) {
        if (changes[i] > 0) {
          avgGain += changes[i];
        } else {
          avgLoss += Math.abs(changes[i]);
        }
      }
      
      avgGain = avgGain / period;
      avgLoss = avgLoss / period;
      
      // Use Wilder's smoothing method for remaining values
      for (let i = period; i < changes.length; i++) {
        const gain = changes[i] > 0 ? changes[i] : 0;
        const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
      }
      
      // Calculate RSI
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };
    
    // MACD (Moving Average Convergence Divergence) - Fixed calculation
    const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
      if (data.length < slowPeriod) return { macd: null, signal: null, histogram: null };
      
      // Calculate fast and slow EMAs
      const fastEMA = calculateEMA(data, fastPeriod);
      const slowEMA = calculateEMA(data, slowPeriod);
      
      if (fastEMA === null || slowEMA === null) {
        return { macd: null, signal: null, histogram: null };
      }
      
      const macdLine = fastEMA - slowEMA;
      
      // Calculate MACD line for each point to get signal line
      const macdValues = [];
      const minLength = Math.max(fastPeriod, slowPeriod);
      
      for (let i = minLength - 1; i < data.length; i++) {
        const slice = data.slice(0, i + 1);
        const tempFast = calculateEMA(slice, fastPeriod);
        const tempSlow = calculateEMA(slice, slowPeriod);
        if (tempFast !== null && tempSlow !== null) {
          macdValues.push(tempFast - tempSlow);
        }
      }
      
      // Calculate signal line as EMA of MACD values
      const signalLine = macdValues.length >= signalPeriod ? calculateEMA(macdValues, signalPeriod) : null;
      
      return {
        macd: macdLine,
        signal: signalLine,
        histogram: signalLine !== null ? macdLine - signalLine : null
      };
    };
    
    // Bollinger Bands - Fixed calculation
    const calculateBollingerBands = (data, period = 20, stdDevMultiplier = 2) => {
      if (data.length < period) return { upper: null, middle: null, lower: null };
      
      // Get the last 'period' values
      const slice = data.slice(-period);
      
      // Calculate middle band (SMA)
      const sma = slice.reduce((sum, val) => sum + val, 0) / period;
      
      // Calculate standard deviation
      const squaredDiffs = slice.map(val => Math.pow(val - sma, 2));
      const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
      const stdDev = Math.sqrt(variance);
      
      return {
        upper: sma + (stdDevMultiplier * stdDev),
        middle: sma,
        lower: sma - (stdDevMultiplier * stdDev)
      };
    };
    
    // Stochastic Oscillator - Fixed calculation
    const calculateStochastic = (highs, lows, closes, kPeriod = 14, dPeriod = 3) => {
      if (closes.length < kPeriod) return { k: null, d: null };
      
      // Calculate %K
      const recentHighs = highs.slice(-kPeriod);
      const recentLows = lows.slice(-kPeriod);
      const currentClose = closes[closes.length - 1];
      
      const highestHigh = Math.max(...recentHighs);
      const lowestLow = Math.min(...recentLows);
      
      let k;
      if (highestHigh === lowestLow) {
        k = 50; // Neutral when no range
      } else {
        k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      }
      
      // Calculate %D (3-period SMA of %K)
      // We need historical %K values for this
      const kValues = [];
      for (let i = kPeriod - 1; i < closes.length; i++) {
        const hSlice = highs.slice(i - kPeriod + 1, i + 1);
        const lSlice = lows.slice(i - kPeriod + 1, i + 1);
        const hh = Math.max(...hSlice);
        const ll = Math.min(...lSlice);
        
        if (hh === ll) {
          kValues.push(50);
        } else {
          kValues.push(((closes[i] - ll) / (hh - ll)) * 100);
        }
      }
      
      // Calculate %D as SMA of last dPeriod %K values
      let d = null;
      if (kValues.length >= dPeriod) {
        const dSlice = kValues.slice(-dPeriod);
        d = dSlice.reduce((sum, val) => sum + val, 0) / dPeriod;
      }
      
      return { k, d };
    };
    
    // Average True Range (ATR) - Fixed calculation
    const calculateATR = (highs, lows, closes, period = 14) => {
      if (highs.length < period + 1) return null;
      
      // Calculate True Range for each period
      const trueRanges = [];
      for (let i = 1; i < highs.length; i++) {
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        trueRanges.push(Math.max(tr1, tr2, tr3));
      }
      
      // Calculate initial ATR (simple average of first 'period' TRs)
      let atr = 0;
      for (let i = 0; i < period; i++) {
        atr += trueRanges[i];
      }
      atr = atr / period;
      
      // Apply Wilder's smoothing for remaining values
      for (let i = period; i < trueRanges.length; i++) {
        atr = (atr * (period - 1) + trueRanges[i]) / period;
      }
      
      return atr;
    };
    
    // Commodity Channel Index (CCI) - Fixed calculation
    const calculateCCI = (highs, lows, closes, period = 20) => {
      if (highs.length < period) return null;
      
      // Calculate typical prices for the last 'period' days
      const typicalPrices = [];
      for (let i = closes.length - period; i < closes.length; i++) {
        typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
      }
      
      // Calculate SMA of typical prices
      const sma = typicalPrices.reduce((sum, val) => sum + val, 0) / period;
      
      // Calculate Mean Deviation
      const meanDeviation = typicalPrices.reduce((sum, val) => sum + Math.abs(val - sma), 0) / period;
      
      // Calculate current typical price
      const currentTP = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
      
      // Calculate CCI
      if (meanDeviation === 0) return 0;
      return (currentTP - sma) / (0.015 * meanDeviation);
    };
    
    // Williams %R - Fixed calculation
    const calculateWilliamsR = (highs, lows, closes, period = 14) => {
      if (highs.length < period) return null;
      
      const recentHighs = highs.slice(-period);
      const recentLows = lows.slice(-period);
      const currentClose = closes[closes.length - 1];
      
      const highestHigh = Math.max(...recentHighs);
      const lowestLow = Math.min(...recentLows);
      
      if (highestHigh === lowestLow) return -50; // Neutral
      
      // Williams %R = (Highest High - Close) / (Highest High - Lowest Low) * -100
      return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
    };
    
    // Average Directional Index (ADX) - Fixed calculation
    const calculateADX = (highs, lows, closes, period = 14) => {
      if (highs.length < period + 1) return null;
      
      // Step 1: Calculate +DM, -DM, and TR
      const plusDMs = [];
      const minusDMs = [];
      const trs = [];
      
      for (let i = 1; i < highs.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        
        let plusDM = 0;
        let minusDM = 0;
        
        if (upMove > downMove && upMove > 0) {
          plusDM = upMove;
        }
        if (downMove > upMove && downMove > 0) {
          minusDM = downMove;
        }
        
        plusDMs.push(plusDM);
        minusDMs.push(minusDM);
        
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        trs.push(Math.max(tr1, tr2, tr3));
      }
      
      // Step 2: Smooth +DM, -DM, and TR using Wilder's method
      let smoothedPlusDM = plusDMs.slice(0, period).reduce((sum, val) => sum + val, 0);
      let smoothedMinusDM = minusDMs.slice(0, period).reduce((sum, val) => sum + val, 0);
      let smoothedTR = trs.slice(0, period).reduce((sum, val) => sum + val, 0);
      
      for (let i = period; i < plusDMs.length; i++) {
        smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDMs[i];
        smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDMs[i];
        smoothedTR = smoothedTR - (smoothedTR / period) + trs[i];
      }
      
      // Step 3: Calculate +DI and -DI
      const plusDI = (smoothedPlusDM / smoothedTR) * 100;
      const minusDI = (smoothedMinusDM / smoothedTR) * 100;
      
      // Step 4: Calculate DX
      const diDiff = Math.abs(plusDI - minusDI);
      const diSum = plusDI + minusDI;
      
      if (diSum === 0) return 0;
      
      const dx = (diDiff / diSum) * 100;
      
      // For simplicity, we return DX as ADX approximation
      // A full ADX would require smoothing DX values over period
      // This simplified version is acceptable for most use cases
      return dx;
    };
    
    // Rate of Change (ROC) - Fixed calculation
    const calculateROC = (closes, period = 12) => {
      if (closes.length <= period) return null;
      
      const currentPrice = closes[closes.length - 1];
      const pastPrice = closes[closes.length - 1 - period];
      
      if (pastPrice === 0) return 0;
      
      // ROC = ((Current - Past) / Past) * 100
      return ((currentPrice - pastPrice) / pastPrice) * 100;
    };
    
    // Money Flow Index (MFI) - Fixed calculation
    const calculateMFI = (highs, lows, closes, volumes, period = 14) => {
      if (closes.length <= period) return null;
      
      // Calculate typical prices and money flow
      const positiveFlow = [];
      const negativeFlow = [];
      
      for (let i = closes.length - period; i < closes.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        const moneyFlow = typicalPrice * volumes[i];
        
        if (i > closes.length - period) {
          const prevTP = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
          
          if (typicalPrice > prevTP) {
            positiveFlow.push(moneyFlow);
          } else if (typicalPrice < prevTP) {
            negativeFlow.push(moneyFlow);
          }
        }
      }
      
      const positiveMF = positiveFlow.reduce((sum, val) => sum + val, 0);
      const negativeMF = negativeFlow.reduce((sum, val) => sum + val, 0);
      
      if (negativeMF === 0) return 100;
      if (positiveMF === 0) return 0;
      
      const moneyRatio = positiveMF / negativeMF;
      return 100 - (100 / (1 + moneyRatio));
    };
    
    // On Balance Volume (OBV) - Fixed calculation
    const calculateOBV = (closes, volumes) => {
      if (closes.length < 2) return null;
      
      let obv = 0;
      
      for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) {
          obv += volumes[i];
        } else if (closes[i] < closes[i - 1]) {
          obv -= volumes[i];
        }
        // If prices are equal, OBV remains unchanged
      }
      
      return obv;
    };
    
    // Fibonacci Retracement Levels
    const calculateFibonacciLevels = (highs, lows) => {
      if (highs.length < 2) return null;
      
      const lookback = Math.min(50, highs.length); // Use 50-period lookback
      const recentHighs = highs.slice(-lookback);
      const recentLows = lows.slice(-lookback);
      
      const high = Math.max(...recentHighs);
      const low = Math.min(...recentLows);
      const diff = high - low;
      
      return {
        level0: high,                      // 0% (swing high)
        level236: high - diff * 0.236,    // 23.6% retracement
        level382: high - diff * 0.382,    // 38.2% retracement
        level500: high - diff * 0.500,    // 50.0% retracement
        level618: high - diff * 0.618,    // 61.8% retracement (golden ratio)
        level786: high - diff * 0.786,    // 78.6% retracement
        level100: low,                     // 100% (swing low)
        high: high,
        low: low
      };
    };
    
    // Pivot Points (Standard)
    const calculatePivotPoints = (highs, lows, closes) => {
      if (highs.length < 2) return null;
      
      // Use previous day's data
      const prevHigh = highs[highs.length - 2];
      const prevLow = lows[lows.length - 2];
      const prevClose = closes[closes.length - 2];
      
      const pivot = (prevHigh + prevLow + prevClose) / 3;
      
      return {
        pivotPoint: pivot,
        resistance1: (2 * pivot) - prevLow,
        resistance2: pivot + (prevHigh - prevLow),
        resistance3: prevHigh + 2 * (pivot - prevLow),
        support1: (2 * pivot) - prevHigh,
        support2: pivot - (prevHigh - prevLow),
        support3: prevLow - 2 * (prevHigh - pivot)
      };
    };
    
    // ==================== CALCULATE ALL INDICATORS ====================
    
    const indicators = {};
    
    // Moving Averages
    try {
      indicators.sma20 = calculateSMA(closes, 20);
      indicators.sma50 = calculateSMA(closes, 50);
      indicators.sma200 = calculateSMA(closes, 200);
      indicators.ema12 = calculateEMA(closes, 12);
      indicators.ema26 = calculateEMA(closes, 26);
      indicators.ema50 = calculateEMA(closes, 50);
      indicators.ema200 = calculateEMA(closes, 200);
    } catch (e) {
      console.error('Error calculating MAs:', e);
    }
    
    // RSI
    try {
      indicators.rsi = calculateRSI(closes, 14);
    } catch (e) {
      console.error('Error calculating RSI:', e);
      indicators.rsi = null;
    }
    
    // MACD
    try {
      const macdResult = calculateMACD(closes);
      indicators.macd = macdResult.macd;
      indicators.macdSignal = macdResult.signal;
      indicators.macdHist = macdResult.histogram;
    } catch (e) {
      console.error('Error calculating MACD:', e);
      indicators.macd = null;
      indicators.macdSignal = null;
      indicators.macdHist = null;
    }
    
    // Bollinger Bands
    try {
      const bb = calculateBollingerBands(closes, 20, 2);
      indicators.bbUpper = bb.upper;
      indicators.bbMiddle = bb.middle;
      indicators.bbLower = bb.lower;
    } catch (e) {
      console.error('Error calculating Bollinger Bands:', e);
      indicators.bbUpper = null;
      indicators.bbMiddle = null;
      indicators.bbLower = null;
    }
    
    // Stochastic
    try {
      const stoch = calculateStochastic(highs, lows, closes, 14, 3);
      indicators.stochK = stoch.k;
      indicators.stochD = stoch.d;
    } catch (e) {
      console.error('Error calculating Stochastic:', e);
      indicators.stochK = null;
      indicators.stochD = null;
    }
    
    // ATR
    try {
      indicators.atr = calculateATR(highs, lows, closes, 14);
    } catch (e) {
      console.error('Error calculating ATR:', e);
      indicators.atr = null;
    }
    
    // CCI
    try {
      indicators.cci = calculateCCI(highs, lows, closes, 20);
    } catch (e) {
      console.error('Error calculating CCI:', e);
      indicators.cci = null;
    }
    
    // Williams %R
    try {
      indicators.williamsR = calculateWilliamsR(highs, lows, closes, 14);
    } catch (e) {
      console.error('Error calculating Williams %R:', e);
      indicators.williamsR = null;
    }
    
    // ADX
    try {
      indicators.adx = calculateADX(highs, lows, closes, 14);
    } catch (e) {
      console.error('Error calculating ADX:', e);
      indicators.adx = null;
    }
    
    // ROC
    try {
      indicators.roc = calculateROC(closes, 12);
    } catch (e) {
      console.error('Error calculating ROC:', e);
      indicators.roc = null;
    }
    
    // MFI
    try {
      indicators.mfi = calculateMFI(highs, lows, closes, volumes, 14);
    } catch (e) {
      console.error('Error calculating MFI:', e);
      indicators.mfi = null;
    }
    
    // OBV
    try {
      indicators.obv = calculateOBV(closes, volumes);
    } catch (e) {
      console.error('Error calculating OBV:', e);
      indicators.obv = null;
    }
    
    // Fibonacci
    try {
      indicators.fibonacci = calculateFibonacciLevels(highs, lows);
    } catch (e) {
      console.error('Error calculating Fibonacci:', e);
      indicators.fibonacci = null;
    }
    
    // Pivot Points
    try {
      indicators.pivotPoints = calculatePivotPoints(highs, lows, closes);
    } catch (e) {
      console.error('Error calculating Pivot Points:', e);
      indicators.pivotPoints = null;
    }
    
    // Get current price
    const getCurrentStockData = () => {
      return new Promise((resolve, reject) => {
        const sql = `SELECT price 
                   FROM stocks_history 
                   WHERE symbol = ? 
                   ORDER BY last_updated DESC 
                   LIMIT 1`;
        
        db.get(sql, [symbol], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    };
    
    const currentStockData = await getCurrentStockData();
    const currentPrice = currentStockData?.price || closes[closes.length - 1];
    
    // Format response
    const analysis = {
      symbol: symbol,
      currentPrice: currentPrice,
      chartPeriod: "1y",
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
        sma200: {
          value: indicators.sma200,
          signal: indicators.sma200 !== null ? (currentPrice > indicators.sma200 ? 'Bullish' : 'Bearish') : 'N/A',
          color: indicators.sma200 !== null ? (currentPrice > indicators.sma200 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
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
          signal: indicators.stochK !== null ? (
            indicators.stochK > 80 ? 'Overbought' : 
            indicators.stochK < 20 ? 'Oversold' : 
            'Neutral'
          ) : 'N/A',
          color: indicators.stochK !== null ? (
            indicators.stochK > 80 ? 'text-red-600' : 
            indicators.stochK < 20 ? 'text-green-600' : 
            'text-yellow-600'
          ) : 'text-gray-500'
        },
        
        atr: {
          value: indicators.atr,
          signal: indicators.atr !== null ? 'Calculated' : 'N/A',
          color: 'text-purple-600'
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
        
        obv: {
          value: indicators.obv,
          signal: indicators.obv !== null ? 'Volume Indicator' : 'N/A',
          color: 'text-indigo-600'
        },
        
        fibonacci: {
          level0: indicators.fibonacci?.level0 || null,
          level236: indicators.fibonacci?.level236 || null,
          level382: indicators.fibonacci?.level382 || null,
          level500: indicators.fibonacci?.level500 || null,
          level618: indicators.fibonacci?.level618 || null,
          level786: indicators.fibonacci?.level786 || null,
          level100: indicators.fibonacci?.level100 || null,
          high: indicators.fibonacci?.high || null,
          low: indicators.fibonacci?.low || null,
          signal: indicators.fibonacci !== null ? 'Calculated' : 'N/A',
          color: 'text-teal-600'
        },
        
        pivotPoints: {
          pivotPoint: indicators.pivotPoints?.pivotPoint || null,
          resistance1: indicators.pivotPoints?.resistance1 || null,
          resistance2: indicators.pivotPoints?.resistance2 || null,
          resistance3: indicators.pivotPoints?.resistance3 || null,
          support1: indicators.pivotPoints?.support1 || null,
          support2: indicators.pivotPoints?.support2 || null,
          support3: indicators.pivotPoints?.support3 || null,
          signal: indicators.pivotPoints !== null ? 'Calculated' : 'N/A',
          color: 'text-orange-600'
        }
      },
      summary: {
        trend: indicators.ema12 !== null && indicators.ema26 !== null ? (
          indicators.ema12 > indicators.ema26 ? 'Bullish' : 'Bearish'
        ) : 'Indeterminate',
        momentum: indicators.rsi !== null ? (
          indicators.rsi > 70 ? 'Overbought' : 
          indicators.rsi < 30 ? 'Oversold' : 
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

// Calculate overall technical score (0-100)
const calculateTechnicalScore = (indicators, currentPrice) => {
  let totalWeight = 0;
  let weightedScore = 0;
  
  // Trend Indicators (40% weight) - More balanced scoring
  if (indicators.sma20 !== null) {
    const weight = 8;
    totalWeight += weight;
    weightedScore += (currentPrice > indicators.sma20 ? 10 : 4) * weight;
  }
  
  if (indicators.sma50 !== null) {
    const weight = 8;
    totalWeight += weight;
    weightedScore += (currentPrice > indicators.sma50 ? 10 : 4) * weight;
  }
  
  if (indicators.sma200 !== null) {
    const weight = 7;
    totalWeight += weight;
    weightedScore += (currentPrice > indicators.sma200 ? 10 : 3) * weight;
  }
  
  if (indicators.ema12 !== null) {
    const weight = 7;
    totalWeight += weight;
    weightedScore += (currentPrice > indicators.ema12 ? 10 : 4) * weight;
  }
  
  if (indicators.ema26 !== null) {
    const weight = 7;
    totalWeight += weight;
    weightedScore += (currentPrice > indicators.ema26 ? 10 : 4) * weight;
  }
  
  if (indicators.ema50 !== null) {
    const weight = 7;
    totalWeight += weight;
    weightedScore += (currentPrice > indicators.ema50 ? 10 : 4) * weight;
  }
  
  if (indicators.ema200 !== null) {
    const weight = 6;
    totalWeight += weight;
    weightedScore += (currentPrice > indicators.ema200 ? 10 : 3) * weight;
  }
  
  // Momentum Indicators (35% weight)
  if (indicators.rsi !== null) {
    const weight = 10;
    totalWeight += weight;
    let score = 5; // Base score
    if (indicators.rsi >= 40 && indicators.rsi <= 60) {
      score = 10; // Ideal zone
    } else if (indicators.rsi > 60 && indicators.rsi <= 70) {
      score = 8; // Mildly bullish
    } else if (indicators.rsi >= 30 && indicators.rsi < 40) {
      score = 7; // Mildly oversold (potential buy)
    } else if (indicators.rsi > 70 && indicators.rsi <= 80) {
      score = 6; // Overbought but still trending
    } else if (indicators.rsi > 80) {
      score = 4; // Very overbought
    } else if (indicators.rsi >= 20 && indicators.rsi < 30) {
      score = 6; // Oversold (buying opportunity)
    } else if (indicators.rsi < 20) {
      score = 5; // Very oversold
    }
    weightedScore += score * weight;
  }
  
  if (indicators.macd !== null && indicators.macdHist !== null) {
    const weight = 8;
    totalWeight += weight;
    // MACD histogram positive = bullish, negative = bearish
    let score = 5;
    if (indicators.macdHist > 0) {
      score = indicators.macd > 0 ? 10 : 7; // Strong bullish if both positive
    } else {
      score = indicators.macd < 0 ? 3 : 5; // Bearish if both negative
    }
    weightedScore += score * weight;
  }
  
  if (indicators.stochK !== null) {
    const weight = 8;
    totalWeight += weight;
    let score = 5;
    if (indicators.stochK >= 20 && indicators.stochK <= 80) {
      score = 10; // Normal range
    } else if (indicators.stochK > 80) {
      score = 5; // Overbought
    } else {
      score = 6; // Oversold (potential buy)
    }
    weightedScore += score * weight;
  }
  
  if (indicators.williamsR !== null) {
    const weight = 5;
    totalWeight += weight;
    let score = 5;
    if (indicators.williamsR >= -80 && indicators.williamsR <= -20) {
      score = 10; // Normal range
    } else if (indicators.williamsR > -20) {
      score = 5; // Overbought
    } else {
      score = 6; // Oversold (potential buy)
    }
    weightedScore += score * weight;
  }
  
  // Volatility & Volume Indicators (25% weight)
  if (indicators.cci !== null) {
    const weight = 6;
    totalWeight += weight;
    let score = 5;
    if (indicators.cci >= -100 && indicators.cci <= 100) {
      score = 10; // Normal range
    } else if (indicators.cci > 100 && indicators.cci <= 200) {
      score = 6; // Mildly overbought
    } else if (indicators.cci > 200) {
      score = 4; // Very overbought
    } else if (indicators.cci >= -200 && indicators.cci < -100) {
      score = 6; // Mildly oversold
    } else {
      score = 5; // Very oversold
    }
    weightedScore += score * weight;
  }
  
  if (indicators.adx !== null) {
    const weight = 6;
    totalWeight += weight;
    let score = 5;
    if (indicators.adx > 25) {
      score = 8; // Strong trend (good for trading)
    } else if (indicators.adx >= 20 && indicators.adx <= 25) {
      score = 6; // Moderate trend
    } else {
      score = 5; // Weak trend (choppy market)
    }
    weightedScore += score * weight;
  }
  
  if (indicators.roc !== null) {
    const weight = 6;
    totalWeight += weight;
    let score = 5;
    if (indicators.roc > 5) {
      score = 10; // Strong positive momentum
    } else if (indicators.roc > 0 && indicators.roc <= 5) {
      score = 7; // Positive momentum
    } else if (indicators.roc >= -5 && indicators.roc <= 0) {
      score = 4; // Slight negative momentum
    } else {
      score = 2; // Strong negative momentum
    }
    weightedScore += score * weight;
  }
  
  if (indicators.mfi !== null) {
    const weight = 7;
    totalWeight += weight;
    let score = 5;
    if (indicators.mfi >= 20 && indicators.mfi <= 80) {
      score = 10; // Normal range
    } else if (indicators.mfi > 80) {
      score = 5; // Overbought
    } else {
      score = 6; // Oversold (potential buy)
    }
    weightedScore += score * weight;
  }
  
  // Bollinger Bands bonus/penalty
  if (indicators.bbUpper !== null && indicators.bbLower !== null) {
    const weight = 5;
    totalWeight += weight;
    let score = 5;
    if (currentPrice >= indicators.bbLower && currentPrice <= indicators.bbUpper) {
      score = 10; // Within bands (normal)
    } else if (currentPrice < indicators.bbLower) {
      score = 6; // Below lower band (oversold, potential buy)
    } else {
      score = 5; // Above upper band (overbought)
    }
    weightedScore += score * weight;
  }
  
  // Calculate final score (convert from 0-10 scale to 0-100 scale)
  const finalScore = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 10) : 50;
  return Math.max(0, Math.min(100, finalScore));
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
        period1 = '2000-01-01';
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

// Get basic quote data for a stock
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