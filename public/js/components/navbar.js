// Navbar Component
class NavbarComponent {
  constructor() {
    this.isOpen = false;
    this.init();
  }

  init() {
    this.createNavbar();
    this.addEventListeners();
  }

  createNavbar() {
    // Create the navbar element
    const navbar = document.createElement('nav');
    navbar.className = 'fixed top-0 left-0 right-0 z-50';
    navbar.innerHTML = `
      <div class="bg-gradient-to-r from-red-500 to-green-500 shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <!-- Logo -->
            <div class="flex-shrink-0 flex items-center">
              <span class="text-white font-bold text-xl">Node.js MVC</span>
            </div>
            
            <!-- Desktop Menu -->
            <div class="hidden md:block">
              <div class="ml-10 flex items-baseline space-x-4">
                <a href="/" class="text-white hover:bg-black hover:bg-opacity-10 px-3 py-2 rounded-md text-sm font-medium transition">Home</a>
                <a href="/users" class="text-white hover:bg-black hover:bg-opacity-10 px-3 py-2 rounded-md text-sm font-medium transition">Users</a>
                <a href="/stocks/dashboard" class="text-white hover:bg-black hover:bg-opacity-10 px-3 py-2 rounded-md text-sm font-medium transition">Stocks</a>
              </div>
            </div>
            
            <!-- Mobile menu button -->
            <div class="md:hidden flex items-center">
              <button id="mobile-menu-button" class="text-white hover:bg-black hover:bg-opacity-10 p-2 rounded-md focus:outline-none">
                <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path id="menu-icon-line1" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16" />
                  <path id="menu-icon-line2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12h16" />
                  <path id="menu-icon-line3" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Mobile Menu -->
        <div id="mobile-menu" class="hidden md:hidden bg-gradient-to-r from-red-600 to-green-600">
          <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <a href="/" class="text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-black hover:bg-opacity-10">Home</a>
            <a href="/users" class="text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-black hover:bg-opacity-10">Users</a>
            <a href="/stocks/dashboard" class="text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-black hover:bg-opacity-10">Stocks</a>
          </div>
        </div>
      </div>
    `;
    
    // Insert into the designated placeholder
    const placeholder = document.getElementById('navbar-placeholder');
    if (placeholder) {
      placeholder.replaceWith(navbar);
    } else {
      // Fallback to body if placeholder not found
      document.body.insertBefore(navbar, document.body.firstChild);
    }
  }

  addEventListeners() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuButton && mobileMenu) {
      mobileMenuButton.addEventListener('click', () => {
        this.toggleMobileMenu();
      });
    }
  }

  toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
      mobileMenu.classList.toggle('hidden');
      this.isOpen = !this.isOpen;
      
      // Toggle hamburger icon
      const line1 = document.getElementById('menu-icon-line1');
      const line2 = document.getElementById('menu-icon-line2');
      const line3 = document.getElementById('menu-icon-line3');
      
      if (this.isOpen) {
        // Transform to X icon
        line1.style.transform = 'rotate(45deg) translate(5px, 5px)';
        line2.style.opacity = '0';
        line3.style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        // Reset to hamburger icon
        line1.style.transform = 'none';
        line2.style.opacity = '1';
        line3.style.transform = 'none';
      }
    }
  }
}

// Initialize navbar when DOM is loaded
function initNavbar() {
  if (document.getElementById('navbar-placeholder')) {
    new NavbarComponent();
  } else {
    // If placeholder isn't ready, wait a bit and try again
    setTimeout(initNavbar, 100);
  }
}

document.addEventListener('DOMContentLoaded', initNavbar);

// Also try to initialize when the window loads (fallback)
window.addEventListener('load', initNavbar);