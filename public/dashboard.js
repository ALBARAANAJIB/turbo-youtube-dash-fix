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
        console.log('✅ Found videos:', videos.length);
        renderVideos();
        
        if (result.totalResults) {
          const totalCount = document.createElement('div');
          totalCount.className = 'total-count';
          totalCount.textContent = `Showing ${videos.length} of ${result.totalResults} videos`;
          videoList.parentNode.insertBefore(totalCount, videoList);
          
          if (result.nextPageToken) {
            addLoadMoreButton(result.nextPageToken);
          }
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
  
  // Function to add a load more button
  function addLoadMoreButton(pageToken) {
    const existingBtn = document.getElementById('load-more');
    if (existingBtn) {
      existingBtn.remove();
    }
    
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'load-more';
    loadMoreBtn.className = 'secondary-button';
    loadMoreBtn.textContent = 'Load More Videos';
    loadMoreBtn.addEventListener('click', () => loadMoreVideos(pageToken));
    
    loadMoreContainer.innerHTML = '';
    loadMoreContainer.appendChild(loadMoreBtn);
  }
  
  // Function to load more videos using the nextPageToken
  function loadMoreVideos(pageToken) {
    if (isLoadingMore) return;
    
    const loadMoreBtn = document.getElementById('load-more');
    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading...';
    }
    
    isLoadingMore = true;
    
    chrome.runtime.sendMessage({ 
      action: 'fetchMoreVideos', 
      pageToken: pageToken 
    }, (response) => {
      isLoadingMore = false;
      
      if (response && response.success) {
        console.log("Successfully loaded more videos:", response);
        
        videos = [...videos, ...response.videos];
        
        chrome.storage.local.set({ 
          likedVideos: videos,
          nextPageToken: response.nextPageToken || null
        });
        
        renderVideos();
        
        if (response.nextPageToken) {
          addLoadMoreButton(response.nextPageToken);
        } else if (loadMoreBtn) {
          loadMoreBtn.remove();
        }
        
        const totalCount = document.querySelector('.total-count');
        if (totalCount) {
          totalCount.textContent = `Showing ${videos.length} of ${response.totalResults || videos.length} videos`;
        }
      } else {
        console.error("Failed to load more videos:", response?.error || "Unknown error");
        if (loadMoreBtn) {
          loadMoreBtn.disabled = false;
          loadMoreBtn.textContent = 'Try Again';
        }
        
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = response?.error || 'Failed to load more videos. Please try again.';
        errorMessage.style.color = '#ea384c';
        errorMessage.style.marginTop = '16px';
        errorMessage.style.textAlign = 'center';
        
        const existingError = document.querySelector('.error-message');
        if (existingError) {
          existingError.remove();
        }
        
        loadMoreContainer.appendChild(errorMessage);
        
        setTimeout(() => {
          if (errorMessage.parentNode) {
            errorMessage.remove();
          }
        }, 5000);
      }
    });
  }
  
  // Render videos based on search and filter
  function renderVideos() {
    console.log('🎨 Rendering videos:', videos.length);
    videoList.innerHTML = '';
    
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterSelect.value;
    
    let filteredVideos = videos.filter(video => 
      (video.title && video.title.toLowerCase().includes(searchTerm)) || 
      (video.channelTitle && video.channelTitle.toLowerCase().includes(searchTerm))
    );
    
    switch (filterValue) {
      case 'recent':
        filteredVideos.sort((a, b) => new Date(b.likedAt || b.publishedAt) - new Date(a.likedAt || a.publishedAt));
        break;
      case 'oldest':
        filteredVideos.sort((a, b) => new Date(a.likedAt || a.publishedAt) - new Date(b.likedAt || b.publishedAt));
        break;
      case 'popular':
        filteredVideos.sort((a, b) => parseInt(b.viewCount || 0) - parseInt(a.viewCount || 0));
        break;
      default:
        filteredVideos.sort((a, b) => new Date(b.likedAt || b.publishedAt) - new Date(a.likedAt || a.publishedAt));
    }
    
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
  
  // Create a video card element
  function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.id = video.id;
    
    const likedDate = new Date(video.likedAt || video.publishedAt || Date.now());
    const formattedDate = likedDate.toLocaleDateString();
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
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
      // Method 1: Try using a CORS-enabled API
      await tryDirectDownload(videoId, sanitizedTitle);
    } catch (error) {
      console.log('Direct download failed, trying alternative method...');
      
      try {
        // Method 2: Try using youtube-dl-web service
        await tryYoutubeDLWeb(videoUrl, sanitizedTitle);
      } catch (error2) {
        console.log('Alternative method failed, using fallback...');
        
        // Method 3: Create a downloadable link using iframe method
        await tryIframeMethod(videoId, sanitizedTitle);
      }
    } finally {
      downloadBtn.innerHTML = originalText;
      downloadBtn.disabled = false;
    }
  }
  
  // Method 1: Direct API download
  async function tryDirectDownload(videoId, title) {
    const response = await fetch(`https://api.cobalt.tools/api/json`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        vQuality: '720',
        vFormat: 'mp4',
        isAudioOnly: false
      })
    });
    
    const data = await response.json();
    
    if (data.status === 'success' && data.url) {
      const link = document.createElement('a');
      link.href = data.url;
      link.download = `${title}.mp4`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('Video download started!');
      return;
    }
    
    throw new Error('Direct download failed');
  }
  
  // Method 2: YouTube-DL Web service
  async function tryYoutubeDLWeb(videoUrl, title) {
    const response = await fetch('https://youtube-dl-web.herokuapp.com/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        format: 'mp4'
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.download_url) {
      const link = document.createElement('a');
      link.href = data.download_url;
      link.download = `${title}.mp4`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('Video download started!');
      return;
    }
    
    throw new Error('YouTube-DL web failed');
  }
  
  // Method 3: Iframe extraction method
  async function tryIframeMethod(videoId, title) {
    try {
      // Create a hidden iframe to extract video sources
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      document.body.appendChild(iframe);
      
      // Wait for iframe to load
      await new Promise(resolve => {
        iframe.onload = resolve;
        setTimeout(resolve, 3000); // Fallback timeout
      });
      
      // Try to extract video URL from iframe (this is a simplified approach)
      // In reality, this would require more complex extraction
      
      document.body.removeChild(iframe);
      
      // Fallback: Use a public video downloader service embedded
      const downloadUrl = `https://yt1s.com/api/ajaxSearch/index`;
      const formData = new FormData();
      formData.append('q', `https://www.youtube.com/watch?v=${videoId}`);
      formData.append('vt', 'mp4');
      
      const response = await fetch(downloadUrl, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.status === 'ok' && data.mess) {
        // Parse the response to get download links
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.mess, 'text/html');
        const downloadLink = doc.querySelector('a[href*="download"]');
        
        if (downloadLink) {
          const link = document.createElement('a');
          link.href = downloadLink.href;
          link.download = `${title}.mp4`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          showToast('Video download started!');
          return;
        }
      }
      
      throw new Error('Iframe method failed');
    } catch (error) {
      // Final fallback - open in new tab with instructions
      const blob = new Blob([`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Download ${title}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .download-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .btn { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 5px; }
            .btn:hover { background: #b91c1c; }
          </style>
        </head>
        <body>
          <h1>Download: ${title}</h1>
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
      link.download = `${title}_download_options.html`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Download options file created! Check your downloads folder.');
    }
  }
  
  // Show toast notification
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
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
  
  // Delete a single video
  function deleteVideo(videoId) {
    chrome.runtime.sendMessage({ action: 'deleteVideo', videoId }, (response) => {
      if (response && response.success) {
        videos = videos.filter(video => video.id !== videoId);
        selectedVideos.delete(videoId);
        updateSelectionCount();
        renderVideos();
      } else {
        alert('Failed to delete video. Please try again.');
      }
    });
  }
  
  // Toggle select all videos
  function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.video-checkbox');
    const allSelected = checkboxes.length === selectedVideos.size;
    
    if (allSelected) {
      selectedVideos.clear();
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
    } else {
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        selectedVideos.add(checkbox.getAttribute('data-id'));
      });
    }
    
    updateSelectionCount();
  }
  
  // Update selection count
  function updateSelectionCount() {
    const count = selectedVideos.size;
    selectionCountElement.textContent = `${count} video${count !== 1 ? 's' : ''} selected`;
    deleteSelectedButton.disabled = count === 0;
    
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
  
  // Delete selected videos
  function deleteSelectedVideos() {
    const totalToDelete = selectedVideos.size;
    let deleted = 0;
    let failed = 0;
    
    const videoIds = Array.from(selectedVideos);
    
    hideDeleteConfirmation();
    
    loadingElement.textContent = 'Deleting selected videos...';
    loadingElement.style.display = 'block';
    
    videoIds.forEach(videoId => {
      chrome.runtime.sendMessage({ action: 'deleteVideo', videoId }, (response) => {
        if (response && response.success) {
          deleted++;
        } else {
          failed++;
        }
        
        if (deleted + failed === totalToDelete) {
          videos = videos.filter(video => !selectedVideos.has(video.id));
          selectedVideos.clear();
          updateSelectionCount();
          loadingElement.style.display = 'none';
          renderVideos();
          
          if (failed > 0) {
            alert(`Successfully removed ${deleted} videos. Failed to remove ${failed} videos.`);
          }
        }
      });
    });
  }
});
