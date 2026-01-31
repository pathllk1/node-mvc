// SPA Client Router - Enables single-page application behavior without page reloads
class SPARouter {
  constructor() {
    this.isInitialized = false;
    this.currentPath = window.location.pathname;
    this.pendingScripts = new Set(); // Track scripts currently loading
    this.scriptLoadPromises = new Map(); // Cache script load promises
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    
    // Intercept all link clicks
    document.addEventListener('click', this.handleLinkClick.bind(this));
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', this.handlePopState.bind(this));
    
    // Handle form submissions
    document.addEventListener('submit', this.handleFormSubmit.bind(this));
    
    this.isInitialized = true;
    console.log('SPA Router initialized');
  }

  handleLinkClick(event) {
    // Check if the clicked element is a link
    const link = event.target.closest('a');
    if (!link) return;

    // Get the href and current origin
    const href = link.href;
    const url = new URL(href);
    
    // Only intercept same-origin links
    if (url.origin !== window.location.origin) return;
    
    // Don't intercept links with target="_blank" or other targets
    if (link.target && link.target !== '_self') return;
    
    // Don't intercept links with special attributes
    if (link.hasAttribute('download') || link.getAttribute('rel') === 'external') return;
    
    // Prevent default navigation
    event.preventDefault();
    
    // Navigate to the new path
    this.navigate(url.pathname + url.search);
  }

  handleFormSubmit(event) {
    // Check if the form is submitting to the same origin
    const form = event.target;
    if (!form || !form.action) return;
    
    const url = new URL(form.action);
    if (url.origin !== window.location.origin) return;
    
    // Only handle GET and POST methods for now
    const method = (form.method || 'get').toLowerCase();
    if (!['get', 'post'].includes(method)) return;
    
    event.preventDefault();
    
    // Handle form submission via AJAX
    this.submitForm(form, method);
  }

  async submitForm(form, method) {
    const formData = new FormData(form);
    const action = form.action;
    const params = new URLSearchParams(formData).toString();
    
    let url = action;
    if (method === 'get') {
      url = `${action}${params ? '?' + params : ''}`;
    }
    
    try {
      await this.loadPage(url);
    } catch (error) {
      console.error('Form submission failed:', error);
      // Fallback to regular form submission
      form.submit();
    }
  }

  async navigate(path, shouldPushState = true) {
    if (this.currentPath === path) return;
    
    try {
      // Update the current path
      this.currentPath = path;
      
      // Load the new page content
      await this.loadPage(path);
      
      // Update browser history if needed
      if (shouldPushState) {
        history.pushState({ path }, '', path);
      }
    } catch (error) {
      console.error('Navigation failed:', error);
      // Fallback to regular navigation
      window.location.href = path;
    }
  }

  async loadPage(url) {
    // Show loading indicator
    this.showLoading();
    
    try {
      // Fetch the new page content
      const response = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract the main content from the new page
      const newMainContent = doc.querySelector('main') || doc.body;
      const currentMainContent = document.querySelector('main') || document.body;
      
      if (currentMainContent && newMainContent) {
        // Remove script tags from the new content to prevent re-execution
        const newContent = newMainContent.cloneNode(true);
        const scripts = newContent.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Preserve the layout structure and just update the main content
        currentMainContent.innerHTML = newContent.innerHTML;
      } else {
        // If we can't find main content, update the whole body
        // Remove script tags from the new content to prevent re-execution
        const newBody = doc.body.cloneNode(true);
        const scripts = newBody.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        document.body.innerHTML = newBody.innerHTML;
      }
      
      // Update the title
      const newTitle = doc.title;
      if (newTitle) {
        document.title = newTitle;
      }
      
      // Update any layout elements that might have changed
      this.updateLayoutElements(doc);
      
      // Execute scripts from the new page content with proper dependency management
      await this.executeScriptsFromDocument(doc);
      
      // Dispatch a custom event for other components to react to the page change
      window.dispatchEvent(new CustomEvent('spa:navigated', { detail: { url } }));
      
      // Scroll to top after navigation
      window.scrollTo(0, 0);
      
    } catch (error) {
      console.error('Failed to load page:', error);
      throw error;
    } finally {
      // Hide loading indicator
      this.hideLoading();
    }
  }

  updateLayoutElements(newDoc) {
    // Update navbar if it exists in the new document
    const newNavbar = newDoc.querySelector('#navbar-placeholder');
    const currentNavbar = document.querySelector('#navbar-placeholder');
    if (newNavbar && currentNavbar) {
      currentNavbar.innerHTML = newNavbar.innerHTML;
    }
    
    // Update footer if it exists in the new document
    const newFooter = newDoc.querySelector('#footer-placeholder');
    const currentFooter = document.querySelector('#footer-placeholder');
    if (newFooter && currentFooter) {
      currentFooter.innerHTML = newFooter.innerHTML;
    }
  }
  
  /**
   * Load an external script and return a promise that resolves when it's loaded
   */
  loadExternalScript(src) {
    // Check if we already have a promise for this script
    if (this.scriptLoadPromises.has(src)) {
      return this.scriptLoadPromises.get(src);
    }
    
    // Check if script already exists in DOM
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      // If it exists and has loaded, resolve immediately
      if (existingScript.hasAttribute('data-loaded')) {
        return Promise.resolve();
      }
      // If it's currently loading, wait for it
      if (this.pendingScripts.has(src)) {
        return this.scriptLoadPromises.get(src);
      }
    }
    
    // Create a promise for loading this script
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false; // Ensure scripts execute in order
      
