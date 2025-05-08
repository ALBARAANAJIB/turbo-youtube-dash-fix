
// OAuth 2.0 constants
const CLIENT_ID = '304162096302-c470kd77du16s0lrlumobc6s8u6uleng.apps.googleusercontent.com';
const REDIRECT_URL = chrome.identity.getRedirectURL();
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

// YouTube API endpoints
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const LIKED_VIDEOS_ENDPOINT = `${API_BASE}/videos`;
const USER_INFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v1/userinfo';
const PLAYLIST_ITEMS_ENDPOINT = `${API_BASE}/playlistItems`;
const CHANNELS_ENDPOINT = `${API_BASE}/channels`;
const SUBSCRIPTIONS_ENDPOINT = `${API_BASE}/subscriptions`;

// Handle messages from popup.js and content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'authenticate') {
    authenticate()
      .then(token => getUserInfo(token))
      .then(({token, userInfo}) => {
        chrome.storage.local.set({ userToken: token, userInfo: userInfo });
        sendResponse({ success: true, userInfo: userInfo });
      })
      .catch(error => {
        console.error('Authentication error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for the async response
  }
  
  if (request.action === 'checkAuth') {
    chrome.storage.local.get('userToken', (result) => {
      if (result.userToken) {
        console.log('User is authenticated');
        sendResponse({ authenticated: true });
      } else {
        console.log('User is not authenticated');
        sendResponse({ authenticated: false });
      }
    });
    return true; // Keep the message channel open for the async response
  }

  if (request.action === 'fetchLikedVideos' || request.action === 'getLikedVideos') {
    chrome.storage.local.get('userToken', async (result) => {
      if (!result.userToken) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        console.log('Fetching liked videos...');
        // Fetch up to 100 videos (maximum allowed by the API in one request)
        const response = await fetch(`${LIKED_VIDEOS_ENDPOINT}?part=snippet,statistics&maxResults=100&myRating=like`, {
          headers: { Authorization: `Bearer ${result.userToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch liked videos');
        
        const data = await response.json();
        console.log('Liked videos fetched:', data);
        
        // Process videos
        const videos = data.items.map(video => ({
          id: video.id,
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          channelId: video.snippet.channelId,
          publishedAt: video.snippet.publishedAt,
          likedAt: video.snippet.publishedAt, // Use publishedAt as approximate likedAt
          thumbnail: video.snippet.thumbnails.medium?.url || '',
          viewCount: video.statistics.viewCount || '0',
          likeCount: video.statistics.likeCount || '0'
        }));
        
        // Store the videos locally
        chrome.storage.local.set({ 
          likedVideos: videos,
          nextPageToken: data.nextPageToken || null,
          totalResults: data.pageInfo?.totalResults || videos.length
        });
        
        console.log('Videos stored in local storage');
        
        // Display a toast notification on YouTube pages
        chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
          if (tabs.length > 0) {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, { 
                action: 'showToast', 
                message: 'Videos fetched successfully!',
                count: videos.length
              });
            });
          }
        });
        
        sendResponse({ success: true, count: videos.length });
      } catch (error) {
        console.error('Error fetching liked videos:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Keep the message channel open for the async response
  }

  if (request.action === 'fetchMoreVideos') {
    chrome.storage.local.get(['userToken', 'likedVideos'], async (result) => {
      if (!result.userToken) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        // Fetch more videos with the pageToken
        const response = await fetch(`${LIKED_VIDEOS_ENDPOINT}?part=snippet,statistics&maxResults=100&myRating=like&pageToken=${request.pageToken}`, {
          headers: { Authorization: `Bearer ${result.userToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch more videos');
        
        const data = await response.json();
        
        // Process videos
        const newVideos = data.items.map(video => ({
          id: video.id,
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          channelId: video.snippet.channelId,
          publishedAt: video.snippet.publishedAt,
          likedAt: video.snippet.publishedAt, // Use publishedAt as approximate likedAt
          thumbnail: video.snippet.thumbnails.medium?.url || '',
          viewCount: video.statistics.viewCount || '0',
          likeCount: video.statistics.likeCount || '0'
        }));
        
        // Combine with existing videos
        const allVideos = [...(result.likedVideos || []), ...newVideos];
        
        // Update local storage
        chrome.storage.local.set({
          likedVideos: allVideos,
          nextPageToken: data.nextPageToken || null,
          totalResults: data.pageInfo?.totalResults || allVideos.length
        });
        
        sendResponse({
          success: true,
          videos: newVideos,
          nextPageToken: data.nextPageToken,
          totalResults: data.pageInfo?.totalResults
        });
      } catch (error) {
        console.error('Error fetching more videos:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true;
  }

  if (request.action === 'openDashboard') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    return false;
  }

  if (request.action === 'exportData') {
    chrome.storage.local.get('likedVideos', (result) => {
      if (!result.likedVideos || result.likedVideos.length === 0) {
        alert('No data to export. Please fetch your liked videos first.');
        return;
      }
      
      // Create exportable data
      const exportData = JSON.stringify(result.likedVideos, null, 2);
      
      // Create a blob and download it
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: 'youtube-liked-videos.json',
        saveAs: true
      });
    });
    return false; // No async response needed
  }

  if (request.action === 'deleteVideo') {
    chrome.storage.local.get(['userToken', 'likedVideos'], async (result) => {
      if (!result.userToken) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        // Call YouTube API to remove video from liked list
        const response = await fetch(`${API_BASE}/videos/rate`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${result.userToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `id=${request.videoId}&rating=none`
        });
        
        if (!response.ok) throw new Error('Failed to delete video from liked list');
        
        // Update local storage
        if (result.likedVideos) {
          const updatedVideos = result.likedVideos.filter(video => video.id !== request.videoId);
          chrome.storage.local.set({ likedVideos: updatedVideos });
        }
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error deleting video:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Keep the message channel open for the async response
  }
  
  if (request.action === 'fetchSubscriptions') {
    chrome.storage.local.get('userToken', async (result) => {
      if (!result.userToken) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        // Fetch user's subscriptions
        const response = await fetch(`${SUBSCRIPTIONS_ENDPOINT}?part=snippet&mine=true&maxResults=50`, {
          headers: { Authorization: `Bearer ${result.userToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch subscriptions');
        
        const data = await response.json();
        
        // Process subscriptions
        const subscriptions = data.items.map(item => ({
          id: item.id,
          channelId: item.snippet.resourceId.channelId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails.default?.url || '',
          publishedAt: item.snippet.publishedAt
        }));
        
        // Store subscriptions locally
        chrome.storage.local.set({
          subscriptions: subscriptions,
          subscriptionsNextPageToken: data.nextPageToken || null,
          totalSubscriptions: data.pageInfo?.totalResults || subscriptions.length
        });
        
        sendResponse({
          success: true,
          count: subscriptions.length,
          openDashboard: false // We're not opening a separate dashboard yet
        });
      } catch (error) {
        console.error('Error fetching subscriptions:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true;
  }
});

// Function to authenticate with YouTube
async function authenticate() {
  return new Promise((resolve, reject) => {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URL)}&scope=${encodeURIComponent(SCOPES.join(' '))}`;
    
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!redirectUrl) {
          reject(new Error('Authentication failed'));
          return;
        }
        
        const url = new URL(redirectUrl);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        
        if (!token) {
          reject(new Error('No access token found in the response'));
          return;
        }
        
        resolve(token);
      }
    );
  });
}

// Get user info with the access token
async function getUserInfo(token) {
  try {
    const response = await fetch(USER_INFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user information');
    }
    
    const userInfo = await response.json();
    return { token, userInfo };
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
}

// Open dashboard when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});
