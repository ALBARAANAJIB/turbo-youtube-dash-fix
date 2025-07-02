// YouTube Enhancer Background Script with Correct Liked Videos API
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

// FIXED: Modern Chrome Authentication with better token handling
// In frontend/background.js
async function authenticateWithYouTube() {
    try {
        console.log('🔐 Starting YouTube authentication with Chrome Identity API...');

        // Clear any existing tokens first
        await chrome.storage.local.remove(['userToken', 'userInfo', 'userId']); // Add 'userId' here

        const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true, scopes: SCOPES }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    return reject(new Error(chrome.runtime.lastError?.message || 'Failed to get auth token.'));
                }
                resolve(token);
            });
        });

        // Fetch user info using the token (from userinfo.profile and userinfo.email scopes)
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!userInfoResponse.ok) {
            throw new Error('Failed to fetch user info.');
        }
        const userInfo = await userInfoResponse.json();

        // Store user ID for backend use - use userInfo.id as the stable identifier
        await chrome.storage.local.set({ userToken: token, userInfo: userInfo, userId: userInfo.id }); // <--- CRUCIAL: Store userInfo.id
        console.log('User authenticated and info stored:', userInfo);
        return { success: true, user: userInfo };

    } catch (error) {
        console.error('❌ Authentication error:', error);
        return { success: false, error: error.message };
    }
}

