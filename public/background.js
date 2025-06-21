
// YouTube Enhancer Background Script with Modern Chrome Authentication
console.log('🚀 YouTube Enhancer background script loaded');

// Set up extension installation/startup
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('📦 Extension installed successfully');
  }
});

// Modern Chrome Authentication using getAuthToken
async function authenticateWithYouTube() {
  try {
    console.log('🔐 Starting YouTube authentication with Chrome Identity API...');
    
    // Clear any existing tokens first
    await chrome.storage.local.remove(['userToken', 'userInfo']);
    
    // Use Chrome's built-in authentication
    const token = await chrome.identity.getAuthToken({
      interactive: true,
      scopes: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ]
    });
    
    if (!token) {
      throw new Error('Authentication was cancelled or failed');
    }
    
    // Ensure token is a string
    const accessToken = typeof token === 'string' ? token : token.token || '';
    
    if (!accessToken) {
      throw new Error('No valid access token received');
    }
    
    console.log('🎟️ Access token received:', accessToken.substring(0, 20) + '...');
    
    // Get user info from Google API
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user information');
    }
    
    const userInfo = await userInfoResponse.json();
    console.log('👤 User info received:', userInfo);
    
    // Store authentication data
    await chrome.storage.local.set({
      userToken: accessToken,
      userInfo: userInfo,
      tokenExpiry: Date.now() + (3600 * 1000) // 1 hour from now
    });
    
    console.log('💾 Authentication data stored successfully');
    
    return {
      success: true,
      userInfo: userInfo,
      message: 'Authentication successful!'
    };
    
  } catch (error) {
    console.error('❌ Authentication error:', error);
    
    // Clear any partial authentication data
    await chrome.storage.local.remove(['userToken', 'userInfo', 'tokenExpiry']);
    
    return {
      success: false,
      error: error.message || 'Authentication failed'
    };
  }
}

// Fetch liked videos from YouTube API
async function fetchLikedVideos() {
  try {
    console.log('📺 Fetching liked videos...');
    
    const storage = await chrome.storage.local.get(['userToken', 'tokenExpiry']);
    
    if (!storage.userToken) {
      throw new Error('Not authenticated. Please sign in first.');
    }
    
    if (storage.tokenExpiry && Date.now() > storage.tokenExpiry) {
      throw new Error('Token expired. Please sign in again.');
    }
    
    // Fetch liked videos using YouTube Data API v3
    const response = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&myRating=like&maxResults=50', {
      headers: {
        'Authorization': `Bearer ${storage.userToken}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Liked videos fetched:', data.items?.length || 0);
    
    // Store the videos
    await chrome.storage.local.set({
      likedVideos: data.items || [],
      lastFetch: Date.now()
    });
    
    return {
      success: true,
      videos: data.items || [],
      count: data.items?.length || 0
    };
    
  } catch (error) {
    console.error('❌ Error fetching liked videos:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export liked videos data
async function exportLikedVideos() {
  try {
    console.log('📤 Exporting liked videos...');
    
    const storage = await chrome.storage.local.get(['likedVideos']);
    const videos = storage.likedVideos || [];
    
    if (videos.length === 0) {
      return {
        success: false,
        error: 'No liked videos found. Please fetch your videos first.'
      };
    }
    
    // Prepare export data
    const exportData = {
      exportDate: new Date().toISOString(),
      totalVideos: videos.length,
      videos: videos.map(video => ({
        title: video.snippet?.title,
        channelTitle: video.snippet?.channelTitle,
        publishedAt: video.snippet?.publishedAt,
        videoId: video.id,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        viewCount: video.statistics?.viewCount,
        likeCount: video.statistics?.likeCount,
        thumbnail: video.snippet?.thumbnails?.medium?.url
      }))
    };
    
    // Create and download the file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    await chrome.downloads.download({
      url: url,
      filename: `youtube-liked-videos-${new Date().toISOString().split('T')[0]}.json`,
      saveAs: true
    });
    
    console.log('✅ Export completed');
    
    return {
      success: true,
      count: videos.length,
      message: 'Export completed successfully!'
    };
    
  } catch (error) {
    console.error('❌ Export error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message);
  
  switch (message.action) {
    case 'authenticate':
      authenticateWithYouTube().then(sendResponse);
      return true; // Keep message channel open for async response
      
    case 'fetchLikedVideos':
      fetchLikedVideos().then(sendResponse);
      return true;
      
    case 'exportData':
      exportLikedVideos().then(sendResponse);
      return true;
      
    default:
      console.log('❓ Unknown action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Extension startup');
});

console.log('✅ Background script fully initialized');
