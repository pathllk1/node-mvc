// Function to show the technical analysis modal
async function showTechnicalAnalysisModal(symbol) {
  const modalHtml = `
    <div id="ta-modal" class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto transform transition-transform duration-300 scale-95">
        <div class="p-6">
          <div class="flex justify-between items-start mb-4 pb-3 border-b border-gray-200">
            <div>
              <h2 id="ta-modal-title" class="text-2xl font-bold text-gray-900">${symbol} - Technical Analysis</h2>
              <p class="text-sm text-gray-500 mt-1">Comprehensive technical indicators and analysis</p>
            </div>
            <button id="close-ta-modal" class="text-gray-400 hover:text-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div id="ta-content" class="space-y-5">
            <div class="flex justify-center items-center py-12">
              <span class="ml-3 text-gray-600">Loading technical analysis data...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Get modal elements
  const taModal = document.getElementById('ta-modal');
  const taModalTitle = document.getElementById('ta-modal-title');
  const taContent = document.getElementById('ta-content');
  const closeTaModalBtn = document.getElementById('close-ta-modal');

  // Show the modal
  taModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling

  // Add smooth transition effect
  setTimeout(() => {
    taModal.querySelector('.transform').classList.remove('scale-95');
  }, 10);

  try {
    // Fetch technical analysis data from the API
    const response = await fetch(`/stocks/api/technical-analysis/${symbol}`);
    const taData = await response.json();

    if (!response.ok) {
      throw new Error(taData.error || 'Failed to fetch technical analysis data');
    }

    // Update the modal title
    taModalTitle.textContent = `${taData.symbol} - Technical Analysis (Current: ${taData.currentPrice.toFixed(2)})`;

    // Create the technical analysis content
    taContent.innerHTML = createTechnicalAnalysisContent(taData);
      
    // Initialize charts after content is rendered
    setTimeout(() => {
      initializeTechnicalCharts(symbol, taData);
      setupChartEventListeners(symbol);
    }, 100);
      
  } catch (error) {
    console.error('Error fetching technical analysis data:', error);
    taModalTitle.textContent = `${symbol} - Error Loading Technical Analysis`;
    taContent.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-6">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-lg font-medium text-red-800">Error Loading Technical Analysis</h3>
        </div>
        <p class="mt-2 text-red-700">${error.message}</p>
      </div>
    `;
  }
}

