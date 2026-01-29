// SPA Client Router - Enables single-page application behavior without page reloads
class SPARouter {
  constructor() {
    this.isInitialized = false;
    this.currentPath = window.location.pathname;
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
      
      // Execute scripts from the new page content
      this.executeScriptsFromDocument(doc);
      
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
  
  executeScriptsFromDocument(doc) {
    // Initialize the set of executed scripts if it doesn't exist
    if (!window.executedScripts) {
      window.executedScripts = new Set();
    }
    
    // Find all script tags in the new document
    const scripts = doc.querySelectorAll('script');
    
    scripts.forEach(script => {
      // Create a unique identifier for this script
      let scriptId;
      if (script.src) {
        // For external scripts, use the src URL
        scriptId = script.src;
      } else {
        // For inline scripts, use a hash of the content
        scriptId = 'inline_' + (script.textContent || '').substring(0, 100);
      }
      
      // Check if this script has already been executed
      if (window.executedScripts.has(scriptId)) {
        console.log('Skipping already executed script:', scriptId);
        return; // Skip already executed scripts
      }
      
      // Mark this script as executed
      window.executedScripts.add(scriptId);
      
      // Create a new script element
      const newScript = document.createElement('script');
      
      // Copy attributes
      for (let attr of script.attributes) {
        newScript.setAttribute(attr.name, attr.value);
      }
      
      // Copy script content if it's an inline script
      if (script.textContent) {
        newScript.textContent = script.textContent;
      }
      
      // For external scripts, append to head
      if (script.src) {
        document.head.appendChild(newScript);
        // Don't remove external scripts as they might be needed
      } else {
        // For inline scripts, execute and remove
        document.head.appendChild(newScript);
        document.head.removeChild(newScript);
      }
    });
    
    // Dispatch a custom event after scripts are executed
    window.dispatchEvent(new CustomEvent('spa:scripts-executed'));
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