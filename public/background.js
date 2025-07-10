// Enhanced YouTube Enhancer Background Script with Token Refresh and Persistence
console.log('🚀 YouTube Enhancer background script loaded');

// OAuth 2.0 constants
const CLIENT_ID = '304162096302-4mpo9949jogs1ptnpmc0s4ipkq53dbsm.apps.googleusercontent.com';
const REDIRECT_URL = chrome.identity.getRedirectURL();
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

// YouTube API endpoints
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const VIDEOS_ENDPOINT = `${API_BASE}/videos`;
const CHANNELS_ENDPOINT = `${API_BASE}/channels`;
const PLAYLIST_ITEMS_ENDPOINT = `${API_BASE}/playlistItems`;

// Set up extension installation/startup
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('📦 Extension installed successfully');
    console.log('🔗 OAuth Redirect URL:', REDIRECT_URL);
  }
});

// NEW: Token validation and refresh utility
async function validateAndRefreshToken() {
  try {
    console.log('🔍 Validating stored token...');
    
    const storage = await chrome.storage.local.get(['userToken', 'tokenExpiry', 'userInfo']);
    
    if (!storage.userToken) {
      console.log('❌ No token found');
      return { valid: false, needsAuth: true };
    }
    
    // Check if token is expired (with 5-minute buffer)
    const now = Date.now();
    const expiryTime = storage.tokenExpiry || 0;
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    
    if (expiryTime && now > (expiryTime - bufferTime)) {
      console.log('⏰ Token is expired or about to expire, refreshing...');
      return await refreshToken();
    }
    
    // Test token validity with a simple API call
    try {
      const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        headers: { 'Authorization': `Bearer ${storage.userToken}` }
      });
      
      if (testResponse.ok) {
        const tokenInfo = await testResponse.json();
        console.log('✅ Token is valid, expires in:', tokenInfo.expires_in, 'seconds');
        
        // Update expiry time based on API response
        if (tokenInfo.expires_in) {
          const newExpiry = now + (tokenInfo.expires_in * 1000);
          await chrome.storage.local.set({ tokenExpiry: newExpiry });
        }
        
        return { valid: true, token: storage.userToken };
      } else {
        console.log('❌ Token validation failed, needs refresh');
        return await refreshToken();
      }
    } catch (error) {
      console.log('❌ Token validation error:', error.message);
      return await refreshToken();
    }
    
  } catch (error) {
    console.error('❌ Token validation error:', error);
    return { valid: false, needsAuth: true };
  }
}

// NEW: Token refresh function
async function refreshToken() {
  try {
    console.log('🔄 Attempting to refresh token...');
    
    // Clear the cached token first
    await chrome.storage.local.remove(['userToken', 'tokenExpiry']);
    
    // Use Chrome Identity API to get a fresh token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ 
        interactive: false, // Don't show UI for refresh
        scopes: SCOPES 
      }, (token) => {
        if (chrome.runtime.lastError || !token) {
          console.log('🔄 Silent refresh failed, will need interactive auth');
          resolve(null);
        } else {
          resolve(token);
        }
      });
    });
    
    if (token) {
      console.log('✅ Token refreshed successfully');
      
      // Get token expiry information
      const tokenInfoResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let expiry = Date.now() + (3600 * 1000); // Default 1 hour
      if (tokenInfoResponse.ok) {
        const tokenInfo = await tokenInfoResponse.json();
        if (tokenInfo.expires_in) {
          expiry = Date.now() + (tokenInfo.expires_in * 1000);
        }
      }
      
      await chrome.storage.local.set({ 
        userToken: token, 
        tokenExpiry: expiry 
      });
      
      return { valid: true, token: token };
    } else {
      console.log('❌ Token refresh failed, needs interactive auth');
      return { valid: false, needsAuth: true };
    }
    
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    return { valid: false, needsAuth: true };
  }
}

