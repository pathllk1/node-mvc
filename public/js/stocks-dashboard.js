// WebSocket connection manager - handles connection lifecycle for SPA navigation
class StockDashboardWebSocket {
  constructor() {
    this.socket = null;
    this.isInitialized = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  initialize() {
    if (this.isInitialized) {
      console.log('WebSocket already initialized, reconnecting if needed...');
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
      return this.socket;
    }

    console.log('Initializing WebSocket connection...');
    
    // Create socket connection with auto-reconnection
    this.socket = io({ 
      reconnection: true, 
      reconnectionDelay: 1000, 
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    // Set up event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    console.log('WebSocket initialized successfully');
    
    return this.socket;
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Connection event
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.reconnectAttempts = 0;
      this.updateConnectionCount();
      // Request initial data when connected
      this.socket.emit('request-initial-data');
    });

    // Disconnection event
    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.updateConnectionCount();
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, reconnect manually
        this.socket.connect();
      }
    });

    // Reconnection attempts
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
      this.reconnectAttempts = attemptNumber;
    });

    // Reconnection failed
    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect after maximum attempts');
    });

    // Stock data updates
    this.socket.on('stock-data-update', (data) => {
      this.handleStockDataUpdate(data);
    });
  }

  handleStockDataUpdate(data) {
    updateStockTable(data);
    updateStats(data.length);
  }

  updateConnectionCount() {
    const connectedClientsEl = document.getElementById('connected-clients');
    if (connectedClientsEl) {
      connectedClientsEl.textContent = `Clients: ${this.socket && this.socket.connected ? '1' : '0'}`;
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('Disconnecting WebSocket...');
      this.socket.disconnect();
    }
  }

  reconnect() {
    if (this.socket) {
      console.log('Reconnecting WebSocket...');
      if (!this.socket.connected) {
        this.socket.connect();
      }
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

// Create a singleton instance
const wsManager = new StockDashboardWebSocket();

// Store previous stock data for change detection
let previousStockData = {};

// Variables for sorting and searching
let currentStocks = [];
let sortColumn = null;
let sortDirection = 'asc';
let searchTerm = '';

// Event listeners cleanup tracker
const eventListeners = {
  searchInput: null,
  closeModalBtn: null,
  stockModal: null,
  tableHeaders: []
};

// Function to initialize the stock dashboard
function initializeStockDashboard() {
  console.log('Initializing stock dashboard...');
  
  // Initialize WebSocket connection
  const socket = wsManager.initialize();
  
  // Ensure socket is connected
  if (!wsManager.isConnected()) {
    console.log('Socket not connected, attempting to connect...');
    wsManager.reconnect();
  }

  // Set up search functionality
  setupSearchFunctionality();
  
  // Set up table sorting
  setupTableSorting();
  
  // Set up modal handlers
  setupModalHandlers();
  
  // Request initial data
  if (wsManager.isConnected()) {
    socket.emit('request-initial-data');
  }
  
  console.log('Stock dashboard initialized successfully');
}

// Clean up function for when leaving the page
function cleanupStockDashboard() {
  console.log('Cleaning up stock dashboard...');
  
  // Remove event listeners
  removeEventListeners();
  
  // We don't disconnect the socket here - let it stay connected
  // It will auto-reconnect if needed when we return to the page
  
  console.log('Stock dashboard cleanup complete');
}

// Remove all event listeners
function removeEventListeners() {
  // Remove search input listener
  if (eventListeners.searchInput) {
    const searchInput = document.getElementById('search-input');
    if (searchInput && eventListeners.searchInput) {
      searchInput.removeEventListener('input', eventListeners.searchInput);
      eventListeners.searchInput = null;
    }
  }
  
  // Remove modal listeners
  if (eventListeners.closeModalBtn) {
    const closeBtn = document.getElementById('close-modal');
    if (closeBtn) {
      closeBtn.removeEventListener('click', eventListeners.closeModalBtn);
      eventListeners.closeModalBtn = null;
    }
  }
  
  if (eventListeners.stockModal) {
    const modal = document.getElementById('stock-modal');
    if (modal) {
      modal.removeEventListener('click', eventListeners.stockModal);
      eventListeners.stockModal = null;
    }
  }
  
  // Remove table header listeners
  eventListeners.tableHeaders.forEach(({ element, listener }) => {
    if (element) {
      element.removeEventListener('click', listener);
    }
  });
  eventListeners.tableHeaders = [];
}

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

// Update stats display
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
          <svg class="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </td>
      <td class="py-2 px-3 text-center text-gray-600">
        <button class="ta-btn text-purple-600 hover:text-purple-800" data-symbol="${stock.symbol}">
          <svg class="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </button>
      </td>
    `;

    stockTableBody.appendChild(row);
  });

  // Update no results message if needed
  if (filteredStocks.length === 0) {
    stockTableBody.innerHTML = `
      <tr>
        <td colspan="12" class="py-4 px-3 text-center text-gray-500">
          ${searchTerm ? `No stocks found matching "${searchTerm}"` : 'No stock data available'}
        </td>
      </tr>
    `;
  }
}

// Format large numbers (volume, market cap) with suffix
function formatLargeNumber(num, currency = null) {
  if (num == null) return '--';

  const absNum = Math.abs(num);
  let suffix = '';
  let divisor = 1;

  if (absNum >= 1e12) {
    suffix = 'T';
    divisor = 1e12;
  } else if (absNum >= 1e9) {
    suffix = 'B';
    divisor = 1e9;
  } else if (absNum >= 1e6) {
    suffix = 'M';
    divisor = 1e6;
  } else if (absNum >= 1e3) {
    suffix = 'K';
    divisor = 1e3;
  }

  const formattedNum = (num / divisor).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  const currencySymbol = currency && currency !== 'USD' ? ` ${currency}` : '';
  return `${formattedNum}${suffix}${currencySymbol}`;
}

// Function to filter stocks based on search term
function filterStocks(stocks, term) {
  if (!term) return stocks;

  const lowerTerm = term.toLowerCase();
  return stocks.filter(stock => {
    return stock.symbol && stock.symbol.toLowerCase().includes(lowerTerm);
  });
}

// Function to show stock details in modal
async function showStockModal(stock) {
  console.log('showStockModal called with stock:', stock);
  const { stockModal, modalStockTitle, stockDetailContent } = getDOMElements();

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
  stockModal.classList.add('flex');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling

  // Add smooth transition effect
  setTimeout(() => {
    const modalContent = stockModal.querySelector('.transform');
    if (modalContent) {
      modalContent.classList.remove('scale-95');
    }
  }, 10);

  try {
    // Fetch fundamental data from the API
    console.log('Fetching fundamental data for symbol:', stock.symbol);
    const response = await fetch(`/stocks/api/fundamental/${stock.symbol}`);
    console.log('Fundamental data response status:', response.status);
    const fundamentalData = await response.json();
    console.log('Fundamental data received:', fundamentalData);

    if (!response.ok) {
      throw new Error(fundamentalData.error || 'Failed to fetch fundamental data');
    }

    // Update the modal title
    modalStockTitle.textContent = `${fundamentalData.symbol} - ${fundamentalData.companyInfo.name || 'Stock Details'}`;

    // Create the modal content with fundamental data
    stockDetailContent.innerHTML = createFundamentalDataContent(fundamentalData, stock);

    // Set up modal handlers after content is rendered
    setupModalHandlers();

    // Initialize chart for the stock
    initializeChartForStock(fundamentalData.symbol);

    // Set up chart period button handlers
    setupChartPeriodHandlers(fundamentalData.symbol);

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
        <button onclick="showBasicStockModal(${JSON.stringify(stock).replace(/"/g, '&quot;')})" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
          Show Basic Data
        </button>
      </div>
    `;
  }
}

