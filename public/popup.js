
document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  const loginContainer = document.getElementById('login-container');
  const featuresContainer = document.getElementById('features-container');
  const fetchVideosButton = document.getElementById('fetch-videos');
  const openDashboardButton = document.getElementById('open-dashboard');
  const exportDataButton = document.getElementById('export-data');
  const aiSummaryButton = document.getElementById('ai-summary');
  const signOutButton = document.getElementById('sign-out');
  const userEmail = document.getElementById('user-email');
  const userInitial = document.getElementById('user-initial');

  // Check authentication status using background script validation
  chrome.runtime.sendMessage({ action: 'checkAuth' }, (response) => {
    if (response && response.success && response.userInfo) {
      loginContainer.style.display = 'none';
      featuresContainer.style.display = 'block';
      
      if (response.userInfo.email) {
        userEmail.textContent = response.userInfo.email;
        userInitial.textContent = response.userInfo.email.charAt(0).toUpperCase();
      } else if (response.userInfo.name) {
        userEmail.textContent = response.userInfo.name;
        userInitial.textContent = response.userInfo.name.charAt(0).toUpperCase();
      }
    } else {
      loginContainer.style.display = 'block';
      featuresContainer.style.display = 'none';
      
      // Show re-authentication message if needed
      if (response && response.needsReauth) {
        showErrorMessage('Your session has expired. Please sign in again.');
      }
    }
  });

  // Login with YouTube
  loginButton && loginButton.addEventListener('click', () => {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
    
    chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
      if (response && response.success) {
        loginContainer.style.display = 'none';
        featuresContainer.style.display = 'block';
        
        if (response.userInfo && response.userInfo.email) {
          userEmail.textContent = response.userInfo.email;
          userInitial.textContent = response.userInfo.email.charAt(0).toUpperCase();
        } else if (response.userInfo && response.userInfo.name) {
          userEmail.textContent = response.userInfo.name;
          userInitial.textContent = response.userInfo.name.charAt(0).toUpperCase();
        }
      } else {
        showErrorMessage('Authentication failed. Please try again.');
        loginButton.disabled = false;
        loginButton.textContent = 'Sign in with YouTube';
      }
    });
  });

  // Fetch liked videos
  fetchVideosButton && fetchVideosButton.addEventListener('click', () => {
    fetchVideosButton.disabled = true;
    const originalText = fetchVideosButton.textContent;
    fetchVideosButton.textContent = 'Fetching...';
    
    chrome.runtime.sendMessage({ action: 'fetchLikedVideos' }, (response) => {
      fetchVideosButton.disabled = false;
      fetchVideosButton.textContent = originalText;
      
      if (response && response.success) {
        showSuccessMessage(fetchVideosButton, `${response.count} videos fetched!`);
      } else if (response && response.needsReauth) {
        showErrorMessage('Your session has expired. Please sign in again.');
        // Switch back to login view
        loginContainer.style.display = 'block';
        featuresContainer.style.display = 'none';
      } else {
        showErrorMessage(response?.error || 'Failed to fetch videos. Please try again.');
      }
    });
  });

  // Open dashboard
  openDashboardButton && openDashboardButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  // Export data
  exportDataButton && exportDataButton.addEventListener('click', () => {
    exportDataButton.disabled = true;
    const originalText = exportDataButton.textContent;
    exportDataButton.textContent = 'Exporting...';
    
    chrome.runtime.sendMessage({ action: 'exportData' }, (response) => {
      setTimeout(() => {
        exportDataButton.disabled = false;
        exportDataButton.textContent = originalText;
        
        if (response && response.success) {
          showSuccessMessage(exportDataButton, `${response.count} videos exported!`);
        } else if (response && response.needsReauth) {
          showErrorMessage('Your session has expired. Please sign in again.');
          // Switch back to login view
          loginContainer.style.display = 'block';
          featuresContainer.style.display = 'none';
        } else {
          showErrorMessage(response?.error || 'Export failed. Please try again.');
          console.error('Export failed:', response?.error || 'Unknown error');
        }
      }, 1000);
    });
  });

  // AI Summary
  aiSummaryButton && aiSummaryButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      
      if (currentTab && currentTab.url && currentTab.url.includes('youtube.com/watch')) {
        showSuccessMessage(aiSummaryButton, "Summarization panel is now available on the video page!");
        window.close();
      } else {
        chrome.tabs.create({ 
          url: chrome.runtime.getURL('dashboard.html?tab=ai') 
        });
      }
    });
  });

  // Sign out
  signOutButton && signOutButton.addEventListener('click', () => {
    chrome.storage.local.remove(['userToken', 'userInfo', 'userId', 'tokenExpiry', 'likedVideos'], () => {
      loginContainer.style.display = 'block';
      featuresContainer.style.display = 'none';
    });
  });
  
  // Helper functions
  function showSuccessMessage(element, message) {
    const successMessage = document.createElement('div');
    successMessage.classList.add('success-message');
    successMessage.textContent = message;
    
    element.parentNode.insertBefore(successMessage, element.nextSibling);
    
    setTimeout(() => {
      successMessage.remove();
    }, 3000);
  }
  
  function showErrorMessage(message) {
    const errorMessage = document.createElement('div');
    errorMessage.classList.add('error-message');
    errorMessage.style.color = '#ff3333';
    errorMessage.style.padding = '8px';
    errorMessage.style.margin = '8px 0';
    errorMessage.style.borderRadius = '4px';
    errorMessage.style.backgroundColor = 'rgba(255,0,0,0.1)';
    errorMessage.textContent = message;
    
    const container = loginContainer.style.display === 'none' ? featuresContainer : loginContainer;
    container.insertBefore(errorMessage, container.firstChild);
    
    setTimeout(() => {
      errorMessage.remove();
    }, 5000);
  }
});
