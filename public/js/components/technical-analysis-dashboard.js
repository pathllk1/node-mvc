/**
 * TechnicalAnalysisDashboard - Main dashboard component for technical analysis
 * Manages data loading, rendering, filtering, pagination, modals, and charts
 * Wrapped in IIFE to avoid conflicts on script reload
 */
(function() {
  window.TechnicalAnalysisDashboard = class TechnicalAnalysisDashboard {
    // Configuration constants
    static CONFIG = {
      PAGE_SIZE: 20,
      CHART_ANIMATION_DURATION: 750,
      SEARCH_DEBOUNCE_MS: 300,
      API_TIMEOUT_MS: 10000,
      TOP_STOCKS_LIMIT: 5,
      HISTORY_LIMIT: 50,
      SCORE_STRONG: 70,
      SCORE_MODERATE: 50
    };

    // Color palette
    static COLORS = {
      STRONG: '#10B981',    // Green
      MODERATE: '#F59E0B',  // Amber
      WEAK: '#EF4444',      // Red
      INFO: '#3B82F6',      // Blue
      SUCCESS: '#059669',   // Dark Green
      WARNING: '#D97706',   // Dark Amber
      DANGER: '#DC2626'     // Dark Red
    };

    constructor() {
      this.currentPage = 1;
      this.pageSize = window.TechnicalAnalysisDashboard.CONFIG.PAGE_SIZE;
      this.totalRecords = 0;
      this.allRecords = [];
      this.filteredRecords = [];
      this.scoreDistributionChart = null;
      this.isInitialized = false;
      this.searchTimeout = null;
      this.companyNameCache = {};
      
      this.initialize();
    }

    async initialize() {
      if (this.isInitialized) return;
      
      this.bindEvents();
      await this.loadData();
      this.isInitialized = true;
    }

  bindEvents() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        window.location.href = '/technical-analysis/settings';
      });
    }

    // Table body event delegation - FIXED: Using correct selector
    const recordsTableBody = document.getElementById('records-table-body');
    if (recordsTableBody) {
      recordsTableBody.addEventListener('click', (e) => {
        // Find the closest button element
        const button = e.target.closest('button');
        if (button && button.dataset.symbol) {
          const symbol = button.dataset.symbol;
          const action = button.dataset.action;
          
          if (action === 'view' || action === 'view-detail') {
            this.showStockDetail(symbol);
          } else if (action === 'history' || action === 'view-history') {
            this.viewHistory(symbol);
          }
        }
      });
    }

    // Modal content event delegation for modal-specific buttons
    const modalContent = document.getElementById('modal-content');
    if (modalContent) {
      modalContent.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
          const action = button.dataset.action;
          const symbol = button.dataset.symbol;
          
          if (action === 'view-history' && symbol) {
            this.viewHistory(symbol);
          }
        }
      });
    }

    // Modal close button handler
    const closeButton = document.getElementById('modal-close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeModal();
      });
    }

    // Search input with debouncing
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.filterRecords(e.target.value);
        }, TechnicalAnalysisDashboard.CONFIG.SEARCH_DEBOUNCE_MS);
      });
    }

    // Score filter
    const scoreFilter = document.getElementById('score-filter');
    if (scoreFilter) {
      scoreFilter.addEventListener('change', (e) => this.filterByScore(e.target.value));
    }

    // Pagination
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    if (prevBtn) prevBtn.addEventListener('click', () => this.previousPage());
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextPage());

    // Modal events with improved handling
    const closeModal = document.getElementById('close-modal');
    const modal = document.getElementById('stock-detail-modal');
    
    if (closeModal) {
      closeModal.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeModal();
      });
    }
    
    if (modal) {
      // Close modal when clicking outside the content
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      const modalEl = document.getElementById('stock-detail-modal');
      if (e.key === 'Escape' && modalEl && !modalEl.classList.contains('hidden')) {
        this.closeModal();
      }
    });
  }

  async loadData() {
    try {
      this.showLoadingState();
      
      // Load summary data
      await this.loadSummary().catch(e => this.logError('Summary', e));
      
      // Load latest records
      await this.loadLatestRecords().catch(e => this.logError('Latest Records', e));
      
      // Load charts
      await this.loadCharts().catch(e => this.logError('Charts', e));
      
      // Load top stocks
      await this.loadTopStocks().catch(e => this.logError('Top Stocks', e));
      
      this.hideLoadingState();
    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Failed to load technical analysis data. Please try again.');
    }
  }

  /**
   * Load summary statistics
   */
  async loadSummary() {
    try {
      const response = await fetch('/technical-analysis/summary', {
        signal: AbortSignal.timeout(TechnicalAnalysisDashboard.CONFIG.API_TIMEOUT_MS)
      });
      
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      
      const data = await response.json();
      
      if (data.success) {
        const totalStocks = data.summary?.total_stocks || 0;
        const avgScore = data.summary?.avg_score || 0;
        
        // Add defensive checks for all DOM elements
        const totalStocksEl = document.getElementById('total-stocks');
        const avgScoreEl = document.getElementById('avg-score');
        const lastUpdatedEl = document.getElementById('last-updated');
        const strongSignalsEl = document.getElementById('strong-signals');
        
        if (totalStocksEl) {
          totalStocksEl.textContent = totalStocks.toString();
        } else {
          console.warn('Element with id "total-stocks" not found');
        }
        
        if (avgScoreEl) {
          avgScoreEl.textContent = avgScore ? avgScore.toFixed(1) : '0';
        } else {
          console.warn('Element with id "avg-score" not found');
        }
        
        if (lastUpdatedEl) {
          lastUpdatedEl.textContent = new Date().toLocaleTimeString();
        } else {
          console.warn('Element with id "last-updated" not found');
        }
        
        // Count strong signals (score >= 70)
        const strongSignals = data.distribution?.filter(d => 
          d.category.includes('Strong') || d.category.includes('70')
        ).reduce((sum, d) => sum + d.count, 0) || 0;
        
        if (strongSignalsEl) {
          strongSignalsEl.textContent = strongSignals.toString();
        } else {
          console.warn('Element with id "strong-signals" not found');
        }
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  }

  /**
   * Load latest technical analysis records
   */
  async loadLatestRecords() {
    try {
      const response = await fetch('/technical-analysis/latest', {
        signal: AbortSignal.timeout(TechnicalAnalysisDashboard.CONFIG.API_TIMEOUT_MS)
      });
      
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      
      const data = await response.json();
      
      if (data.success) {
        this.allRecords = data.data || [];
        this.filteredRecords = [...this.allRecords];
        this.totalRecords = this.filteredRecords.length;
        this.renderTable();
        this.updatePagination();
      }
    } catch (error) {
      console.error('Error loading latest records:', error);
      this.showError('Failed to load technical analysis records');
    }
  }

  /**
   * Load chart data
   */
  async loadCharts() {
    try {
      const response = await fetch('/technical-analysis/summary', {
        signal: AbortSignal.timeout(TechnicalAnalysisDashboard.CONFIG.API_TIMEOUT_MS)
      });
      
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      
      const data = await response.json();
      
      if (data.success && data.distribution) {
        this.renderScoreDistributionChart(data.distribution);
      }
    } catch (error) {
      console.error('Error loading charts:', error);
    }
  }

  /**
   * Load top performing stocks
   */
  async loadTopStocks() {
    try {
      const response = await fetch(
        `/technical-analysis/top-performing?limit=${TechnicalAnalysisDashboard.CONFIG.TOP_STOCKS_LIMIT}`,
        { signal: AbortSignal.timeout(TechnicalAnalysisDashboard.CONFIG.API_TIMEOUT_MS) }
      );
      
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      
      const data = await response.json();
      
      if (data.success) {
        this.renderTopStocks(data.data || []);
      }
    } catch (error) {
      console.error('Error loading top stocks:', error);
    }
  }

  /**
   * Log API errors in user-friendly format
   */
  logError(source, error) {
    console.error(`${source} Error:`, error);
  }

  /**
   * Render score distribution chart - FIXED: Responsive, professional styling, proper cleanup
   */
  renderScoreDistributionChart(distribution) {
    const ctx = document.getElementById('score-distribution-chart');
    if (!ctx) return;

    // Destroy existing chart if it exists - prevent memory leaks
    if (this.scoreDistributionChart) {
      try {
        this.scoreDistributionChart.destroy();
      } catch (e) {
        console.warn('Error destroying previous chart:', e);
      }
      this.scoreDistributionChart = null;
    }

    const categories = distribution.map(d => d.category);
    const counts = distribution.map(d => d.count);

    try {
      this.scoreDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: categories,
          datasets: [{
            data: counts,
            backgroundColor: [
              TechnicalAnalysisDashboard.COLORS.STRONG,
              TechnicalAnalysisDashboard.COLORS.MODERATE,
              TechnicalAnalysisDashboard.COLORS.WEAK
            ],
            borderColor: '#ffffff',
            borderWidth: 2,
            borderRadius: 4,
            spacing: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                usePointStyle: true,
                font: {
                  size: 12,
                  weight: '500'
                },
                color: '#374151'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: { size: 14, weight: 'bold' },
              bodyFont: { size: 13 },
              callbacks: {
                label: function(context) {
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((context.parsed / total) * 100).toFixed(1);
                  return `${context.label}: ${context.parsed} (${percentage}%)`;
                }
              }
            },
            datalabels: {
              color: '#ffffff',
              font: {
                weight: 'bold',
                size: 13
              }
            }
          },
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: TechnicalAnalysisDashboard.CONFIG.CHART_ANIMATION_DURATION
          }
        }
      });
    } catch (error) {
      console.error('Error creating score distribution chart:', error);
    }
  }

  /**
   * Render top performing stocks list
   */
  renderTopStocks(stocks) {
    const container = document.getElementById('top-stocks-list');
    if (!container) return;

    if (stocks.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-8">No stock data available</p>';
      return;
    }

    container.innerHTML = stocks.map(stock => {
      const score = stock.technical_score || 0;
      const scoreColor = score >= TechnicalAnalysisDashboard.CONFIG.SCORE_STRONG ? 'bg-green-100 text-green-800' : 
                         score >= TechnicalAnalysisDashboard.CONFIG.SCORE_MODERATE ? 'bg-yellow-100 text-yellow-800' : 
                         'bg-red-100 text-red-800';
      
      return `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" 
             data-symbol="${stock.symbol}">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-900 truncate">${stock.symbol}</div>
            <div class="text-sm text-gray-600 mt-1">Score: <span class="font-medium">${score}</span></div>
          </div>
          <div class="flex items-center ml-4 gap-2">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${scoreColor}">
              ${score}
            </span>
            <button data-symbol="${stock.symbol}" data-action="view-detail" 
                    class="inline-flex items-center p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View stock details">
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render table with all technical analysis records - FIXED: Better styling, mobile responsive
   */
  renderTable() {
    const tbody = document.getElementById('records-table-body');
    if (!tbody) {
      console.error('Table body element not found');
      return;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const pageRecords = this.filteredRecords.slice(startIndex, endIndex);

    if (pageRecords.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-12 text-center">
            <div class="text-gray-500">
              <svg class="mx-auto h-12 w-12 text-gray-400 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p class="text-sm font-medium">No records found</p>
              <p class="text-xs text-gray-400 mt-1">Try adjusting your filters or refresh the data</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageRecords.map(record => {
      const score = record.technical_score || 0;
      const scoreColor = score >= TechnicalAnalysisDashboard.CONFIG.SCORE_STRONG ? 'bg-green-100 text-green-800' : 
                         score >= TechnicalAnalysisDashboard.CONFIG.SCORE_MODERATE ? 'bg-yellow-100 text-yellow-800' : 
                         'bg-red-100 text-red-800';
      
      return `
        <tr class="hover:bg-blue-50 transition-colors border-b border-gray-200">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
            ${record.symbol}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 max-w-xs truncate" title="${this.getCompanyName(record.symbol)}">
            ${this.getCompanyName(record.symbol)}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${scoreColor}">
              ${score}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
            ${record.rsi ? record.rsi.toFixed(2) : '--'}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
            ${record.macd ? record.macd.toFixed(4) : '--'}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
            <time datetime="${record.calculation_timestamp}">
              ${new Date(record.calculation_timestamp).toLocaleTimeString()}
            </time>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
            <button data-symbol="${record.symbol}" data-action="view" 
                    class="text-blue-600 hover:text-blue-900 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                    title="View detailed analysis">
              View
            </button>
            <button data-symbol="${record.symbol}" data-action="history" 
                    class="text-green-600 hover:text-green-900 hover:underline focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1"
                    title="View historical data">
              History
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Filter records by search term with debouncing
   */
  filterRecords(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      this.filteredRecords = [...this.allRecords];
    } else {
      this.filteredRecords = this.allRecords.filter(record => 
        record.symbol.toLowerCase().includes(term) ||
        this.getCompanyName(record.symbol).toLowerCase().includes(term)
      );
    }
    
    this.currentPage = 1;
    this.totalRecords = this.filteredRecords.length;
    this.renderTable();
    this.updatePagination();
  }

  /**
   * Filter records by minimum technical score
   */
  filterByScore(minScore) {
    if (!minScore) {
      this.filteredRecords = [...this.allRecords];
    } else {
      const threshold = parseInt(minScore);
      this.filteredRecords = this.allRecords.filter(record => 
        record.technical_score >= threshold
      );
    }
    
    this.currentPage = 1;
    this.totalRecords = this.filteredRecords.length;
    this.renderTable();
    this.updatePagination();
  }

  /**
   * Navigate to previous page
   */
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderTable();
      this.updatePagination();
      this.scrollToTable();
    }
  }

  /**
   * Navigate to next page
   */
  nextPage() {
    const totalPages = Math.ceil(this.totalRecords / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderTable();
      this.updatePagination();
      this.scrollToTable();
    }
  }

  /**
   * Scroll table into view when paginating
   */
  scrollToTable() {
    const table = document.querySelector('table');
    if (table) {
      table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Update pagination UI and button states
   */
  updatePagination() {
    const totalPages = Math.ceil(this.totalRecords / this.pageSize);
    const startIndex = this.totalRecords === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const endIndex = Math.min(this.currentPage * this.pageSize, this.totalRecords);
    
    const showingStart = document.getElementById('showing-start');
    const showingEnd = document.getElementById('showing-end');
    const totalRecords = document.getElementById('total-records');
    
    if (showingStart) showingStart.textContent = startIndex.toString();
    if (showingEnd) showingEnd.textContent = endIndex.toString();
    if (totalRecords) totalRecords.textContent = this.totalRecords.toString();
    
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) prevBtn.disabled = this.currentPage === 1;
    if (nextBtn) nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
  }

  /**
   * Show stock detail modal - FIXED: Proper loading and error handling
   */
  async showStockDetail(symbol) {
    if (!symbol || typeof symbol !== 'string') {
      console.error('Invalid symbol:', symbol);
      return;
    }

    try {
      const response = await fetch(`/technical-analysis/history-api/${encodeURIComponent(symbol)}?limit=1`, {
        signal: AbortSignal.timeout(TechnicalAnalysisDashboard.CONFIG.API_TIMEOUT_MS)
      });
      
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        const record = data.data[0];
        this.renderStockDetailModal(symbol, record);
        this.showModal();
      } else {
        this.showError('No data available for this stock');
      }
    } catch (error) {
      console.error('Error loading stock detail:', error);
      this.showError('Failed to load stock details. Please try again.');
    }
  }

  /**
   * Render stock detail modal content - FIXED: Professional styling, better organization
   */
  renderStockDetailModal(symbol, record) {
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-stock-symbol');
    
    if (!modalContent || !modalTitle) return;

    modalTitle.textContent = `${symbol} - Technical Analysis`;

    const formatValue = (val, decimals = 2) => val ? parseFloat(val).toFixed(decimals) : '--';

    modalContent.innerHTML = `
      <div class="space-y-6">
        <!-- Key Indicators Section -->
        <div>
          <h4 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            Key Indicators
          </h4>
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="text-xs font-medium text-gray-600 uppercase tracking-wider">Technical Score</p>
              <p class="text-2xl font-bold text-blue-600 mt-2">${record.technical_score || '--'}</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg border border-purple-100">
              <p class="text-xs font-medium text-gray-600 uppercase tracking-wider">RSI (14)</p>
              <p class="text-2xl font-bold text-purple-600 mt-2">${formatValue(record.rsi, 2)}</p>
            </div>
            <div class="bg-pink-50 p-4 rounded-lg border border-pink-100">
              <p class="text-xs font-medium text-gray-600 uppercase tracking-wider">MACD</p>
              <p class="text-2xl font-bold text-pink-600 mt-2">${formatValue(record.macd, 4)}</p>
            </div>
            <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
              <p class="text-xs font-medium text-gray-600 uppercase tracking-wider">SMA 20</p>
              <p class="text-2xl font-bold text-indigo-600 mt-2">${formatValue(record.sma20, 2)}</p>
            </div>
          </div>
        </div>

        <!-- Additional Metrics Section -->
        <div>
          <h4 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            Additional Metrics
          </h4>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span class="text-sm font-medium text-gray-700">SMA 50</span>
              <span class="font-mono text-sm font-semibold text-gray-900">${formatValue(record.sma50, 2)}</span>
            </div>
            <div class="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span class="text-sm font-medium text-gray-700">ATR</span>
              <span class="font-mono text-sm font-semibold text-gray-900">${formatValue(record.atr, 2)}</span>
            </div>
            <div class="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span class="text-sm font-medium text-gray-700">Stoch %K</span>
              <span class="font-mono text-sm font-semibold text-gray-900">${formatValue(record.stochastic_k, 2)}</span>
            </div>
            <div class="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span class="text-sm font-medium text-gray-700">Williams %R</span>
              <span class="font-mono text-sm font-semibold text-gray-900">${formatValue(record.williams_r, 2)}</span>
            </div>
            <div class="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span class="text-sm font-medium text-gray-700">ROC</span>
              <span class="font-mono text-sm font-semibold text-gray-900">${formatValue(record.roc, 2)}</span>
            </div>
            <div class="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span class="text-sm font-medium text-gray-700">Last Updated</span>
              <span class="font-mono text-sm font-semibold text-gray-900">${new Date(record.calculation_timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 pt-4 border-t border-gray-200">
          <button data-symbol="${symbol}" data-action="view-history" 
                  class="flex-1 inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
            <svg class="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z" />
            </svg>
            View Full History
          </button>
          <button id="modal-close-button" class="inline-flex items-center px-4 py-3 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
            Close
          </button>
        </div>
      </div>
    `;
  }

  /**
   * View full history for a stock - FIXED: Proper navigation with symbol parameter
   */
  viewHistory(symbol) {
    if (!symbol || typeof symbol !== 'string') {
      console.error('Invalid symbol for history view:', symbol);
      return;
    }

    this.closeModal();
    // Use proper URL encoding and parameter format
    window.location.href = `/technical-analysis/history?symbol=${encodeURIComponent(symbol)}`;
  }

  /**
   * Show modal with animation - FIXED: CSP-compliant, no inline styles
   */
  showModal() {
    const modal = document.getElementById('stock-detail-modal');
    if (modal) {
      // Remove hidden class to show modal
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  /**
   * Close modal with animation - FIXED: CSP-compliant, no inline styles
   */
  closeModal() {
    const modal = document.getElementById('stock-detail-modal');
    if (modal) {
      // Add hidden class to hide modal
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  /**
   * Refresh all dashboard data - FIXED: Better loading state and error handling
   */
  async refreshData() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (!refreshBtn) return;

    const originalHTML = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Refreshing...
    `;
    refreshBtn.disabled = true;

    try {
      await this.loadData();
      this.showSuccess('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.showError('Failed to refresh data. Please try again.');
    } finally {
      // Restore button
      refreshBtn.innerHTML = originalHTML;
      refreshBtn.disabled = false;
    }
  }

  /**
   * Show loading state on elements
   */
  showLoadingState() {
    const elements = document.querySelectorAll('[id$="-list"], [id$="-table-body"]');
    elements.forEach(el => {
      if (!el.innerHTML.includes('animate-pulse')) {
        el.innerHTML = `
          <div class="animate-pulse space-y-2">
            <div class="h-4 bg-gray-200 rounded w-3/4"></div>
            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        `;
      }
    });
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    // Loading states removed when actual data renders
  }

  /**
   * Show success notification - FIXED: Using toast-like notifications
   */
  showSuccess(message) {
    console.log('Success:', message);
    // Could integrate with a toast notification library here
  }

  /**
   * Show error notification - FIXED: Better user feedback
   */
  showError(message) {
    console.error('Error:', message);
    // In production, use a proper toast/notification library like Toastify
    // For now, log to console and optionally alert
    if (typeof Toastify !== 'undefined') {
      Toastify({
        text: message,
        duration: 4000,
        gravity: 'top',
        position: 'right',
        backgroundColor: '#EF4444',
        close: true
      }).showToast();
    } else {
      console.warn('Toast library not available');
    }
  }

  /**
   * Get company name from symbol - FIXED: Expanded mapping with fallback
   * Should ideally fetch from backend API
   */
  getCompanyName(symbol) {
    // Check cache first
    if (this.companyNameCache[symbol]) {
      return this.companyNameCache[symbol];
    }

    // Comprehensive company mapping for Indian stocks
    const companyMap = {
      'RELIANCE': 'Reliance Industries Limited',
      'TCS': 'Tata Consultancy Services',
      'INFY': 'Infosys Limited',
      'HDFCBANK': 'HDFC Bank Limited',
      'ICICIBANK': 'ICICI Bank Limited',
      'AXISBANK': 'Axis Bank Limited',
      'BAJAJFINSV': 'Bajaj Finserv Limited',
      'MARUTI': 'Maruti Suzuki India Limited',
      'SUNPHARMA': 'Sun Pharmaceutical Industries',
      'ASIANPAINT': 'Asian Paints (India) Limited',
      'NESTLEIND': 'Nestlé India Limited',
      'LTTS': 'L&T Technology Services Limited',
      'TECHM': 'Tech Mahindra Limited',
      'WIPRO': 'Wipro Limited',
      'LT': 'Larsen & Toubro Limited',
      'BHARTIARTL': 'Bharti Airtel Limited',
      'JSWSTEEL': 'JSW Steel Limited',
      'HINDUNILVR': 'Hindustan Unilever Limited',
      'SBIN': 'State Bank of India',
      'ITC': 'ITC Limited'
    };

    const companyName = companyMap[symbol] || symbol;
    this.companyNameCache[symbol] = companyName;
    return companyName;
  }
}

/**
 * Initialize the dashboard when the page loads
 * FIXED: Better initialization with proper timing and error handling
 */
let technicalAnalysisDashboard;

function initializeTechnicalAnalysisDashboard() {
  try {
    // CRITICAL: Check if we're on the correct page FIRST
    const isTechDashboardPath = window.location.pathname === '/technical-analysis/dashboard';
    if (!isTechDashboardPath) {
      console.log('Not on technical analysis dashboard path, skipping initialization');
      return;
    }
    
    // Increased delay to ensure HTML content is fully rendered
    setTimeout(() => {
      // Debug: Check current path and page content
      console.log('Current path:', window.location.pathname);
      console.log('Document title:', document.title);
      console.log('Main content exists:', !!document.querySelector('main'));
      
      // Additional check to ensure required elements exist
      const requiredElements = [
        'total-stocks',
        'avg-score',
        'last-updated',
        'strong-signals',
        'records-table-body'
      ];
      
      const missingElements = requiredElements.filter(id => !document.getElementById(id));
      
      if (missingElements.length > 0) {
        console.warn('Required elements missing, retrying initialization:', missingElements);
        
        // Add maximum retry limit to prevent infinite loops
        if (!window.techDashboardRetryCount) {
          window.techDashboardRetryCount = 0;
        }
        
        window.techDashboardRetryCount++;
        
        if (window.techDashboardRetryCount > 5) {
          console.error('Maximum retry attempts reached, giving up on technical analysis dashboard initialization');
          console.log('Current URL:', window.location.href);
          console.log('Document title:', document.title);
          console.log('Available elements with IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
          console.log('Main content HTML snippet:', document.querySelector('main')?.innerHTML?.substring(0, 200) + '...');
          return;
        }
        
        // Retry after a longer delay
        setTimeout(() => initializeTechnicalAnalysisDashboard(), 300);
        return;
      }
      
      // Reset retry counter on successful initialization
      window.techDashboardRetryCount = 0;
      
      technicalAnalysisDashboard = new window.TechnicalAnalysisDashboard();
      console.log('Technical Analysis Dashboard initialized successfully');
    }, 150);
  } catch (error) {
    console.error('Failed to initialize Technical Analysis Dashboard:', error);
  }
}

// Handle page load - check readyState to support both initial load and SPA navigation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTechnicalAnalysisDashboard);
} else {
  // DOM is already ready (happens on SPA navigation after script reload)
  setTimeout(initializeTechnicalAnalysisDashboard, 50);
}

// Cleanup function for technical analysis dashboard
function cleanupTechnicalAnalysisDashboard() {
  console.log('Cleaning up technical analysis dashboard...');
  
  if (window.technicalAnalysisDashboard) {
    // Clear search timeout
    if (window.technicalAnalysisDashboard.searchTimeout) {
      clearTimeout(window.technicalAnalysisDashboard.searchTimeout);
      window.technicalAnalysisDashboard.searchTimeout = null;
    }
    
    // Destroy chart if exists
    if (window.technicalAnalysisDashboard.scoreDistributionChart) {
      window.technicalAnalysisDashboard.scoreDistributionChart.destroy();
      window.technicalAnalysisDashboard.scoreDistributionChart = null;
    }
    
    // Clear instance
    window.technicalAnalysisDashboard = null;
  }
  
  console.log('Technical analysis dashboard cleanup complete');
}

// Register cleanup with router
if (window.spaRouter) {
  window.spaRouter.registerCleanup('/technical-analysis/dashboard', cleanupTechnicalAnalysisDashboard);
}

// Listen for SPA navigation events
window.addEventListener('spa:navigated', (event) => {
  console.log('SPA navigation detected');
  console.log('Current path:', window.location.pathname);
  
  // Path-based check is PRIMARY - must include the exact path
  const isTechDashboardPath = window.location.pathname === '/technical-analysis/dashboard';
  
  // Only if path matches, do additional element checks
  const isTechDashboard = isTechDashboardPath && (
    document.getElementById('records-table-body') || 
    document.getElementById('avg-score') ||
    document.getElementById('refresh-btn')
  );
  
  console.log('Is TA Dashboard path:', isTechDashboardPath);
  console.log('Is TA Dashboard (with elements):', isTechDashboard);
  
  if (isTechDashboard) {
    console.log('On technical analysis dashboard, reinitializing...');
    // Reset retry counter for new navigation
    window.techDashboardRetryCount = 0;
    // Increased delay for SPA navigation to ensure DOM is ready
    setTimeout(() => {
      initializeTechnicalAnalysisDashboard();
    }, 250);
  } else {
    console.log('Not on technical analysis dashboard - skipping initialization');
    // Clean up any existing dashboard instance
    if (window.technicalAnalysisDashboard) {
      console.log('Cleaning up technical analysis dashboard instance');
      cleanupTechnicalAnalysisDashboard();
    }
  }
});

// Handle page visibility to refresh data when tab becomes active
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && technicalAnalysisDashboard && !technicalAnalysisDashboard.isInitialized === false) {
    console.log('Page became visible, refreshing data...');
    // Optionally refresh data when user returns to the tab
    // technicalAnalysisDashboard.refreshData();
  }
});
})();