// Function to create fundamental data content
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

  // Format the original stock data for display
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

  return `
    <div class="space-y-6">
      <!-- Price Overview Section -->
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

      <!-- Trading Data Section -->
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

      <!-- Basic Information Section -->
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

      <!-- Chart Section -->
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
        <div class="bg-white rounded-lg p-4 border border-emerald-200 relative h-96">
          <canvas id="stock-chart-${fundamentalData.symbol.replace('.', '_')}"></canvas>
        </div>
      </div>

      <!-- Company Overview Section -->
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

      <!-- Financial Ratios Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            Valuation Ratios
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">P/E Ratio:</span>
              <span class="font-medium text-gray-900">${formatRatio(fundamentalData.financials.peRatio)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">EPS:</span>
              <span class="font-medium text-gray-900">${formatCurrency(fundamentalData.financials.eps)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-purple-100 last:border-0">
              <span class="text-gray-600">Dividend Yield:</span>
              <span class="font-medium text-gray-900">${formatPercent(fundamentalData.financials.dividendYield)}</span>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-100">
          <h3 class="font-bold text-lg text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 002-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
            </svg>
            Financial Health
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-orange-100 last:border-0">
              <span class="text-gray-600">Debt to Equity:</span>
              <span class="font-medium text-gray-900">${formatRatio(fundamentalData.financials.debtToEquity)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-orange-100 last:border-0">
              <span class="text-gray-600">Current Ratio:</span>
              <span class="font-medium text-gray-900">${formatRatio(fundamentalData.financials.currentRatio)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-orange-100 last:border-0">
              <span class="text-gray-600">ROE:</span>
              <span class="font-medium text-gray-900">${formatPercent(fundamentalData.financials.returnOnEquity)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Show basic stock modal (fallback if API fails)
function showBasicStockModal(stock) {
  const { stockModal, modalStockTitle, stockDetailContent } = getDOMElements();

  if (!stockModal || !modalStockTitle || !stockDetailContent) return;

  modalStockTitle.textContent = `${stock.symbol} - Stock Details`;

  const marketCap = stock.marketCap ? formatLargeNumber(stock.marketCap, stock.currency) : 'N/A';
  const volume = stock.volume ? formatLargeNumber(stock.volume, null) : 'N/A';

  stockDetailContent.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-gray-50 p-4 rounded-lg">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Basic Information</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-gray-600">Symbol:</span><span class="text-gray-900 font-semibold">${stock.symbol || 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-gray-600">Market Cap:</span><span class="text-gray-900">${marketCap}</span></div>
        </div>
      </div>

      <div class="bg-gray-50 p-4 rounded-lg">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Price Information</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-gray-600">Current Price:</span><span class="text-gray-900 font-bold">${stock.price ? stock.price.toFixed(2) : 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-gray-600">Change:</span><span class="${stock.change >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold">${stock.change >= 0 ? '+' : ''}${stock.change ? stock.change.toFixed(2) : 'N/A'} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent ? stock.changePercent.toFixed(2) : 'N/A'}%)</span></div>
        </div>
      </div>

      <div class="bg-gray-50 p-4 rounded-lg">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Today's Range</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-gray-600">Open:</span><span class="text-gray-900">${stock.open ? stock.open.toFixed(2) : 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-gray-600">High:</span><span class="text-gray-900">${stock.high ? stock.high.toFixed(2) : 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-gray-600">Low:</span><span class="text-gray-900">${stock.low ? stock.low.toFixed(2) : 'N/A'}</span></div>
        </div>
      </div>

      <div class="bg-gray-50 p-4 rounded-lg">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Volume</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-gray-600">Volume:</span><span class="text-gray-900">${volume}</span></div>
        </div>
      </div>
    </div>
  `;

  stockModal.classList.remove('hidden');
  stockModal.classList.add('flex');
}

