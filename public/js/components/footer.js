// Footer Component
class FooterComponent {
  constructor() {
    this.init();
  }

  init() {
    this.createFooter();
  }

  createFooter() {
    // Create the footer element
    const footer = document.createElement('footer');
    footer.className = 'fixed bottom-0 left-0 right-0 z-40';
    footer.innerHTML = `
      <div class="bg-gradient-to-r from-green-500 to-red-500 py-3">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between">
            <div class="text-white text-sm">
              &copy; 2023 Node.js MVC Application
            </div>
            <div class="text-white text-sm hidden sm:block">
              Built with ❤️ using Node.js, Express, and Tailwind CSS
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Insert into the designated placeholder
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) {
      placeholder.replaceWith(footer);
    } else {
      // Fallback to body if placeholder not found
      document.body.appendChild(footer);
    }
    
    // Add padding to the bottom of the main content to prevent overlap with fixed footer
    this.adjustMainContentPadding();
  }

  adjustMainContentPadding() {
    // Calculate the footer height and add margin to the main content
    setTimeout(() => {
      const footer = document.querySelector('footer.fixed.bottom-0');
      if (footer) {
        const footerHeight = footer.offsetHeight;
        const mainContent = document.querySelector('main') || document.querySelector('.container');
        
        if (mainContent) {
          mainContent.style.marginBottom = `${footerHeight}px`;
        }
      }
    }, 100); // Small delay to ensure footer is rendered
  }
}

// Initialize footer when DOM is loaded
function initFooter() {
  if (document.getElementById('footer-placeholder')) {
    new FooterComponent();
  } else {
    // If placeholder isn't ready, wait a bit and try again
    setTimeout(initFooter, 100);
  }
}

document.addEventListener('DOMContentLoaded', initFooter);

// Also try to initialize when the window loads (fallback)
window.addEventListener('load', initFooter);