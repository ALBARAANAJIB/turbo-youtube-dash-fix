
document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const fetchVideosButton = document.getElementById('fetch-videos');
  const fetchSubscriptionsButton = document.getElementById('fetch-subscriptions');
  const openDashboardButton = document.getElementById('open-dashboard');
  const userEmail = document.getElementById('user-email');
  const userInitial = document.getElementById('user-initial');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  // Check if user is already authenticated
  chrome.storage.local.get(['userToken', 'userInfo'], (result) => {
    if (result.userToken && result.userInfo) {
      // User is authenticated, show features
      loginSection.style.display = 'none';
      userSection.style.display = 'block';
      
      // Display user info
      if (result.userInfo.email) {
        userEmail.textContent = result.userInfo.email;
        userInitial.textContent = result.userInfo.email.charAt(0).toUpperCase();
      } else if (result.userInfo.name) {
        userEmail.textContent = result.userInfo.name;
        userInitial.textContent = result.userInfo.name.charAt(0).toUpperCase();
      }
    } else {
      // User is not authenticated, show login
      loginSection.style.display = 'block';
      userSection.style.display = 'none';
    }
  });

  // Show toast message
  function showToast(message, duration = 3000) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // Login with Google
  loginButton.addEventListener('click', () => {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
    
    chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
      if (response && response.success) {
        loginSection.style.display = 'none';
        userSection.style.display = 'block';
        
        // Display user info
        if (response.userInfo && response.userInfo.email) {
          userEmail.textContent = response.userInfo.email;
          userInitial.textContent = response.userInfo.email.charAt(0).toUpperCase();
        } else if (response.userInfo && response.userInfo.name) {
          userEmail.textContent = response.userInfo.name;
          userInitial.textContent = response.userInfo.name.charAt(0).toUpperCase();
        }
      } else {
        showToast('Authentication failed. Please try again.');
        loginButton.disabled = false;
        loginButton.textContent = 'Sign in with Google';
      }
    });
  });

  // Fetch liked videos
  fetchVideosButton.addEventListener('click', () => {
    fetchVideosButton.disabled = true;
    const originalText = fetchVideosButton.textContent;
    fetchVideosButton.textContent = 'Fetching...';
    
    chrome.runtime.sendMessage({ action: 'fetchLikedVideos' }, (response) => {
      fetchVideosButton.disabled = false;
      fetchVideosButton.textContent = originalText;
      
      if (response && response.success) {
        showToast(`${response.count} videos fetched successfully!`);
      } else {
        showToast('Failed to fetch videos. Please try again.');
      }
    });
  });
  
  // Fetch subscriptions
  fetchSubscriptionsButton.addEventListener('click', () => {
    fetchSubscriptionsButton.disabled = true;
    const originalText = fetchSubscriptionsButton.textContent;
    fetchSubscriptionsButton.textContent = 'Fetching...';
    
    chrome.runtime.sendMessage({ action: 'fetchSubscriptions' }, (response) => {
      fetchSubscriptionsButton.disabled = false;
      fetchSubscriptionsButton.textContent = originalText;
      
      if (response && response.success) {
        showToast(`${response.count} subscriptions fetched successfully!`);
      } else {
        showToast('Failed to fetch subscriptions. Please try again.');
      }
    });
  });

  // Open dashboard
  openDashboardButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  // Sign out
  logoutButton.addEventListener('click', () => {
    chrome.storage.local.remove(['userToken', 'userInfo', 'likedVideos', 'subscriptions'], () => {
      loginSection.style.display = 'block';
      userSection.style.display = 'none';
      showToast('Signed out successfully');
    });
  });
});
