
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

// Function to inject the "Fetch My Liked Videos" button and "Export Videos" button
function injectButtons() {
  // Check if we're on a YouTube page
  if (!window.location.hostname.includes('youtube.com')) return;
  
  // Check if we're on the liked videos page
  const isLikedVideosPage = window.location.href.includes('playlist?list=LL');
  
  if (!isLikedVideosPage) return;
  
  console.log('Detected liked videos page, attempting to inject buttons...');
  
  // Remove any existing buttons
  const existingFetchButton = document.getElementById('youtube-enhancer-fetch-button');
  if (existingFetchButton) existingFetchButton.remove();
  
  const existingExportButton = document.getElementById('youtube-enhancer-export-button');
  if (existingExportButton) existingExportButton.remove();
  
  const existingButtonContainer = document.getElementById('youtube-enhancer-button-container');
  if (existingButtonContainer) existingButtonContainer.remove();
  
  // Try multiple placement strategies for better reliability
  const placeButtonsInUI = () => {
    // Strategy 1: Find the Play all and Shuffle buttons container
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
    
    // Create a button container div to hold both buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'youtube-enhancer-button-container';
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
      width: 100%;
      max-width: 300px;
    `;
    
    // Create fetch button that matches YouTube's styling
    const fetchButton = createYouTubeStyleButton('Fetch My Liked Videos', 'youtube-enhancer-fetch-button');
    
    // Create export button that matches YouTube's styling
    const exportButton = createYouTubeStyleButton('Export Videos', 'youtube-enhancer-export-button');
    
    // Add click event for fetch button
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
    
    // Add click event for export button
    exportButton.addEventListener('click', () => {
      // Show loading state
      exportButton.textContent = 'Exporting...';
      exportButton.disabled = true;
      exportButton.style.opacity = '0.7';
      
      // Send message to background script
      chrome.runtime.sendMessage({ action: 'exportData' }, (response) => {
        // Reset button
        exportButton.textContent = 'Export Videos';
        exportButton.disabled = false;
        exportButton.style.opacity = '1';
        
        if (!response || !response.success) {
          // Show error temporarily
          exportButton.textContent = 'Error. Try Again';
          setTimeout(() => {
            exportButton.textContent = 'Export Videos';
          }, 3000);
        }
      });
    });
    
    // Add buttons to container
    buttonContainer.appendChild(fetchButton);
    buttonContainer.appendChild(exportButton);
    
    // Look for the Play all / Shuffle button row
    const playShuffleRow = document.querySelector('ytd-playlist-header-renderer #top-row-buttons');
    
    if (playShuffleRow) {
      // Insert after the play/shuffle buttons
      playShuffleRow.parentNode.insertBefore(buttonContainer, playShuffleRow.nextSibling);
    } else if (targetContainer === playAllContainer) {
      // If we found the playAllContainer but not the row, insert after the container
      targetContainer.parentNode.insertBefore(buttonContainer, targetContainer.nextSibling);
    } else {
      // Last resort - just append to the header
      targetContainer.appendChild(buttonContainer);
    }
    
    console.log('Buttons injected successfully in vertical layout');
    return true;
  };
  
  // Helper function to create YouTube-styled buttons
  function createYouTubeStyleButton(text, id) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    
    // Apply YouTube-like styling with our custom purple theme
    button.style.cssText = `
      background-color: #9b87f5;
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
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      width: 100%;
    `;
    
    // Add hover effect
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#7E69AB';
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#9b87f5';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    });
    
    // Add active effect
    button.addEventListener('mousedown', () => {
      button.style.transform = 'translateY(1px)';
      button.style.boxShadow = '0 0 2px rgba(0,0,0,0.2)';
    });
    
    button.addEventListener('mouseup', () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    });
    
    return button;
  }
  
  // Try to place the buttons immediately
  if (!placeButtonsInUI()) {
    // If initial placement fails, retry with increasing delays
    const retryTimes = [500, 1000, 2000, 3000, 5000];
    retryTimes.forEach(delay => {
      setTimeout(() => {
        if (!document.getElementById('youtube-enhancer-fetch-button')) {
          placeButtonsInUI();
        }
      }, delay);
    });
  }
}

// Enhanced URL change detection with mutation observer
function handleUrlChange() {
  let lastUrl = location.href;
  
  // Function to check and inject buttons when needed
  const checkAndInject = () => {
    if (window.location.href.includes('playlist?list=LL')) {
      console.log('Liked videos page detected, injecting buttons');
      
      // Initial injection
      injectButtons();
      
      // Set up additional checks after page state changes
      setTimeout(injectButtons, 1000);
      setTimeout(injectButtons, 2500);
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
        
        // Check specifically for the "Unavailable videos are hidden" alert
        if (mutation.target && 
            mutation.target.textContent && 
            mutation.target.textContent.includes('Unavailable videos are')) {
          console.log('Detected unavailable videos toggle - reinjecting buttons');
          setTimeout(injectButtons, 500);
          setTimeout(injectButtons, 1500);
        }
      }
      
      if (shouldReinject) {
        console.log('Detected content changes - reinjecting buttons');
        setTimeout(injectButtons, 500);
      }
    }
  });
  
  // Watch for both URL changes and content changes
  observer.observe(document, { 
    subtree: true, 
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden'],
    characterData: true
  });
  
  // Watch for YouTube's SPA navigation events
  document.addEventListener('yt-navigate-finish', () => {
    console.log('YouTube navigation event detected');
    if (window.location.href.includes('playlist?list=LL')) {
      console.log('Navigated to liked videos page');
      setTimeout(injectButtons, 1000);
      setTimeout(injectButtons, 2500);  // Additional safety check
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
      console.log('YouTube action detected, checking buttons');
      setTimeout(injectButtons, 1000);
    }
  }
});

// Re-check whenever visibility changes (user comes back to the tab)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && 
      window.location.href.includes('playlist?list=LL')) {
    console.log('Page became visible, ensuring buttons exist');
    setTimeout(injectButtons, 1000);
  }
});

// Also set up periodic checks as a safety measure
setInterval(() => {
  if (window.location.href.includes('playlist?list=LL')) {
    const fetchButtonExists = document.getElementById('youtube-enhancer-fetch-button');
    const exportButtonExists = document.getElementById('youtube-enhancer-export-button');
    if (!fetchButtonExists || !exportButtonExists) {
      console.log('Periodic check: buttons missing, reinjecting');
      injectButtons();
    }
  }
}, 5000);