// ENHANCED: Authentication with better token handling and expiry tracking
async function authenticateWithYouTube() {
  try {
    console.log('🔐 Starting YouTube authentication with Chrome Identity API...');

    // First check if we have a valid token
    const tokenCheck = await validateAndRefreshToken();
    if (tokenCheck.valid) {
      console.log('✅ Using existing valid token');
      const storage = await chrome.storage.local.get(['userInfo']);
      return { success: true, user: storage.userInfo };
    }

    // Clear any existing tokens first
    await chrome.storage.local.remove(['userToken', 'userInfo', 'userId', 'tokenExpiry']);

    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ 
        interactive: true, 
        scopes: SCOPES 
      }, (token) => {
        if (chrome.runtime.lastError || !token) {
          return reject(new Error(chrome.runtime.lastError?.message || 'Failed to get auth token.'));
        }
        resolve(token);
      });
    });

    // Get token expiry information
    const tokenInfoResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let expiry = Date.now() + (3600 * 1000); // Default 1 hour
    if (tokenInfoResponse.ok) {
      const tokenInfo = await tokenInfoResponse.json();
      if (tokenInfo.expires_in) {
        expiry = Date.now() + (tokenInfo.expires_in * 1000);
      }
    }

    // Fetch user info using the token
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info.');
    }
    
    const userInfo = await userInfoResponse.json();

    // Store user data with expiry
    await chrome.storage.local.set({ 
      userToken: token, 
      userInfo: userInfo, 
      userId: userInfo.id,
      tokenExpiry: expiry,
      lastAuthTime: Date.now()
    });
    
    console.log('✅ User authenticated and info stored:', userInfo);
    console.log('⏰ Token expires at:', new Date(expiry).toLocaleString());
    
    return { success: true, user: userInfo };

  } catch (error) {
    console.error('❌ Authentication error:', error);
    return { success: false, error: error.message };
  }
}

// ENHANCED: All API calls now use token validation
async function makeAuthenticatedRequest(url, options = {}) {
  try {
    // Validate token before making request
    const tokenCheck = await validateAndRefreshToken();
    
    if (!tokenCheck.valid) {
      if (tokenCheck.needsAuth) {
        throw new Error('NEEDS_REAUTH');
      } else {
        throw new Error('Token validation failed');
      }
    }
    
    // Make the request with the validated token
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${tokenCheck.token}`,
        'Accept': 'application/json'
      }
    });
    
    // Handle token expiry during request
    if (response.status === 401) {
      console.log('🔄 Request returned 401, token may be expired');
      
      // Try to refresh token one more time
      const refreshResult = await refreshToken();
      if (refreshResult.valid) {
        // Retry the request with new token
        return await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${refreshResult.token}`,
            'Accept': 'application/json'
          }
        });
      } else {
        throw new Error('NEEDS_REAUTH');
      }
    }
    
    return response;
    
  } catch (error) {
    if (error.message === 'NEEDS_REAUTH') {
      throw error;
    }
    console.error('❌ Authenticated request error:', error);
    throw error;
  }
}

