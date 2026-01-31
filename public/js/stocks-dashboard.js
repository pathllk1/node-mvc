// Connect to WebSocket server
const socket = io();

// Store previous stock data for change detection
let previousStockData = {};

// Variables for sorting and searching
let currentStocks = [];
let sortColumn = null;
let sortDirection = 'asc';
let searchTerm = '';

// Function to initialize the stock dashboard
function initializeStockDashboard() {
  // Ensure search is set up
  setupSearchFunctionality();

  // Request initial data when the page loads
  socket.emit('request-initial-data');
}

// Initialize on window load
window.addEventListener('load', initializeStockDashboard);

// Listen for SPA navigation events to re-initialize when the page is loaded via SPA
window.addEventListener('spa:navigated', (event) => {
  if (window.location.pathname === '/stocks/dashboard' || document.getElementById('stock-table-body')) {
    // Small delay to ensure DOM is updated
    setTimeout(initializeStockDashboard, 100);
  }
});

// Function to get current DOM elements (instead of caching references)
function getDOMElements() {
  return {
    stockTableBody: document.getElementById('stock-table-body'),
    connectedClientsEl: document.getElementById('connected-clients'),
    lastUpdateEl: document.getElementById('last-update'),
    totalStocksEl: document.getElementById('total-stocks'),
    stockModal: document.getElementById('stock-modal'),
    modalStockTitle: document.getElementById('modal-stock-title'),
    stockDetailContent: document.getElementById('stock-detail-content'),
    closeModalBtn: document.getElementById('close-modal')
  };
}

// Listen for stock data updates
socket.on('stock-data-update', (data) => {
  updateStockTable(data);
  updateStats(data.length);
});

