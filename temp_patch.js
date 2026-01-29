// Function to close the technical analysis modal
function closeTechnicalAnalysisModal() {
  const taModal = document.getElementById('ta-modal');

  if (taModal) {
    // Destroy any existing charts to prevent memory leaks
    if (window.taCharts) {
      Object.values(window.taCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
          chart.destroy();
        }
      });
      window.taCharts = {};
    }
    
    taModal.remove();
    document.body.style.overflow = ''; // Restore scrolling
  }
}
