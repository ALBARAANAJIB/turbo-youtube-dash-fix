
// OAuth 2.0 constants
const CLIENT_ID = '304162096302-c470kd77du16s0lrlumobc6s8u6uleng.apps.googleusercontent.com';
const REDIRECT_URL = chrome.identity.getRedirectURL();
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// YouTube API endpoints
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const LIKED_VIDEOS_ENDPOINT = `${API_BASE}/videos`;
const USER_INFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v1/userinfo';
const PLAYLIST_ITEMS_ENDPOINT = `${API_BASE}/playlistItems`;
const CHANNELS_ENDPOINT = `${API_BASE}/channels`;

// Handle messages from popup.js and content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

  if (request.action === 'fetchLikedVideos') {
    chrome.storage.local.get('userToken', async (result) => {
      if (!result.userToken) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        // First get the user's "liked videos" playlist ID
        const channelResponse = await fetch(`${CHANNELS_ENDPOINT}?part=contentDetails&mine=true`, {
          headers: { Authorization: `Bearer ${result.userToken}` }
        });
        
        if (!channelResponse.ok) throw new Error('Failed to fetch channel data');
        
        const channelData = await channelResponse.json();
        const likedPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.likes;
        
        // Then fetch the videos from that playlist
        const videos = await fetchAllLikedVideos(result.userToken, likedPlaylistId, 50);
        
        // Store the videos locally
        chrome.storage.local.set({ likedVideos: videos });
        
        // Display a toast notification on YouTube pages
        chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
          if (tabs.length > 0) {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, { 
                action: 'showToast', 
                message: `${videos.length} videos fetched. View them in your dashboard.` 
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

// Fetch liked videos from YouTube API
async function fetchAllLikedVideos(token, playlistId, maxResults = 50) {
  const videos = [];
  let nextPageToken = null;
  let totalFetched = 0;
  
  do {
    try {
      // Build request URL
      let requestUrl = `${PLAYLIST_ITEMS_ENDPOINT}?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}`;
      if (nextPageToken) {
        requestUrl += `&pageToken=${nextPageToken}`;
      }
      
      // Make the request
      const response = await fetch(requestUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch playlist items');
      }
      
      const data = await response.json();
      
      // Process each video
      for (const item of data.items) {
        if (totalFetched >= maxResults) break;
        
        // Get additional video details
        const videoResponse = await fetch(`${LIKED_VIDEOS_ENDPOINT}?part=snippet,statistics&id=${item.contentDetails.videoId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!videoResponse.ok) continue;
        
        const videoData = await videoResponse.json();
        
        if (videoData.items && videoData.items.length > 0) {
          const video = videoData.items[0];
          videos.push({
            id: video.id,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            publishedAt: video.snippet.publishedAt,
            likedAt: item.snippet.publishedAt, // When it was added to likes
            thumbnail: video.snippet.thumbnails.medium.url,
            viewCount: video.statistics.viewCount,
            likeCount: video.statistics.likeCount
          });
          
          totalFetched++;
        }
      }
      
      // Check if there are more pages
      nextPageToken = data.nextPageToken;
      
    } catch (error) {
      console.error('Error fetching videos:', error);
      break;
    }
  } while (nextPageToken && totalFetched < maxResults);
  
  return videos;
}
