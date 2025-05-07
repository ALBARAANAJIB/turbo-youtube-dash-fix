
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

  // Check if user is already authenticated
  chrome.storage.local.get(['userToken', 'userInfo'], (result) => {
    if (result.userToken && result.userInfo) {
      // User is authenticated, show features
      loginContainer.style.display = 'none';
      featuresContainer.style.display = 'block';
      
      // Display user info
      if (result.userInfo.email) {
        userEmail.textContent = result.userInfo.email;
        userInitial.textContent = result.userInfo.email.charAt(0).toUpperCase();
      }
    } else {
      // User is not authenticated, show login
      loginContainer.style.display = 'block';
      featuresContainer.style.display = 'none';
    }
  });

  // Login with YouTube
  loginButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
      if (response && response.success) {
        loginContainer.style.display = 'none';
        featuresContainer.style.display = 'block';
        
        // Display user info
        if (response.userInfo && response.userInfo.email) {
          userEmail.textContent = response.userInfo.email;
          userInitial.textContent = response.userInfo.email.charAt(0).toUpperCase();
        }
      } else {
        alert('Authentication failed. Please try again.');
      }
    });
  });

  // Fetch liked videos
  fetchVideosButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'fetchLikedVideos' }, (response) => {
      if (response && response.success) {
        alert(`${response.count} videos fetched. View them in your dashboard.`);
      } else {
        alert('Failed to fetch videos. Please try again.');
      }
    });
  });

  // Open dashboard
  openDashboardButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  // Export data
  exportDataButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'exportData' });
  });

  // AI Summary
  aiSummaryButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'aiSummary' });
  });

  // Sign out
  signOutButton.addEventListener('click', () => {
    chrome.storage.local.remove(['userToken', 'userInfo', 'likedVideos'], () => {
      loginContainer.style.display = 'block';
      featuresContainer.style.display = 'none';
    });
  });
});
