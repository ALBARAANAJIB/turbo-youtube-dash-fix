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
  
  let videos = [];
  let allVideos = []; // Store all fetched videos
  let selectedVideos = new Set();
  let channels = new Set(); // Store unique channels
  let isLoading = false;
  let hasMoreVideos = false;
  
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
        videos = result.likedVideos;
        allVideos = [...videos];
        
        // Extract unique channels
        videos.forEach(video => {
          if (video.channelTitle) {
            channels.add(video.channelTitle);
          }
        });
        
        // Populate channel filter dropdown
        populateChannelFilter();
        
        // Render videos
        renderVideos();
        
        // Show total count and pagination info
        updateProgressIndicator(videos.length, result.totalResults || videos.length);
        
        // Check if there are more videos to load
        hasMoreVideos = !!result.nextPageToken;
      } else {
        loadingElement.style.display = 'none';
        noVideosElement.style.display = 'block';
      }
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
          } else {
            // Show error message
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'Failed to load more videos. Try again later.';
            videoList.appendChild(errorMsg);
            
            // Remove error after 5 seconds
            setTimeout(() => {
              const errorElements = document.querySelectorAll('.error-message');
              errorElements.forEach(el => el.remove());
            }, 5000);
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
      const matchesChannel = !channelFilter || channelFilter === 'all' || 
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
      if (searchTerm || filterValue !== 'all' || channelFilter !== 'all' || startDate || endDate) {
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
        <img src="${video.thumbnail}" alt="${video.title}">
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
      } else {
        // Show error message
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = 'Failed to delete video. Please try again.';
        videoList.prepend(errorMsg);
        
        // Remove error after 5 seconds
        setTimeout(() => errorMsg.remove(), 5000);
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
  }
  
  // Toggle select all videos
  function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.video-checkbox');
    
    // Check if all are selected
    const allSelected = checkboxes.length === selectedVideos.size;
    
    if (allSelected) {
      // Deselect all
      selectedVideos.clear();
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
    } else {
      // Select all visible videos
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        selectedVideos.add(checkbox.getAttribute('data-id'));
      });
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
          
          // Show result
          if (failed > 0) {
            alert(`Successfully removed ${deleted} videos. Failed to remove ${failed} videos.`);
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
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.textContent = `${response.count} subscriptions fetched!`;
        fetchSubscriptionsButton.parentNode.insertBefore(successMsg, fetchSubscriptionsButton.nextSibling);
        
        // Remove success message after 3 seconds
        setTimeout(() => successMsg.remove(), 3000);
        
        // Handle the fetched subscriptions
        // This could open a new tab, display them in a modal, etc.
        if (response.openDashboard) {
          chrome.tabs.create({ url: chrome.runtime.getURL('subscriptions.html') });
        }
      } else {
        // Show error message
        alert('Failed to fetch subscriptions. Please try again later.');
      }
    });
  }
});
