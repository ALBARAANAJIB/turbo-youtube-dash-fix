
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
  
  // Remove any existing fetch button
  const existingButton = document.getElementById('youtube-enhancer-fetch-button');
  if (existingButton) existingButton.remove();
  
  // Create the button
  const fetchButton = document.createElement('button');
  fetchButton.id = 'youtube-enhancer-fetch-button';
  fetchButton.textContent = 'Fetch My Liked Videos';
  fetchButton.style.cssText = `
    background-color: rgba(26, 26, 26, 0.6);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 500;
    margin: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Roboto, Arial, sans-serif;
    transition: background-color 0.2s;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.1);
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  `;
  
  // Add hover effect
  fetchButton.addEventListener('mouseenter', () => {
    fetchButton.style.backgroundColor = 'rgba(234, 56, 76, 0.8)';
  });
  
  fetchButton.addEventListener('mouseleave', () => {
    fetchButton.style.backgroundColor = 'rgba(26, 26, 26, 0.6)';
  });
  
  // Add click event
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
  
  // Find a good place to insert the button
  const insertButton = () => {
    // Try multiple selectors to find a good insertion point
    const selectors = [
      'ytd-playlist-header-renderer #top-level-buttons-computed',
      'ytd-playlist-sidebar-renderer',
      'ytd-playlist-header-renderer',
      '#above-the-fold'
    ];
    
    let inserted = false;
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Insert before the first child or append if no children
        if (element.firstChild) {
          element.insertBefore(fetchButton, element.firstChild);
        } else {
          element.appendChild(fetchButton);
        }
        inserted = true;
        break;
      }
    }
    
    // If all else fails, try the page manager
    if (!inserted) {
      const pageManager = document.querySelector('ytd-page-manager');
      if (pageManager) {
        pageManager.prepend(fetchButton);
        inserted = true;
      }
    }
    
    return inserted;
  };
  
  // Try to insert the button, if it fails, wait for the DOM to load more
  if (!insertButton()) {
    const observer = new MutationObserver((mutations, obs) => {
      if (insertButton()) {
        obs.disconnect(); // Stop observing once button is inserted
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
