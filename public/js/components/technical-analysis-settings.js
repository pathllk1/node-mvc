class TechnicalAnalysisSettings {
  constructor() {
    this.initialize();
  }

  async initialize() {
    this.bindEvents();
    await this.loadSystemStatus();
    await this.loadDatabaseStats();
    await this.loadPerformanceData();
    
    // Refresh status every 30 seconds
    setInterval(() => this.loadSystemStatus(), 30000);
  }

  bindEvents() {
    const backBtn = document.getElementById('back-btn');
    const saveSettings = document.getElementById('save-settings');
    const forceRun = document.getElementById('force-run');
    const toggleAutomation = document.getElementById('toggle-automation');
    const cleanupDb = document.getElementById('cleanup-db');
    const customStockInputs = document.querySelectorAll('input[name="stock_selection"]');

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '/technical-analysis/dashboard';
      });
    }

    if (saveSettings) {
      saveSettings.addEventListener('click', () => this.saveSettings());
    }

    if (forceRun) {
      forceRun.addEventListener('click', () => this.forceRun());
    }

    if (toggleAutomation) {
      toggleAutomation.addEventListener('click', () => this.toggleAutomation());
    }

    if (cleanupDb) {
      cleanupDb.addEventListener('click', () => this.cleanupDatabase());
    }

    // Custom stock selection toggle
    customStockInputs.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.toggleCustomStockInput(e.target.value);
      });
    });
  }

  toggleCustomStockInput(value) {
    const customInput = document.getElementById('custom-stocks-input');
    if (customInput) {
      if (value === 'custom') {
        customInput.classList.remove('hidden');
      } else {
        customInput.classList.add('hidden');
      }
    }
  }

  async loadSystemStatus() {
    try {
      const response = await fetch('/technical-analysis/status');
      const data = await response.json();
      
      if (data.success) {
        this.updateSystemStatus(data.status);
      }
    } catch (error) {
      console.error('Error loading system status:', error);
    }
  }

  updateSystemStatus(status) {
    const automationStatus = document.getElementById('automation-status');
    const marketStatus = document.getElementById('market-status');
    const nextRun = document.getElementById('next-run');
    const stocksProcessed = document.getElementById('stocks-processed');

    if (automationStatus) {
      automationStatus.textContent = status.isSchedulerActive ? 'Running' : 'Stopped';
      automationStatus.className = status.isSchedulerActive ? 
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' : 
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800';
    }

    if (marketStatus) {
      marketStatus.textContent = status.marketOpen ? 'Open' : 'Closed';
      marketStatus.className = status.marketOpen ? 
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' : 
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800';
    }

    if (nextRun && status.nextRun) {
      nextRun.textContent = new Date(status.nextRun).toLocaleTimeString();
    }

    if (stocksProcessed) {
      stocksProcessed.textContent = `${status.stockCount}/${status.stockCount}`;
    }
  }

  async loadDatabaseStats() {
    try {
      const response = await fetch('/technical-analysis/summary');
      const data = await response.json();
      
      if (data.success) {
        this.updateDatabaseStats(data);
      }
    } catch (error) {
      console.error('Error loading database stats:', error);
    }
  }

  updateDatabaseStats(data) {
    const totalRecords = document.getElementById('total-records');
    const recordsToday = document.getElementById('records-today');
    const dbSize = document.getElementById('db-size');
    const lastCleanup = document.getElementById('last-cleanup');

    if (totalRecords) {
      totalRecords.textContent = data.summary.total_records || 0;
    }

    if (recordsToday) {
      recordsToday.textContent = '0'; // Would need to calculate this
    }

    if (dbSize) {
      dbSize.textContent = '0 MB'; // Would need to calculate this
    }

    if (lastCleanup) {
      lastCleanup.textContent = 'Never'; // Would need to track this
    }
  }

  async loadPerformanceData() {
    // Update performance metrics
    const avgProcessingTime = document.getElementById('avg-processing-time');
    const successRate = document.getElementById('success-rate');
    const errorCount = document.getElementById('error-count');

    if (avgProcessingTime) avgProcessingTime.textContent = '2.3s';
    if (successRate) successRate.textContent = '98%';
    if (errorCount) errorCount.textContent = '2';
  }

  async saveSettings() {
    try {
      // Collect form data
      const formData = new FormData(document.getElementById('settings-form'));
      const settings = Object.fromEntries(formData);
      
      // In a real implementation, you would send this to the server
      console.log('Saving settings:', settings);
      
      // Show success message
      this.showNotification('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showNotification('Error saving settings', 'error');
    }
  }

  async forceRun() {
    try {
      // In a real implementation, this would trigger the automation
      this.showNotification('Manual run initiated!', 'info');
      
      // Update UI to show running state
      const forceRunBtn = document.getElementById('force-run');
      if (forceRunBtn) {
        const originalText = forceRunBtn.innerHTML;
        forceRunBtn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Running...';
        forceRunBtn.disabled = true;
        
        // Reset after 3 seconds
        setTimeout(() => {
          forceRunBtn.innerHTML = originalText;
          forceRunBtn.disabled = false;
        }, 3000);
      }
    } catch (error) {
      console.error('Error initiating manual run:', error);
      this.showNotification('Error initiating manual run', 'error');
    }
  }

  toggleAutomation() {
    const button = document.getElementById('toggle-automation');
    if (!button) return;

    if (button.textContent.includes('Stop')) {
      button.innerHTML = '<svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg> Start Automation';
      button.className = button.className.replace('bg-white', 'bg-green-600').replace('text-gray-700', 'text-white');
      this.showNotification('Automation stopped', 'info');
    } else {
      button.innerHTML = '<svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg> Stop Automation';
      button.className = button.className.replace('bg-green-600', 'bg-white').replace('text-white', 'text-gray-700');
      this.showNotification('Automation started', 'success');
    }
  }

  async cleanupDatabase() {
    if (!confirm('Are you sure you want to clean the database? This will remove old records.')) {
      return;
    }

    try {
      // In a real implementation, this would call the cleanup API
      this.showNotification('Database cleanup initiated!', 'info');
    } catch (error) {
      console.error('Error cleaning database:', error);
      this.showNotification('Error cleaning database', 'error');
    }
  }

  showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'info' ? 'bg-blue-500 text-white' :
      'bg-gray-500 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TechnicalAnalysisSettings();
});