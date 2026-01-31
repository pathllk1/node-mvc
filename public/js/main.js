// Client-side JavaScript for the Node.js MVC application

document.addEventListener('DOMContentLoaded', function() {
    console.log('Node.js MVC Application loaded');
    
    // Handle method override for forms with confirmation
    const forms = document.querySelectorAll('form[method="POST"]');
    forms.forEach(form => {
        const methodInput = form.querySelector('input[name="_method"]');
        const confirmMessage = form.dataset.confirm;
        if (methodInput && confirmMessage) {
            form.addEventListener('submit', function(e) {
                if (!confirm(confirmMessage)) {
                    e.preventDefault();
                }
            });
        }
    });
    
    // Add padding to main content to account for fixed navbar
    const mainContent = document.querySelector('main') || document.querySelector('.container');
    if (mainContent) {
        mainContent.style.marginTop = '4rem'; // Adjust based on navbar height
    }
    
    // Example toast notifications for user actions
    // You can call these from anywhere in your application
    // showToast('Success message', 'success');
    // showToast('Info message', 'info');
    // showToast('Warning message', 'warning');
    // showToast('Error message', 'error');
});