// UPDATED: Use the new authenticated request function
async function getLikedPlaylistId() {
  try {
    console.log('🔍 Attempting to get liked videos playlist ID...');
    
    const channelResponse = await makeAuthenticatedRequest(
      `${CHANNELS_ENDPOINT}?part=contentDetails,snippet&mine=true`
    );
    
    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error('❌ Channel API error:', channelResponse.status, errorText);
      
      if (channelResponse.status === 403) {
        console.log('🔄 Channel access denied, trying alternative approach...');
        throw new Error('CHANNEL_ACCESS_DENIED');
      }
      
      throw new Error(`Failed to get channel info: ${channelResponse.status} - ${errorText}`);
    }
    
    const channelData = await channelResponse.json();
    console.log('📺 Channel data received:', channelData);
    
    if (!channelData.items || channelData.items.length === 0) {
      console.log('⚠️ No channel found, trying alternative approach...');
      throw new Error('NO_CHANNEL_FOUND');
    }
    
    const channel = channelData.items[0];
    const likedPlaylistId = channel.contentDetails?.relatedPlaylists?.likes;
    
    if (!likedPlaylistId) {
      console.log('⚠️ No liked playlist ID found, trying alternative approach...');
      throw new Error('NO_LIKED_PLAYLIST');
    }
    
    console.log('✅ Found liked playlist ID:', likedPlaylistId);
    
    // Test playlist access
    const testResponse = await makeAuthenticatedRequest(
      `${PLAYLIST_ITEMS_ENDPOINT}?part=snippet&playlistId=${likedPlaylistId}&maxResults=1`
    );
    
    if (!testResponse.ok) {
      console.log('⚠️ Playlist access test failed, trying alternative approach...');
      throw new Error('PLAYLIST_ACCESS_DENIED');
    }
    
    console.log('✅ Playlist access confirmed');
    return likedPlaylistId;
    
  } catch (error) {
    console.log('❌ Primary method failed:', error.message);
    throw error;
  }
}

