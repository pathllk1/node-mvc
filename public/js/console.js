// Client-side JavaScript for the server console
// Wrapped in IIFE to avoid variable conflicts on script reload

(function() {
  // Socket connection - initialized lazily when DOM is ready
  let socket = null;

  // Console state variables
  let logsCount = 0;
  let errorCount = 0;
  let infoCount = 0;
  let warnCount = 0;
  let debugCount = 0;
  let autoScroll = true;
  let showInfo = true;
  let showWarn = true;
  let showError = true;
  let showDebug = true;

  function initializeSocket() {
    if (socket) return; // Already initialized
    console.log('Initializing socket connection...');
    socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
  }

  // DOM elements - use a function to get fresh references
  function getDOMElements() {
    return {
      consoleOutput: document.getElementById('consoleOutput'),
      clearConsoleBtn: document.getElementById('clearConsoleBtn'),
      toggleAutoScrollBtn: document.getElementById('toggleAutoScrollBtn'),
      connectionIndicator: document.getElementById('connectionIndicator'),
      connectionStatus: document.getElementById('connectionStatus'),
      socketId: document.getElementById('socketId'),
      totalLogsCount: document.getElementById('totalLogsCount'),
      errorLogsCount: document.getElementById('errorLogsCount'),
      infoLogsCount: document.getElementById('infoLogsCount'),
      warnLogsCount: document.getElementById('warnLogsCount'),
      socketIdDisplay: document.getElementById('socketIdDisplay'),
      filterInfoBtn: document.getElementById('filterInfoBtn'),
      filterWarnBtn: document.getElementById('filterWarnBtn'),
      filterErrorBtn: document.getElementById('filterErrorBtn'),
      filterDebugBtn: document.getElementById('filterDebugBtn')
    };
  }

  // Function to initialize console handlers
  function initializeConsoleHandlers() {
    const elements = getDOMElements();
  
    // Only setup listeners if elements exist
    if (!elements.clearConsoleBtn) {
      console.log('Console page elements not found, skipping initialization');
      return;
    }
  
    console.log('Initializing console handlers...');
  
    // Socket connection events
    socket.off('connect'); // Remove old listeners
    socket.off('disconnect');
    socket.off('server-log');
  
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      const { connectionIndicator, connectionStatus, socketId, socketIdDisplay } = getDOMElements();
      if (connectionIndicator) connectionIndicator.className = 'w-3 h-3 bg-green-500 rounded-full mr-2';
      if (connectionStatus) {
        connectionStatus.textContent = 'Connected';
        connectionStatus.className = 'text-green-400';
      }
      if (socketId) socketId.textContent = socket.id;
      if (socketIdDisplay) socketIdDisplay.textContent = socket.id;
    });
  
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      const { connectionIndicator, connectionStatus, socketId, socketIdDisplay } = getDOMElements();
      if (connectionIndicator) connectionIndicator.className = 'w-3 h-3 bg-red-500 rounded-full mr-2';
      if (connectionStatus) {
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.className = 'text-red-400';
      }
      if (socketId) socketId.textContent = '-';
      if (socketIdDisplay) socketIdDisplay.textContent = '-';
    });
  
    // Listen for log messages from server
    socket.on('server-log', (data) => {
      addLogLine(data.message, data.level, data.timestamp);
    });
  
    // Setup button event listeners
    const { clearConsoleBtn, toggleAutoScrollBtn, filterInfoBtn, filterWarnBtn, filterErrorBtn, filterDebugBtn } = getDOMElements();
  
    // Remove old event listeners by cloning elements
    if (clearConsoleBtn) {
      const newClearBtn = clearConsoleBtn.cloneNode(true);
      clearConsoleBtn.parentNode.replaceChild(newClearBtn, clearConsoleBtn);
      getDOMElements().clearConsoleBtn.addEventListener('click', clearConsole);
    }
  
    if (toggleAutoScrollBtn) {
      const newToggleBtn = toggleAutoScrollBtn.cloneNode(true);
      toggleAutoScrollBtn.parentNode.replaceChild(newToggleBtn, toggleAutoScrollBtn);
      getDOMElements().toggleAutoScrollBtn.addEventListener('click', toggleAutoScroll);
    }
  
    if (filterInfoBtn) {
      const newFilterBtn = filterInfoBtn.cloneNode(true);
      filterInfoBtn.parentNode.replaceChild(newFilterBtn, filterInfoBtn);
      getDOMElements().filterInfoBtn.addEventListener('click', () => toggleFilter('info'));
    }
  
    if (filterWarnBtn) {
      const newFilterBtn = filterWarnBtn.cloneNode(true);
      filterWarnBtn.parentNode.replaceChild(newFilterBtn, filterWarnBtn);
      getDOMElements().filterWarnBtn.addEventListener('click', () => toggleFilter('warn'));
    }
  
    if (filterErrorBtn) {
      const newFilterBtn = filterErrorBtn.cloneNode(true);
      filterErrorBtn.parentNode.replaceChild(newFilterBtn, filterErrorBtn);
      getDOMElements().filterErrorBtn.addEventListener('click', () => toggleFilter('error'));
    }
  
    if (filterDebugBtn) {
      const newFilterBtn = filterDebugBtn.cloneNode(true);
      filterDebugBtn.parentNode.replaceChild(newFilterBtn, filterDebugBtn);
      getDOMElements().filterDebugBtn.addEventListener('click', () => toggleFilter('debug'));
    }
  
    // Ensure socket is connected
    if (socket && !socket.connected) {
      console.log('Socket not connected, attempting to connect...');
      socket.connect();
    }
  }

  // Add a log line to the console
  function addLogLine(message, level = 'info', timestamp = new Date()) {
    const { consoleOutput, totalLogsCount, errorLogsCount, infoLogsCount, warnLogsCount } = getDOMElements();
    if (!consoleOutput) return;
  
    const logLine = document.createElement('div');
    logLine.className = 'console-line py-1';
  
    // Format timestamp
    const timeStr = new Date(timestamp).toLocaleTimeString();
  
    // Add appropriate styling based on log level
    switch(level.toLowerCase()) {
      case 'error':
        logLine.classList.add('text-red-400');
        errorCount++;
        break;
      case 'warn':
      case 'warning':
        logLine.classList.add('text-yellow-600');
        warnCount++;
        break;
      case 'info':
        logLine.classList.add('text-blue-600');
        infoCount++;
        break;
      case 'debug':
        logLine.classList.add('text-gray-500');
        debugCount++;
        break;
      default:
        logLine.classList.add('text-green-600');
        break;
    }
  
    logLine.textContent = `[${timeStr}] [${level.toUpperCase()}] ${message}`;
  
    // Check if this log level should be shown based on filters
    let shouldShow = true;
    switch(level.toLowerCase()) {
      case 'error':
        shouldShow = showError;
        break;
      case 'warn':
      case 'warning':
        shouldShow = showWarn;
        break;
      case 'info':
        shouldShow = showInfo;
        break;
      case 'debug':
        shouldShow = showDebug;
        break;
    }
  
    logLine.style.display = shouldShow ? 'block' : 'none';
  
    consoleOutput.appendChild(logLine);
  
    // Update statistics
    logsCount++;
    if (totalLogsCount) totalLogsCount.textContent = logsCount;
    if (errorLogsCount) errorLogsCount.textContent = errorCount;
    if (infoLogsCount) infoLogsCount.textContent = infoCount;
    if (warnLogsCount) warnLogsCount.textContent = warnCount;
  
    // Auto-scroll to bottom if enabled
    if (autoScroll) {
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }

  function clearConsole() {
    const { consoleOutput, totalLogsCount, errorLogsCount, infoLogsCount, warnLogsCount } = getDOMElements();
    if (!consoleOutput) return;
  
    consoleOutput.innerHTML = '';
    logsCount = 0;
    errorCount = 0;
    infoCount = 0;
    warnCount = 0;
    debugCount = 0;
  
    if (totalLogsCount) totalLogsCount.textContent = '0';
    if (errorLogsCount) errorLogsCount.textContent = '0';
    if (infoLogsCount) infoLogsCount.textContent = '0';
    if (warnLogsCount) warnLogsCount.textContent = '0';
  
    // Add initial message
    const initialMsg = document.createElement('div');
    initialMsg.className = 'console-line text-gray-500';
    initialMsg.textContent = '[INFO] Console cleared...';
    consoleOutput.appendChild(initialMsg);
  }

  function toggleAutoScroll() {
    const { toggleAutoScrollBtn, consoleOutput } = getDOMElements();
    if (!toggleAutoScrollBtn) return;
  
    autoScroll = !autoScroll;
    const autoScrollSpan = toggleAutoScrollBtn.querySelector('span');
    if (autoScrollSpan) {
      autoScrollSpan.textContent = autoScroll ? 'ON' : 'OFF';
    }
  
    toggleAutoScrollBtn.className = autoScroll 
      ? 'px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition text-sm'
      : 'px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md transition text-sm';
  
    // Scroll to bottom if enabling auto-scroll
    if (autoScroll && consoleOutput) {
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }

  function toggleFilter(filterType) {
    const { filterInfoBtn, filterWarnBtn, filterErrorBtn, filterDebugBtn } = getDOMElements();
  
    switch(filterType) {
      case 'info':
        showInfo = !showInfo;
        if (filterInfoBtn) {
          filterInfoBtn.className = showInfo 
            ? 'px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition text-sm font-medium'
            : 'px-3 py-2 bg-gray-300 text-gray-500 rounded-md transition text-sm font-medium';
        }
        break;
      case 'warn':
        showWarn = !showWarn;
        if (filterWarnBtn) {
          filterWarnBtn.className = showWarn 
            ? 'px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition text-sm font-medium'
            : 'px-3 py-2 bg-gray-300 text-gray-500 rounded-md transition text-sm font-medium';
        }
        break;
      case 'error':
        showError = !showError;
        if (filterErrorBtn) {
          filterErrorBtn.className = showError 
            ? 'px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition text-sm font-medium'
            : 'px-3 py-2 bg-gray-300 text-gray-500 rounded-md transition text-sm font-medium';
        }
        break;
      case 'debug':
        showDebug = !showDebug;
        if (filterDebugBtn) {
          filterDebugBtn.className = showDebug 
            ? 'px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition text-sm font-medium'
            : 'px-3 py-2 bg-gray-300 text-gray-500 rounded-md transition text-sm font-medium';
        }
        break;
    }
  
    updateLogVisibility();
  }

  // Update visibility of all log lines based on current filters
  function updateLogVisibility() {
    const { consoleOutput } = getDOMElements();
    if (!consoleOutput) return;
  
    const logLines = consoleOutput.querySelectorAll('.console-line');
  
    logLines.forEach(line => {
      // Extract the level from the text (between the square brackets)
      const text = line.textContent;
      const levelMatch = text.match(/\[.*?\]\s+\[(.*?)\]/);
    
      if (levelMatch && levelMatch[1]) {
        const level = levelMatch[1].toUpperCase();
      
        let shouldShow = true;
        switch(level) {
          case 'ERROR':
            shouldShow = showError;
            break;
          case 'WARN':
          case 'WARNING':
            shouldShow = showWarn;
            break;
          case 'INFO':
            shouldShow = showInfo;
            break;
          case 'DEBUG':
            shouldShow = showDebug;
            break;
        }
      
        line.style.display = shouldShow ? 'block' : 'none';
      }
    });
  
    // Scroll to bottom if auto-scroll is enabled
    if (autoScroll && consoleOutput) {
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }

  // Initialize console when DOM is ready or on page load
  function initializeConsole() {
    const consoleOutput = document.getElementById('consoleOutput');
    if (!consoleOutput) {
      console.log('Console page elements not found, skipping initialization');
      return;
    }
  
    console.log('Console page initialized via DOM check');
    initializeSocket();
    initializeConsoleHandlers();
  }

  // Cleanup function for console page - proper WebSocket cleanup
  function cleanupConsole() {
    console.log('Cleaning up console page...');
    
    // Close socket connection properly
    if (socket) {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('server-log');
      socket.close();
      socket = null;
    }
    
    // Remove button event listeners
    const { clearConsoleBtn, toggleAutoScrollBtn, filterInfoBtn, filterWarnBtn, filterErrorBtn, filterDebugBtn } = getDOMElements();
    if (clearConsoleBtn) clearConsoleBtn.removeEventListener('click', clearConsole);
    if (toggleAutoScrollBtn) toggleAutoScrollBtn.removeEventListener('click', toggleAutoScroll);
    if (filterInfoBtn) filterInfoBtn.removeEventListener('click', () => toggleFilter('info'));
    if (filterWarnBtn) filterWarnBtn.removeEventListener('click', () => toggleFilter('warn'));
    if (filterErrorBtn) filterErrorBtn.removeEventListener('click', () => toggleFilter('error'));
    if (filterDebugBtn) filterDebugBtn.removeEventListener('click', () => toggleFilter('debug'));
    
    console.log('Console cleanup complete');
  }

  // Handle page load - check readyState to support both initial load and SPA navigation
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeConsole);
  } else {
    // DOM is already ready (happens on SPA navigation after script reload)
    setTimeout(initializeConsole, 50);
  }

  // Register cleanup function with SPA router
  if (window.spaRouter) {
    window.spaRouter.registerCleanup('/console', cleanupConsole);
  } else {
    // If router not ready, wait for it
    window.addEventListener('spa:router-ready', () => {
      if (window.spaRouter) {
        window.spaRouter.registerCleanup('/console', cleanupConsole);
      }
    });
  }

  // Listen for SPA navigation events
  window.addEventListener('spa:navigated', (event) => {
    console.log('SPA navigation detected on console page');
  
    const isConsolePage = window.location.pathname === '/console' || 
                          document.getElementById('consoleOutput');
  
    if (isConsolePage) {
      console.log('On console page, reinitializing...');
      setTimeout(() => {
        initializeConsole();
      }, 100);
    } else {
      console.log('Not on console page');
    }
  });
})();