// Function to close stock modal
function closeStockModal() {
  const { stockModal } = getDOMElements();
  if (stockModal) {
    stockModal.classList.add('hidden');
    stockModal.classList.remove('flex');
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// Function to load stock chart
async function loadStockChart(symbol, period = '1mo') {
  try {
    console.log('loadStockChart called with symbol:', symbol, 'period:', period);
    const response = await fetch(`/stocks/api/chart/${symbol}?period=${period}`);
    if (!response.ok) throw new Error('Failed to fetch chart data');

    const data = await response.json();
    console.log('Chart data received:', data);

    const canvasId = `stock-chart-${symbol.replace('.', '_')}`;
    console.log('Looking for canvas with ID:', canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('Canvas element not found for symbol:', symbol, 'ID:', canvasId);
      return;
    }

    console.log('Canvas found, creating chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart if any
    if (window.stockChartInstance) {
      window.stockChartInstance.destroy();
    }

    // Create new chart
    window.stockChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels || [],
        datasets: [{
          label: 'Price',
          data: data.datasets[0]?.data || [],
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5
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
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              callback: function (value) {
                return '$' + value.toFixed(2);
              }
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
    console.log('Chart created successfully for symbol:', symbol);
  } catch (error) {
    console.error('Error loading chart for symbol:', symbol, 'Error:', error.message, error);
    const canvasId = `stock-chart-${symbol.replace('.', '_')}`;
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      canvas.style.display = 'none';
      const errorMsg = document.createElement('div');
      errorMsg.className = 'text-red-500 p-4';
      errorMsg.textContent = 'Failed to load chart: ' + error.message;
      canvas.parentElement.appendChild(errorMsg);
    }
  }
}

// Set up event delegation for view stock buttons (only once, not on reload)
if (!window.stockViewBtnListenerInitialized) {
  console.log('Initializing view stock button global listener...');
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.view-stock-btn');
    if (button) {
      console.log('View button clicked');
      const stock = JSON.parse(button.dataset.stock);
      showStockModal(stock);
    }
  });
  window.stockViewBtnListenerInitialized = true;
}

// Set up event delegation for technical analysis buttons (only once, not on reload)
if (!window.taBtnListenerInitialized) {
  console.log('Initializing technical analysis button global listener...');
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.ta-btn');
    if (button) {
      console.log('Technical analysis button clicked');
      const symbol = button.dataset.symbol;
      // Call the TA modal function if it exists
      if (typeof showTechnicalAnalysisModal === 'function') {
        showTechnicalAnalysisModal(symbol);
      } else {
        console.warn('showTechnicalAnalysisModal function not found');
      }
    }
  });
  window.taBtnListenerInitialized = true;
}

