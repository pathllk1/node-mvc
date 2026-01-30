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

// ========================================================
// TECHNICAL ANALYSIS & CALCULATIONS (REFACTORED)
// ========================================================

// Internal Library for Vectorized/Array-based Calculations
const TechIndicators = {
  // Simple Moving Average
  sma(data, period) {
    const out = Array(data.length).fill(null)
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += data[i - j]
      out[i] = sum / period
    }
    return out
  },

  ema(data, period) {
    const k = 2 / (period + 1)
    const out = Array(data.length).fill(null)

    // First EMA seed = SMA
    let sum = 0
    for (let i = 0; i < period; i++) sum += data[i]
    out[period - 1] = sum / period

    for (let i = period; i < data.length; i++) {
      out[i] = data[i] * k + out[i - 1] * (1 - k)
    }
    return out
  },

  // ==============================
  // RSI (Wilder)
  // ==============================
  rsi(closes, period = 14) {
    const rsi = Array(closes.length).fill(null)

    let gain = 0, loss = 0
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1]
      if (diff > 0) gain += diff
      else loss -= diff
    }

    let avgGain = gain / period
    let avgLoss = loss / period

    rsi[period] = 100 - 100 / (1 + avgGain / avgLoss)

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1]
      const g = diff > 0 ? diff : 0
      const l = diff < 0 ? -diff : 0

      avgGain = (avgGain * (period - 1) + g) / period
      avgLoss = (avgLoss * (period - 1) + l) / period

      rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    }

    return rsi
  },

  // MACD
  macd(data, fast = 12, slow = 26, signal = 9) {
    const emaFast = this.ema(data, fast)
    const emaSlow = this.ema(data, slow)

    const macdLine = data.map((_, i) =>
      emaFast[i] && emaSlow[i] ? emaFast[i] - emaSlow[i] : null
    )

    const signalLine = this.ema(macdLine.filter(x => x !== null), signal)

    const signalFull = Array(macdLine.length).fill(null)
    let k = 0
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] !== null) {
        signalFull[i] = signalLine[k++]
      }
    }

    const hist = macdLine.map((v, i) =>
      v !== null && signalFull[i] !== null ? v - signalFull[i] : null
    )

    return {
      macd: macdLine.at(-1),
      signal: signalFull.at(-1),
      histogram: hist.at(-1)
    }
  },

  // ==============================
  // Bollinger Bands (Sample StdDev)
  // ==============================
  bollingerBands(data, period = 20, mult = 2) {
    const slice = data.slice(-period)
    const mean = slice.reduce((a, b) => a + b) / period

    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)

    return {
      upper: mean + mult * sd,
      middle: mean,
      lower: mean - mult * sd
    }
  },

  // ==============================
  // Stochastic (TradingView)
  // ==============================
  stochastic(highs, lows, closes, k = 14, d = 3) {
    const kVals = []

    for (let i = k - 1; i < closes.length; i++) {
      const hh = Math.max(...highs.slice(i - k + 1, i + 1))
      const ll = Math.min(...lows.slice(i - k + 1, i + 1))
      kVals.push(100 * (closes[i] - ll) / (hh - ll))
    }

    const dVals = this.sma(kVals, d)

    return {
      k: kVals.at(-1),
      d: dVals.at(-1)
    }
  },

  // ADX (Corrected logic with full smoothing)
  atr(highs, lows, closes, period = 14) {
    const tr = []

    for (let i = 1; i < closes.length; i++) {
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ))
    }

    let atr = tr.slice(0, period).reduce((a, b) => a + b) / period
    for (let i = period; i < tr.length; i++) {
      atr = (atr * (period - 1) + tr[i]) / period
    }

    return atr
  },

  // ==============================
  // ADX (Fully Correct Wilder)
  // ==============================
  adx(highs, lows, closes, period = 14) {
    const tr = [], pdm = [], mdm = []

    for (let i = 1; i < highs.length; i++) {
      const up = highs[i] - highs[i - 1]
      const dn = lows[i - 1] - lows[i]

      pdm.push(up > dn && up > 0 ? up : 0)
      mdm.push(dn > up && dn > 0 ? dn : 0)

      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ))
    }

    let atr = tr.slice(0, period).reduce((a, b) => a + b)
    let pDM = pdm.slice(0, period).reduce((a, b) => a + b)
    let mDM = mdm.slice(0, period).reduce((a, b) => a + b)

    let dxs = []

    for (let i = period; i < tr.length; i++) {
      atr = atr - atr / period + tr[i]
      pDM = pDM - pDM / period + pdm[i]
      mDM = mDM - mDM / period + mdm[i]

      const pDI = 100 * pDM / atr
      const mDI = 100 * mDM / atr
      dxs.push(100 * Math.abs(pDI - mDI) / (pDI + mDI))
    }

    let adx = dxs.slice(0, period).reduce((a, b) => a + b) / period
    for (let i = period; i < dxs.length; i++) {
      adx = (adx * (period - 1) + dxs[i]) / period
    }

    return adx
  },
  
  // CCI
  cci: (highs, lows, closes, period = 20) => {
    if (highs.length < period) return null;
    // Standard CCI uses the current window's TP and SMA
    const i = closes.length - 1; // Current index
    
    // Calculate TPs for the window
    const tps = [];
    for(let j = i - period + 1; j <= i; j++) {
      tps.push((highs[j] + lows[j] + closes[j]) / 3);
    }
    
    const smaTP = tps.reduce((a,b) => a+b, 0) / period;
    const meanDev = tps.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
    
    const currentTP = tps[tps.length - 1];
    
    if (meanDev === 0) return 0;
    return (currentTP - smaTP) / (0.015 * meanDev);
  },

  // ROC
  roc: (closes, period = 12) => {
    if (closes.length <= period) return null;
    const current = closes[closes.length - 1];
    const past = closes[closes.length - 1 - period];
    if (past === 0) return 0;
    return ((current - past) / past) * 100;
  },

  // MFI
  mfi: (highs, lows, closes, volumes, period = 14) => {
    if (closes.length <= period) return null;

    let posFlow = 0;
    let negFlow = 0;

    // Iterate over the last 'period' intervals
    for (let i = closes.length - period; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      const prevTP = (highs[i-1] + lows[i-1] + closes[i-1]) / 3;
      const rawFlow = tp * volumes[i];

      if (tp > prevTP) posFlow += rawFlow;
      else if (tp < prevTP) negFlow += rawFlow;
    }

    if (negFlow === 0) return 100;
    const mfiRatio = posFlow / negFlow;
    return 100 - (100 / (1 + mfiRatio));
  },

  // Williams %R
  williamsR: (highs, lows, closes, period = 14) => {
    if (closes.length < period) return null;
    const currentClose = closes[closes.length - 1];
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const hh = Math.max(...recentHighs);
    const ll = Math.min(...recentLows);
    
    if (hh === ll) return -50;
    return ((hh - currentClose) / (hh - ll)) * -100;
  },

  // OBV
  obv: (closes, volumes) => {
    if (closes.length === 0) return 0;
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) obv += volumes[i];
      else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    }
    return obv;
  }
};

