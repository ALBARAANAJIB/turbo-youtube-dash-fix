// Enhanced YouTube extension with secure backend integration

// 🔥 IMPORTANT: Backend URL Configuration 🔥
const API_BASE_URL = 'http://localhost:3000/api';

// Generate or get user ID for rate limiting


function injectSummarizationPanel() {
  // Check if we're on a YouTube video page
  if (!window.location.href.includes('youtube.com/watch')) {
    return;
  }

  // Remove existing panel if it exists
  const existingPanel = document.getElementById('youtube-enhancer-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  // Wait for YouTube's secondary column to load
  const secondaryColumn = document.querySelector('#secondary');
  if (!secondaryColumn) {
    setTimeout(injectSummarizationPanel, 1000);
    return;
  }

  // Create the professional summarization panel
  const panel = document.createElement('div');
  panel.id = 'youtube-enhancer-panel';
  panel.innerHTML = `
    <div style="
      background: #ffffff;
      border-radius: 12px;
      margin-bottom: 16px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    ">
      <!-- Professional Header -->
      <div style="
        background: #f9fafb;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid #e5e7eb;
      ">
        <div style="
          width: 20px;
          height: 20px;
          background: #f3f4f6;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #374151;
          font-weight: 600;
          border: 1px solid #d1d5db;
        ">AI</div>
        <h3 style="
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          letter-spacing: -0.025em;
        ">Video Summary</h3>
        <div style="
          margin-left: auto;
          font-size: 10px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 3px;
        ">Backend: ${API_BASE_URL.includes('localhost') ? 'Local' : 'Railway'}</div>
      </div>
      
      <!-- Rate Limit Info -->
      <div id="rate-limit-info" style="
        display: none;
        background: #fef3c7;
        color: #92400e;
        padding: 12px 16px;
        font-size: 12px;
        border-bottom: 1px solid #f59e0b;
      ">
        <span id="rate-limit-text"></span>
      </div>
      
      <!-- Content -->
      <div style="padding: 20px;">
        <button id="summarize-video-btn" style="
          width: 100%;
          background: #f9fafb;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 16px;
          font-family: inherit;
          letter-spacing: -0.025em;
        " onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af'" 
           onmouseout="this.style.background='#f9fafb'; this.style.borderColor='#d1d5db'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Generate Summary</span>
        </button>
        
        <div id="summary-loading" style="
          display: none;
          text-align: center;
          padding: 24px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #f3f4f6;
        ">
          <div style="
            width: 16px;
            height: 16px;
            border: 2px solid #f3f4f6;
            border-top: 2px solid #6b7280;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 12px;
          "></div>
          <div style="
            font-size: 12px; 
            color: #6b7280;
            font-weight: 400;
          " id="loading-message">Analyzing video transcript...</div>
        </div>
        
        <div id="summary-content" style="
          display: none;
          background: #ffffff;
          border-radius: 8px;
          border: 1px solid #f3f4f6;
          overflow: hidden;
        "></div>
      </div>
    </div>
    
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;

  // Insert the panel at the top of the secondary column
  secondaryColumn.insertBefore(panel, secondaryColumn.firstChild);

  // Add event listeners
  const summarizeBtn = document.getElementById('summarize-video-btn');
  const loadingDiv = document.getElementById('summary-loading');
  const contentDiv = document.getElementById('summary-content');
  const loadingMessage = document.getElementById('loading-message');

  summarizeBtn?.addEventListener('click', async () => {
    const currentUrl = window.location.href;
    
    // Show loading
    summarizeBtn.style.display = 'none';
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';

    try {
      await summarizeVideo(currentUrl, loadingMessage, contentDiv, loadingDiv, summarizeBtn);
    } catch (error) {
      console.error('Error:', error);
      showError(contentDiv, loadingDiv, summarizeBtn, error.message);
    }
  });
}

// Fixed summarizeVideo function with proper variable handling
async function summarizeVideo(videoUrl, loadingMessage, contentDiv, loadingDiv, summarizeBtn) {
    // Clear previous content and show loading
    contentDiv.innerHTML = '';
    contentDiv.style.display = 'none';
    loadingDiv.style.display = 'block';
    summarizeBtn.disabled = true;

    try {
        // Retrieve userId from Chrome storage
        const storage = await chrome.storage.local.get('userId');
        const userId = storage.userId;

        if (!userId) {
            showError(contentDiv, loadingDiv, summarizeBtn, 'Authentication required. Please authenticate via the extension popup to use summarization.');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/summary/youtube`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoUrl: videoUrl,
                userId: userId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Handle specific error codes from the backend
            if (data.code === 'LIMIT_REACHED') {
                showRateLimitError(contentDiv, loadingDiv, summarizeBtn, data);
            } else if (data.code === 'TRANSCRIPT_TOO_LONG') {
                showError(contentDiv, loadingDiv, summarizeBtn, 'This video transcript is too long to summarize. Please try a shorter video.');
            } else if (data.code === 'TRANSCRIPT_FETCH_FAILED') {
                showError(contentDiv, loadingDiv, summarizeBtn, 'Could not fetch video transcript. It might be unavailable or private.');
            } else if (data.code === 'API_KEY_MISSING') {
                showError(contentDiv, loadingDiv, summarizeBtn, 'Summarization service is temporarily unavailable. Please try again later.');
            } else {
                showError(contentDiv, loadingDiv, summarizeBtn, data.error || 'Failed to summarize video. Please try again.');
            }
            return;
        }

        // Handle successful response
        showSuccess(contentDiv, loadingDiv, summarizeBtn, data.summary, data.metadata, data.rateLimitInfo);

    } catch (error) {
        console.error('❌ Error during summarization fetch:', error);
        showError(contentDiv, loadingDiv, summarizeBtn, 'An error occurred during summarization. Please check your internet connection or try again later.');
    } finally {
        loadingDiv.style.display = 'none';
        summarizeBtn.disabled = false;
    }
}