// Initialize chart when modal is shown
function initializeChartForStock(symbol) {
  console.log('initializeChartForStock called with symbol:', symbol);
  // Small delay to ensure modal is fully rendered
  setTimeout(() => {
    const defaultPeriod = '1mo';
    console.log('Calling loadStockChart with symbol:', symbol, 'period:', defaultPeriod);
    loadStockChart(symbol, defaultPeriod);
  }, 300);
}

// Set up chart period button handlers
function setupChartPeriodHandlers(symbol) {
  console.log('setupChartPeriodHandlers called for symbol:', symbol);
  const chartPeriodRadios = document.querySelectorAll('.chart-period-radio');
  console.log('Found', chartPeriodRadios.length, 'chart period radios');
  
  chartPeriodRadios.forEach((radio, index) => {
    console.log(`Setting up radio ${index}: value=${radio.value}, symbol=${radio.dataset.symbol}`);
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        console.log('Chart period changed to:', e.target.value, 'for symbol:', symbol);
        loadStockChart(symbol, e.target.value);
      }
    });
  });
  
  console.log('Chart period handlers set up for symbol:', symbol);
}

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

// Function to setup table sorting
function setupTableSorting() {
  // Remove existing listeners
  eventListeners.tableHeaders.forEach(({ element, listener }) => {
    if (element) {
      element.removeEventListener('click', listener);
    }
  });
  eventListeners.tableHeaders = [];

  // Add new listeners
  document.querySelectorAll('[data-sort]').forEach(header => {
    const column = header.dataset.sort;
    const listener = () => sortTable(column);
    header.addEventListener('click', listener);
    eventListeners.tableHeaders.push({ element: header, listener });
  });
}

