// Client-side JavaScript for the server console
document.addEventListener('DOMContentLoaded', function() {
  // Initialize socket connection
  const socket = io();
  
  // DOM elements
  const consoleOutput = document.getElementById('consoleOutput');
  const clearConsoleBtn = document.getElementById('clearConsoleBtn');
  const toggleAutoScrollBtn = document.getElementById('toggleAutoScrollBtn');
  const connectionIndicator = document.getElementById('connectionIndicator');
  const connectionStatus = document.getElementById('connectionStatus');
  const socketId = document.getElementById('socketId');
  const totalLogsCount = document.getElementById('totalLogsCount');
  const errorLogsCount = document.getElementById('errorLogsCount');
  const infoLogsCount = document.getElementById('infoLogsCount');
  const warnLogsCount = document.getElementById('warnLogsCount');
  const socketIdDisplay = document.getElementById('socketIdDisplay');
  
  // Filter buttons
  const filterInfoBtn = document.getElementById('filterInfoBtn');
  const filterWarnBtn = document.getElementById('filterWarnBtn');
  const filterErrorBtn = document.getElementById('filterErrorBtn');
  const filterDebugBtn = document.getElementById('filterDebugBtn');
  
  // State variables
  let autoScroll = true;
  let logsCount = 0;
  let errorCount = 0;
  let infoCount = 0;
  let warnCount = 0;
  let debugCount = 0;
  
  // Log filters
  let showInfo = true;
  let showWarn = true;
  let showError = true;
  let showDebug = true;
  
  // Socket connection events
  socket.on('connect', () => {
    connectionIndicator.className = 'w-3 h-3 bg-green-500 rounded-full mr-2';
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'text-green-400';
    socketId.textContent = socket.id;
    socketIdDisplay.textContent = socket.id;
  });
  
  socket.on('disconnect', () => {
    connectionIndicator.className = 'w-3 h-3 bg-red-500 rounded-full mr-2';
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'text-red-400';
    socketId.textContent = '-';
    socketIdDisplay.textContent = '-';
  });
  
  // Listen for log messages from server
  socket.on('server-log', (data) => {
    addLogLine(data.message, data.level, data.timestamp);
  });
  
  // Add a log line to the console
  function addLogLine(message, level = 'info', timestamp = new Date()) {
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
      case 'warning':
        shouldShow = showError;
        break;
      case 'warn':
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
    totalLogsCount.textContent = logsCount;
    errorLogsCount.textContent = errorCount;
    infoLogsCount.textContent = infoCount;
    warnLogsCount.textContent = warnCount;
    
    // Auto-scroll to bottom if enabled
    if (autoScroll) {
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }
  
  // Clear console button event
  clearConsoleBtn.addEventListener('click', () => {
    consoleOutput.innerHTML = '';
    logsCount = 0;
    errorCount = 0;
    infoCount = 0;
    warnCount = 0;
    debugCount = 0;
    
    totalLogsCount.textContent = '0';
    errorLogsCount.textContent = '0';
    infoLogsCount.textContent = '0';
    warnLogsCount.textContent = '0';
    
    // Add initial message
    const initialMsg = document.createElement('div');
    initialMsg.className = 'console-line text-gray-500';
    initialMsg.textContent = '[INFO] Console cleared...';
    consoleOutput.appendChild(initialMsg);
  });
  
  // Toggle auto-scroll button event
  toggleAutoScrollBtn.addEventListener('click', () => {
    autoScroll = !autoScroll;
    const autoScrollSpan = toggleAutoScrollBtn.querySelector('span');
    if (autoScrollSpan) {
      autoScrollSpan.textContent = autoScroll ? 'ON' : 'OFF';
    }
    
    toggleAutoScrollBtn.className = autoScroll 
      ? 'px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition text-sm'
      : 'px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md transition text-sm';
    
    // Scroll to bottom if enabling auto-scroll
    if (autoScroll) {
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  });
  
  // Filter buttons functionality
  filterInfoBtn.addEventListener('click', () => {
    showInfo = !showInfo;
    filterInfoBtn.className = showInfo 
      ? 'px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition text-sm font-medium'
      : 'px-3 py-2 bg-gray-300 text-gray-500 rounded-md transition text-sm font-medium';
    updateLogVisibility();
  });
  
  filterWarnBtn.addEventListener('click', () => {
    showWarn = !showWarn;
    filterWarnBtn.className = showWarn 
      ? 'px-3 py-2 bg-gray-200 hover:bg-gray-300 text-yellow-600 rounded-md transition text-sm font-medium'
      : 'px-3 py-2 bg-gray-300 text-gray-500 rounded-md transition text-sm font-medium';
    updateLogVisibility();
  });
  
  filterErrorBtn.addEventListener('click', () => {
    showError = !showError;
    filterErrorBtn.className = showError 
      ? 'px-3 py-2 bg-gray-200 hover:bg-gray-300 text-red-600 rounded-md transition text-sm font-medium'
      : 'px-3 py-2 bg-gray-300 text-gray-500 rounded-md transition text-sm font-medium';
    updateLogVisibility();
  });
  
  filterDebugBtn.addEventListener('click', () => {
    showDebug = !showDebug;
    filterDebugBtn.className = showDebug 
      ? 'px-3 py-2 bg-gray-200 hover:bg-gray-300 text-blue-600 rounded-md transition text-sm font-medium'
      : 'px-3 py-2 bg-gray-300 text-gray-500 rounded-md transition text-sm font-medium';
    updateLogVisibility();
  });
  
  // Update visibility of all log lines based on current filters
  function updateLogVisibility() {
    const logLines = consoleOutput.querySelectorAll('.console-line');
    
    logLines.forEach(line => {
      // Extract the level from the text (between the square brackets)
      const text = line.textContent;
      const levelMatch = text.match(/\[(.*?)\]/);
      
      if (levelMatch && levelMatch[1]) {
        const level = levelMatch[1].toLowerCase();
        
        let shouldShow = true;
        switch(level) {
          case 'ERROR':
          case 'WARNING':
            shouldShow = showError;
            break;
          case 'WARN':
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
    if (autoScroll) {
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }
});