// UPDATED: Enhanced fetch with automatic token refresh
async function fetchLikedVideos(pageToken = null) {
  try {
    console.log('📺 Starting liked videos fetch process...', pageToken ? `with pageToken: ${pageToken}` : 'initial fetch');
    
    let videos = [];
    let nextPageToken = null;
    let totalResults = 0;
    
    try {
      console.log('🎯 Attempting playlist approach...');
      const likedPlaylistId = await getLikedPlaylistId();
      const result = await fetchVideosFromPlaylist(likedPlaylistId, pageToken);
      videos = result.videos;
      nextPageToken = result.nextPageToken;
      totalResults = result.totalResults;
      
    } catch (playlistError) {
      console.log('⚠️ Playlist approach failed:', playlistError.message);
      
      // Handle re-authentication needs
      if (playlistError.message === 'NEEDS_REAUTH') {
        return {
          success: false,
          error: 'Authentication expired. Please sign in again.',
          needsReauth: true
        };
      }
      
      // Try alternative approach
      if (['CHANNEL_ACCESS_DENIED', 'NO_CHANNEL_FOUND', 'NO_RELATED_PLAYLISTS', 'NO_LIKED_PLAYLIST', 'PLAYLIST_ACCESS_DENIED'].includes(playlistError.message)) {
        try {
          console.log('🔄 Trying myRating approach...');
          const result = await fetchLikedVideosViaRating(pageToken);
          videos = result.videos;
          nextPageToken = result.nextPageToken;
          totalResults = result.totalResults;
        } catch (ratingError) {
          if (ratingError.message === 'NEEDS_REAUTH') {
            return {
              success: false,
              error: 'Authentication expired. Please sign in again.',
              needsReauth: true
            };
          }
          
          console.error('❌ Rating approach also failed:', ratingError.message);
          return {
            success: false,
            error: `Unable to fetch liked videos. Primary error: ${playlistError.message}. Alternative method also failed: ${ratingError.message}. Please ensure your liked videos are public in your YouTube privacy settings and try re-authenticating.`
          };
        }
      } else {
        throw playlistError;
      }
    }
    
    console.log(`✅ Successfully fetched ${videos.length} liked videos`);
    
    if (videos.length === 0 && !pageToken) {
      return {
        success: true,
        videos: [],
        count: 0,
        nextPageToken: null,
        totalResults: 0,
        message: 'No liked videos found. This could be because your liked videos are private or you haven\'t liked any videos yet.'
      };
    }
    
    // Store videos if first fetch
    if (!pageToken) {
      await chrome.storage.local.set({ 
        likedVideos: videos,
        nextPageToken: nextPageToken,
        totalResults: totalResults,
        lastFetchTime: Date.now()
      });
    }
    
    return {
      success: true,
      videos: videos,
      count: videos.length,
      nextPageToken: nextPageToken,
      totalResults: totalResults
    };
    
  } catch (error) {
    console.error('❌ Error in fetchLikedVideos:', error);
    
    if (error.message === 'NEEDS_REAUTH') {
      return {
        success: false,
        error: 'Authentication expired. Please sign in again.',
        needsReauth: true
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// UPDATED: Helper functions with new authentication
async function fetchVideosFromPlaylist(playlistId, pageToken = null) {
  console.log('📋 Fetching from playlist:', playlistId, pageToken ? `page: ${pageToken}` : 'first page');
  
  let url = `${PLAYLIST_ITEMS_ENDPOINT}?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }
  
  const playlistResponse = await makeAuthenticatedRequest(url);
  
  if (!playlistResponse.ok) {
    const errorText = await playlistResponse.text();
    console.error('Playlist API error:', playlistResponse.status, errorText);
    throw new Error(`Failed to fetch liked videos playlist: ${playlistResponse.status} - ${errorText}`);
  }
  
  const playlistData = await playlistResponse.json();
  console.log('📋 Playlist data:', playlistData);
  
  if (!playlistData.items || playlistData.items.length === 0) {
    console.log('📋 Playlist is empty or no items returned');
    return {
      videos: [],
      nextPageToken: null,
      totalResults: playlistData.pageInfo?.totalResults || 0
    };
  }
  
  // Extract video IDs and get detailed information
  const videoIds = playlistData.items.map(item => item.contentDetails.videoId).join(',');
  console.log('🆔 Video IDs to fetch:', videoIds);
  
  const videosResponse = await makeAuthenticatedRequest(
    `${VIDEOS_ENDPOINT}?part=snippet,statistics,contentDetails&id=${videoIds}`
  );
  
  if (!videosResponse.ok) {
    const errorText = await videosResponse.text();
    console.error('Videos API error:', videosResponse.status, errorText);
    throw new Error(`Failed to fetch video details: ${videosResponse.status}`);
  }
  
  const videosData = await videosResponse.json();
  console.log('📹 Videos data:', videosData);
  
  // Process videos
  const videos = playlistData.items.map(playlistItem => {
    const videoDetails = videosData.items.find(video => video.id === playlistItem.contentDetails.videoId);
    
    if (!videoDetails) {
      console.warn('⚠️ Video details not found for:', playlistItem.contentDetails.videoId);
      return null;
    }
    
    return {
      id: videoDetails.id,
      title: videoDetails.snippet.title,
      channelTitle: videoDetails.snippet.channelTitle,
      channelId: videoDetails.snippet.channelId,
      publishedAt: videoDetails.snippet.publishedAt,
      likedAt: playlistItem.snippet.publishedAt,
      thumbnail: videoDetails.snippet.thumbnails.medium?.url || videoDetails.snippet.thumbnails.default?.url || '',
      viewCount: videoDetails.statistics?.viewCount || '0',
      likeCount: videoDetails.statistics?.likeCount || '0',
      duration: videoDetails.contentDetails?.duration || '',
      url: `https://www.youtube.com/watch?v=${videoDetails.id}`
    };
  }).filter(video => video !== null);
  
  console.log(`✅ Processed ${videos.length} videos from playlist`);
  
  return {
    videos: videos,
    nextPageToken: playlistData.nextPageToken || null,
    totalResults: playlistData.pageInfo?.totalResults || videos.length
  };
}

async function fetchLikedVideosViaRating(pageToken = null) {
  console.log('⭐ Attempting to find liked videos via myRating parameter...', pageToken ? `page: ${pageToken}` : 'first page');
  
  let url = `${VIDEOS_ENDPOINT}?part=snippet,statistics,contentDetails&myRating=like&maxResults=50`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }
  
  const response = await makeAuthenticatedRequest(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('MyRating API error:', response.status, errorText);
    throw new Error(`Failed to fetch liked videos via rating: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('⭐ MyRating response:', data);
  
  if (!data.items || data.items.length === 0) {
    return {
      videos: [],
      nextPageToken: null,
      totalResults: data.pageInfo?.totalResults || 0
    };
  }
  
  const videos = data.items.map(video => ({
    id: video.id,
    title: video.snippet.title,
    channelTitle: video.snippet.channelTitle,
    channelId: video.snippet.channelId,
    publishedAt: video.snippet.publishedAt,
    likedAt: video.snippet.publishedAt,
    thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url || '',
    viewCount: video.statistics?.viewCount || '0',
    likeCount: video.statistics?.likeCount || '0',
    duration: video.contentDetails?.duration || '',
    url: `https://www.youtube.com/watch?v=${video.id}`
  }));
  
  console.log(`⭐ Found ${videos.length} videos via myRating approach`);
  
  return {
    videos: videos,
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo?.totalResults || videos.length
  };
}

