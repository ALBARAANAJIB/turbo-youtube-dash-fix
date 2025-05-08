
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
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 16px;
    border-radius: 8px;
    z-index: 9999;
    display: flex;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: Roboto, Arial, sans-serif;
    max-width: 400px;
    animation: fadeIn 0.3s, fadeOut 0.3s 4.7s;
  `;
  
  // Add check icon
  const checkIcon = document.createElement('span');
  checkIcon.innerHTML = '✅';
  checkIcon.style.marginRight = '12px';
  checkIcon.style.fontSize = '18px';
  
  // Add message text
  const messageText = document.createElement('div');
  messageText.innerHTML = `
    <div style="font-weight: 500; font-size: 15px;">${message}</div>
    <div style="font-size: 13px; color: #ccc; margin-top: 4px;">
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
    background-color: #FF0000;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.2s;
  `;
  
  dashboardBtn.addEventListener('mouseenter', () => {
    dashboardBtn.style.backgroundColor = '#CC0000';
  });
  
  dashboardBtn.addEventListener('mouseleave', () => {
    dashboardBtn.style.backgroundColor = '#FF0000';
  });
  
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
  
  // Remove any existing fetch button
  const existingButton = document.getElementById('youtube-enhancer-fetch-button');
  if (existingButton) existingButton.remove();
  
  // Create the button
  const fetchButton = document.createElement('button');
  fetchButton.id = 'youtube-enhancer-fetch-button';
  fetchButton.textContent = 'Fetch My Liked Videos';
  fetchButton.style.cssText = `
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    border-radius: 18px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    margin: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Roboto, Arial, sans-serif;
    transition: background-color 0.2s;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  `;
  
  // Add hover effect
  fetchButton.addEventListener('mouseenter', () => {
    fetchButton.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
  });
  
  fetchButton.addEventListener('mouseleave', () => {
    fetchButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
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
  
  // Try to insert the button near the Play All and Shuffle buttons
  const playAllButton = document.querySelector('ytd-button-renderer[id="play-button"]');
  const shuffleButton = document.querySelector('ytd-button-renderer[id="shuffle-button"]');
  
  if (playAllButton || shuffleButton) {
    const buttonContainer = (playAllButton || shuffleButton).closest('#top-level-buttons-computed');
    if (buttonContainer) {
      buttonContainer.appendChild(fetchButton);
      return;
    }
  }
  
  // Fallback: Insert after the playlist header
  const playlistHeader = document.querySelector('ytd-playlist-header-renderer');
  if (playlistHeader) {
    playlistHeader.appendChild(fetchButton);
  }
}

// Create a MutationObserver to watch for DOM changes
const observer = new MutationObserver((mutations) => {
  // Check if we're on the liked videos page
  const isLikedVideosPage = window.location.href.includes('playlist?list=LL');
  if (isLikedVideosPage) {
    // Try to add the button when DOM changes
    injectFetchButton();
  }
});

// Watch for changes in the page content
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also watch for URL changes (YouTube is a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  if (lastUrl !== location.href) {
    lastUrl = location.href;
    
    // Wait for content to load
    setTimeout(() => {
      if (location.href.includes('playlist?list=LL')) {
        injectFetchButton();
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });

// Initial injection
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFetchButton);
} else {
  injectFetchButton();
}

// Handle visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && 
      location.href.includes('playlist?list=LL')) {
    setTimeout(injectFetchButton, 500);
  }
});

// Re-inject the button periodically to ensure it's present
setInterval(() => {
  if (location.href.includes('playlist?list=LL')) {
    injectFetchButton();
  }
}, 3000);
