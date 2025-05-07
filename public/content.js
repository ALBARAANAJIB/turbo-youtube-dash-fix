
// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showToast') {
    showToast(message.message);
  }
  return true;
});

// Create and show a toast notification
function showToast(message) {
  // Remove any existing toast
  const existingToast = document.getElementById('youtube-enhancer-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.id = 'youtube-enhancer-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #333;
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    z-index: 9999;
    display: flex;
    align-items: center;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    font-family: Roboto, Arial, sans-serif;
    max-width: 400px;
    animation: fadeIn 0.3s, fadeOut 0.3s 4.7s;
  `;
  
  // Add check icon
  const checkIcon = document.createElement('span');
  checkIcon.innerHTML = '✅';
  checkIcon.style.marginRight = '10px';
  
  // Add message text
  const messageText = document.createElement('span');
  messageText.textContent = message;
  messageText.style.flexGrow = '1';
  
  // Add dashboard link
  const dashboardLink = document.createElement('a');
  dashboardLink.textContent = 'Open Dashboard';
  dashboardLink.href = '#';
  dashboardLink.style.cssText = `
    color: #8e44ad;
    margin-left: 10px;
    text-decoration: none;
    font-weight: bold;
    background-color: white;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
  `;
  dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: 'openDashboard' });
  });
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: #aaa;
    font-size: 18px;
    cursor: pointer;
    padding: 0 0 0 10px;
    margin-left: 5px;
  `;
  closeButton.addEventListener('click', () => {
    toast.remove();
  });
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(20px); }
    }
  `;
  document.head.appendChild(style);
  
  // Assemble and show the toast
  toast.appendChild(checkIcon);
  toast.appendChild(messageText);
  toast.appendChild(dashboardLink);
  toast.appendChild(closeButton);
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.remove();
    }
  }, 5000);
}