// FIXED: Get the user's liked videos using multiple approaches with better error handling
async function getLikedPlaylistId(userToken) {
  try {
    console.log('🔍 Attempting to get liked videos playlist ID...');
    
    // Method 1: Try to get the user's channel info
    let channelResponse = await fetch(`${CHANNELS_ENDPOINT}?part=contentDetails,snippet&mine=true`, {
      headers: { 
        Authorization: `Bearer ${userToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error('❌ Channel API error:', channelResponse.status, errorText);
      
      // If we get a 403, it might be permissions issue
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
    console.log('📺 Channel details:', {
      id: channel.id,
      title: channel.snippet?.title,
      contentDetails: channel.contentDetails
    });
    
    // Check for contentDetails and relatedPlaylists
    if (!channel.contentDetails || !channel.contentDetails.relatedPlaylists) {
      console.log('⚠️ No relatedPlaylists found, trying alternative approach...');
      throw new Error('NO_RELATED_PLAYLISTS');
    }
    
    const likedPlaylistId = channel.contentDetails.relatedPlaylists.likes;
    
    if (!likedPlaylistId) {
      console.log('⚠️ No liked playlist ID found, trying alternative approach...');
      throw new Error('NO_LIKED_PLAYLIST');
    }
    
    console.log('✅ Found liked playlist ID:', likedPlaylistId);
    
    // Test if we can access the playlist
    const testResponse = await fetch(`${PLAYLIST_ITEMS_ENDPOINT}?part=snippet&playlistId=${likedPlaylistId}&maxResults=1`, {
      headers: { 
        Authorization: `Bearer ${userToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!testResponse.ok) {
      console.log('⚠️ Playlist access test failed, trying alternative approach...');
      throw new Error('PLAYLIST_ACCESS_DENIED');
    }
    
    console.log('✅ Playlist access confirmed');
    return likedPlaylistId;
    
  } catch (error) {
    console.log('❌ Primary method failed:', error.message);
    // Don't throw here - let the caller handle the fallback
    throw error;
  }
}

// ENHANCED: Fetch liked videos with improved error handling and pagination support
async function fetchLikedVideos(pageToken = null) {
  try {
    console.log('📺 Starting liked videos fetch process...', pageToken ? `with pageToken: ${pageToken}` : 'initial fetch');
    
    const storage = await chrome.storage.local.get(['userToken', 'userInfo', 'tokenExpiry']);
    
    if (!storage.userToken) {
      throw new Error('Not authenticated. Please sign in first.');
    }
    
    if (storage.tokenExpiry && Date.now() > storage.tokenExpiry) {
      console.log('🔄 Token expired, need to re-authenticate');
      throw new Error('Token expired. Please sign in again.');
    }
    
    console.log('👤 Authenticated user:', storage.userInfo?.email || storage.userInfo?.name || 'Unknown');
    
    let videos = [];
    let nextPageToken = null;
    let totalResults = 0;
    
    try {
      // Try the playlist approach first
      console.log('🎯 Attempting playlist approach...');
      const likedPlaylistId = await getLikedPlaylistId(storage.userToken);
      const result = await fetchVideosFromPlaylist(storage.userToken, likedPlaylistId, pageToken);
      videos = result.videos;
      nextPageToken = result.nextPageToken;
      totalResults = result.totalResults;
      
    } catch (playlistError) {
      console.log('⚠️ Playlist approach failed:', playlistError.message);
      
      // Only try alternative if it's a specific error we can handle
      if (['CHANNEL_ACCESS_DENIED', 'NO_CHANNEL_FOUND', 'NO_RELATED_PLAYLISTS', 'NO_LIKED_PLAYLIST', 'PLAYLIST_ACCESS_DENIED'].includes(playlistError.message)) {
        try {
          console.log('🔄 Trying myRating approach...');
          const result = await fetchLikedVideosViaRating(storage.userToken, pageToken);
          videos = result.videos;
          nextPageToken = result.nextPageToken;
          totalResults = result.totalResults;
        } catch (ratingError) {
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
    
    // If this is the first fetch (no pageToken), store the videos
    // If it's a pagination fetch, the caller will handle merging
    if (!pageToken) {
      await chrome.storage.local.set({ 
        likedVideos: videos,
        nextPageToken: nextPageToken,
        totalResults: totalResults
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
    return {
      success: false,
      error: error.message
    };
  }
}

// ENHANCED: Helper function to fetch videos from playlist with pagination
async function fetchVideosFromPlaylist(userToken, playlistId, pageToken = null) {
  console.log('📋 Fetching from playlist:', playlistId, pageToken ? `page: ${pageToken}` : 'first page');
  
  let url = `${PLAYLIST_ITEMS_ENDPOINT}?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }
  
  const playlistResponse = await fetch(url, {
    headers: { 
      Authorization: `Bearer ${userToken}`,
      'Accept': 'application/json'
    }
  });
  
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
  
  // Extract video IDs to get detailed video information
  const videoIds = playlistData.items.map(item => item.contentDetails.videoId).join(',');
  console.log('🆔 Video IDs to fetch:', videoIds);
  
  // Get detailed video information
  const videosResponse = await fetch(
    `${VIDEOS_ENDPOINT}?part=snippet,statistics,contentDetails&id=${videoIds}`, 
    {
      headers: { 
        Authorization: `Bearer ${userToken}`,
        'Accept': 'application/json'
      }
    }
  );
  
  if (!videosResponse.ok) {
    const errorText = await videosResponse.text();
    console.error('Videos API error:', videosResponse.status, errorText);
    throw new Error(`Failed to fetch video details: ${videosResponse.status}`);
  }
  
  const videosData = await videosResponse.json();
  console.log('📹 Videos data:', videosData);
  
  // Combine playlist order with video details
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
      likedAt: playlistItem.snippet.publishedAt, // This is when it was added to the liked playlist
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

// ENHANCED: Alternative method using myRating=like parameter with pagination
async function fetchLikedVideosViaRating(userToken, pageToken = null) {
  console.log('⭐ Attempting to find liked videos via myRating parameter...', pageToken ? `page: ${pageToken}` : 'first page');
  
  let url = `${VIDEOS_ENDPOINT}?part=snippet,statistics,contentDetails&myRating=like&maxResults=50`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }
  
  const response = await fetch(url, {
    headers: { 
      Authorization: `Bearer ${userToken}`,
      'Accept': 'application/json'
    }
  });
  
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
  
  // Format the videos (note: we won't have accurate "liked" dates with this method)
  const videos = data.items.map(video => ({
    id: video.id,
    title: video.snippet.title,
    channelTitle: video.snippet.channelTitle,
    channelId: video.snippet.channelId,
    publishedAt: video.snippet.publishedAt,
    likedAt: video.snippet.publishedAt, // Fallback: use published date
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

// ENHANCED: Fetch more videos with proper pagination
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
      // Get current videos from storage
      const storage = await chrome.storage.local.get(['likedVideos', 'totalResults']);
      const currentVideos = storage.likedVideos || [];
      
      // Merge new videos with existing ones
      const allVideos = [...currentVideos, ...result.videos];
      
      // Update storage
      await chrome.storage.local.set({
        likedVideos: allVideos,
        nextPageToken: result.nextPageToken,
        totalResults: result.totalResults
      });
      
      return {
        success: true,
        videos: result.videos, // Return only new videos
        allVideos: allVideos, // Return all videos for context
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

// Delete video from YouTube liked list using the API
async function deleteVideoFromYouTube(videoId) {
  try {
    console.log('🗑️ Deleting video from YouTube:', videoId);
    
    const storage = await chrome.storage.local.get(['userToken', 'tokenExpiry']);
    
    if (!storage.userToken) {
      throw new Error('Not authenticated. Please sign in first.');
    }
    
    if (storage.tokenExpiry && Date.now() > storage.tokenExpiry) {
      throw new Error('Token expired. Please sign in again.');
    }
    
    // Use YouTube API to remove the like rating (set to 'none')
    const response = await fetch(`${API_BASE}/videos/rate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${storage.userToken}`,
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
    return {
      success: false,
      error: error.message
    };
  }
}

// COMPLETELY REWRITTEN: Export function that fetches ALL liked videos
async function exportLikedVideos() {
  try {
    console.log('📤 Starting FULL export of ALL liked videos...');
    
    const storage = await chrome.storage.local.get(['userToken', 'userInfo', 'tokenExpiry']);
    
    if (!storage.userToken) {
      throw new Error('Not authenticated. Please sign in first.');
    }
    
    if (storage.tokenExpiry && Date.now() > storage.tokenExpiry) {
      throw new Error('Token expired. Please sign in again.');
    }
    
    let allVideos = [];
    let pageToken = null;
    let totalFetched = 0;
    let totalAvailable = 0;
    
    console.log('🔄 Fetching ALL liked videos for export...');
    
    // Fetch all pages of liked videos
    do {
      console.log(`📥 Fetching page ${pageToken ? `(${pageToken})` : '1'}...`);
      
      const result = await fetchLikedVideos(pageToken);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      allVideos = [...allVideos, ...result.videos];
      pageToken = result.nextPageToken;
      totalFetched += result.videos.length;
      totalAvailable = result.totalResults || totalFetched;
      
      console.log(`📊 Progress: ${totalFetched}/${totalAvailable} videos fetched`);
      
      // Prevent infinite loops
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
    
    // Prepare comprehensive export data
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
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create data URL for the JSON file
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    
    // Use chrome.downloads to save the file
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
      
    case 'fetchMoreVideos':
      fetchMoreLikedVideos(message.pageToken).then(sendResponse);
      return true;
      
    case 'deleteVideo':
      deleteVideoFromYouTube(message.videoId).then(sendResponse);
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
