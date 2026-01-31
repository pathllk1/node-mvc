class TechnicalAnalysisDashboard {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalRecords = 0;
    this.allRecords = [];
    this.filteredRecords = [];
    this.scoreDistributionChart = null;
    this.isInitialized = false;
    
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

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.filterRecords(e.target.value));
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

    // Modal events
    const closeModal = document.getElementById('close-modal');
    const modal = document.getElementById('stock-detail-modal');
    if (closeModal) closeModal.addEventListener('click', () => this.closeModal());
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal();
    });

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  }

  async loadData() {
    try {
      this.showLoadingState();
      
      // Load summary data
      await this.loadSummary();
      
      // Load latest records
      await this.loadLatestRecords();
      
      // Load charts
      await this.loadCharts();
      
      // Load top stocks
      await this.loadTopStocks();
      
      this.hideLoadingState();
    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Failed to load technical analysis data');
    }
  }

  async loadSummary() {
    try {
      const response = await fetch('/technical-analysis/summary');
      const data = await response.json();
      
      if (data.success) {
        document.getElementById('total-stocks').textContent = data.summary.total_stocks || 0;
        document.getElementById('avg-score').textContent = data.summary.avg_score ? 
          data.summary.avg_score.toFixed(1) : '0';
        document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
        
        // Count strong signals (score >= 70)
        const strongSignals = data.distribution?.find(d => d.category.includes('Strong'))?.count || 0;
        document.getElementById('strong-signals').textContent = strongSignals;
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  }

  async loadLatestRecords() {
    try {
      const response = await fetch('/technical-analysis/latest');
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
    }
  }

  async loadCharts() {
    try {
      const response = await fetch('/technical-analysis/summary');
      const data = await response.json();
      
      if (data.success && data.distribution) {
        this.renderScoreDistributionChart(data.distribution);
      }
    } catch (error) {
      console.error('Error loading charts:', error);
    }
  }

  async loadTopStocks() {
    try {
      const response = await fetch('/technical-analysis/top-performing?limit=5');
      const data = await response.json();
      
      if (data.success) {
        this.renderTopStocks(data.data || []);
      }
    } catch (error) {
      console.error('Error loading top stocks:', error);
    }
  }

  renderScoreDistributionChart(distribution) {
    const ctx = document.getElementById('score-distribution-chart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.scoreDistributionChart) {
      this.scoreDistributionChart.destroy();
    }

    const categories = distribution.map(d => d.category);
    const counts = distribution.map(d => d.count);

    this.scoreDistributionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: counts,
          backgroundColor: [
            '#10B981', // Green for Strong
            '#F59E0B', // Yellow for Moderate
            '#EF4444'  // Red for Weak
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          }
        }
      }
    });
  }

  renderTopStocks(stocks) {
    const container = document.getElementById('top-stocks-list');
    if (!container) return;

    if (stocks.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-4">No data available</p>';
      return;
    }

    container.innerHTML = stocks.map(stock => `
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
        <div>
          <div class="font-medium text-gray-900">${stock.symbol}</div>
          <div class="text-sm text-gray-500">Score: ${stock.technical_score}</div>
        </div>
        <div class="flex items-center">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            stock.technical_score >= 70 ? 'bg-green-100 text-green-800' : 
            stock.technical_score >= 50 ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'
          }">
            ${stock.technical_score}
          </span>
          <button onclick="technicalAnalysisDashboard.showStockDetail('${stock.symbol}')" 
                  class="ml-2 text-blue-600 hover:text-blue-800">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  renderTable() {
    const tbody = document.getElementById('records-table-body');
    if (!tbody) return;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const pageRecords = this.filteredRecords.slice(startIndex, endIndex);

    if (pageRecords.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-4 text-center text-gray-500">
            No records found
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageRecords.map(record => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          ${record.symbol}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${this.getCompanyName(record.symbol)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            record.technical_score >= 70 ? 'bg-green-100 text-green-800' : 
            record.technical_score >= 50 ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'
          }">
            ${record.technical_score}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${record.rsi ? record.rsi.toFixed(2) : '--'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${record.macd ? record.macd.toFixed(4) : '--'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${new Date(record.calculation_timestamp).toLocaleTimeString()}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button onclick="technicalAnalysisDashboard.showStockDetail('${record.symbol}')" 
                  class="text-blue-600 hover:text-blue-900 mr-3">
            View
          </button>
          <button onclick="technicalAnalysisDashboard.viewHistory('${record.symbol}')" 
                  class="text-green-600 hover:text-green-900">
            History
          </button>
        </td>
      </tr>
    `).join('');
  }

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

  filterByScore(minScore) {
    if (!minScore) {
      this.filteredRecords = [...this.allRecords];
    } else {
      this.filteredRecords = this.allRecords.filter(record => 
        record.technical_score >= parseInt(minScore)
      );
    }
    
    this.currentPage = 1;
    this.totalRecords = this.filteredRecords.length;
    this.renderTable();
    this.updatePagination();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderTable();
      this.updatePagination();
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.totalRecords / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderTable();
      this.updatePagination();
    }
  }

  updatePagination() {
    const totalPages = Math.ceil(this.totalRecords / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize + 1;
    const endIndex = Math.min(this.currentPage * this.pageSize, this.totalRecords);
    
    document.getElementById('showing-start').textContent = startIndex;
    document.getElementById('showing-end').textContent = endIndex;
    document.getElementById('total-records').textContent = this.totalRecords;
    
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) prevBtn.disabled = this.currentPage === 1;
    if (nextBtn) nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
  }

  async showStockDetail(symbol) {
    try {
      const response = await fetch(`/technical-analysis/history-api/${symbol}?limit=1`);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        const record = data.data[0];
        this.renderStockDetailModal(symbol, record);
        this.showModal();
      }
    } catch (error) {
      console.error('Error loading stock detail:', error);
    }
  }

  renderStockDetailModal(symbol, record) {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    modalContent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 class="text-lg font-medium text-gray-900 mb-3">Key Indicators</h4>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Technical Score</span>
              <span class="font-medium">${record.technical_score}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">RSI</span>
              <span class="font-medium">${record.rsi ? record.rsi.toFixed(2) : '--'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">MACD</span>
              <span class="font-medium">${record.macd ? record.macd.toFixed(4) : '--'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">SMA 20</span>
              <span class="font-medium">${record.sma20 ? record.sma20.toFixed(2) : '--'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">SMA 50</span>
              <span class="font-medium">${record.sma50 ? record.sma50.toFixed(2) : '--'}</span>
            </div>
          </div>
        </div>
        <div>
          <h4 class="text-lg font-medium text-gray-900 mb-3">Additional Metrics</h4>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">ATR</span>
              <span class="font-medium">${record.atr ? record.atr.toFixed(2) : '--'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Stochastic %K</span>
              <span class="font-medium">${record.stochastic_k ? record.stochastic_k.toFixed(2) : '--'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Williams %R</span>
              <span class="font-medium">${record.williams_r ? record.williams_r.toFixed(2) : '--'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">ROC</span>
              <span class="font-medium">${record.roc ? record.roc.toFixed(2) : '--'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Last Updated</span>
              <span class="font-medium">${new Date(record.calculation_timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-6 pt-6 border-t border-gray-200">
        <button onclick="technicalAnalysisDashboard.viewHistory('${symbol}')" 
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          View Full History
        </button>
      </div>
    `;
  }

  viewHistory(symbol) {
    this.closeModal();
    window.location.href = `/technical-analysis/history?symbol=${symbol}`;
  }

  showModal() {
    const modal = document.getElementById('stock-detail-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  closeModal() {
    const modal = document.getElementById('stock-detail-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  async refreshData() {
    const refreshBtn = document.getElementById('refresh-btn');
    const originalText = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Refreshing...';
    refreshBtn.disabled = true;

    try {
      await this.loadData();
    } finally {
      // Restore button
      refreshBtn.innerHTML = originalText;
      refreshBtn.disabled = false;
    }
  }

  showLoadingState() {
    // Add loading indicators where appropriate
    const elements = document.querySelectorAll('[id$="-list"], [id$="-table-body"]');
    elements.forEach(el => {
      if (el.innerHTML.includes('Loading') || el.innerHTML.includes('animate-pulse')) return;
      el.innerHTML = '<div class="animate-pulse"><div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div><div class="h-4 bg-gray-200 rounded w-1/2"></div></div>';
    });
  }

  hideLoadingState() {
    // Remove loading indicators
  }

  showError(message) {
    // In a real implementation, you'd use a proper toast/notification system
    console.error(message);
    alert(message);
  }

  getCompanyName(symbol) {
    // This would ideally come from a company mapping service
    // For now, return a placeholder
    const companyMap = {
      'RELIANCE': 'Reliance Industries',
      'TCS': 'Tata Consultancy Services',
      'INFY': 'Infosys',
      'HDFCBANK': 'HDFC Bank',
      'ICICIBANK': 'ICICI Bank'
      // Add more mappings as needed
    };
    return companyMap[symbol] || symbol;
  }
}

// Initialize the dashboard when the page loads
let technicalAnalysisDashboard;
document.addEventListener('DOMContentLoaded', () => {
  technicalAnalysisDashboard = new TechnicalAnalysisDashboard();
});