// Listen for connection count updates
socket.on('connect', () => {
  // Request initial data when connected
  socket.emit('request-initial-data');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// Update stats display
socket.on('connect', updateConnectionCount);
socket.on('disconnect', updateConnectionCount);

function updateConnectionCount() {
  const { connectedClientsEl } = getDOMElements();
  if (connectedClientsEl) {
    connectedClientsEl.textContent = `Clients: ${socket.connected ? '1' : '0'}`;
  }
}

function updateStats(count) {
  const { totalStocksEl, lastUpdateEl } = getDOMElements();
  if (totalStocksEl) {
    totalStocksEl.textContent = `Stocks: ${count}`;
  }
  if (lastUpdateEl) {
    lastUpdateEl.textContent = `Last Update: ${new Date().toLocaleTimeString()}`;
  }
}

function updateStockTable(stocks) {
  console.log('updateStockTable called with:', stocks.length, 'stocks');
  console.log('Current search term:', searchTerm);

  const { stockTableBody } = getDOMElements();
  if (!stockTableBody) return;

  // Store current data as previous for next comparison
  const oldStockData = { ...previousStockData };

  // Update previous stock data for next comparison
  previousStockData = {};
  stocks.forEach(stock => {
    previousStockData[stock.symbol] = {
      price: stock.price,
      change: stock.change,
      changePercent: stock.changePercent
    };
  });

  // Store current stocks for sorting/searching
  currentStocks = [...stocks];

  // Apply search filter if there's a search term
  let filteredStocks = searchTerm ? filterStocks(currentStocks, searchTerm) : [...currentStocks];
  console.log('After filtering:', filteredStocks.length, 'stocks remain');

  // Apply sorting if there's a sort column
  if (sortColumn) {
    filteredStocks = sortStocks(filteredStocks, sortColumn, sortDirection);
  } else {
    // Default sort by symbol
    filteredStocks.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  console.log('Final table will show:', filteredStocks.length, 'stocks');

  // Clear existing rows
  stockTableBody.innerHTML = '';

  // Add rows for each stock
  filteredStocks.forEach(stock => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';

    // Format values for display
    const price = stock.price ? stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
    const change = stock.change ? stock.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
    const changePercent = stock.changePercent ? stock.changePercent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
    const open = stock.open ? stock.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
    const high = stock.high ? stock.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
    const low = stock.low ? stock.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
    const close = stock.close ? stock.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
    const volume = stock.volume ? formatLargeNumber(stock.volume, null) : '--';
    const marketCap = stock.marketCap ? formatLargeNumber(stock.marketCap, stock.currency) : '--';

    // Determine row color based on change
    let rowClass = '';
    if (stock.change) {
      rowClass = stock.change > 0 ? 'bg-green-50' : 'bg-red-50';
    }

    // Check if this stock has changed since the last update
    // Only show update indicators if we had previous data (not on initial load)
    const hasChanged = Object.keys(oldStockData).length > 0 && oldStockData[stock.symbol] && (
      oldStockData[stock.symbol].price !== stock.price ||
      oldStockData[stock.symbol].change !== stock.change ||
      oldStockData[stock.symbol].changePercent !== stock.changePercent
    );

    // Apply initial row class based on change
    if (rowClass) {
      row.className = `hover:bg-gray-50 ${rowClass}`;
    } else {
      row.className = 'hover:bg-gray-50';
    }

    // Add temporary highlight class if stock has changed
    if (hasChanged) {
      row.classList.add('bg-yellow-100', 'animate-pulse');

      // Remove the highlight after 1 second
      setTimeout(() => {
        if (row.classList.contains('bg-yellow-100') && row.classList.contains('animate-pulse')) {
          row.classList.remove('bg-yellow-100', 'animate-pulse');

          // Reset to appropriate gain/loss background based on change
          row.classList.remove('bg-green-50', 'bg-red-50');
          if (stock.change > 0) {
            row.classList.add('bg-green-50');
          } else if (stock.change < 0) {
            row.classList.add('bg-red-50');
          }
        }
      }, 1000);
    }

    row.innerHTML = `
      <td class="py-2 px-3 text-sm font-medium text-gray-900">${stock.symbol}</td>
      <td class="py-2 px-3 text-sm text-right text-gray-900 font-medium">${price}</td>
      <td class="py-2 px-3 text-sm text-right ${stock.change > 0 ? 'text-green-600' : stock.change < 0 ? 'text-red-600' : 'text-gray-600'}">${change}</td>
      <td class="py-2 px-3 text-sm text-right ${stock.changePercent > 0 ? 'text-green-600' : stock.changePercent < 0 ? 'text-red-600' : 'text-gray-600'}">${changePercent}%</td>
      <td class="py-2 px-3 text-sm text-right text-gray-600">${open}</td>
      <td class="py-2 px-3 text-sm text-right text-gray-600">${high}</td>
      <td class="py-2 px-3 text-sm text-right text-gray-600">${low}</td>
      <td class="py-2 px-3 text-sm text-right text-gray-600">${close}</td>
      <td class="py-2 px-3 text-sm text-right text-gray-600">${volume}</td>
      <td class="py-2 px-3 text-sm text-right text-gray-600">${marketCap}</td>
      <td class="py-2 px-3 text-center text-gray-600">
        <button class="view-stock-btn text-blue-600 hover:text-blue-800" data-stock='${JSON.stringify(stock).replace(/'/g, '&quot;')}'>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
          </svg>
        </button>
      </td>
      <td class="py-2 px-3 text-center text-gray-600">
        <button class="tech-analysis-btn text-purple-600 hover:text-purple-800" data-symbol="${stock.symbol}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clip-rule="evenodd" />
          </svg>
        </button>
      </td>
    `;

    stockTableBody.appendChild(row);
  });

  // Add event listeners to the view buttons
  document.querySelectorAll('.view-stock-btn').forEach(button => {
    button.addEventListener('click', function() {
      const stockData = JSON.parse(this.getAttribute('data-stock'));
      showStockModal(stockData);
    });
  });
  
  // Add event listeners to the technical analysis buttons
  document.querySelectorAll('.tech-analysis-btn').forEach(button => {
    button.addEventListener('click', function() {
      const symbol = this.getAttribute('data-symbol');
      showTechnicalAnalysisModal(symbol);
    });
  });
}

// Function to show the stock detail modal
async function showStockModal(stock) {
  const { stockModal, modalStockTitle, stockDetailContent, closeModalBtn } = getDOMElements();

  if (!stockModal || !modalStockTitle || !stockDetailContent) {
    console.error('Modal elements not found');
    return;
  }

  // Set the modal title
  modalStockTitle.textContent = `${stock.symbol} - Loading Fundamental Data...`;

  // Show loading state
  stockDetailContent.innerHTML = `
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <span class="ml-3 text-gray-600">Loading fundamental data...</span>
    </div>
  `;

  // Show the modal
  stockModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling

  // Add smooth transition effect
  setTimeout(() => {
    stockModal.querySelector('.transform').classList.remove('scale-95');
  }, 10);

  try {
    // Fetch fundamental data from the API
    const response = await fetch(`/stocks/api/fundamental/${stock.symbol}`);
    const fundamentalData = await response.json();

    if (!response.ok) {
      throw new Error(fundamentalData.error || 'Failed to fetch fundamental data');
    }

    // Update the modal title
    modalStockTitle.textContent = `${fundamentalData.symbol} - ${fundamentalData.companyInfo.name || 'Stock Details'}`;

    // Create the modal content with fundamental data
    stockDetailContent.innerHTML = createFundamentalDataContent(fundamentalData, stock);

  } catch (error) {
    console.error('Error fetching fundamental data:', error);
    modalStockTitle.textContent = `${stock.symbol} - Error Loading Data`;
    stockDetailContent.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-6">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-lg font-medium text-red-800">Error Loading Data</h3>
        </div>
        <p class="mt-2 text-red-700">${error.message}</p>
        <button data-action="show-basic-modal" data-stock='${JSON.stringify(stock)}' class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
          Show Basic Data
        </button>
      </div>
    `;
  }
}


// Function to filter stocks based on search term
function filterStocks(stocks, searchTerm) {
  console.log('filterStocks called with:', stocks.length, 'stocks and search term:', searchTerm);
  const term = searchTerm.toLowerCase();
  const results = stocks.filter(stock => {
    const matches = (
      stock.symbol.toLowerCase().includes(term) ||
      (stock.price && stock.price.toString().includes(term)) ||
      (stock.change && stock.change.toString().includes(term)) ||
      (stock.changePercent && stock.changePercent.toString().includes(term)) ||
      (stock.open && stock.open.toString().includes(term)) ||
      (stock.high && stock.high.toString().includes(term)) ||
      (stock.low && stock.low.toString().includes(term)) ||
      (stock.close && stock.close.toString().includes(term)) ||
      (stock.volume && stock.volume.toString().includes(term)) ||
      (stock.marketCap && stock.marketCap.toString().includes(term))
    );
    return matches;
  });
  console.log('filterStocks returning:', results.length, 'results');
  return results;
}

function createFundamentalDataContent(fundamentalData, stock) {
  const currencySymbol = fundamentalData.companyInfo.currency === 'INR' ? '₹' : '$';

  // Format financial values
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '--';
    return `${currencySymbol}${formatLargeNumber(value, null)}`;
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '--';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '--';
    return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const formatRatio = (value) => {
    if (value === null || value === undefined) return '--';
    return value.toFixed(2);
  };

  // Format the original stock data for display (same as before)
  const formattedPrice = stock.price ? stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedChange = stock.change ? stock.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedChangePercent = stock.changePercent ? stock.changePercent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedOpen = stock.open ? stock.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedHigh = stock.high ? stock.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedLow = stock.low ? stock.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedClose = stock.close ? stock.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedVolume = stock.volume ? formatLargeNumber(stock.volume, null) : '--';
  const formattedMarketCap = stock.marketCap ? formatLargeNumber(stock.marketCap, stock.currency) : '--';

  // Determine color classes based on change
  const changeColorClass = stock.change > 0 ? 'text-green-600' : stock.change < 0 ? 'text-red-600' : 'text-gray-600';
  const changeBgClass = stock.change > 0 ? 'bg-green-50' : stock.change < 0 ? 'bg-red-50' : 'bg-gray-50';
  const changeSign = stock.change > 0 ? '+' : '';

  return `
    <div class="space-y-6">
      <!-- Original Overview Section (same as before) -->
      <div class="${changeBgClass} rounded-xl p-5 border-l-4 ${stock.change > 0 ? 'border-green-500' : 'border-red-500'}">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="text-center">
            <p class="text-sm text-gray-500">Price</p>
            <p class="text-xl font-bold text-gray-900">${currencySymbol}${formattedPrice}</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-500">Change</p>
            <p class="text-xl font-bold ${changeColorClass}">${changeSign}${formattedChange}</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-500">Change %</p>
            <p class="text-xl font-bold ${changeColorClass}">${changeSign}${formattedChangePercent}%</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-500">Volume</p>
            <p class="text-xl font-bold text-gray-900">${formattedVolume}</p>
          </div>
        </div>
      </div>
      
      <!-- Original Detailed Information Grid (same as before) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
            </svg>
            Trading Data
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-blue-100 last:border-0">
              <span class="text-gray-600">Open:</span>
              <span class="font-medium text-gray-900">${currencySymbol}${formattedOpen}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-blue-100 last:border-0">
              <span class="text-gray-600">High:</span>
              <span class="font-medium text-gray-900">${currencySymbol}${formattedHigh}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-blue-100 last:border-0">
              <span class="text-gray-600">Low:</span>
              <span class="font-medium text-gray-900">${currencySymbol}${formattedLow}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-blue-100 last:border-0">
              <span class="text-gray-600">Close:</span>
              <span class="font-medium text-gray-900">${currencySymbol}${formattedClose}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-blue-100 last:border-0">
              <span class="text-gray-600">52-Week Range:</span>
              <span class="font-medium text-gray-900">${fundamentalData.financials.fiftyTwoWeekLow ? `${currencySymbol}${fundamentalData.financials.fiftyTwoWeekLow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${currencySymbol}${fundamentalData.financials.fiftyTwoWeekHigh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}</span>
            </div>
          </div>
        </div>
        
        <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            Additional Info
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">Market Cap:</span>
              <span class="font-medium text-gray-900">${formattedMarketCap}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">Currency:</span>
              <span class="font-medium text-gray-900">${stock.currency || 'USD'}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">Exchange:</span>
              <span class="font-medium text-gray-900">${stock.exchange || '--'}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">Symbol:</span>
              <span class="font-medium text-gray-900">${stock.symbol}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- NEW: Chart Section -->
      <div class="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Price Chart
        </h3>
        
        <!-- Time Period Selector -->
        <div class="flex flex-wrap gap-2 mb-4">
          <label class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-medium cursor-pointer hover:bg-emerald-200 transition-colors">
            <input type="radio" name="chart-period" value="1d" class="sr-only chart-period-radio" data-symbol="${fundamentalData.symbol}">
            <span>1D</span>
          </label>
          <label class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-medium cursor-pointer hover:bg-emerald-200 transition-colors">
            <input type="radio" name="chart-period" value="1wk" class="sr-only chart-period-radio" data-symbol="${fundamentalData.symbol}">
            <span>1W</span>
          </label>
          <label class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-medium cursor-pointer hover:bg-emerald-200 transition-colors">
            <input type="radio" name="chart-period" value="1mo" class="sr-only chart-period-radio" data-symbol="${fundamentalData.symbol}" checked>
            <span>1M</span>
          </label>
          <label class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-medium cursor-pointer hover:bg-emerald-200 transition-colors">
            <input type="radio" name="chart-period" value="1y" class="sr-only chart-period-radio" data-symbol="${fundamentalData.symbol}">
            <span>1Y</span>
          </label>
          <label class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-medium cursor-pointer hover:bg-emerald-200 transition-colors">
            <input type="radio" name="chart-period" value="max" class="sr-only chart-period-radio" data-symbol="${fundamentalData.symbol}">
            <span>MAX</span>
          </label>
        </div>
        
        <!-- Chart Container -->
        <div class="bg-white rounded-lg p-4 border border-emerald-200">
          <canvas id="stock-chart-${fundamentalData.symbol.replace('.', '_')}" height="300"></canvas>
        </div>
      </div>
      
      <!-- NEW: Company Overview (fundamental data) -->
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 class="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Company Overview
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-600">Industry</p>
            <p class="font-medium text-gray-900">${fundamentalData.companyInfo.industry || '--'}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Sector</p>
            <p class="font-medium text-gray-900">${fundamentalData.companyInfo.sector || '--'}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Employees</p>
            <p class="font-medium text-gray-900">${formatNumber(fundamentalData.companyInfo.fullTimeEmployees)}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-sm text-gray-600">Website</p>
            <p class="font-medium text-blue-600">${fundamentalData.companyInfo.website !== 'N/A' ? `<a href="${fundamentalData.companyInfo.website}" target="_blank" class="hover:underline">${fundamentalData.companyInfo.website}</a>` : '--'}</p>
          </div>
        </div>
        ${fundamentalData.companyInfo.businessSummary && fundamentalData.companyInfo.businessSummary !== 'No business summary available' ? `
          <div class="mt-4 pt-4 border-t border-blue-200">
            <p class="text-sm text-gray-600 mb-2">Business Summary</p>
            <p class="text-gray-700 text-sm">${fundamentalData.companyInfo.businessSummary.substring(0, 300)}${fundamentalData.companyInfo.businessSummary.length > 300 ? '...' : ''}</p>
          </div>
        ` : ''}
      </div>
      
      <!-- NEW: Financial Ratios (fundamental data) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Valuation Ratios
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">P/E Ratio:</span>
              <span class="font-medium text-gray-900">${formatRatio(fundamentalData.financials.peRatio)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">Forward P/E:</span>
              <span class="font-medium text-gray-900">${formatRatio(fundamentalData.financials.forwardPE)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">EPS:</span>
              <span class="font-medium text-gray-900">${formatCurrency(fundamentalData.financials.eps)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">Revenue:</span>
              <span class="font-medium text-gray-900">${formatCurrency(fundamentalData.financials.revenue)}</span>
            </div>
          </div>
        </div>
        
        <div class="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-100">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Profitability
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-yellow-100 last:border-0">
              <span class="text-gray-600">Gross Margin:</span>
              <span class="font-medium text-gray-900">${formatPercent(fundamentalData.financials.grossMargins)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-yellow-100 last:border-0">
              <span class="text-gray-600">Operating Margin:</span>
              <span class="font-medium text-gray-900">${formatPercent(fundamentalData.financials.operatingMargins)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-yellow-100 last:border-0">
              <span class="text-gray-600">Profit Margin:</span>
              <span class="font-medium text-gray-900">${formatPercent(fundamentalData.financials.profitMargins)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-yellow-100 last:border-0">
              <span class="text-gray-600">Return on Equity:</span>
              <span class="font-medium text-gray-900">${formatPercent(fundamentalData.financials.returnOnEquity)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- NEW: Additional Fundamental Information -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-6 border border-cyan-100">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Growth Metrics
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-cyan-100 last:border-0">
              <span class="text-gray-600">Revenue Growth:</span>
              <span class="font-medium text-gray-900">${formatPercent(fundamentalData.financials.revenueGrowth)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-cyan-100 last:border-0">
              <span class="text-gray-600">Earnings Growth:</span>
              <span class="font-medium text-gray-900">${formatPercent(fundamentalData.financials.earningsGrowth)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-cyan-100 last:border-0">
              <span class="text-gray-600">Target Price:</span>
              <span class="font-medium text-gray-900">${formatCurrency(fundamentalData.financials.targetMeanPrice)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-cyan-100 last:border-0">
              <span class="text-gray-600">Price Range:</span>
              <span class="font-medium text-gray-900">${formatCurrency(fundamentalData.financials.targetLowPrice)} - ${formatCurrency(fundamentalData.financials.targetHighPrice)}</span>
            </div>
          </div>
        </div>
        
        <div class="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Key Statistics
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-gray-200 last:border-0">
              <span class="text-gray-600">Volume:</span>
              <span class="font-medium text-gray-900">${formatLargeNumber(fundamentalData.financials.volume, null)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-gray-200 last:border-0">
              <span class="text-gray-600">Avg Volume:</span>
              <span class="font-medium text-gray-900">${formatLargeNumber(fundamentalData.financials.averageVolume, null)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-gray-200 last:border-0">
              <span class="text-gray-600">Debt to Equity:</span>
              <span class="font-medium text-gray-900">${formatRatio(fundamentalData.financials.debtToEquity)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-gray-200 last:border-0">
              <span class="text-gray-600">Exchange:</span>
              <span class="font-medium text-gray-900">${fundamentalData.companyInfo.exchange}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- NEW: Analyst Recommendations -->
      ${fundamentalData.analyst.recommendation ? `
        <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Analyst Recommendation
          </h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-2xl font-bold text-gray-900 capitalize">${fundamentalData.analyst.recommendation}</p>
              <p class="text-gray-600">${fundamentalData.analyst.numberOfAnalysts} analysts</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-600">Last updated</p>
              <p class="text-sm font-medium text-gray-900">${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      ` : ''}
      
      <!-- Original Market Status (same as before) -->
      <div class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-medium text-gray-800">Market Status</h3>
            <p class="text-sm text-gray-600">Updated in real-time</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-600">Last updated</p>
            <p class="text-sm font-medium text-gray-900">${new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Fallback function to show basic stock data if fundamental data fails
function showBasicStockModal(stock) {
  const { modalStockTitle, stockDetailContent } = getDOMElements();

  modalStockTitle.textContent = `${stock.symbol} - Stock Details`;

  const currencySymbol = stock.currency === 'INR' ? '₹' : '$';
  const formattedPrice = stock.price ? stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedChange = stock.change ? stock.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedChangePercent = stock.changePercent ? stock.changePercent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formattedVolume = stock.volume ? formatLargeNumber(stock.volume, null) : '--';
  const formattedMarketCap = stock.marketCap ? formatLargeNumber(stock.marketCap, stock.currency) : '--';
  const formatted52WeekLow = stock.fiftyTwoWeekLow ? stock.fiftyTwoWeekLow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  const formatted52WeekHigh = stock.fiftyTwoWeekHigh ? stock.fiftyTwoWeekHigh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';

  const changeColorClass = stock.change > 0 ? 'text-green-600' : stock.change < 0 ? 'text-red-600' : 'text-gray-600';
  const changeBgClass = stock.change > 0 ? 'bg-green-50' : stock.change < 0 ? 'bg-red-50' : 'bg-gray-50';
  const changeSign = stock.change > 0 ? '+' : '';

  stockDetailContent.innerHTML = `
    <div class="space-y-6">
      <div class="${changeBgClass} rounded-xl p-6 border-l-4 ${stock.change > 0 ? 'border-green-500' : 'border-red-500'}">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="text-center">
            <p class="text-sm text-gray-500">Price</p>
            <p class="text-2xl font-bold text-gray-900">${currencySymbol}${formattedPrice}</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-500">Change</p>
            <p class="text-2xl font-bold ${changeColorClass}">${changeSign}${formattedChange}</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-500">Change %</p>
            <p class="text-2xl font-bold ${changeColorClass}">${changeSign}${formattedChangePercent}%</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-500">Volume</p>
            <p class="text-2xl font-bold text-gray-900">${formattedVolume}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
          </svg>
          Trading Data
        </h3>
        <div class="space-y-3">
          <div class="flex justify-between py-2 border-b border-blue-100 last:border-0">
            <span class="text-gray-600">52-Week Range:</span>
            <span class="font-medium text-gray-900">${currencySymbol}${formatted52WeekLow} - ${currencySymbol}${formatted52WeekHigh}</span>
          </div>
        </div>
      </div>
      
      <div class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
        <h3 class="font-bold text-lg text-gray-800 mb-4">Basic Information</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-600">Market Cap</p>
            <p class="font-medium text-gray-900">${formattedMarketCap}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Currency</p>
            <p class="font-medium text-gray-900">${stock.currency || 'USD'}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Exchange</p>
            <p class="font-medium text-gray-900">${stock.exchange || '--'}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Symbol</p>
            <p class="font-medium text-gray-900">${stock.symbol}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Function to close the modal
function closeStockModal() {
  const { stockModal } = getDOMElements();

  if (stockModal) {
    stockModal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// Chart management variables
window.stockCharts = {};

// Function to load stock chart
async function loadStockChart(symbol, period = '1mo') {
  try {
    const canvasId = `stock-chart-${symbol.replace('.', '_')}`;
    const canvas = document.getElementById(canvasId);
    
    if (!canvas) {
      console.error('Chart canvas not found:', canvasId);
      return;
    }
    
    // Fetch chart data from the API
    const response = await fetch(`/stocks/api/chart/${symbol}?period=${period}`);
    const chartData = await response.json();
    
    if (!response.ok) {
      throw new Error(chartData.error || 'Failed to fetch chart data');
    }
    
    // Destroy existing chart if it exists
    const chartId = symbol.replace('.', '_');
    if (window.stockCharts[chartId]) {
      window.stockCharts[chartId].destroy();
    }
    
    // Create the chart data - use simple array for x-axis to avoid time adapter issues
    const chartLabels = chartData.labels;
    const chartValues = chartData.datasets[0].data;
    
    // Create the chart
    const ctx = canvas.getContext('2d');
    window.stockCharts[chartId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartLabels, // Use the dates as labels
        datasets: [{
          label: `${symbol} Price`,
          data: chartValues,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                // Show the label (date) in the tooltip
                return chartLabels[context[0].dataIndex];
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
    
  } catch (error) {
    console.error('Error loading stock chart:', error);
  }
}

// Helper function to format large numbers
function formatLargeNumber(num, currency = 'USD') {
  if (num === null || num === undefined) return '--';

  // For volume (null currency) or when currency is not specified, don't add any prefix
  let prefix = '';
  if (currency === 'USD') {
    prefix = '$';
  } else if (currency === 'INR') {
    prefix = '₹';
  }

  if (num >= 1e12) {
    return `${prefix}${(num / 1e12).toFixed(2)}T`;
  } else if (num >= 1e9) {
    return `${prefix}${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `${prefix}${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `${prefix}${(num / 1e3).toFixed(2)}K`;
  }
  return `${prefix}${num.toString()}`;
}


// Add event listeners for chart period selection and table sorting
document.addEventListener('click', function (e) {
  if (e.target.closest('.chart-period-radio')) {
    const radio = e.target.closest('.chart-period-radio');
    const symbol = radio.dataset.symbol;
    const period = radio.value;
      
    // Update UI to show selected period
    document.querySelectorAll(`.chart-period-radio[data-symbol="${symbol}"]`).forEach(radio => {
      radio.parentElement.classList.remove('bg-emerald-500', 'text-white');
      radio.parentElement.classList.add('bg-emerald-100', 'text-emerald-800');
    });
      
    radio.parentElement.classList.remove('bg-emerald-100', 'text-emerald-800');
    radio.parentElement.classList.add('bg-emerald-500', 'text-white');
    
    // Load chart with new period
    loadStockChart(symbol, period);
  } else if (e.target.closest('th[data-sort]')) {
    // Handle table column sorting
    const sortColumn = e.target.closest('th[data-sort]').dataset.sort;
    sortTable(sortColumn);
  } else if (e.target.closest('button[data-action="show-basic-modal"]')) {
    // Handle show basic modal button
    const button = e.target.closest('button[data-action="show-basic-modal"]');
    const stock = JSON.parse(button.dataset.stock);
    showBasicStockModal(stock);
  }
});

// Initialize chart when modal is shown
function initializeChartForStock(symbol) {
  // Small delay to ensure modal is fully rendered
  setTimeout(() => {
    const defaultPeriod = '1mo';
    loadStockChart(symbol, defaultPeriod);
  }, 300);
}

// Modify showStockModal to initialize chart
const originalShowStockModal = showStockModal;
showStockModal = async function (stock) {
  await originalShowStockModal(stock);
  // Initialize chart after modal content is loaded
  setTimeout(() => {
    initializeChartForStock(stock.symbol);
  }, 500);
};

// Function to sort stocks
function sortStocks(stocks, column, direction) {
  return [...stocks].sort((a, b) => {
    let valA = a[column];
    let valB = b[column];

    // Handle null/undefined values
    if (valA == null && valB == null) return 0;
    if (valA == null) return direction === 'asc' ? 1 : -1;
    if (valB == null) return direction === 'asc' ? -1 : 1;

    // Convert to numbers for numeric comparisons
    if (typeof valA === 'number' && typeof valB === 'number') {
      return direction === 'asc' ? valA - valB : valB - valA;
    }

    // String comparison for non-numeric values
    if (typeof valA === 'string' && typeof valB === 'string') {
      const comparison = valA.localeCompare(valB);
      return direction === 'asc' ? comparison : -comparison;
    }

    // Fallback comparison
    const comparison = String(valA).localeCompare(String(valB));
    return direction === 'asc' ? comparison : -comparison;
  });
}

// Function to handle column sorting
function sortTable(column) {
  // Toggle direction if clicking the same column
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }

  // Update sort indicators
  updateSortIndicators();

  // Refresh the table with sorted data
  updateStockTable(currentStocks);
}

// Function to update sort indicators in the table header
function updateSortIndicators() {
  // Clear all indicators
  document.querySelectorAll('[id^="sort-"]').forEach(el => el.textContent = '');

  // Add indicator for current sort column
  const indicator = document.getElementById(`sort-${sortColumn}`);
  if (indicator) {
    indicator.textContent = sortDirection === 'asc' ? ' ↑' : ' ↓';
  }
}

// Function to handle search input
function setupSearchFunctionality() {
  console.log('setupSearchFunctionality called');

  // Try multiple times to find the search input
  let attempts = 0;
  const maxAttempts = 10;

  function trySetup() {
    attempts++;
    const searchInput = document.getElementById('search-input');
    console.log(`Attempt ${attempts}: Search input element:`, searchInput);

    if (searchInput) {
      console.log('Search input found, setting up event listener');

      // Remove existing event listeners by cloning the element
      const newSearchInput = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(newSearchInput, searchInput);

      // Add new event listener
      newSearchInput.addEventListener('input', (e) => {
        console.log('Search input event triggered, value:', e.target.value);
        searchTerm = e.target.value.trim();
        console.log('Search term set to:', searchTerm);
        if (currentStocks.length > 0) {
          console.log('Updating stock table with filtered data');
          updateStockTable(currentStocks);
        } else {
          console.log('No current stocks to filter');
        }
      });

      // Mark as initialized to prevent duplicate event listeners
      newSearchInput.dataset.initialized = 'true';

      // Debug logging
      console.log('Search functionality initialized successfully');

      // Update the reference if needed
      return newSearchInput;
    } else if (attempts < maxAttempts) {
      console.log(`Search input not found, retrying in 100ms (attempt ${attempts}/${maxAttempts})`);
      setTimeout(trySetup, 100);
    } else {
      console.error('Search input element not found after', maxAttempts, 'attempts');
    }
    return null;
  }

  return trySetup();
}

// Initialize search functionality when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupSearchFunctionality();
  });
} else {
  setupSearchFunctionality();
}

// Also initialize search when SPA navigation occurs
window.addEventListener('spa:navigated', (event) => {
  console.log('SPA navigated event received');
  if (window.location.pathname === '/stocks/dashboard' || document.getElementById('search-input')) {
    console.log('On stocks dashboard or search input exists, initializing search');
    // Ensure DOM is fully updated before initializing
    setTimeout(() => {
      setupSearchFunctionality();
      // Re-initialize the dashboard if we're on the stocks page
      if (window.location.pathname === '/stocks/dashboard') {
        console.log('Re-initializing stock dashboard');
        initializeStockDashboard();
      }
    }, 200); // Increased timeout to ensure DOM is fully ready
  }
});

// Also listen for when SPA scripts are executed
window.addEventListener('spa:scripts-executed', () => {
  console.log('SPA scripts executed event received');
  if (window.location.pathname === '/stocks/dashboard' || document.getElementById('search-input')) {
    console.log('Setting up search after SPA scripts executed');
    setTimeout(() => setupSearchFunctionality(), 50);
  }
});

// Event listener for modal close button
window.addEventListener('DOMContentLoaded', () => {
  const { closeModalBtn } = getDOMElements();
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeStockModal);
  }

  // Close modal when clicking on the backdrop
  const stockModal = document.getElementById('stock-modal');
  if (stockModal) {
    stockModal.addEventListener('click', function (e) {
      if (e.target === stockModal) {
        closeStockModal();
      }
    });
  }
});

// Also set up event listeners when SPA navigates to this page
window.addEventListener('spa:navigated', (event) => {
  if (window.location.pathname === '/stocks/dashboard') {
    setTimeout(() => {
      const { closeModalBtn } = getDOMElements();
      if (closeModalBtn) {
        closeModalBtn.removeEventListener('click', closeStockModal); // Remove any existing listener
        closeModalBtn.addEventListener('click', closeStockModal);
      }

      // Set up backdrop click handler
      const stockModal = document.getElementById('stock-modal');
      if (stockModal) {
        stockModal.removeEventListener('click', function (e) {
          if (e.target === stockModal) {
            closeStockModal();
          }
        }); // Remove existing listener
        stockModal.addEventListener('click', function (e) {
          if (e.target === stockModal) {
            closeStockModal();
          }
        });
      }
    }, 100);
  }
});


