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
  
  // Check if we're on the liked videos page
  const isLikedVideosPage = window.location.href.includes('playlist?list=LL');
  
  if (!isLikedVideosPage) return;
  
  console.log('Detected liked videos page, attempting to inject button...');
  
  // Remove any existing fetch button
  const existingButton = document.getElementById('youtube-enhancer-fetch-button');
  if (existingButton) existingButton.remove();
  
  // Create a simple button without relying on computed styles
  const fetchButton = document.createElement('button');
  fetchButton.id = 'youtube-enhancer-fetch-button';
  fetchButton.textContent = 'Fetch My Liked Videos';
  fetchButton.style.cssText = `
    background-color: #ea384c;
    color: white;
    border: none;
    border-radius: 18px;
    padding: 0 16px;
    height: 36px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: Roboto, Arial, sans-serif;
    position: fixed;
    top: 120px;
    right: 20px;
    z-index: 9999;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  
  // Add hover effect
  fetchButton.addEventListener('mouseenter', () => {
    fetchButton.style.backgroundColor = '#d62d3c';
  });
  
  fetchButton.addEventListener('mouseleave', () => {
    fetchButton.style.backgroundColor = '#ea384c';
  });
  
  // Add click event
  fetchButton.addEventListener('click', () => {
    // Show loading state
    fetchButton.textContent = 'Fetching...';
    fetchButton.disabled = true;
    fetchButton.style.opacity = '0.7';
    
    // Send message to background script
    chrome.runtime.sendMessage({ action: 'fetchLikedVideos' }, (response) => {
      // Reset button
      fetchButton.textContent = 'Fetch My Liked Videos';
      fetchButton.disabled = false;
      fetchButton.style.opacity = '1';
      
      if (!response || !response.success) {
        // Show error temporarily
        fetchButton.textContent = 'Error. Try Again';
        setTimeout(() => {
          fetchButton.textContent = 'Fetch My Liked Videos';
        }, 3000);
      }
    });
  });
  
  // Always add to body to avoid DOM structure issues
  document.body.appendChild(fetchButton);
  console.log('Button injected successfully');
}

// Handle URL changes (YouTube is a SPA)
function handleUrlChange() {
  let lastUrl = location.href;
  
  // Function to check and inject button if needed
  const checkAndInject = () => {
    if (window.location.href.includes('playlist?list=LL')) {
      console.log('Liked videos page detected, injecting button');
      injectFetchButton();
    }
  };
  
  // Call once on initial load with delay to ensure YouTube has fully loaded
  setTimeout(checkAndInject, 2000);
  
  // Create an observer to watch for URL changes
  const observer = new MutationObserver(() => {
    if (lastUrl !== location.href) {
      lastUrl = location.href;
      console.log('URL changed to: ' + location.href);
      setTimeout(checkAndInject, 2000);
    }
  });
  
  // Start observing
  observer.observe(document, { subtree: true, childList: true });
}

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleUrlChange);
} else {
  handleUrlChange();
}

// Re-check periodically
setInterval(() => {
  const isLikedVideosPage = window.location.href.includes('playlist?list=LL');
  const buttonExists = document.getElementById('youtube-enhancer-fetch-button');
  
  if (isLikedVideosPage && !buttonExists) {
    console.log('Periodic check: button missing, injecting');
    injectFetchButton();
  }
}, 5000);

// Re-inject button when visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && 
      window.location.href.includes('playlist?list=LL')) {
    console.log('Page became visible, checking for button');
    setTimeout(injectFetchButton, 2000);
  }
});