function createTechnicalAnalysisContent(taData) {
  // Format values for display
  const formatValue = (value) => {
    if (value === null || value === undefined) return '--';
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    return value;
  };

  // Get currency symbol
  const currencySymbol = taData.currentPrice >= 1000 ? '₹' : '$';

  // Create content for technical analysis
  return `
    <div class="space-y-6">
      <!-- Overall Score Section -->
      <div class="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Technical Score
        </h3>
        <div class="flex justify-center">
          <div class="relative">
            <div class="w-32 h-32 rounded-full flex items-center justify-center border-8 ${taData.score >= 70 ? 'border-green-500' : taData.score >= 50 ? 'border-yellow-500' : 'border-red-500'}">
              <span class="text-3xl font-bold ${taData.score >= 70 ? 'text-green-600' : taData.score >= 50 ? 'text-yellow-600' : 'text-red-600'}">${taData.score}</span>
            </div>
            <div class="absolute bottom-2 left-0 right-0 text-center text-sm text-gray-600">
              <span class="inline-block px-2 py-1 rounded-full text-xs font-semibold ${taData.score >= 70 ? 'bg-green-100 text-green-800' : taData.score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">
                ${taData.score >= 70 ? 'STRONG' : taData.score >= 50 ? 'MODERATE' : 'WEAK'}
              </span>
            </div>
          </div>
        </div>
        <p class="text-center text-gray-600 mt-2">Overall technical health rating (0-100)</p>
      </div>
      
      <!-- Chart Section -->
      <div class="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m0-8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2m12 0h-8m8 0v2a2 2 0 01-2 2H8a2 2 0 01-2-2V8m8 0V6a2 2 0 00-2-2H8a2 2 0 00-2 2v2" />
          </svg>
          Price Chart & Technical Indicators
        </h3>
        
        <!-- Period Selector -->
        <div class="flex flex-wrap gap-2 mb-4 justify-center">
          <button class="chart-period-btn px-3 py-1 text-sm rounded-lg border transition-colors duration-200 ${taData.chartPeriod === '1d' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}" data-period="1d">1D</button>
          <button class="chart-period-btn px-3 py-1 text-sm rounded-lg border transition-colors duration-200 ${taData.chartPeriod === '1wk' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}" data-period="1wk">1W</button>
          <button class="chart-period-btn px-3 py-1 text-sm rounded-lg border transition-colors duration-200 ${taData.chartPeriod === '1mo' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}" data-period="1mo">1M</button>
          <button class="chart-period-btn px-3 py-1 text-sm rounded-lg border transition-colors duration-200 ${taData.chartPeriod === '3mo' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}" data-period="3mo">3M</button>
          <button class="chart-period-btn px-3 py-1 text-sm rounded-lg border transition-colors duration-200 ${taData.chartPeriod === '6mo' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}" data-period="6mo">6M</button>
          <button class="chart-period-btn px-3 py-1 text-sm rounded-lg border transition-colors duration-200 ${taData.chartPeriod === '1y' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}" data-period="1y">1Y</button>
          <button class="chart-period-btn px-3 py-1 text-sm rounded-lg border transition-colors duration-200 ${taData.chartPeriod === 'max' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}" data-period="max">MAX</button>
        </div>
        
        <!-- Main Chart Container -->
        <div class="bg-white p-4 rounded-lg border border-gray-200 mb-6 h-96 flex flex-col">
          <canvas id="ta-price-chart-${taData.symbol.replace('.', '_')}" height="400" class="w-full h-full"></canvas>
        </div>
        
        <!-- Separate Indicator Panels -->
          <!-- MACD Panel -->
          <div class="bg-white p-4 rounded-lg border border-gray-200 mb-6 h-56 flex flex-col w-full">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              MACD
            </h4>
            <canvas id="ta-macd-chart-${taData.symbol.replace('.', '_')}" class="w-full h-full"></canvas>
          </div>
          
          <!-- RSI Panel -->
          <div class="bg-white p-4 rounded-lg border border-gray-200 mb-6 h-56 flex flex-col w-full">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              RSI
            </h4>
            <canvas id="ta-rsi-chart-${taData.symbol.replace('.', '_')}" class="w-full h-full"></canvas>
          </div>
          
          <!-- Volume Panel -->
          <div class="bg-white p-4 rounded-lg border border-gray-200 mb-6 h-56 flex flex-col w-full">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Volume
            </h4>
            <canvas id="ta-volume-chart-${taData.symbol.replace('.', '_')}" class="w-full h-full"></canvas>
          </div>
      </div>
      
      <!-- Summary Section -->
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Technical Analysis Summary
        </h3>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Trend</p>
            <p class="text-lg font-bold ${taData.summary.trend === 'Bullish' ? 'text-green-600' : taData.summary.trend === 'Bearish' ? 'text-red-600' : 'text-gray-600'}">${taData.summary.trend}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Momentum</p>
            <p class="text-lg font-bold ${taData.summary.momentum === 'Bullish' ? 'text-green-600' : taData.summary.momentum === 'Bearish' ? 'text-red-600' : 'text-gray-600'}">${taData.summary.momentum}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Volatility</p>
            <p class="text-lg font-bold ${taData.summary.volatility === 'High' ? 'text-red-600' : taData.summary.volatility === 'Low' ? 'text-green-600' : 'text-gray-600'}">${taData.summary.volatility}</p>
          </div>
      </div>
      
      <!-- Trend Indicators -->
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m0-8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2m12 0h-8m8 0v2a2 2 0 01-2 2H8a2 2 0 01-2-2V8m8 0V6a2 2 0 00-2-2H8a2 2 0 00-2 2v2" />
          </svg>
          Trend Indicators
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">SMA 20</p>
            <p class="text-lg font-bold ${taData.indicators.sma20.color}">${formatValue(taData.indicators.sma20.value)}</p>
            <p class="text-xs ${taData.indicators.sma20.color}">${taData.indicators.sma20.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">SMA 50</p>
            <p class="text-lg font-bold ${taData.indicators.sma50.color}">${formatValue(taData.indicators.sma50.value)}</p>
            <p class="text-xs ${taData.indicators.sma50.color}">${taData.indicators.sma50.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">SMA 200</p>
            <p class="text-lg font-bold ${taData.indicators.sma200.color}">${formatValue(taData.indicators.sma200.value)}</p>
            <p class="text-xs ${taData.indicators.sma200.color}">${taData.indicators.sma200.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">EMA 12</p>
            <p class="text-lg font-bold ${taData.indicators.ema12.color}">${formatValue(taData.indicators.ema12.value)}</p>
            <p class="text-xs ${taData.indicators.ema12.color}">${taData.indicators.ema12.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">EMA 26</p>
            <p class="text-lg font-bold ${taData.indicators.ema26.color}">${formatValue(taData.indicators.ema26.value)}</p>
            <p class="text-xs ${taData.indicators.ema26.color}">${taData.indicators.ema26.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">EMA 50</p>
            <p class="text-lg font-bold ${taData.indicators.ema50.color}">${formatValue(taData.indicators.ema50.value)}</p>
            <p class="text-xs ${taData.indicators.ema50.color}">${taData.indicators.ema50.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">EMA 200</p>
            <p class="text-lg font-bold ${taData.indicators.ema200.color}">${formatValue(taData.indicators.ema200.value)}</p>
            <p class="text-xs ${taData.indicators.ema200.color}">${taData.indicators.ema200.signal}</p>
          </div>
      </div>
      
      <!-- Momentum Indicators -->
      <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Momentum Indicators
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">RSI (14)</p>
            <p class="text-lg font-bold ${taData.indicators.rsi.color}">${formatValue(taData.indicators.rsi.value)}</p>
            <p class="text-xs ${taData.indicators.rsi.color}">${taData.indicators.rsi.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">MACD</p>
            <p class="text-lg font-bold ${taData.indicators.macd.color}">${formatValue(taData.indicators.macd.value)}</p>
            <p class="text-xs ${taData.indicators.macd.color}">${taData.indicators.macd.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Stochastic K</p>
            <p class="text-lg font-bold ${taData.indicators.stochastic.color}">${formatValue(taData.indicators.stochastic.k)}</p>
            <p class="text-xs ${taData.indicators.stochastic.color}">${taData.indicators.stochastic.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">CCI</p>
            <p class="text-lg font-bold ${taData.indicators.cci.color}">${formatValue(taData.indicators.cci.value)}</p>
            <p class="text-xs ${taData.indicators.cci.color}">${taData.indicators.cci.signal}</p>
          </div>
      </div>
      
      <!-- Volatility Indicators -->
      <div class="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-100">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Volatility Indicators
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Bollinger Bands</p>
            <div class="flex justify-between mt-2">
              <div class="text-center">
                <p class="text-xs text-gray-500">Upper</p>
                <p class="text-sm font-medium">${formatValue(taData.indicators.bollingerBands.upper)}</p>
              </div>
              <div class="text-center">
                <p class="text-xs text-gray-500">Middle</p>
                <p class="text-sm font-medium">${formatValue(taData.indicators.bollingerBands.middle)}</p>
              </div>
              <div class="text-center">
                <p class="text-xs text-gray-500">Lower</p>
                <p class="text-sm font-medium">${formatValue(taData.indicators.bollingerBands.lower)}</p>
              </div>
            </div>
            <p class="text-xs mt-2 ${taData.indicators.bollingerBands.color}">${taData.indicators.bollingerBands.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">ATR (14)</p>
            <p class="text-lg font-bold ${taData.indicators.atr.color}">${formatValue(taData.indicators.atr.value)}</p>
            <p class="text-xs ${taData.indicators.atr.color}">${taData.indicators.atr.signal}</p>
          </div>
      </div>
      
      <!-- Additional Indicators -->
      <div class="bg-gradient-to-r from-cyan-50 to-sky-50 rounded-xl p-6 border border-cyan-100">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Additional Indicators
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Current Price</p>
            <p class="text-lg font-bold text-gray-900">${currencySymbol}${formatValue(taData.currentPrice)}</p>
            <p class="text-xs text-gray-500">Latest closing price</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Williams %R</p>
            <p class="text-lg font-bold ${taData.indicators.williamsR.color}">${formatValue(taData.indicators.williamsR.value)}</p>
            <p class="text-xs ${taData.indicators.williamsR.color}">${taData.indicators.williamsR.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">ADX</p>
            <p class="text-lg font-bold ${taData.indicators.adx.color}">${formatValue(taData.indicators.adx.value)}</p>
            <p class="text-xs ${taData.indicators.adx.color}">${taData.indicators.adx.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Rate of Change</p>
            <p class="text-lg font-bold ${taData.indicators.roc.color}">${formatValue(taData.indicators.roc.value)}</p>
            <p class="text-xs ${taData.indicators.roc.color}">${taData.indicators.roc.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Money Flow Index</p>
            <p class="text-lg font-bold ${taData.indicators.mfi.color}">${formatValue(taData.indicators.mfi.value)}</p>
            <p class="text-xs ${taData.indicators.mfi.color}">${taData.indicators.mfi.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">On Balance Volume</p>
            <p class="text-lg font-bold ${taData.indicators.obv.color}">${formatValue(taData.indicators.obv.value)}</p>
            <p class="text-xs ${taData.indicators.obv.color}">${taData.indicators.obv.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Fibonacci 23.6%</p>
            <p class="text-lg font-bold ${taData.indicators.fibonacci.color}">${formatValue(taData.indicators.fibonacci.level236)}</p>
            <p class="text-xs ${taData.indicators.fibonacci.color}">${taData.indicators.fibonacci.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Fibonacci 61.8%</p>
            <p class="text-lg font-bold ${taData.indicators.fibonacci.color}">${formatValue(taData.indicators.fibonacci.level618)}</p>
            <p class="text-xs ${taData.indicators.fibonacci.color}">${taData.indicators.fibonacci.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Pivot Point</p>
            <p class="text-lg font-bold ${taData.indicators.pivotPoints.color}">${formatValue(taData.indicators.pivotPoints.pivotPoint)}</p>
            <p class="text-xs ${taData.indicators.pivotPoints.color}">${taData.indicators.pivotPoints.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">MACD Signal</p>
            <p class="text-lg font-bold ${taData.indicators.macd.color}">${formatValue(taData.indicators.macdSignal.value)}</p>
            <p class="text-xs ${taData.indicators.macd.color}">${taData.indicators.macd.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">MACD Histogram</p>
            <p class="text-lg font-bold ${taData.indicators.macd.color}">${formatValue(taData.indicators.macdHistogram.value)}</p>
            <p class="text-xs ${taData.indicators.macd.color}">${taData.indicators.macd.signal}</p>
          </div>
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-500">Stochastic D</p>
            <p class="text-lg font-bold ${taData.indicators.stochastic.color}">${formatValue(taData.indicators.stochastic.d)}</p>
            <p class="text-xs ${taData.indicators.stochastic.color}">${taData.indicators.stochastic.signal}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Function to close the technical analysis modal
function closeTechnicalAnalysisModal() {
  const taModal = document.getElementById('ta-modal');

  if (taModal) {
    // Destroy any existing charts to prevent memory leaks
    if (window.taCharts) {
      Object.values(window.taCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
          chart.destroy();
        }
      });
      window.taCharts = {};
    }
    
    taModal.remove();
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// Set up event listeners for technical analysis modal
window.addEventListener('DOMContentLoaded', () => {
  // Use event delegation for close button since modal is dynamically added
  document.addEventListener('click', function (e) {
    if (e.target.closest('#close-ta-modal')) {
      closeTechnicalAnalysisModal();
    }
  });

  // Close modal when clicking on the backdrop
  document.addEventListener('click', function (e) {
    if (e.target.id === 'ta-modal') {
      closeTechnicalAnalysisModal();
    }
  });
});

// Also set up event listeners when SPA navigates
window.addEventListener('spa:navigated', (event) => {
  if (window.location.pathname === '/stocks/dashboard') {
    setTimeout(() => {
      document.addEventListener('click', function (e) {
        if (e.target.closest('#close-ta-modal')) {
          closeTechnicalAnalysisModal();
        }
      });

      document.addEventListener('click', function (e) {
        if (e.target.id === 'ta-modal') {
          closeTechnicalAnalysisModal();
        }
      });
    }, 100);
  }
});

// Chart management functions
window.taCharts = {};

async function initializeTechnicalCharts(symbol, taData) {
  const symbolId = symbol.replace('.', '_');
  
  // Clear any existing charts
  Object.values(window.taCharts).forEach(chart => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  });
  window.taCharts = {};
  
  try {
    // Fetch chart data - use 1 year to ensure enough data for technical indicators like MACD
    const response = await fetch(`/stocks/api/chart/${symbol}?period=1y`);
    const chartData = await response.json();
    
    if (!response.ok) {
      throw new Error(chartData.error || 'Failed to fetch chart data');
    }
    
    // Initialize main price chart
    const priceCanvas = document.getElementById(`ta-price-chart-${symbolId}`);
    if (priceCanvas) {
      window.taCharts.price = createPriceChart(priceCanvas, chartData, taData);
    }
    
    // Initialize MACD chart
    const macdCanvas = document.getElementById(`ta-macd-chart-${symbolId}`);
    if (macdCanvas) {
      window.taCharts.macd = createMacdChart(macdCanvas, chartData, taData);
    }
    
    // Initialize RSI chart
    const rsiCanvas = document.getElementById(`ta-rsi-chart-${symbolId}`);
    if (rsiCanvas) {
      window.taCharts.rsi = createRsiChart(rsiCanvas, chartData, taData);
    }
    
    // Initialize Volume chart
    const volumeCanvas = document.getElementById(`ta-volume-chart-${symbolId}`);
    if (volumeCanvas) {
      window.taCharts.volume = createVolumeChart(volumeCanvas, chartData);
    }
    
  } catch (error) {
    console.error('Error initializing technical charts:', error);
  }
}

function createPriceChart(canvas, chartData, taData) {
  const ctx = canvas.getContext('2d');
  
  // Extract data from the API response
  const labels = chartData.labels;
  const priceData = chartData.datasets[0].data;
  
  // Create time-series compatible data (need to convert labels to timestamps)
  // For this, we'll create a mock time series
  const timeSeriesData = labels.map((label, index) => ({
    x: new Date(Date.now() - (labels.length - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    y: priceData[index]
  }));
  
  // Prepare moving average data
  // For demonstration purposes, we'll create simplified SMA and EMA data
  // In a real scenario, these would be computed from the historical data
  const smaData = [];
  const emaData = [];
  
  // If we have enough data points, compute simple averages
  if (priceData.length >= 5) {
    for (let i = 4; i < priceData.length; i++) {
      // Simple 5-point SMA for demo
      const smaValue = priceData.slice(i-4, i+1).reduce((a, b) => a + b, 0) / 5;
      smaData.push({
        x: timeSeriesData[i].x,
        y: smaValue
      });
      
      // EMA calculation (simplified for demo)
      const emaValue = (priceData[i] * 2 + priceData[i-1] * 1.5 + priceData[i-2] * 1.2 + priceData[i-3] * 1.1 + priceData[i-4]) / 7;
      emaData.push({
        x: timeSeriesData[i].x,
        y: emaValue
      });
    }
  }
  
  // Ensure canvas respects container size
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  
  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Price',
          data: timeSeriesData,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          borderWidth: 2,
          tension: 0.1,
          pointRadius: 0
        },
        {
          label: 'SMA 5',
          data: smaData,
          type: 'line',
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'EMA 5',
          data: emaData,
          type: 'line',
          borderColor: 'rgba(255, 205, 86, 1)',
          backgroundColor: 'rgba(255, 205, 86, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 2,
      scales: {
        x: {
          type: 'category'
        },
        y: {
          beginAtZero: false
        }
      },
      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    }
  });
}

function createMacdChart(canvas, chartData, taData) {
  const ctx = canvas.getContext('2d');
  
  // Create sample MACD data based on the price data
  const priceData = chartData.datasets[0].data;
  const labels = chartData.labels;
  
  // Generate proper MACD values using EMA calculations
  const macdLine = [];
  const signalLine = [];
  const histogram = [];
  
  if (priceData.length >= 26) { // Need at least 26 data points for MACD
    // Calculate EMAs
    const kMultiplier = 2 / (12 + 1); // EMA 12 multiplier
    const dMultiplier = 2 / (26 + 1); // EMA 26 multiplier
    const signalMultiplier = 2 / (9 + 1); // Signal line multiplier
    
    // Calculate EMAs for MACD
    const ema12Values = [];
    const ema26Values = [];
    
    // Calculate simple moving averages for initial values
    let ema12 = priceData.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
    let ema26 = priceData.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
    
    // Calculate the EMAs for each data point
    for (let i = 0; i < priceData.length; i++) {
      // Update EMA12 for all applicable indices
      if (i >= 11) { // Start contributing values after 12 data points
        if (i === 11) {
          ema12 = priceData.slice(0, 12).reduce((a, b) => a + b, 0) / 12; // Initial SMA
        } else {
          ema12 = (priceData[i] - ema12) * kMultiplier + ema12; // Update EMA
        }
        ema12Values.push(ema12);
      }
      
      // Update EMA26 for all applicable indices
      if (i >= 25) { // Start contributing values after 26 data points
        if (i === 25) {
          ema26 = priceData.slice(0, 26).reduce((a, b) => a + b, 0) / 26; // Initial SMA
        } else {
          ema26 = (priceData[i] - ema26) * dMultiplier + ema26; // Update EMA
        }
        ema26Values.push(ema26);
      }
    }
    
    // Calculate MACD line (EMA12 - EMA26)
    // The MACD line starts where EMA26 starts contributing (at index 25)
    // At that point, EMA12 has contributed 14 more values (since it started at index 11)
    for (let i = 0; i < ema26Values.length; i++) {
      // The EMA12 value that corresponds to the same time period as ema26Values[i]
      // is at index (i + difference_in_start_points)
      const correspondingEma12Index = i + (25 - 11);
      if (correspondingEma12Index < ema12Values.length) {
        const macdValue = ema12Values[correspondingEma12Index] - ema26Values[i];
        // Use the appropriate label index (the label at the same time as the MACD calculation)
        const labelIndex = 25 + i;  // This corresponds to the index in the original data where MACD values start
        if (labelIndex < labels.length) {
          macdLine.push({x: labels[labelIndex], y: macdValue});
        }
      }
    }
    
    // Calculate signal line (9-day EMA of MACD line)
    if (macdLine.length >= 9) {
      // Calculate initial signal value from first 9 MACD values
      let signalSum = 0;
      for (let i = 0; i < 9; i++) {
        signalSum += macdLine[i].y;
      }
      let signalValue = signalSum / 9;
      signalLine.push({x: macdLine[8].x, y: signalValue});
      
      // Calculate the rest of the signal line
      for (let i = 9; i < macdLine.length; i++) {
        signalValue = (macdLine[i].y - signalValue) * signalMultiplier + signalValue;
        signalLine.push({x: macdLine[i].x, y: signalValue});
      }
    }
    
    // Calculate histogram (MACD line - Signal line)
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push({x: signalLine[i].x, y: macdLine[i].y - signalLine[i].y});
    }
  }
  
  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'MACD Line',
          data: macdLine,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          borderWidth: 2,
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: 'Signal Line',
          data: signalLine,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderWidth: 2,
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: 'Histogram',
          data: histogram,
          type: 'bar',
          backgroundColor: histogram.map(point => point.y >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'),
          borderColor: histogram.map(point => point.y >= 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'),
          borderWidth: 1,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      scales: {
        x: {
          type: 'category'
        },
        y: {
          beginAtZero: false
        }
      },
      plugins: {
        legend: {
          display: true
        }
      }
    }
  });
}

function createRsiChart(canvas, chartData, taData) {
  const ctx = canvas.getContext('2d');
  
  const priceData = chartData.datasets[0].data;
  const labels = chartData.labels.map((label, index) => 
    new Date(Date.now() - (chartData.labels.length - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  
  // Calculate RSI based on price changes
  const rsiData = [];
  
  // Need at least 15 data points to calculate 14-period RSI
  if (priceData.length >= 15) {
    // Calculate price changes
    const changes = [];
    for (let i = 1; i < priceData.length; i++) {
      changes.push(priceData[i] - priceData[i-1]);
    }
    
    // Calculate initial average gain and loss (first 14 values)
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 0; i < 14; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }
    
    avgGain /= 14;
    avgLoss /= 14;
    
    // Calculate first RSI value
    if (avgLoss !== 0) {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiData.push({x: labels[14], y: rsi});
    } else {
      rsiData.push({x: labels[14], y: 100});
    }
    
    // Calculate subsequent RSI values using smoothed moving average
    for (let i = 15; i < priceData.length; i++) {
      const currentChange = changes[i-1]; // changes array is 1 shorter than priceData
      
      const gain = currentChange > 0 ? currentChange : 0;
      const loss = currentChange < 0 ? Math.abs(currentChange) : 0;
      
      // Smoothed averages
      avgGain = ((avgGain * 13) + gain) / 14;
      avgLoss = ((avgLoss * 13) + loss) / 14;
      
      if (avgLoss !== 0) {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiData.push({x: labels[i], y: rsi});
      } else {
        rsiData.push({x: labels[i], y: 100});
      }
    }
  }
  
  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'RSI',
        data: rsiData,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 2,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      scales: {
        x: {
          type: 'category'
        },
        y: {
          min: 0,
          max: 100,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          display: true
        }
      }
    }
  });
}

function createVolumeChart(canvas, chartData) {
  const ctx = canvas.getContext('2d');
  
  // We need to get volume data from the technical analysis data instead of creating mock data
  // Use volume data from the chartData if available
  
  // For now, let's create volume data based on the chart data structure
  // In a real implementation, volume data should come from the API
  const labels = chartData.labels.map((label, index) => 
    new Date(Date.now() - (chartData.labels.length - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  
  // Create volume data based on price data and any available volume info
  // If there's volume data in the chartData structure, use that
  let volumeData = [];
  
  // First, try to get volume data from chartData.datasets
  if (chartData.datasets.length > 1) {
    // If there's a volume dataset in chartData
    const volumeDataset = chartData.datasets.find(ds => ds.label && ds.label.toLowerCase().includes('volume'));
    if (volumeDataset && volumeDataset.data) {
      for (let i = 0; i < Math.min(labels.length, volumeDataset.data.length); i++) {
        volumeData.push({x: labels[i], y: volumeDataset.data[i]});
      }
    }
  }
  
  // If still no volume data, create mock data based on price changes
  if (volumeData.length === 0) {
    const priceData = chartData.datasets[0].data;
    for (let i = 0; i < chartData.labels.length; i++) {
      // Create mock volume data based on price level and volatility
      const baseVolume = 1000000; // Base volume
      const priceFactor = (priceData[i] || 100) / 100; // Scale by price
      const volatilityFactor = Math.abs((priceData[Math.min(i + 1, priceData.length - 1)] || priceData[i]) - (priceData[Math.max(i - 1, 0)] || priceData[i])) / (priceData[i] || 100);
      const volume = Math.floor(baseVolume * priceFactor * (1 + volatilityFactor * 10));
      volumeData.push({x: labels[i], y: volume});
    }
  }
  
  return new Chart(ctx, {
    type: 'bar',
    data: {
      datasets: [{
        label: 'Volume',
        data: volumeData,
        backgroundColor: volumeData.map(point => point.y >= 0 ? 'rgba(54, 162, 235, 0.6)' : 'rgba(255, 99, 132, 0.6)'),
        borderColor: volumeData.map(point => point.y >= 0 ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 99, 132, 1)'),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      scales: {
        x: {
          type: 'category'
        },
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: true
        }
      }
    }
  });
}

function setupChartEventListeners(symbol) {
  // Add event listeners for period buttons
  const periodButtons = document.querySelectorAll('.chart-period-btn');
  periodButtons.forEach(button => {
    button.addEventListener('click', async function() {
      const period = this.getAttribute('data-period');
      
      // Update button states
      periodButtons.forEach(btn => btn.classList.remove('bg-blue-500', 'text-white', 'border-blue-500'));
      periodButtons.forEach(btn => btn.classList.add('bg-white', 'text-gray-700', 'border-gray-300'));
      this.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
      this.classList.add('bg-blue-500', 'text-white', 'border-blue-500');
      
      // Update charts with new period
      try {
        const response = await fetch(`/stocks/api/chart/${symbol}?period=${period}`);
        const chartData = await response.json();
        
        if (response.ok && window.taCharts.price) {
          // Update price chart with new data
          const priceData = chartData.datasets[0].data;
          const labels = chartData.labels;
                
          // Create time-series compatible data
          const timeSeriesData = labels.map((label, index) => ({
            x: new Date(Date.now() - (labels.length - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            y: priceData[index]
          }));
                
          window.taCharts.price.data.datasets[0].data = timeSeriesData;
          window.taCharts.price.update();
        }
      } catch (error) {
        console.error('Error updating chart period:', error);
      }
    });
  });
}