
document.addEventListener('DOMContentLoaded', () => {
  const videoList = document.getElementById('video-list');
  const loadingElement = document.getElementById('loading');
  const noVideosElement = document.getElementById('no-videos');
  const searchInput = document.getElementById('search');
  const filterSelect = document.getElementById('filter');
  const dateFilterForm = document.getElementById('date-filter-form');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const channelFilterSelect = document.getElementById('channel-filter');
  const selectAllButton = document.getElementById('select-all');
  const select100Button = document.getElementById('select-100');
  const deleteSelectedButton = document.getElementById('delete-selected');
  const selectionCountElement = document.getElementById('selection-count');
  const confirmationModal = document.getElementById('confirmation-modal');
  const cancelDeleteButton = document.getElementById('cancel-delete');
  const confirmDeleteButton = document.getElementById('confirm-delete');
  const userEmail = document.getElementById('user-email');
  const userInitial = document.getElementById('user-initial');
  const progressIndicator = document.getElementById('progress-indicator');
  const fetchSubscriptionsButton = document.getElementById('fetch-subscriptions');
  const subscriptionsContainer = document.getElementById('subscriptions-container');
  const subscriptionsList = document.getElementById('subscriptions-list');
  
  let videos = [];
  let allVideos = []; // Store all fetched videos
  let selectedVideos = new Set();
  let channels = new Set(); // Store unique channels
  let isLoading = false;
  let hasMoreVideos = false;
  let toastTimeout = null;
  
  // Initialize the dashboard
  init();

  // Event listeners for filters
  searchInput.addEventListener('input', renderVideos);
  filterSelect.addEventListener('change', renderVideos);
  dateFilterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    renderVideos();
  });
  channelFilterSelect.addEventListener('change', renderVideos);
  
  // Event listeners for bulk actions
  selectAllButton.addEventListener('click', toggleSelectAll);
  select100Button.addEventListener('click', selectFirst100);
  deleteSelectedButton.addEventListener('click', showDeleteConfirmation);
  
  // Event listeners for modal
  cancelDeleteButton.addEventListener('click', hideDeleteConfirmation);
  confirmDeleteButton.addEventListener('click', deleteSelectedVideos);
  
  // Event listener for fetch subscriptions button
  fetchSubscriptionsButton.addEventListener('click', fetchSubscriptions);
  
  // Add event listener for infinite scrolling
  window.addEventListener('scroll', handleInfiniteScroll);
  
  // Initialize the dashboard
  function init() {
    // Set today as the end date default
    const today = new Date();
    const formattedToday = formatDateForInput(today);
    endDateInput.value = formattedToday;
    
    // Set 3 months ago as the start date default
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    startDateInput.value = formatDateForInput(threeMonthsAgo);
    
    // Load user info
    chrome.storage.local.get('userInfo', (result) => {
      if (result.userInfo) {
        if (result.userInfo.email) {
          userEmail.textContent = result.userInfo.email;
          userInitial.textContent = result.userInfo.email.charAt(0).toUpperCase();
        } else if (result.userInfo.name) {
          userEmail.textContent = result.userInfo.name;
          userInitial.textContent = result.userInfo.name.charAt(0).toUpperCase();
        } else {
          // If no email or name, show "Welcome back" message
          userEmail.textContent = "Welcome back!";
          userInitial.textContent = "👋";
        }
      } else {
        // User info not found
        userEmail.textContent = "Welcome to Dashboard";
        userInitial.textContent = "👋";
      }
    });
    
    // Load videos
    chrome.storage.local.get(['likedVideos', 'nextPageToken', 'totalResults'], (result) => {
      if (result.likedVideos && result.likedVideos.length > 0) {
        allVideos = result.likedVideos;
        
        // Extract unique channels
        allVideos.forEach(video => {
          if (video.channelTitle) {
            channels.add(video.channelTitle);
          }
        });
        
        // Populate channel filter dropdown
        populateChannelFilter();
        
        // Render videos
        renderVideos();
        
        // Show total count and pagination info
        updateProgressIndicator(allVideos.length, result.totalResults || allVideos.length);
        
        // Check if there are more videos to load
        hasMoreVideos = !!result.nextPageToken;
        
        // Load subscriptions
        loadSubscriptions();
      } else {
        loadingElement.style.display = 'none';
        noVideosElement.style.display = 'block';
      }
    });
  }
  
  // Function to load and display subscriptions
  function loadSubscriptions() {
    chrome.storage.local.get('subscriptions', (result) => {
      if (result.subscriptions && result.subscriptions.length > 0) {
        displaySubscriptions(result.subscriptions);
      }
    });
  }
  
  // Function to display subscriptions
  function displaySubscriptions(subscriptions) {
    if (!subscriptions || subscriptions.length === 0) return;
    
    subscriptionsContainer.style.display = 'block';
    subscriptionsList.innerHTML = '';
    
    subscriptions.forEach(sub => {
      const subCard = document.createElement('div');
      subCard.className = 'subscription-card';
      
      subCard.innerHTML = `
        <div class="subscription-thumbnail">
          <img src="${sub.thumbnail}" alt="${sub.title}" onerror="this.src='icons/icon.png'">
        </div>
        <div class="subscription-details">
          <div class="subscription-title">${sub.title}</div>
          <a href="https://www.youtube.com/channel/${sub.channelId}" target="_blank" class="view-channel">View Channel</a>
        </div>
      `;
      
      subCard.addEventListener('click', () => {
        // Filter videos by this channel
        channelFilterSelect.value = sub.title;
        renderVideos();
      });
      
      subscriptionsList.appendChild(subCard);
    });
  }
  
  // Function to format date for input element
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Function to populate channel filter dropdown
  function populateChannelFilter() {
    // Clear existing options except for the first one
    while (channelFilterSelect.options.length > 1) {
      channelFilterSelect.remove(1);
    }
    
    // Add channels to dropdown
    const sortedChannels = Array.from(channels).sort();
    sortedChannels.forEach(channel => {
      const option = document.createElement('option');
      option.value = channel;
      option.textContent = channel;
      channelFilterSelect.appendChild(option);
    });
  }
  
  // Handle infinite scroll
  function handleInfiniteScroll() {
    // Check if we're near the bottom of the page
    const scrollPosition = window.innerHeight + window.scrollY;
    const bodyHeight = document.body.offsetHeight;
    const scrollThreshold = bodyHeight - 500; // 500px before the bottom
    
    if (scrollPosition >= scrollThreshold && hasMoreVideos && !isLoading) {
      loadMoreVideos();
    }
  }
  
  // Function to load more videos using the nextPageToken
  function loadMoreVideos() {
    chrome.storage.local.get(['nextPageToken', 'totalResults'], (result) => {
      if (result.nextPageToken) {
        isLoading = true;
        
        // Show loading indicator
        const loadingMoreIndicator = document.createElement('div');
        loadingMoreIndicator.id = 'loading-more';
        loadingMoreIndicator.className = 'loading-more';
        loadingMoreIndicator.textContent = 'Loading more videos...';
        videoList.appendChild(loadingMoreIndicator);
        
        chrome.runtime.sendMessage({ 
          action: 'fetchMoreVideos', 
          pageToken: result.nextPageToken 
        }, (response) => {
          isLoading = false;
          
          // Remove loading indicator
          const loadingMoreIndicator = document.getElementById('loading-more');
          if (loadingMoreIndicator) {
            loadingMoreIndicator.remove();
          }
          
          if (response && response.success) {
            // Add the new videos to our arrays
            const newVideos = response.videos;
            allVideos = [...allVideos, ...newVideos];
            
            // Extract new channels
            newVideos.forEach(video => {
              if (video.channelTitle) {
                channels.add(video.channelTitle);
              }
            });
            
            // Update channel filter dropdown
            populateChannelFilter();
            
            // Check if there are more videos to load
            hasMoreVideos = !!response.nextPageToken;
            
            // Apply current filters to the updated dataset
            renderVideos();
            
            // Update the progress indicator
            updateProgressIndicator(allVideos.length, response.totalResults || allVideos.length);

            // Show toast notification
            showToast(`Loaded ${newVideos.length} more videos`);
          } else {
            // Show error message
            showToast('Failed to load more videos. Try again later.', 'error');
          }
        });
      }
    });
  }
  
  // Update progress indicator
  function updateProgressIndicator(showing, total) {
    progressIndicator.textContent = `Showing ${showing} of ${total} videos`;
  }
  
  // Render videos based on search, filters, and date range
  function renderVideos() {
    // Clear current list
    videoList.innerHTML = '';
    
    // Get search term
    const searchTerm = searchInput.value.toLowerCase();
    
    // Get filter value
    const filterValue = filterSelect.value;
    
    // Get channel filter value
    const channelFilter = channelFilterSelect.value;
    
    // Get date range filters
    const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
    
    // If end date is provided, set it to the end of the day
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Filter videos
    let filteredVideos = allVideos.filter(video => {
      // Text search filter
      const matchesSearch = !searchTerm || 
                          video.title.toLowerCase().includes(searchTerm) || 
                          video.channelTitle.toLowerCase().includes(searchTerm);
      
      // Channel filter
      const matchesChannel = channelFilter === 'all' || 
                           video.channelTitle === channelFilter;
      
      // Date filter
      let matchesDate = true;
      if (startDate || endDate) {
        const videoDate = new Date(video.likedAt);
        
        if (startDate && videoDate < startDate) {
          matchesDate = false;
        }
        
        if (endDate && videoDate > endDate) {
          matchesDate = false;
        }
      }
      
      return matchesSearch && matchesChannel && matchesDate;
    });
    
    // Apply sorting based on filter
    switch (filterValue) {
      case 'recent':
        filteredVideos.sort((a, b) => new Date(b.likedAt) - new Date(a.likedAt));
        break;
      case 'oldest':
        filteredVideos.sort((a, b) => new Date(a.likedAt) - new Date(b.likedAt));
        break;
      case 'popular':
        filteredVideos.sort((a, b) => parseInt(b.viewCount) - parseInt(a.viewCount));
        break;
      default:
        // Default is already sorted by recently liked
        filteredVideos.sort((a, b) => new Date(b.likedAt) - new Date(a.likedAt));
    }
    
    // Store current filtered videos for select operations
    videos = filteredVideos;
    
    // Display videos
    filteredVideos.forEach(video => {
      const videoCard = createVideoCard(video);
      videoList.appendChild(videoCard);
    });
    
    // Hide loading element
    loadingElement.style.display = 'none';
    
    // Show no videos message if needed
    if (filteredVideos.length === 0) {
      if (searchTerm || filterValue !== 'recent' || channelFilter !== 'all' || startDate || endDate) {
        noVideosElement.textContent = 'No videos match your search or filters.';
      } else {
        noVideosElement.textContent = 'No liked videos found. Try fetching videos first.';
      }
      noVideosElement.style.display = 'block';
    } else {
      noVideosElement.style.display = 'none';
    }
    
    // Update progress indicator showing filtered count vs total
    updateProgressIndicator(filteredVideos.length, allVideos.length);
  }
  
  // Create a video card element
  function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.id = video.id;
    
    // Format the date
    const likedDate = new Date(video.likedAt);
    const formattedDate = likedDate.toLocaleDateString();
    
    // Format view count
    const viewCount = parseInt(video.viewCount).toLocaleString();
    
    card.innerHTML = `
      <div class="video-thumbnail">
        <img src="${video.thumbnail}" alt="${video.title}" onerror="this.src='icons/icon.png'">
        <div class="checkbox-container">
          <input type="checkbox" class="video-checkbox" data-id="${video.id}">
        </div>
      </div>
      <div class="video-details">
        <h3 class="video-title">
          <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">${video.title}</a>
        </h3>
        <div class="video-channel">${video.channelTitle}</div>
        <div class="video-meta">
          <span>${viewCount} views</span>
          <span>Liked on ${formattedDate}</span>
        </div>
        <div class="video-actions">
          <button class="delete-button" data-id="${video.id}">
            <span class="delete-icon">×</span> Remove
          </button>
        </div>
      </div>
    `;
    
    // Add event listener for delete button
    const deleteButton = card.querySelector('.delete-button');
    deleteButton.addEventListener('click', () => deleteVideo(video.id));
    
    // Add event listener for checkbox
    const checkbox = card.querySelector('.video-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedVideos.add(video.id);
      } else {
        selectedVideos.delete(video.id);
      }
      updateSelectionCount();
    });
    
    // Check if this video is already selected
    if (selectedVideos.has(video.id)) {
      checkbox.checked = true;
    }
    
    return card;
  }
  
  // Delete a single video
  function deleteVideo(videoId) {
    chrome.runtime.sendMessage({ action: 'deleteVideo', videoId }, (response) => {
      if (response && response.success) {
        // Remove from arrays
        allVideos = allVideos.filter(video => video.id !== videoId);
        videos = videos.filter(video => video.id !== videoId);
        
        // Remove from selected videos if it was selected
        selectedVideos.delete(videoId);
        
        // Update selection count
        updateSelectionCount();
        
        // Re-render videos
        renderVideos();
        
        // Show success toast
        showToast('Video removed from liked videos');
      } else {
        // Show error toast
        showToast('Failed to delete video. Please try again.', 'error');
      }
    });
  }
  
  // Select first 100 videos
  function selectFirst100() {
    // Clear current selection
    selectedVideos.clear();
    
    // Select first 100 videos from currently filtered videos
    const videosToSelect = videos.slice(0, 100);
    
    videosToSelect.forEach(video => {
      selectedVideos.add(video.id);
    });
    
    // Update checkboxes
    const checkboxes = document.querySelectorAll('.video-checkbox');
    checkboxes.forEach(checkbox => {
      const videoId = checkbox.getAttribute('data-id');
      checkbox.checked = selectedVideos.has(videoId);
    });
    
    // Update selection count
    updateSelectionCount();
    
    // Show notification about selection
    if (videosToSelect.length < 100) {
      showToast(`Selected ${videosToSelect.length} videos (less than 100 available)`, 'info');
    } else {
      showToast('Selected 100 videos', 'success');
    }
  }
  
  // Toggle select all videos
  function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.video-checkbox');
    
    // Check if all are selected
    const allSelected = videos.length > 0 && videos.every(video => selectedVideos.has(video.id));
    
    if (allSelected) {
      // Deselect all
      videos.forEach(video => selectedVideos.delete(video.id));
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      showToast('All videos deselected');
    } else {
      // Select all visible videos
      videos.forEach(video => selectedVideos.add(video.id));
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
      });
      showToast(`Selected all ${videos.length} videos`);
    }
    
    // Update selection count
    updateSelectionCount();
  }
  
  // Update selection count
  function updateSelectionCount() {
    const count = selectedVideos.size;
    selectionCountElement.textContent = `${count} video${count !== 1 ? 's' : ''} selected`;
    
    // Enable or disable delete button
    deleteSelectedButton.disabled = count === 0;
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
    
    // Convert Set to Array for iteration
    const videoIds = Array.from(selectedVideos);
    
    // Hide modal
    hideDeleteConfirmation();
    
    // Show loading state
    loadingElement.textContent = 'Deleting selected videos...';
    loadingElement.style.display = 'block';
    
    // Process each video
    videoIds.forEach(videoId => {
      chrome.runtime.sendMessage({ action: 'deleteVideo', videoId }, (response) => {
        if (response && response.success) {
          deleted++;
        } else {
          failed++;
        }
        
        // Check if all operations completed
        if (deleted + failed === totalToDelete) {
          // Remove from local array
          allVideos = allVideos.filter(video => !selectedVideos.has(video.id));
          videos = videos.filter(video => !selectedVideos.has(video.id));
          
          // Clear selected videos
          selectedVideos.clear();
          
          // Update selection count
          updateSelectionCount();
          
          // Re-render videos
          loadingElement.style.display = 'none';
          renderVideos();
          
          // Show result toast
          if (failed > 0) {
            showToast(`Removed ${deleted} videos, ${failed} failed`, 'warning');
          } else {
            showToast(`Successfully removed ${deleted} videos`, 'success');
          }
        }
      });
    });
  }
  
  // Fetch user subscriptions
  function fetchSubscriptions() {
    fetchSubscriptionsButton.disabled = true;
    fetchSubscriptionsButton.textContent = 'Fetching...';
    
    chrome.runtime.sendMessage({ action: 'fetchSubscriptions' }, (response) => {
      fetchSubscriptionsButton.disabled = false;
      fetchSubscriptionsButton.textContent = 'Fetch Subscriptions';
      
      if (response && response.success) {
        // Show success toast
        showToast(`${response.count} subscriptions fetched!`, 'success');
        
        // Load and display the fetched subscriptions
        chrome.storage.local.get('subscriptions', (result) => {
          if (result.subscriptions) {
            displaySubscriptions(result.subscriptions);
          }
        });
      } else {
        // Show error toast
        showToast('Failed to fetch subscriptions. Please try again later.', 'error');
      }
    });
  }
  
  // Function to show toast messages
  function showToast(message, type = 'success') {
    // Clear any existing toast
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    
    // Create or get toast container
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '!' : 'ℹ'}</span>
        <span class="toast-message">${message}</span>
      </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Add show class after a brief delay for animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
      // Remove from DOM after animation completes
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toastContainer.removeChild(toast);
        }
      }, 300); // Match transition duration
    }, 3000);
  }
});