      script.onload = () => {
        script.setAttribute('data-loaded', 'true');
        this.pendingScripts.delete(src);
        console.log('Script loaded successfully:', src);
        resolve();
      };
      
      script.onerror = () => {
        this.pendingScripts.delete(src);
        this.scriptLoadPromises.delete(src);
        console.error('Script failed to load:', src);
        reject(new Error(`Failed to load script: ${src}`));
      };
      
      this.pendingScripts.add(src);
      document.head.appendChild(script);
    });
    
    this.scriptLoadPromises.set(src, promise);
    return promise;
  }
  
  /**
   * Execute scripts from the document with proper dependency management
   */
  async executeScriptsFromDocument(doc) {
    // Initialize the set of executed scripts if it doesn't exist
    if (!window.executedScripts) {
      window.executedScripts = new Set();
    }
    
    // Find all script tags in the new document
    const scripts = Array.from(doc.querySelectorAll('script'));
    
    // Separate scripts into external and inline
    const externalScripts = scripts.filter(s => s.src);
    const inlineScripts = scripts.filter(s => !s.src);
    
    // Group scripts by reload strategy
    const alwaysReloadScripts = [];
    const normalExternalScripts = [];
    
    for (const script of externalScripts) {
      const shouldAlwaysReload = script.hasAttribute('data-reload-on-spa');
      if (shouldAlwaysReload) {
        alwaysReloadScripts.push(script);
      } else {
        normalExternalScripts.push(script);
      }
    }
    
    console.log('Script execution plan:', {
      total: scripts.length,
      external: externalScripts.length,
      inline: inlineScripts.length,
      alwaysReload: alwaysReloadScripts.length,
      normal: normalExternalScripts.length
    });
    
    // Step 1: Load normal external scripts IN ORDER (respecting dependencies)
    for (const script of normalExternalScripts) {
      const src = script.src;
      const scriptId = src;
      
      // Check if this script has already been loaded
      if (window.executedScripts.has(scriptId)) {
        console.log('Skipping already loaded script:', scriptId);
        continue;
      }
      
      try {
        console.log('Loading external script:', src);
        await this.loadExternalScript(src);
        window.executedScripts.add(scriptId);
      } catch (error) {
        console.error('Failed to load script:', src, error);
      }
    }
    
    // Step 2: Handle always-reload scripts (like WebSocket-dependent scripts)
    // Remove old instances first, then load fresh
    for (const script of alwaysReloadScripts) {
      const src = script.src;
      const scriptId = src;
      
      console.log('Reloading script marked with data-reload-on-spa:', src);
      
      // Remove from executed set to allow re-execution
      window.executedScripts.delete(scriptId);
      
      // Remove existing script from DOM
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        existingScript.remove();
      }
      
      // Clear from cache
      this.scriptLoadPromises.delete(src);
      this.pendingScripts.delete(src);
      
      try {
        await this.loadExternalScript(src);
        window.executedScripts.add(scriptId);
      } catch (error) {
        console.error('Failed to reload script:', src, error);
      }
    }
    
    // Step 3: Execute inline scripts
    for (const script of inlineScripts) {
      // Create a unique identifier for this script
      const scriptContent = script.textContent || '';
      const scriptId = 'inline_' + this.hashCode(scriptContent);
      
      const shouldAlwaysReload = script.hasAttribute('data-reload-on-spa');
      
      // Check if this script has already been executed
      if (window.executedScripts.has(scriptId) && !shouldAlwaysReload) {
        console.log('Skipping already executed inline script');
        continue;
      }
      
      // Mark this script as executed
      window.executedScripts.add(scriptId);
      
      // Create a new script element
      const newScript = document.createElement('script');
      
      // Copy attributes
      for (let attr of script.attributes) {
        newScript.setAttribute(attr.name, attr.value);
      }
      
      // Copy script content
      newScript.textContent = scriptContent;
      
      // Execute and remove
      document.head.appendChild(newScript);
      document.head.removeChild(newScript);
    }
    
    // Dispatch a custom event after scripts are executed
    window.dispatchEvent(new CustomEvent('spa:scripts-executed'));
    
    console.log('All scripts executed successfully');
  }
  
  /**
   * Simple hash function for inline script content
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  handlePopState(event) {
    if (event.state && event.state.path) {
      // We handle the popstate ourselves to maintain currentPath
      this.currentPath = event.state.path;
      this.loadPage(event.state.path).catch(error => {
        console.error('Popstate navigation failed:', error);
        // Fallback to regular navigation
        window.location.href = event.state.path;
      });
    }
  }

  showLoading() {
    // Add a simple loading indicator
    if (!document.getElementById('spa-loading')) {
      const loadingEl = document.createElement('div');
      loadingEl.id = 'spa-loading';
      loadingEl.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: linear-gradient(to right, #3b82f6, #8b5cf6);
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(loadingEl);
    }
    
    const loadingEl = document.getElementById('spa-loading');
    loadingEl.style.opacity = '1';
  }

  hideLoading() {
    const loadingEl = document.getElementById('spa-loading');
    if (loadingEl) {
      loadingEl.style.opacity = '0';
      // Remove after transition completes
      setTimeout(() => {
        if (loadingEl.parentNode) {
          loadingEl.parentNode.removeChild(loadingEl);
        }
      }, 300);
    }
  }
}

// Initialize the SPA router when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.spaRouter = new SPARouter();
});

// Make it globally available for manual navigation
window.navigateTo = (path) => {
  if (window.spaRouter) {
    window.spaRouter.navigate(path);
  }
};