// Get technical analysis data for a specific stock
exports.technicalAnalysis = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }
    
    // Get latest 300 days to ensure enough warmup data for ADX/EMA200
    const { db } = require('../utils/database');
    
    const getStockData = () => {
      return new Promise((resolve, reject) => {
        const sql = `SELECT close, high, low, open, volume, date 
                   FROM historical_ohlcv 
                   WHERE symbol = ? 
                   ORDER BY date DESC 
                   LIMIT 300`;
        
        db.all(sql, [symbol], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    
    const stockData = await getStockData();
    
    if (stockData.length < 50) {
      return res.status(400).json({ 
        error: 'Insufficient data for technical analysis',
        message: `Need at least 50 data points for basic analysis, got ${stockData.length}`
      });
    }
    
    // Prepare data (Filter nulls & Reverse to Chronological: Index 0 = Oldest)
    const validData = stockData.filter(d => 
      d.close !== null && d.high !== null && d.low !== null && d.open !== null && d.volume !== null
    );
    
    // Chronological order arrays
    const closes = validData.map(d => parseFloat(d.close)).reverse();
    const highs = validData.map(d => parseFloat(d.high)).reverse();
    const lows = validData.map(d => parseFloat(d.low)).reverse();
    const opens = validData.map(d => parseFloat(d.open)).reverse();
    const volumes = validData.map(d => parseInt(d.volume)).reverse();
    
    // ==================== CALCULATE ALL INDICATORS ====================
    const indicators = {};
    const safeLast = (arr) => (arr && arr.length > 0) ? arr[arr.length - 1] : null;

    try {
      // SMA
      const sma20Arr = TechIndicators.sma(closes, 20);
      const sma50Arr = TechIndicators.sma(closes, 50);
      const sma200Arr = TechIndicators.sma(closes, 200);
      indicators.sma20 = safeLast(sma20Arr);
      indicators.sma50 = safeLast(sma50Arr);
      indicators.sma200 = safeLast(sma200Arr);

      // EMA
      const ema12Arr = TechIndicators.ema(closes, 12);
      const ema26Arr = TechIndicators.ema(closes, 26);
      const ema50Arr = TechIndicators.ema(closes, 50);
      const ema200Arr = TechIndicators.ema(closes, 200);
      indicators.ema12 = safeLast(ema12Arr);
      indicators.ema26 = safeLast(ema26Arr);
      indicators.ema50 = safeLast(ema50Arr);
      indicators.ema200 = safeLast(ema200Arr);

      // RSI
      const rsiArr = TechIndicators.rsi(closes, 14);
      indicators.rsi = safeLast(rsiArr);

      // MACD
      const macdRes = TechIndicators.macd(closes, 12, 26, 9);
      indicators.macd = macdRes.macd;
      indicators.macdSignal = macdRes.signal;
      indicators.macdHist = macdRes.histogram;

      // Bollinger Bands
      const bb = TechIndicators.bollingerBands(closes, 20, 2);
      indicators.bbUpper = bb.upper;
      indicators.bbMiddle = bb.middle;
      indicators.bbLower = bb.lower;

      // Stochastic
      const stoch = TechIndicators.stochastic(highs, lows, closes, 14, 3);
      indicators.stochK = stoch.k;
      indicators.stochD = stoch.d;

      // ATR
      indicators.atr = TechIndicators.atr(highs, lows, closes, 14);

      // CCI
      indicators.cci = TechIndicators.cci(highs, lows, closes, 20);

      // Williams %R
      indicators.williamsR = TechIndicators.williamsR(highs, lows, closes, 14);

      // ADX
      indicators.adx = TechIndicators.adx(highs, lows, closes, 14);

      // ROC
      indicators.roc = TechIndicators.roc(closes, 12);

      // MFI
      indicators.mfi = TechIndicators.mfi(highs, lows, closes, volumes, 14);

      // OBV
      indicators.obv = TechIndicators.obv(closes, volumes);

      // Fibonacci (Standard - Unchanged logic, just cleanup)
      const fibLookback = Math.min(50, highs.length);
      const recentHighs = highs.slice(-fibLookback);
      const recentLows = lows.slice(-fibLookback);
      const hHigh = Math.max(...recentHighs);
      const lLow = Math.min(...recentLows);
      const diff = hHigh - lLow;
      
      indicators.fibonacci = {
        level0: hHigh,
        level236: hHigh - diff * 0.236,
        level382: hHigh - diff * 0.382,
        level500: hHigh - diff * 0.500,
        level618: hHigh - diff * 0.618,
        level786: hHigh - diff * 0.786,
        level100: lLow,
        high: hHigh,
        low: lLow
      };

      // Pivot Points (Use yesterday's complete data)
      // Since 'closes' is chronological (end is today), index length-2 is yesterday
      if (closes.length >= 2) {
        const prevHigh = highs[highs.length - 2];
        const prevLow = lows[lows.length - 2];
        const prevClose = closes[closes.length - 2];
        const pp = (prevHigh + prevLow + prevClose) / 3;
        
        indicators.pivotPoints = {
          pivotPoint: pp,
          resistance1: (2 * pp) - prevLow,
          resistance2: pp + (prevHigh - prevLow),
          resistance3: prevHigh + 2 * (pp - prevLow),
          support1: (2 * pp) - prevHigh,
          support2: pp - (prevHigh - prevLow),
          support3: prevLow - 2 * (prevHigh - pp)
        };
      } else {
        indicators.pivotPoints = null;
      }

    } catch (e) {
      console.error('Calculation Error:', e);
    }
    
    // Get current price (live or latest close)
    const getCurrentStockData = () => {
      return new Promise((resolve) => {
        const sql = `SELECT price FROM stocks_history WHERE symbol = ? ORDER BY last_updated DESC LIMIT 1`;
        db.get(sql, [symbol], (err, row) => resolve(row));
      });
    };
    
    const currentStockData = await getCurrentStockData();
    const currentPrice = currentStockData?.price || closes[closes.length - 1];
    
    // Format response
    const analysis = {
      symbol: symbol,
      currentPrice: currentPrice,
      chartPeriod: "1y",
      indicators: formatIndicatorResponse(indicators, currentPrice),
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

// Helper to format the indicator response object
const formatIndicatorResponse = (indicators, currentPrice) => {
  return {
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
  };
};

// Calculate overall technical score (0-100)
const calculateTechnicalScore = (indicators, currentPrice) => {
  let totalWeight = 0;
  let weightedScore = 0;
  
  // 1. Trend (Moving Averages) - 35%
  // Strategy: Price > MA = Bullish. Fast MA > Slow MA = Bullish.
  const checkMA = (ma, weight) => {
    if (ma !== null) {
      totalWeight += weight;
      weightedScore += (currentPrice > ma ? 10 : 2) * weight;
    }
  };
  
  checkMA(indicators.sma20, 8);
  checkMA(indicators.sma50, 8);
  checkMA(indicators.sma200, 8);
  checkMA(indicators.ema12, 5); // Short term less weight
  
  // Golden Cross / Death Cross Check (SMA50 vs SMA200)
  if (indicators.sma50 !== null && indicators.sma200 !== null) {
    totalWeight += 5;
    if (indicators.sma50 > indicators.sma200) weightedScore += 10 * 5; // Golden Cross condition
    else weightedScore += 2 * 5;
  }

  // 2. Momentum (RSI, MACD, Stoch) - 35%
  if (indicators.rsi !== null) {
    const w = 12;
    totalWeight += w;
    // RSI Sweet spots: 40-60 is strong trend holding. <30 is buy, >70 is sell/caution.
    // Score implies "Bullishness". So oversold (buy signal) = High Score?
    // Or does Score imply "Strength"? Usually "Buy Signal" = High Score.
    if (indicators.rsi < 30) weightedScore += 9 * w; // Oversold -> Buy
    else if (indicators.rsi > 70) weightedScore += 2 * w; // Overbought -> Sell
    else if (indicators.rsi > 50) weightedScore += 8 * w; // Uptrend
    else weightedScore += 4 * w; // Downtrend
  }

  if (indicators.macdHist !== null) {
    const w = 10;
    totalWeight += w;
    // Histogram rising/positive is bullish
    weightedScore += (indicators.macdHist > 0 ? 9 : 3) * w;
  }

  if (indicators.stochK !== null && indicators.stochD !== null) {
    const w = 8;
    totalWeight += w;
    // K crossing above D in oversold region is very bullish
    if (indicators.stochK < 20 && indicators.stochK > indicators.stochD) weightedScore += 10 * w;
    else if (indicators.stochK > 80) weightedScore += 2 * w;
    else weightedScore += 5 * w;
  }

  // 3. Volatility & Volume (ADX, MFI, Bollinger) - 30%
  if (indicators.adx !== null) {
    const w = 8;
    totalWeight += w;
    // ADX only measures strength, not direction. 
    // If Price > SMA50 AND ADX > 25 => Strong Uptrend (10)
    // If Price < SMA50 AND ADX > 25 => Strong Downtrend (1)
    if (indicators.adx > 25) {
      const isUptrend = indicators.sma50 && currentPrice > indicators.sma50;
      weightedScore += (isUptrend ? 10 : 1) * w;
    } else {
      weightedScore += 5 * w; // Sideways
    }
  }

  if (indicators.mfi !== null) {
    const w = 6;
    totalWeight += w;
    if (indicators.mfi < 20) weightedScore += 9 * w;
    else if (indicators.mfi > 80) weightedScore += 2 * w;
    else weightedScore += 5 * w;
  }

  // Final Score Normalization
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