// Function to handle search input
function setupSearchFunctionality() {
  console.log('Setting up search functionality...');

  const searchInput = document.getElementById('search-input');
  if (!searchInput) {
    console.error('Search input element not found');
    return;
  }

  console.log('Search input found, setting up event listener');

  // Remove existing listener if any
  if (eventListeners.searchInput) {
    searchInput.removeEventListener('input', eventListeners.searchInput);
  }

  // Create new listener
  eventListeners.searchInput = (e) => {
    console.log('Search input event triggered, value:', e.target.value);
    searchTerm = e.target.value.trim();
    console.log('Search term set to:', searchTerm);
    if (currentStocks.length > 0) {
      console.log('Updating stock table with filtered data');
      updateStockTable(currentStocks);
    } else {
      console.log('No current stocks to filter');
    }
  };

  // Add new listener
  searchInput.addEventListener('input', eventListeners.searchInput);

  console.log('Search functionality initialized successfully');
}

// Function to setup modal handlers
function setupModalHandlers() {
  console.log('Setting up modal handlers...');
  
  // Remove existing listeners
  if (eventListeners.closeModalBtn) {
    const closeBtn = document.getElementById('close-modal');
    if (closeBtn) {
      closeBtn.removeEventListener('click', eventListeners.closeModalBtn);
      console.log('Removed old close button listener');
    }
  }

  if (eventListeners.stockModal) {
    const modal = document.getElementById('stock-modal');
    if (modal) {
      modal.removeEventListener('click', eventListeners.stockModal);
      console.log('Removed old modal click listener');
    }
  }

  // Create new listeners with small delay to ensure DOM is ready
  setTimeout(() => {
    const closeBtn = document.getElementById('close-modal');
    if (closeBtn) {
      eventListeners.closeModalBtn = () => {
        console.log('Close button clicked');
        closeStockModal();
      };
      closeBtn.addEventListener('click', eventListeners.closeModalBtn);
      console.log('Added new close button listener');
    } else {
      console.warn('Close button not found in DOM');
    }

    const modal = document.getElementById('stock-modal');
    if (modal) {
      eventListeners.stockModal = (e) => {
        if (e.target === modal) {
          console.log('Modal backdrop clicked');
          closeStockModal();
        }
      };
      modal.addEventListener('click', eventListeners.stockModal);
      console.log('Added new modal click listener');
    } else {
      console.warn('Modal element not found in DOM');
    }
  }, 0);
}

// Listen for SPA navigation events
window.addEventListener('spa:navigated', (event) => {
  console.log('SPA navigation detected');
  
  // Check if we're on the stocks dashboard page
  const isStocksDashboard = window.location.pathname === '/stocks/dashboard' || 
                            document.getElementById('stock-table-body');
  
  if (isStocksDashboard) {
    console.log('On stocks dashboard page, initializing...');
    
    // Small delay to ensure DOM is fully updated
    setTimeout(() => {
      initializeStockDashboard();
    }, 150);
  } else {
    console.log('Not on stocks dashboard page, cleaning up...');
    cleanupStockDashboard();
  }
});

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const isStocksDashboard = window.location.pathname === '/stocks/dashboard' || 
                              document.getElementById('stock-table-body');
    if (isStocksDashboard) {
      initializeStockDashboard();
    }
  });
} else {
  const isStocksDashboard = window.location.pathname === '/stocks/dashboard' || 
                            document.getElementById('stock-table-body');
  if (isStocksDashboard) {
    initializeStockDashboard();
  }
}