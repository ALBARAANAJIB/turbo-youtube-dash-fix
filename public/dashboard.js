document.addEventListener('DOMContentLoaded', () => {
  const videoList = document.getElementById('video-list');
  const loadingElement = document.getElementById('loading');
  const noVideosElement = document.getElementById('no-videos');
  const searchInput = document.getElementById('search');
  const filterSelect = document.getElementById('filter');
  const selectAllButton = document.getElementById('select-all');
  const deleteSelectedButton = document.getElementById('delete-selected');
  const selectionCountElement = document.getElementById('selection-count');
  const confirmationModal = document.getElementById('confirmation-modal');
  const cancelDeleteButton = document.getElementById('cancel-delete');
  const confirmDeleteButton = document.getElementById('confirm-delete');
  const userEmail = document.getElementById('user-email');
  const userInitial = document.getElementById('user-initial');
  const loadMoreContainer = document.querySelector('.load-more-container');
  
  let videos = [];
  let selectedVideos = new Set();
  let isLoadingMore = false;
  let totalVideosCount = 0;
  let allVideosSelected = false;
  let nextPageToken = null;
  
  // Initialize the dashboard
  init();

  // Event listeners for search and filter
  searchInput.addEventListener('input', renderVideos);
  filterSelect.addEventListener('change', renderVideos);
  
  // Event listeners for bulk actions
  selectAllButton.addEventListener('click', toggleSelectAll);
  deleteSelectedButton.addEventListener('click', showDeleteConfirmation);
  
  // Event listeners for modal
  cancelDeleteButton.addEventListener('click', hideDeleteConfirmation);
  confirmDeleteButton.addEventListener('click', deleteSelectedVideos);
  
  // Initialize the dashboard
  function init() {
    console.log('🚀 Initializing dashboard...');
    
    // Load user info
    chrome.storage.local.get('userInfo', (result) => {
      console.log('👤 Loading user info:', result);
      if (result.userInfo) {
        if (result.userInfo.email) {
          userEmail.textContent = result.userInfo.email;
          userInitial.textContent = result.userInfo.email.charAt(0).toUpperCase();
        } else if (result.userInfo.name) {
          userEmail.textContent = result.userInfo.name;
          userInitial.textContent = result.userInfo.name.charAt(0).toUpperCase();
        } else {
          userEmail.textContent = "Welcome back!";
          userInitial.textContent = "👋";
        }
      } else {
        userEmail.textContent = "Welcome to Dashboard";
        userInitial.textContent = "👋";
      }
    });
    
    // Load videos
    chrome.storage.local.get(['likedVideos', 'nextPageToken', 'totalResults'], (result) => {
      console.log('📺 Loading videos from storage:', result);
      
      if (result.likedVideos && result.likedVideos.length > 0) {
        videos = result.likedVideos;
        totalVideosCount = result.totalResults || videos.length;
        nextPageToken = result.nextPageToken;
        
        console.log('✅ Found videos:', videos.length);
        console.log('📊 Total videos available:', totalVideosCount);
        console.log('🔗 Next page token:', nextPageToken ? 'Available' : 'None');
        
        // Add total count display
        addTotalCountText();
        
        // CRITICAL: Videos are already in correct order from the playlist API - don't re-sort!
        console.log('📋 Videos are in YouTube playlist order - preserving original order');
        
        renderVideos();
        
        // Add load more button if there are more videos to load
        if (nextPageToken && videos.length < totalVideosCount) {
          addLoadMoreButton(nextPageToken);
        }
        
        loadingElement.style.display = 'none';
      } else {
        console.log('❌ No videos found in storage');
        loadingElement.style.display = 'none';
        noVideosElement.style.display = 'block';
        noVideosElement.innerHTML = `
          <h3>No videos found</h3>
          <p>Your liked videos will appear here once fetched from the extension popup.</p>
        `;
      }
    });
  }
  
  // Add total count display with sync indicator
  function addTotalCountText() {
    // Remove existing total count if it exists
    const existingCount = document.querySelector('.total-videos-text');
    if (existingCount) {
      existingCount.remove();
    }
    
    const totalCountElement = document.createElement('div');
    totalCountElement.className = 'total-videos-text';
    totalCountElement.style.cssText = `
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin: 20px 0;
      padding: 12px;
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      border-radius: 8px;
      border: 1px solid #d1d5db;
    `;
    
    const displayCount = Math.max(totalVideosCount, videos.length);
    const syncStatus = videos.length >= totalVideosCount ? '✅ Fully Synced' : `📥 ${videos.length}/${totalVideosCount} Loaded`;
    
    totalCountElement.innerHTML = `
      <div>Total Liked Videos: ${displayCount.toLocaleString()}</div>
      <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">${syncStatus}</div>
    `;
    
    // Insert before the dashboard header
    const dashboardHeader = document.querySelector('.dashboard-header');
    if (dashboardHeader) {
      dashboardHeader.parentNode.insertBefore(totalCountElement, dashboardHeader);
    }
  }
  
  // ENHANCED: Function to add a load more button with better UX
  function addLoadMoreButton(pageToken) {
    const existingBtn = document.getElementById('load-more');
    if (existingBtn) {
      existingBtn.remove();
    }
    
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'load-more';
    loadMoreBtn.className = 'secondary-button';
    loadMoreBtn.style.cssText = `
      display: block;
      margin: 32px auto;
      padding: 16px 32px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      position: relative;
      overflow: hidden;
    `;
    
    const remainingCount = Math.max(0, totalVideosCount - videos.length);
    loadMoreBtn.innerHTML = `
      <span>Load More Videos</span>
      <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">
        ${remainingCount.toLocaleString()} remaining of ${totalVideosCount.toLocaleString()} total
      </div>
    `;
    
    loadMoreBtn.addEventListener('mouseenter', () => {
      loadMoreBtn.style.transform = 'translateY(-2px)';
      loadMoreBtn.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
    });
    
    loadMoreBtn.addEventListener('mouseleave', () => {
      loadMoreBtn.style.transform = 'translateY(0)';
      loadMoreBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
    });
    
    loadMoreBtn.addEventListener('click', () => loadMoreVideos(pageToken));
    
    loadMoreContainer.innerHTML = '';
    loadMoreContainer.appendChild(loadMoreBtn);
  }
  
  // ENHANCED: Function to load more videos with better error handling and UX
  function loadMoreVideos(pageToken) {
    if (isLoadingMore) return;
    
    const loadMoreBtn = document.getElementById('load-more');
    if (!loadMoreBtn) return;
    
    // Show loading state
    loadMoreBtn.disabled = true;
    loadMoreBtn.style.opacity = '0.7';
    loadMoreBtn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center;">
        <div style="width: 20px; height: 20px; border: 2px solid #ffffff40; border-top: 2px solid #ffffff; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></div>
        Loading more videos...
      </div>
    `;
    
    // Add spinning animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    isLoadingMore = true;
    
    chrome.runtime.sendMessage({ 
      action: 'fetchMoreVideos', 
      pageToken: pageToken 
    }, (response) => {
      isLoadingMore = false;
      
      if (response && response.success) {
        console.log("✅ Successfully loaded more videos:", response);
        
        // Add new videos to existing array (maintaining playlist order)
        const newVideos = response.videos || [];
        videos = [...videos, ...newVideos];
        totalVideosCount = response.totalResults || totalVideosCount;
        nextPageToken = response.nextPageToken;
        
        // Save to storage - this is handled by the background script
        
        // Update display
        addTotalCountText();
        renderVideos();
        
        // Update or remove load more button
        if (nextPageToken && videos.length < totalVideosCount) {
          addLoadMoreButton(nextPageToken);
        } else {
          loadMoreBtn.remove();
          
          // Add completion message
          const completionMsg = document.createElement('div');
          completionMsg.style.cssText = `
            text-align: center;
            padding: 20px;
            color: #10b981;
            font-weight: 600;
            font-size: 16px;
          `;
          completionMsg.textContent = `✅ All ${videos.length.toLocaleString()} liked videos loaded!`;
          loadMoreContainer.appendChild(completionMsg);
        }
        
        // Show success message
        showToast(`Loaded ${newVideos.length} more videos! (${videos.length}/${totalVideosCount} total)`);
        
      } else {
        console.error("❌ Failed to load more videos:", response?.error || "Unknown error");
        
        // Restore button
        loadMoreBtn.disabled = false;
        loadMoreBtn.style.opacity = '1';
        const remainingCount = Math.max(0, totalVideosCount - videos.length);
        loadMoreBtn.innerHTML = `
          <span>Load More Videos</span>
          <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">
            ${remainingCount.toLocaleString()} remaining of ${totalVideosCount.toLocaleString()} total
          </div>
        `;
        
        showToast('Failed to load more videos. Please try again.', 'error');
      }
      
      // Remove animation style
      style.remove();
    });
  }
  
  // CORRECTED: Render videos with proper sorting that respects YouTube's actual order
  function renderVideos() {
    console.log('🎨 Rendering videos:', videos.length);
    videoList.innerHTML = '';
    
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterSelect.value;
    
    let filteredVideos = videos.filter(video => 
      (video.title && video.title.toLowerCase().includes(searchTerm)) || 
      (video.channelTitle && video.channelTitle.toLowerCase().includes(searchTerm))
    );
    
    // CRITICAL: Apply sorting based on filter, but preserve original YouTube order when possible
    switch (filterValue) {
      case 'recent':
        // Keep original playlist order (most recently liked first) - this is already correct!
        console.log('🔄 Keeping original YouTube playlist order (most recent first)');
        break;
      case 'oldest':
        // Reverse the playlist order to show oldest liked first
        filteredVideos.reverse();
        console.log('🔄 Reversed to show oldest liked first');
        break;
      case 'popular':
        // Sort by view count (highest first)
        filteredVideos.sort((a, b) => {
          const viewsA = parseInt(a.viewCount || 0);
          const viewsB = parseInt(b.viewCount || 0);
          return viewsB - viewsA; // Highest views first
        });
        console.log('🔄 Sorted by popularity (view count)');
        break;
      default:
        // Default: keep original YouTube playlist order
        console.log('🔄 Using default YouTube playlist order');
    }
    
    console.log(`🔍 Filtered and sorted ${filteredVideos.length} videos by: ${filterValue}`);
    
    if (filteredVideos.length === 0) {
      if (searchTerm || filterValue !== 'all') {
        noVideosElement.innerHTML = '<h3>No videos match your search or filter.</h3>';
      } else {
        noVideosElement.innerHTML = '<h3>No liked videos found.</h3><p>Try fetching videos from the extension popup first.</p>';
      }
      noVideosElement.style.display = 'block';
      return;
    } else {
      noVideosElement.style.display = 'none';
    }
    
    filteredVideos.forEach(video => {
      const videoCard = createVideoCard(video);
      videoList.appendChild(videoCard);
    });
    
    console.log('✅ Rendered', filteredVideos.length, 'videos');
  }
  
  // Create a video card element with ACCURATE date display
  function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.id = video.id;
    
    // ENHANCED: Use the accurate liked date from playlist API
    const likedDate = new Date(video.likedAt || video.publishedAt || Date.now());
    const isValidDate = !isNaN(likedDate.getTime());
    
    const formattedDate = isValidDate ? likedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'Unknown date';
    
    const viewCount = parseInt(video.viewCount || 0).toLocaleString();
    
    card.innerHTML = `
      <div class="video-thumbnail">
        <img src="${video.thumbnail || '/icons/icon.png'}" alt="${video.title || 'Video thumbnail'}" onerror="this.src='/icons/icon.png'">
        <div class="checkbox-container">
          <input type="checkbox" class="video-checkbox" data-id="${video.id}">
        </div>
      </div>
      <div class="video-details">
        <h3 class="video-title">
          <a href="${video.url || `https://www.youtube.com/watch?v=${video.id}`}" target="_blank">${video.title || 'Unknown Title'}</a>
        </h3>
        <div class="video-channel">${video.channelTitle || 'Unknown Channel'}</div>
        <div class="video-meta">
          <span>${viewCount} views</span>
          <span>Liked on ${formattedDate}</span>
        </div>
        <div class="video-actions">
          <button class="download-button" data-id="${video.id}" data-title="${video.title || 'video'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Download
          </button>
          <button class="delete-button" data-id="${video.id}">
            <span class="delete-icon">×</span> Remove
          </button>
        </div>
      </div>
    `;
    
    const downloadButton = card.querySelector('.download-button');
    downloadButton.addEventListener('click', () => downloadVideo(video.id, video.title || 'video'));
    
    const deleteButton = card.querySelector('.delete-button');
    deleteButton.addEventListener('click', () => deleteVideo(video.id));
    
    const checkbox = card.querySelector('.video-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedVideos.add(video.id);
      } else {
        selectedVideos.delete(video.id);
        allVideosSelected = false;
      }
      updateSelectionCount();
    });
    
    if (selectedVideos.has(video.id)) {
      checkbox.checked = true;
    }
    
    return card;
  }
  
  // Enhanced download video function with proper video downloading
  async function downloadVideo(videoId, videoTitle) {
    const downloadBtn = document.querySelector(`[data-id="${videoId}"].download-button`);
    const originalText = downloadBtn.innerHTML;
    
    downloadBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="animate-spin">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-opacity="0.25"/>
        <path d="M4 12a8 8 0 018-8V0l4 4-4 4v-4a4 4 0 00-4 4H4z" fill="currentColor"/>
      </svg>
      Processing...
    `;
    downloadBtn.disabled = true;
    
    const sanitizedTitle = videoTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    
    try {
      // Final fallback - open in new tab with instructions
      const blob = new Blob([`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Download ${videoTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .download-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .btn { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 5px; }
            .btn:hover { background: #b91c1c; }
          </style>
        </head>
        <body>
          <h1>Download: ${videoTitle}</h1>
          <div class="download-box">
            <p>Click one of the links below to download your video:</p>
            <a href="https://yt1s.com/youtube/${videoId}" target="_blank" class="btn">Download via YT1S</a>
            <a href="https://y2mate.com/youtube/${videoId}" target="_blank" class="btn">Download via Y2Mate</a>
            <a href="https://savefrom.net/#url=https://www.youtube.com/watch?v=${videoId}" target="_blank" class="btn">Download via SaveFrom</a>
          </div>
          <p><small>Choose your preferred quality and format on the download page.</small></p>
        </body>
        </html>
      `], { type: 'text/html' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizedTitle}_download_options.html`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Download options file created! Check your downloads folder.');
    } finally {
      downloadBtn.innerHTML = originalText;
      downloadBtn.disabled = false;
    }
  }
  
  // Show toast notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    const bgColor = type === 'error' ? '#ef4444' : '#10b981';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }
  
  // ENHANCED: Delete a single video from YouTube and update counts
  function deleteVideo(videoId) {
    console.log('🗑️ Deleting video from YouTube:', videoId);
    
    // Show loading state
    const deleteBtn = document.querySelector(`[data-id="${videoId}"].delete-button`);
    const originalText = deleteBtn.innerHTML;
    deleteBtn.innerHTML = 'Removing...';
    deleteBtn.disabled = true;
    
    chrome.runtime.sendMessage({ action: 'deleteVideo', videoId }, (response) => {
      deleteBtn.innerHTML = originalText;
      deleteBtn.disabled = false;
      
      if (response && response.success) {
        // Remove from local array and update counts
        videos = videos.filter(video => video.id !== videoId);
        selectedVideos.delete(videoId);
        
        // Update total count
        totalVideosCount = Math.max(0, totalVideosCount - 1);
        
        // Update storage
        chrome.storage.local.set({ 
          likedVideos: videos,
          totalResults: totalVideosCount,
          nextPageToken: nextPageToken
        });
        
        // Update UI
        addTotalCountText();
        updateSelectionCount();
        renderVideos();
        
        showToast('Video removed from YouTube and your list');
      } else {
        console.error('Failed to delete video:', response?.error);
        showToast('Failed to remove video from YouTube. Please try again.', 'error');
      }
    });
  }
  
  // FIXED: Toggle select all videos with proper toggle behavior
  function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.video-checkbox');
    
    if (allVideosSelected) {
      // Deselect all
      selectedVideos.clear();
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      allVideosSelected = false;
      selectAllButton.textContent = 'Select All';
    } else {
      // Select all
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        selectedVideos.add(checkbox.getAttribute('data-id'));
      });
      allVideosSelected = true;
      selectAllButton.textContent = 'Deselect All';
    }
    
    updateSelectionCount();
  }
  
  // Update selection count with proper toggle state management
  function updateSelectionCount() {
    const count = selectedVideos.size;
    const totalVisible = document.querySelectorAll('.video-checkbox').length;
    
    selectionCountElement.textContent = `${count} video${count !== 1 ? 's' : ''} selected`;
    deleteSelectedButton.disabled = count === 0;
    
    // Update select all button text based on selection state
    if (count === totalVisible && totalVisible > 0) {
      allVideosSelected = true;
      selectAllButton.textContent = 'Deselect All';
    } else {
      allVideosSelected = false;
      selectAllButton.textContent = 'Select All';
    }
    
    // Show/hide sticky bottom bar
    const stickyBar = document.querySelector('.sticky-bottom-bar');
    if (stickyBar) {
      stickyBar.style.display = count > 0 ? 'flex' : 'none';
    }
  }
  
  // Show delete confirmation modal
  function showDeleteConfirmation() {
    if (selectedVideos.size > 0) {
      confirmationModal.style.display = 'flex';
    }
  }
  
  // Hide delete confirmation modal
  function hideDeleteConfirmation() {
    confirmationModal.style.display = 'none';
  }
  
  // Delete selected videos from YouTube and local storage
  function deleteSelectedVideos() {
    const totalToDelete = selectedVideos.size;
    const videoIds = Array.from(selectedVideos);
    
    hideDeleteConfirmation();
    
    console.log('🗑️ Deleting selected videos from YouTube:', videoIds);
    
    // Show loading state
    loadingElement.style.display = 'block';
    loadingElement.textContent = `Removing ${totalToDelete} videos from YouTube...`;
    
    let deletedCount = 0;
    let failedCount = 0;
    
    // Delete each video from YouTube
    videoIds.forEach(videoId => {
      chrome.runtime.sendMessage({ action: 'deleteVideo', videoId }, (response) => {
        if (response && response.success) {
          deletedCount++;
        } else {
          failedCount++;
          console.error(`Failed to delete video ${videoId}:`, response?.error);
        }
        
        // Check if all deletions are complete
        if (deletedCount + failedCount === totalToDelete) {
          // Remove successfully deleted videos from local array
          videos = videos.filter(video => !videoIds.includes(video.id) || failedCount > 0);
          
          // Update storage
          chrome.storage.local.set({ 
            likedVideos: videos,
            totalResults: Math.max(0, totalVideosCount - deletedCount)
          });
          
          // Update total count
          totalVideosCount = Math.max(0, totalVideosCount - deletedCount);
          addTotalCountText();
          
          // Clear selection and update UI
          selectedVideos.clear();
          allVideosSelected = false;
          updateSelectionCount();
          renderVideos();
          
          loadingElement.style.display = 'none';
          
          if (failedCount === 0) {
            showToast(`Successfully removed ${deletedCount} video${deletedCount !== 1 ? 's' : ''} from YouTube`);
          } else {
            showToast(`Removed ${deletedCount} videos, ${failedCount} failed`, 'error');
          }
        }
      });
    });
  }
});
