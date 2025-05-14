
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
    background-color: #9b87f5;
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
  
  // Try multiple placement strategies for better reliability
  const placeButtonInUI = () => {
    // Strategy 1: Look for play all / shuffle container
    const playAllContainer = document.querySelector('ytd-playlist-header-renderer #top-level-buttons-computed');
    
    // Strategy 2: Alternative placement if first strategy fails
    const alternativeContainer = document.querySelector('ytd-playlist-header-renderer #menu-container');
    
    // Strategy 3: Last resort - the entire header section
    const headerContainer = document.querySelector('ytd-playlist-header-renderer');
    
    let targetContainer = playAllContainer || alternativeContainer || headerContainer;
    
    if (!targetContainer) {
      console.log('Could not find a suitable container for button placement');
      return false;
    }
    
    // Create a button that matches YouTube's styling
    const fetchButton = document.createElement('button');
    fetchButton.id = 'youtube-enhancer-fetch-button';
    fetchButton.textContent = 'Fetch My Liked Videos';
    
    // Apply YouTube-like styling with our custom purple theme
    fetchButton.style.cssText = `
      background-color: #9b87f5;
      color: white;
      border: none;
      border-radius: 18px;
      padding: 0 16px;
      height: 36px;
      font-size: 14px;
      font-weight: 500;
      margin-left: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    `;
    
    // Add hover effect
    fetchButton.addEventListener('mouseenter', () => {
      fetchButton.style.backgroundColor = '#7E69AB';
      fetchButton.style.transform = 'translateY(-1px)';
      fetchButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    });
    
    fetchButton.addEventListener('mouseleave', () => {
      fetchButton.style.backgroundColor = '#9b87f5';
      fetchButton.style.transform = 'translateY(0)';
      fetchButton.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    });
    
    // Add active effect
    fetchButton.addEventListener('mousedown', () => {
      fetchButton.style.transform = 'translateY(1px)';
      fetchButton.style.boxShadow = '0 0 2px rgba(0,0,0,0.2)';
    });
    
    fetchButton.addEventListener('mouseup', () => {
      fetchButton.style.transform = 'translateY(-1px)';
      fetchButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
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
    
    // If it's the play all container (our preferred location)
    if (targetContainer === playAllContainer) {
      // Try to place button after existing buttons
      targetContainer.appendChild(fetchButton);
    } else if (targetContainer === alternativeContainer) {
      // Insert before the container for better positioning
      targetContainer.parentNode.insertBefore(fetchButton, targetContainer);
    } else {
      // Last resort - just append to the header
      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.cssText = `
        margin: 16px 0;
        display: flex;
      `;
      buttonsDiv.appendChild(fetchButton);
      targetContainer.appendChild(buttonsDiv);
    }
    
    console.log('Button injected successfully');
    return true;
  };
  
  // Try to place the button immediately
  if (!placeButtonInUI()) {
    // If initial placement fails, retry with increasing delays
    const retryTimes = [500, 1000, 2000, 3000, 5000];
    retryTimes.forEach(delay => {
      setTimeout(() => {
        if (!document.getElementById('youtube-enhancer-fetch-button')) {
          placeButtonInUI();
        }
      }, delay);
    });
  }
}

// Enhanced URL change detection with mutation observer
function handleUrlChange() {
  let lastUrl = location.href;
  
  // Function to check and inject button when needed
  const checkAndInject = () => {
    if (window.location.href.includes('playlist?list=LL')) {
      console.log('Liked videos page detected, injecting button');
      
      // Initial injection
      injectFetchButton();
      
      // Set up additional checks after page state changes
      setTimeout(injectFetchButton, 1000);
      setTimeout(injectFetchButton, 2500);
    }
  };
  
  // Call once on initial load with delay
  setTimeout(checkAndInject, 1000);
  
  // Create an observer to watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    // Check if URL has changed
    if (lastUrl !== location.href) {
      lastUrl = location.href;
      console.log('URL changed to: ' + location.href);
      setTimeout(checkAndInject, 1000);
      return;
    }
    
    // Check for specific mutations that could indicate content updates
    // without full page navigation (like showing/hiding unavailable videos)
    if (window.location.href.includes('playlist?list=LL')) {
      let shouldReinject = false;
      
      for (const mutation of mutations) {
        // Look for changes to the playlist container
        if (mutation.target && 
            (mutation.target.id === 'contents' || 
             mutation.target.classList?.contains('ytd-playlist-video-list-renderer'))) {
          shouldReinject = true;
          break;
        }
        
        // Check if any buttons changed or were added
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeName === 'YTD-BUTTON-RENDERER' || 
                node.nodeName === 'YTD-TOGGLE-BUTTON-RENDERER') {
              shouldReinject = true;
              break;
            }
          }
        }
      }
      
      if (shouldReinject) {
        console.log('Detected content changes - reinjecting button');
        setTimeout(injectFetchButton, 500);
      }
    }
  });
  
  // Watch for both URL changes and content changes
  observer.observe(document, { 
    subtree: true, 
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden']
  });
  
  // Watch for YouTube's SPA navigation events
  document.addEventListener('yt-navigate-finish', () => {
    console.log('YouTube navigation event detected');
    if (window.location.href.includes('playlist?list=LL')) {
      console.log('Navigated to liked videos page');
      setTimeout(injectFetchButton, 1000);
      setTimeout(injectFetchButton, 2500);  // Additional safety check
    }
  });
}

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleUrlChange);
} else {
  handleUrlChange();
}

// Add event listener for YouTube's spfprocess event (when content refreshes)
document.addEventListener('yt-action', (event) => {
  if (event.detail?.actionName === 'yt-append-continuation' || 
      event.detail?.actionName === 'ytd-update-grid-state') {
    if (window.location.href.includes('playlist?list=LL')) {
      console.log('YouTube action detected, checking button');
      setTimeout(injectFetchButton, 1000);
    }
  }
});

// Re-check whenever visibility changes (user comes back to the tab)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && 
      window.location.href.includes('playlist?list=LL')) {
    console.log('Page became visible, ensuring button exists');
    setTimeout(injectFetchButton, 1000);
  }
});

// Also set up periodic checks as a safety measure
setInterval(() => {
  if (window.location.href.includes('playlist?list=LL')) {
    const buttonExists = document.getElementById('youtube-enhancer-fetch-button');
    if (!buttonExists) {
      console.log('Periodic check: button missing, reinjecting');
      injectFetchButton();
    }
  }
}, 5000);
