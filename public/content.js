// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showToast') {
    showToast(message.message, message.count || 0);
  }
  return true;
});

// Create and show a toast notification
function showToast(message, count) {
  // Remove any existing toast
  const existingToast = document.getElementById('youtube-enhancer-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.id = 'youtube-enhancer-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: rgba(26, 31, 44, 0.8);
    color: white;
    padding: 12px 15px;
    border-radius: 8px;
    z-index: 9999;
    display: flex;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: Roboto, Arial, sans-serif;
    max-width: 400px;
    animation: fadeIn 0.3s, fadeOut 0.3s 4.7s;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.1);
  `;
  
  // Add check icon
  const checkIcon = document.createElement('span');
  checkIcon.innerHTML = '✅';
  checkIcon.style.marginRight = '12px';
  checkIcon.style.fontSize = '18px';
  
  // Add message text
  const messageText = document.createElement('div');
  messageText.innerHTML = `
    <div style="font-weight: 500;">${message}</div>
    <div style="font-size: 12px; color: #ccc; margin-top: 4px;">
      ${count} videos fetched. View them in your dashboard.
    </div>
  `;
  messageText.style.flexGrow = '1';
  
  // Add dashboard button
  const dashboardBtn = document.createElement('button');
  dashboardBtn.textContent = 'Open Dashboard';
  dashboardBtn.style.cssText = `
    color: white;
    margin-left: 15px;
    text-decoration: none;
    font-weight: 500;
    background-color: #ea384c;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
  `;
  dashboardBtn.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: 'openDashboard' });
  });
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: #aaa;
    font-size: 20px;
    cursor: pointer;
    padding: 0 0 0 10px;
    margin-left: 5px;
  `;
  closeButton.addEventListener('click', () => {
    toast.remove();
  });
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(20px); }
    }
  `;
  document.head.appendChild(style);
  
  // Assemble and show the toast
  toast.appendChild(checkIcon);
  toast.appendChild(messageText);
  toast.appendChild(dashboardBtn);
  toast.appendChild(closeButton);
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.remove();
    }
  }, 5000);
}

// Function to inject the "Fetch My Liked Videos" button
function injectFetchButton() {
  // Check if we're on a YouTube page
  if (!window.location.hostname.includes('youtube.com')) return;
  
  // Check if we're on the liked videos page or any page with a playlist header
  const isLikedVideosPage = window.location.href.includes('playlist?list=LL') || 
                            document.querySelector('ytd-playlist-header-renderer');
  
  if (!isLikedVideosPage) return;
  
  // Remove any existing fetch and export buttons
  const existingButton = document.getElementById('youtube-enhancer-fetch-button');
  if (existingButton) existingButton.remove();
  
  const existingExportButton = document.getElementById('youtube-enhancer-export-button');
  if (existingExportButton) existingExportButton.remove();
  
  // Create the buttons container div
  const buttonsContainer = document.createElement('div');
  buttonsContainer.id = 'youtube-enhancer-buttons-container';
  buttonsContainer.style.cssText = `
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  `;
  
  // Create the fetch button
  const fetchButton = document.createElement('button');
  fetchButton.id = 'youtube-enhancer-fetch-button';
  fetchButton.textContent = 'Fetch My Liked Videos';
  
  // Style the button to match Play All button
  fetchButton.style.cssText = `
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    border-radius: 18px;
    padding: 0 16px;
    height: 36px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Roboto, Arial, sans-serif;
    transition: background-color 0.2s;
    backdrop-filter: blur(10px);
    width: 122px; /* Match the Play All button width */
  `;
  
  // Add hover effect
  fetchButton.addEventListener('mouseenter', () => {
    fetchButton.style.backgroundColor = 'rgba(234, 56, 76, 0.8)';
  });
  
  fetchButton.addEventListener('mouseleave', () => {
    fetchButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  });
  
  // Create the export button
  const exportButton = document.createElement('button');
  exportButton.id = 'youtube-enhancer-export-button';
  exportButton.textContent = 'Export All Videos';
  
  // Style the export button to match the fetch button
  exportButton.style.cssText = `
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    border-radius: 18px;
    padding: 0 16px;
    height: 36px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Roboto, Arial, sans-serif;
    transition: background-color 0.2s;
    backdrop-filter: blur(10px);
    width: 122px; /* Match the Play All button width */
  `;
  
  // Add hover effect to export button
  exportButton.addEventListener('mouseenter', () => {
    exportButton.style.backgroundColor = 'rgba(234, 56, 76, 0.8)';
  });
  
  exportButton.addEventListener('mouseleave', () => {
    exportButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  });
  
  // Add click event to fetch button
  fetchButton.addEventListener('click', () => {
    // Show loading state
    fetchButton.textContent = 'Fetching...';
    fetchButton.disabled = true;
    fetchButton.style.opacity = '0.7';
    
    // Send message to background script
    chrome.runtime.sendMessage({ action: 'fetchLikedVideos' }, (response) => {
      if (response && response.success) {
        // Reset button
        fetchButton.textContent = 'Fetch My Liked Videos';
        fetchButton.disabled = false;
        fetchButton.style.opacity = '1';
      } else {
        // Show error
        fetchButton.textContent = 'Error. Try Again';
        fetchButton.disabled = false;
        fetchButton.style.opacity = '1';
        
        setTimeout(() => {
          fetchButton.textContent = 'Fetch My Liked Videos';
        }, 3000);
      }
    });
  });
  
  // Add click event to export button
  exportButton.addEventListener('click', () => {
    // Show loading state
    exportButton.textContent = 'Exporting...';
    exportButton.disabled = true;
    exportButton.style.opacity = '0.7';
    
    // Send message to background script
    chrome.runtime.sendMessage({ action: 'exportData' }, (response) => {
      // Reset button after a short delay
      setTimeout(() => {
        exportButton.textContent = 'Export All Videos';
        exportButton.disabled = false;
        exportButton.style.opacity = '1';
      }, 1500);
    });
  });
  
  // Append buttons to the container
  buttonsContainer.appendChild(fetchButton);
  buttonsContainer.appendChild(exportButton);
  
  // Find the button section below the "Play all" button
  const insertButtons = () => {
    // Look for the play button
    const playButton = document.querySelector('ytd-button-renderer[class="style-scope ytd-playlist-header-renderer"]');
    
    if (playButton && playButton.parentElement) {
      // We want to insert after the parent container that holds the play and shuffle buttons
      const buttonsContainer = playButton.closest('div#top-row');
      
      if (buttonsContainer) {
        // Insert our buttons container
        buttonsContainer.parentElement.appendChild(document.createElement('br')); // Add a line break for spacing
        buttonsContainer.parentElement.appendChild(buttonsContainer);
        return true;
      }
    }
    
    return false;
  };
  
  // Try to insert the buttons, if it fails, wait for the DOM to load more
  if (!insertButtons()) {
    const observer = new MutationObserver((mutations, obs) => {
      if (insertButtons()) {
        obs.disconnect(); // Stop observing once buttons are inserted
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Stop observing after 10 seconds to prevent memory leaks
    setTimeout(() => observer.disconnect(), 10000);
  }
}

// Handle URL changes (YouTube is a SPA)
function handleUrlChange() {
  let lastUrl = location.href;
  
  // Call once on initial load
  injectFetchButton();
  
  // Create an observer to watch for URL changes
  const observer = new MutationObserver(() => {
    if (lastUrl !== location.href) {
      lastUrl = location.href;
      setTimeout(injectFetchButton, 1000); // Delay to ensure page loads
    }
  });
  
  // Start observing
  observer.observe(document.body, { subtree: true, childList: true });
}

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleUrlChange);
} else {
  handleUrlChange();
}

// Re-inject button when visibility changes (e.g., if "show unavailable videos" is toggled)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    setTimeout(injectFetchButton, 1000);
  }
});

// Re-check for the button periodically to ensure it's still there
// This helps if YouTube's UI changes or elements get removed
setInterval(injectFetchButton, 10000);