// UPDATED: All other functions with authentication handling
async function fetchMoreLikedVideos(pageToken) {
  console.log('📺 Fetching more liked videos with pageToken:', pageToken);
  
  if (!pageToken) {
    return {
      success: false,
      error: 'No page token provided for pagination'
    };
  }
  
  try {
    const result = await fetchLikedVideos(pageToken);
    
    if (result.success) {
      const storage = await chrome.storage.local.get(['likedVideos', 'totalResults']);
      const currentVideos = storage.likedVideos || [];
      const allVideos = [...currentVideos, ...result.videos];
      
      await chrome.storage.local.set({
        likedVideos: allVideos,
        nextPageToken: result.nextPageToken,
        totalResults: result.totalResults
      });
      
      return {
        success: true,
        videos: result.videos,
        allVideos: allVideos,
        count: result.videos.length,
        totalCount: allVideos.length,
        nextPageToken: result.nextPageToken,
        totalResults: result.totalResults
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error fetching more videos:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function deleteVideoFromYouTube(videoId) {
  try {
    console.log('🗑️ Deleting video from YouTube:', videoId);
    
    const response = await makeAuthenticatedRequest(`${API_BASE}/videos/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `id=${videoId}&rating=none`
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('YouTube API delete error:', response.status, errorText);
      throw new Error(`Failed to delete video from YouTube: ${response.status}`);
    }
    
    console.log('✅ Video successfully removed from YouTube liked list');
    
    return {
      success: true,
      message: 'Video removed from YouTube liked list'
    };
    
  } catch (error) {
    console.error('❌ Error deleting video from YouTube:', error);
    
    if (error.message === 'NEEDS_REAUTH') {
      return {
        success: false,
        error: 'Authentication expired. Please sign in again.',
        needsReauth: true
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

async function exportLikedVideos() {
  try {
    console.log('📤 Starting FULL export of ALL liked videos...');
    
    let allVideos = [];
    let pageToken = null;
    let totalFetched = 0;
    let totalAvailable = 0;
    
    console.log('🔄 Fetching ALL liked videos for export...');
    
    do {
      console.log(`📥 Fetching page ${pageToken ? `(${pageToken})` : '1'}...`);
      
      const result = await fetchLikedVideos(pageToken);
      
      if (!result.success) {
        if (result.needsReauth) {
          throw new Error('Authentication expired. Please sign in again.');
        }
        throw new Error(result.error);
      }
      
      allVideos = [...allVideos, ...result.videos];
      pageToken = result.nextPageToken;
      totalFetched += result.videos.length;
      totalAvailable = result.totalResults || totalFetched;
      
      console.log(`📊 Progress: ${totalFetched}/${totalAvailable} videos fetched`);
      
      if (totalFetched >= 1000) {
        console.log('⚠️ Reached safety limit of 1000 videos');
        break;
      }
      
    } while (pageToken && totalFetched < totalAvailable);
    
    console.log(`✅ Finished fetching! Total videos: ${allVideos.length}`);
    
    if (allVideos.length === 0) {
      return {
        success: false,
        error: 'No liked videos found to export.'
      };
    }
    
    const storage = await chrome.storage.local.get(['userInfo']);
    
    const exportData = {
      exportDate: new Date().toISOString(),
      exportType: 'FULL_LIKED_VIDEOS_EXPORT',
      userInfo: {
        email: storage.userInfo?.email || 'Unknown',
        name: storage.userInfo?.name || 'Unknown'
      },
      statistics: {
        totalVideos: allVideos.length,
        totalAvailableOnYouTube: totalAvailable,
        exportCompleteness: ((allVideos.length / totalAvailable) * 100).toFixed(1) + '%'
      },
      note: 'Complete export of YouTube liked videos with accurate timestamps and metadata',
      videos: allVideos.map((video, index) => ({
        ...video,
        exportIndex: index + 1,
        exportedAt: new Date().toISOString()
      }))
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    
    await chrome.downloads.download({
      url: dataUrl,
      filename: `youtube-liked-videos-FULL-${new Date().toISOString().split('T')[0]}.json`,
      saveAs: true
    });
    
    console.log('✅ FULL export file created successfully');
    
    return {
      success: true,
      count: allVideos.length,
      totalAvailable: totalAvailable,
      completeness: ((allVideos.length / totalAvailable) * 100).toFixed(1) + '%',
      message: `FULL export successful! ${allVideos.length} of ${totalAvailable} liked videos exported (${((allVideos.length / totalAvailable) * 100).toFixed(1)}% complete).`
    };
    
  } catch (error) {
    console.error('❌ Full export error:', error);
    
    if (error.message === 'NEEDS_REAUTH' || error.message.includes('Authentication expired')) {
      return {
        success: false,
        error: 'Authentication expired. Please sign in again.',
        needsReauth: true
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// NEW: Check authentication status on startup
async function checkAuthOnStartup() {
  try {
    console.log('🔍 Checking authentication status on startup...');
    
    const storage = await chrome.storage.local.get(['userToken', 'userInfo', 'lastAuthTime']);
    
    if (!storage.userToken || !storage.userInfo) {
      console.log('❌ No stored authentication found');
      return;
    }
    
    const tokenCheck = await validateAndRefreshToken();
    
    if (tokenCheck.valid) {
      console.log('✅ Authentication is valid on startup');
    } else {
      console.log('❌ Authentication is invalid, user will need to re-authenticate');
      // Clear invalid data
      await chrome.storage.local.remove(['userToken', 'userInfo', 'userId', 'tokenExpiry']);
    }
    
  } catch (error) {
    console.error('❌ Error checking auth on startup:', error);
  }
}

// NEW: Periodic token validation
setInterval(async () => {
  try {
    const storage = await chrome.storage.local.get(['userToken']);
    if (storage.userToken) {
      console.log('🔄 Periodic token validation...');
      await validateAndRefreshToken();
    }
  } catch (error) {
    console.error('❌ Periodic token validation error:', error);
  }
}, 15 * 60 * 1000); // Check every 15 minutes

// Message handling with enhanced error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message);
  
  switch (message.action) {
    case 'authenticate':
      authenticateWithYouTube().then(sendResponse);
      return true;
      
    case 'fetchLikedVideos':
      fetchLikedVideos().then(sendResponse);
      return true;
      
    case 'fetchMoreVideos':
      fetchMoreLikedVideos(message.pageToken).then(sendResponse);
      return true;
      
    case 'deleteVideo':
      deleteVideoFromYouTube(message.videoId).then(sendResponse);
      return true;
      
    case 'exportData':
      exportLikedVideos().then(sendResponse);
      return true;
      
    case 'checkAuth':
      validateAndRefreshToken().then(result => {
        sendResponse({ 
          authenticated: result.valid,
          needsReauth: result.needsAuth 
        });
      });
      return true;
      
    default:
      console.log('❓ Unknown action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Enhanced startup handling
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Extension startup');
  checkAuthOnStartup();
});

// Check auth when service worker becomes active
checkAuthOnStartup();

console.log('✅ Enhanced background script fully initialized with token refresh capabilities');