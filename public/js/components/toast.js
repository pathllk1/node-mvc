// Toast Component
class ToastComponent {
  constructor() {
    this.toasts = [];
    this.container = null;
    this.init();
  }

  init() {
    this.createToastContainer();
  }

  createToastContainer() {
    // Create a container for toasts
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.className = 'fixed top-20 right-4 z-50 space-y-2';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 5000) {
    const toastId = Date.now().toString();
    
    const toast = document.createElement('div');
    toast.id = `toast-${toastId}`;
    toast.className = `flex items-center w-full max-w-xs p-4 mb-2 space-x-2 text-gray-500 bg-white divide-x divide-gray-200 rounded-lg shadow dark:text-gray-400 dark:divide-gray-700 ${
      type === 'success' ? 'bg-green-100 border border-green-300' : 
      type === 'error' ? 'bg-red-100 border border-red-300' : 
      type === 'warning' ? 'bg-yellow-100 border border-yellow-300' : 
      'bg-blue-100 border border-blue-300'
    }`;
    
    toast.innerHTML = `
      <div class="pl-2 pr-1">
        <svg class="w-5 h-5 ${
          type === 'success' ? 'text-green-600' : 
          type === 'error' ? 'text-red-600' : 
          type === 'warning' ? 'text-yellow-600' : 
          'text-blue-600'
        }" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/>
        </svg>
      </div>
      <div class="pr-2 text-sm font-normal">${message}</div>
      <button onclick="this.parentElement.remove()" class="ml-auto -mx-1.5 -my-1.5 text-gray-400 hover:text-gray-900 rounded-lg p-1.5 inline-flex items-center justify-center h-8 w-8">
        <span class="sr-only">Close</span>
        <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
        </svg>
      </button>
    `;
    
    this.container.appendChild(toast);
    
    // Animate the toast in
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        toast.style.transition = 'all 0.3s ease-in-out';
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      }, 10);
    }, 10);
    
    // Auto-hide the toast after specified duration
    if (duration > 0) {
      setTimeout(() => {
        this.hide(toastId);
      }, duration);
    }
    
    return toastId;
  }

  hide(toastId) {
    const toast = document.getElementById(`toast-${toastId}`);
    if (toast) {
      toast.style.transition = 'all 0.3s ease-in-out';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }
  }

  // Convenience methods for different toast types
  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 5000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }
}

// Create a global instance of the ToastComponent
let toastInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  toastInstance = new ToastComponent();
  
  // Expose the toast instance globally so other parts of the application can use it
  window.showToast = (message, type = 'info', duration = 5000) => {
    if (toastInstance) {
      return toastInstance.show(message, type, duration);
    }
  };
  
  window.hideToast = (id) => {
    if (toastInstance) {
      toastInstance.hide(id);
    }
  };
});