// NEW: Show rate limit error with upgrade message
function showRateLimitError(contentDiv, loadingDiv, summarizeBtn, errorData) {
  loadingDiv.style.display = 'none';
  
  contentDiv.innerHTML = `
    <div style="
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    ">
      <div style="
        font-size: 24px;
        margin-bottom: 12px;
      ">⏰</div>
      <div style="
        font-weight: 600; 
        margin-bottom: 8px; 
        font-size: 14px;
        color: #dc2626;
      ">Daily Limit Reached</div>
      <div style="
        font-size: 13px; 
        line-height: 1.5; 
        color: #991b1b;
        margin-bottom: 16px;
      ">${errorData.message}</div>
      <div style="
        background: #fbbf24;
        color: #92400e;
        padding: 12px;
        border-radius: 6px;
        font-size: 12px;
        margin-bottom: 16px;
        font-weight: 500;
      ">
        🌟 Upgrade to Pioneer Access for unlimited summaries!
      </div>
      <button onclick="document.getElementById('summarize-video-btn').style.display='block'; document.getElementById('summary-content').style.display='none';" style="
        background: #f9fafb;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 500;
        font-family: inherit;
      ">Try Again Tomorrow</button>
    </div>
  `;
  
  contentDiv.style.display = 'block';
}

function showSuccess(contentDiv, loadingDiv, summarizeBtn, summary, metadata, rateLimitInfo) {
  loadingDiv.style.display = 'none';
  
  // Show rate limit info if user is not pioneer
  if (rateLimitInfo && !rateLimitInfo.isPioneer) {
    const rateLimitElement = document.getElementById('rate-limit-info');
    const rateLimitText = document.getElementById('rate-limit-text');
    rateLimitText.textContent = `Free tier: ${rateLimitInfo.remainingCount} summaries remaining today`;
    rateLimitElement.style.display = 'block';
  }
  
  contentDiv.innerHTML = `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #f3f4f6;
    ">
      <strong style="
        color: #111827; 
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.025em;
      ">Video Summary</strong>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span style="font-size: 10px; color: #6b7280; background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">
          ✓ ${metadata?.detectedLanguage || 'Auto'}
        </span>
        ${rateLimitInfo && !rateLimitInfo.isPioneer ? 
          `<span style="font-size: 10px; color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 3px;">
            ${rateLimitInfo.remainingCount} left
          </span>` : ''
        }
        <button id="copy-summary" style="
          background: #ffffff;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 5px;
          padding: 5px 10px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: inherit;
        ">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          Copy
        </button>
      </div>
    </div>
    <div style="
      padding: 16px;
      line-height: 1.7;
      font-size: 14px;
      color: #111827;
      max-height: 500px;
      overflow-y: auto;
      word-wrap: break-word;
      word-break: break-word;
      white-space: pre-wrap;
      font-weight: 400;
      letter-spacing: -0.025em;
      background: #ffffff;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f1f5f9;
    " id="summary-text">${summary}</div>
  `;
  
  // Enhanced scrollbar styling for webkit browsers
  const summaryText = document.getElementById('summary-text');
  if (summaryText) {
    const style = document.createElement('style');
    style.textContent = `
      #summary-text::-webkit-scrollbar {
        width: 6px;
      }
      #summary-text::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 3px;
      }
      #summary-text::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      #summary-text::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add copy functionality
  const copyBtn = document.getElementById('copy-summary');
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(summary);
      copyBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
      `;
      copyBtn.style.color = '#059669';
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          Copy
        `;
        copyBtn.style.color = '#374151';
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  });
  
  contentDiv.style.display = 'block';
  summarizeBtn.style.display = 'block';
}

function showError(contentDiv, loadingDiv, summarizeBtn, errorMessage) {
  loadingDiv.style.display = 'none';
  
  contentDiv.innerHTML = `
    <div style="
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    ">
      <div style="
        font-size: 16px;
        margin-bottom: 8px;
      ">😔</div>
      <div style="
        font-weight: 600; 
        margin-bottom: 6px; 
        font-size: 13px;
        color: #dc2626;
      ">Something went wrong</div>
      <div style="
        font-size: 12px; 
        line-height: 1.4; 
        color: #991b1b;
        margin-bottom: 12px;
        white-space: pre-wrap;
        text-align: left;
      ">${errorMessage}</div>
      <button onclick="document.getElementById('summarize-video-btn').click()" style="
        background: #f9fafb;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 500;
        font-family: inherit;
      ">🔄 Try Again</button>
    </div>
  `;
  
  contentDiv.style.display = 'block';
  summarizeBtn.style.display = 'block';
}

// ... keep existing code (liked videos functions and initialization code)
function injectLikedVideosButtons() {
  if (!window.location.href.includes('youtube.com/playlist?list=LL')) {
    return;
  }

  const existingButtons = document.getElementById('youtube-enhancer-liked-buttons');
  if (existingButtons) {
    existingButtons.remove();
  }

  const playlistHeader = document.querySelector('#header.ytd-playlist-header-renderer');
  if (!playlistHeader) {
    setTimeout(injectLikedVideosButtons, 1000);
    return;
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'youtube-enhancer-liked-buttons';
  buttonContainer.innerHTML = `
    <div style="
      display: flex;
      gap: 12px;
      margin-top: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;
    ">
      <button id="fetch-liked-videos" style="
        background: #f9fafb;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: inherit;
      " onmouseover="this.style.background='#f3f4f6'" 
         onmouseout="this.style.background='#f9fafb'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Fetch Videos
      </button>
      
      <button id="export-liked-videos" style="
        background: #f9fafb;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: inherit;
      " onmouseover="this.style.background='#f3f4f6'" 
         onmouseout="this.style.background='#f9fafb'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Export Data
      </button>
    </div>
  `;

  playlistHeader.appendChild(buttonContainer);

  document.getElementById('fetch-liked-videos')?.addEventListener('click', () => {
    if (window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({ action: 'fetchLikedVideos' });
    }
  });

  document.getElementById('export-liked-videos')?.addEventListener('click', () => {
    if (window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({ action: 'exportData' });
    }
  });
}

// Initialize based on page type
function initializeExtension() {
  if (window.location.href.includes('youtube.com/watch')) {
    injectSummarizationPanel();
  } else if (window.location.href.includes('youtube.com/playlist?list=LL')) {
    injectLikedVideosButtons();
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeExtension, 2000);
  });
} else {
  setTimeout(initializeExtension, 2000);
}

// Handle navigation changes
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    setTimeout(initializeExtension, 2000);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showToast') {
      // Handle any toast messages if needed
    }
    return true;
  });
}
