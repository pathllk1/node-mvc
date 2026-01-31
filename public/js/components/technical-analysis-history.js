class TechnicalAnalysisHistory {
  constructor() {
    this.symbol = this.getSymbolFromUrl();
    this.trendChart = null;
    this.initialize();
  }

  getSymbolFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('symbol') || 'RELIANCE';
  }

  async initialize() {
    // Set the symbol in the header
    const symbolElement = document.getElementById('stock-symbol');
    if (symbolElement) {
      symbolElement.textContent = this.symbol;
    }

    await this.loadStockData();
    this.bindEvents();
  }

  bindEvents() {
    const backBtn = document.getElementById('back-btn');
    const exportBtn = document.getElementById('export-btn');
    const trendPeriod = document.getElementById('trend-period');

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '/technical-analysis/dashboard';
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportData();
      });
    }

    if (trendPeriod) {
      trendPeriod.addEventListener('change', (e) => {
        this.loadTrendData(e.target.value);
      });
    }
  }

  async loadStockData() {
    try {
      const response = await fetch(`/technical-analysis/history-api/${this.symbol}?limit=100`);
      const data = await response.json();
      
      if (data.success) {
        // Update company info
        const companyElement = document.getElementById('stock-company');
        if (companyElement) {
          companyElement.textContent = `${this.symbol} Technical Analysis`;
        }
        
        // Update current score
        this.updateCurrentScore(data.data);
        
        // Load charts and tables
        this.loadCharts(data.data);
        this.loadTables(data.data);
        this.loadIndicators(data.data[0]);
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
    }
  }

  updateCurrentScore(data) {
    if (!data || data.length === 0) return;
    
    const latest = data[0];
    const scoreElement = document.getElementById('current-score');
    if (scoreElement) {
      scoreElement.innerHTML = `
        <span class="h-2 w-2 rounded-full ${latest.technical_score >= 70 ? 'bg-green-400' : latest.technical_score >= 50 ? 'bg-yellow-400' : 'bg-red-400'} mr-2"></span>
        ${latest.technical_score}
      `;
      scoreElement.className = `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
        latest.technical_score >= 70 ? 'bg-green-100 text-green-800' : 
        latest.technical_score >= 50 ? 'bg-yellow-100 text-yellow-800' : 
        'bg-red-100 text-red-800'
      }`;
    }
  }

  loadCharts(data) {
    // Score trend chart implementation
    const ctx = document.getElementById('score-trend-chart');
    if (ctx && window.Chart) {
      // Prepare chart data from the input data array
      const labels = data.map(d => new Date(d.analysis_date).toLocaleDateString('en-IN'));
      const scores = data.map(d => d.technical_score);
      
      // Destroy existing chart if present
      if (this.trendChart) {
        this.trendChart.destroy();
      }
      
      // Create new line chart
      this.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Technical Score Trend',
            data: scores,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#3B82F6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15
              }
            }
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              beginAtZero: true,
              ticks: {
                stepSize: 10
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            }
          }
        }
      });
    }
  }

  loadTables(data) {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    tbody.innerHTML = data.map(record => `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${new Date(record.calculation_timestamp).toLocaleDateString()}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            record.technical_score >= 70 ? 'bg-green-100 text-green-800' : 
            record.technical_score >= 50 ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'
          }">
            ${record.technical_score}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.rsi ? record.rsi.toFixed(2) : '--'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.macd ? record.macd.toFixed(4) : '--'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.sma20 ? record.sma20.toFixed(2) : '--'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.sma50 ? record.sma50.toFixed(2) : '--'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">--</td>
      </tr>
    `).join('');
  }

  loadIndicators(latestRecord) {
    if (!latestRecord) return;
    
    // Key indicators (most important metrics at a glance)
    const keyIndicatorsContainer = document.getElementById('key-indicators');
    if (keyIndicatorsContainer) {
      keyIndicatorsContainer.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-blue-50 rounded-lg p-3">
            <div class="text-xs text-gray-600 font-medium">RSI (Momentum)</div>
            <div class="text-lg font-bold text-blue-700">${latestRecord.rsi ? latestRecord.rsi.toFixed(2) : '--'}</div>
            <div class="text-xs text-gray-500 mt-1">${latestRecord.rsi ? (latestRecord.rsi > 70 ? 'Overbought' : latestRecord.rsi < 30 ? 'Oversold' : 'Neutral') : '--'}</div>
          </div>
          <div class="bg-green-50 rounded-lg p-3">
            <div class="text-xs text-gray-600 font-medium">MACD (Trend)</div>
            <div class="text-lg font-bold text-green-700">${latestRecord.macd ? latestRecord.macd.toFixed(4) : '--'}</div>
            <div class="text-xs text-gray-500 mt-1">${latestRecord.macd ? (latestRecord.macd > 0 ? 'Bullish' : 'Bearish') : '--'}</div>
          </div>
          <div class="bg-purple-50 rounded-lg p-3">
            <div class="text-xs text-gray-600 font-medium">ATR (Volatility)</div>
            <div class="text-lg font-bold text-purple-700">${latestRecord.atr ? latestRecord.atr.toFixed(2) : '--'}</div>
            <div class="text-xs text-gray-500 mt-1">Volatility Measure</div>
          </div>
          <div class="bg-orange-50 rounded-lg p-3">
            <div class="text-xs text-gray-600 font-medium">ROC (Rate of Change)</div>
            <div class="text-lg font-bold text-orange-700">${latestRecord.roc ? latestRecord.roc.toFixed(2) : '--'}</div>
            <div class="text-xs text-gray-500 mt-1">${latestRecord.roc ? (latestRecord.roc > 0 ? 'Uptrend' : 'Downtrend') : '--'}</div>
          </div>
        </div>
      `;
    }
    
    // Moving averages
    const maContainer = document.getElementById('moving-averages');
    if (maContainer) {
      maContainer.innerHTML = `
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">SMA 20</span>
          <span class="text-sm font-medium">${latestRecord.sma20 ? latestRecord.sma20.toFixed(2) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">SMA 50</span>
          <span class="text-sm font-medium">${latestRecord.sma50 ? latestRecord.sma50.toFixed(2) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">SMA 200</span>
          <span class="text-sm font-medium">${latestRecord.sma200 ? latestRecord.sma200.toFixed(2) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">EMA 12</span>
          <span class="text-sm font-medium">${latestRecord.ema12 ? latestRecord.ema12.toFixed(2) : '--'}</span>
        </div>
      `;
    }
    
    // Momentum indicators
    const momentumContainer = document.getElementById('momentum-indicators');
    if (momentumContainer) {
      momentumContainer.innerHTML = `
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">RSI</span>
          <span class="text-sm font-medium">${latestRecord.rsi ? latestRecord.rsi.toFixed(2) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">MACD</span>
          <span class="text-sm font-medium">${latestRecord.macd ? latestRecord.macd.toFixed(4) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">Stochastic %K</span>
          <span class="text-sm font-medium">${latestRecord.stochastic_k ? latestRecord.stochastic_k.toFixed(2) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">ROC</span>
          <span class="text-sm font-medium">${latestRecord.roc ? latestRecord.roc.toFixed(2) : '--'}</span>
        </div>
      `;
    }
    
    // Volatility indicators
    const volatilityContainer = document.getElementById('volatility-indicators');
    if (volatilityContainer) {
      volatilityContainer.innerHTML = `
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">ATR</span>
          <span class="text-sm font-medium">${latestRecord.atr ? latestRecord.atr.toFixed(2) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">Bollinger Upper</span>
          <span class="text-sm font-medium">${latestRecord.bollinger_upper ? latestRecord.bollinger_upper.toFixed(2) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">Bollinger Lower</span>
          <span class="text-sm font-medium">${latestRecord.bollinger_lower ? latestRecord.bollinger_lower.toFixed(2) : '--'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600">CCI</span>
          <span class="text-sm font-medium">${latestRecord.cci ? latestRecord.cci.toFixed(2) : '--'}</span>
        </div>
      `;
    }
  }

  async loadTrendData(days) {
    try {
      const response = await fetch(`/technical-analysis/score/${this.symbol}?days=${days}`);
      const data = await response.json();
      
      if (data.success) {
        // Update trend chart with new data
        this.updateTrendChart(data.data);
      }
    } catch (error) {
      console.error('Error loading trend data:', error);
    }
  }

  updateTrendChart(data) {
    // Chart update implementation
    if (this.trendChart && data && data.length > 0) {
      const labels = data.map(d => new Date(d.analysis_date).toLocaleDateString('en-IN'));
      const scores = data.map(d => d.technical_score);
      
      // Update chart data
      this.trendChart.data.labels = labels;
      this.trendChart.data.datasets[0].data = scores;
      this.trendChart.update();
    }
  }

  exportData() {
    // Export functionality
    alert('Export functionality would be implemented here with proper security measures');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TechnicalAnalysisHistory();
});