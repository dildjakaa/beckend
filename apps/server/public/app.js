// Determine server URL based on environment
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SERVER_URL = isLocalhost ? 'http://localhost:3000' : 'https://krackenx.onrender.com';

console.log('Using server:', SERVER_URL);

// Socket.IO client connection with Firefox compatibility options
const socket = io(SERVER_URL, {
  // Force WebSocket transport for consistency across browsers
  transports: ['websocket', 'polling'],
  // Increase timeout for Firefox
  timeout: 20000,
  // Enable debugging
  debug: true,
  // Ensure proper reconnection
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 3,
  // Force JSON protocol
  forceJSONP: false
});

// Connection status handling
socket.on('connect', () => {
  console.log('Connected to server');
  showStatus('Connected to server', 'success');
  isConnected = true;
  
  // Auto-authenticate if we have a token
  const token = localStorage.getItem('authToken');
  if (token && currentUser?.id) {
    socket.emit('authenticate_with_token', { token: token });
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showStatus('Disconnected from server', 'warning');
  isConnected = false;
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  showStatus('Failed to connect to server. Please check if the server is running.', 'error');
  isConnected = false;
});

socket.on('server_error', ({ message }) => {
  showStatus(message || 'Server error occurred', 'error');
});

// DOM Elements
const loginContainer = document.getElementById('loginContainer');
const chatContainer = document.getElementById('chatContainer');
const loginForm = document.getElementById('loginForm');
const messageForm = document.getElementById('messageForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const messageInput = document.getElementById('messageInput');
const messagesDiv = document.getElementById('messages');
const statusMessageDiv = document.getElementById('statusMessage');

// Discord-like interface elements
const serverList = document.querySelector('.server-list');
const channelSidebar = document.querySelector('.channel-sidebar');
const membersSidebar = document.querySelector('.members-sidebar');
const currentChannelName = document.getElementById('currentChannelName');
const channelTopic = document.getElementById('channelTopic');
const onlineCount = document.getElementById('onlineCount');
const membersList = document.getElementById('membersList');
const directMessagesList = document.getElementById('directMessagesList');

// User panel elements
const userAvatar = document.getElementById('userAvatar');
const userDisplayName = document.getElementById('userDisplayName');
const userStatus = document.getElementById('userStatus');
const muteBtn = document.getElementById('muteBtn');
const deafenBtn = document.getElementById('deafenBtn');
const settingsBtn = document.getElementById('settingsBtn');

// Header controls
const addFriendBtn = document.getElementById('addFriendBtn');

// Mobile interface elements
const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
const mobileFriendsView = document.getElementById('mobileFriendsView');
const mobileServersView = document.getElementById('mobileServersView');
const mobileAddFriendBtn = document.getElementById('mobileAddFriendBtn');
const mobileAddServerBtn = document.getElementById('mobileAddServerBtn');
const mobileAddServerBtn2 = document.getElementById('mobileAddServerBtn2');

// Friends system elements
const friendsList = document.getElementById('friendsList');
const friendRequestsList = document.getElementById('friendRequestsList');
const friendTabs = document.querySelectorAll('.friend-tab');
const friendRequestModal = document.getElementById('friendRequestModal');
const requestUserAvatar = document.getElementById('requestUserAvatar');
const requestUsername = document.getElementById('requestUsername');
const acceptFriendBtn = document.getElementById('acceptFriendBtn');
const rejectFriendBtn = document.getElementById('rejectFriendBtn');

// Server and channel elements
const serverMenuBtn = document.getElementById('serverMenuBtn');
const addServerBtn = document.getElementById('addServerBtn');

// Modals
const addServerModal = document.getElementById('addServerModal');
const addServerCloseBtn = document.getElementById('addServerCloseBtn');
const addServerCancelBtn = document.getElementById('addServerCancelBtn');
const addServerConfirmBtn = document.getElementById('addServerConfirmBtn');
const serverNameInput = document.getElementById('serverName');
const serverDescriptionInput = document.getElementById('serverDescription');

const addFriendModal = document.getElementById('addFriendModal');
const addFriendCloseBtn = document.getElementById('addFriendCloseBtn');
const addFriendCancelBtn = document.getElementById('addFriendCancelBtn');
const addFriendConfirmBtn = document.getElementById('addFriendConfirmBtn');
const friendUsernameInput = document.getElementById('friendUsername');

// Application state
let currentUser = null;
let isConnected = false;
let currentServer = 'home';
let currentChannel = 'general';
let onlineUsers = new Map();
let friends = [];
let friendRequests = [];
let servers = [
  { id: 'home', name: 'KrackenX Home', icon: 'fas fa-home' }
];

let channels = {
  home: [
    { id: 'general', name: 'general', type: 'text', topic: 'General discussion and announcements' }
  ]
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  loadUserPreferences();
  
  // Check if user is already logged in
  const token = localStorage.getItem('authToken');
  const userData = localStorage.getItem('userData');
  if (token && userData) {
    try {
      // Try to restore session
      showStatus('Restoring session...', 'info');
      currentUser = JSON.parse(userData);
      
      // Verify user data integrity
      if (currentUser && currentUser.username && currentUser.avatar) {
        showChatInterface();
        updateUserInterface();
        showStatus('Session restored successfully', 'success');
      } else {
        throw new Error('Invalid user data');
      }
    } catch (error) {
      console.error('Session restoration failed:', error);
      // Clear invalid data
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      currentUser = null;
      showStatus('Session expired. Please log in again.', 'warning');
    }
  }
  
  // Set default active states
  document.querySelector('[data-server-id="home"]')?.classList.add('active');
  document.querySelector('[data-channel-id="general"]')?.classList.add('active');
});

// Event Listeners
function initializeEventListeners() {
  // Login form
  loginForm.addEventListener('submit', handleLogin);
  
  // Message form
  messageForm.addEventListener('submit', handleMessageSubmit);
  
  // Server switching
  document.querySelectorAll('.server-item').forEach(item => {
    item.addEventListener('click', () => switchServer(item.dataset.serverId));
  });
  
  // Channel switching
  document.addEventListener('click', (e) => {
    if (e.target.closest('.channel-item')) {
      const channelItem = e.target.closest('.channel-item');
      switchChannel(channelItem.dataset.channelId);
    }
  });
  
  // Server menu
  addServerBtn.addEventListener('click', () => showModal(addServerModal));
  addServerCloseBtn.addEventListener('click', () => hideModal(addServerModal));
  addServerCancelBtn.addEventListener('click', () => hideModal(addServerModal));
  addServerConfirmBtn.addEventListener('click', createServer);
  
  // Friend system
  addFriendCloseBtn.addEventListener('click', () => hideModal(addFriendModal));
  addFriendCancelBtn.addEventListener('click', () => hideModal(addFriendModal));
  addFriendConfirmBtn.addEventListener('click', addFriend);
  
  // User controls
  muteBtn.addEventListener('click', toggleMute);
  deafenBtn.addEventListener('click', toggleDeafen);
  settingsBtn.addEventListener('click', openUserSettings);
  
  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Header controls
  addFriendBtn.addEventListener('click', () => showModal(addFriendModal));
  
  // Modal close on outside click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      hideModal(e.target);
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Login handling
async function handleLogin(e) {
  e.preventDefault();
  
  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  
  if (!username || !password) {
    showStatus('Please enter both username and password', 'error');
    return;
  }
  
  try {
    showStatus('Logging in...', 'info');
    
    // Make real login request to server
    let response;
    try {
      response = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });
    } catch (networkError) {
      console.error('Network error during login:', networkError);
      throw new Error('Unable to connect to server. Please check your internet connection.');
    }
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      const responseText = await response.text();
      console.error('Response text:', responseText);
      throw new Error('Server returned invalid JSON response');
    }
    
    console.log('Login response data:', data); // Debug logging
    
    if (!response.ok) {
      console.error('Server returned error status:', response.status);
      console.error('Error response data:', data);
      throw new Error(data.error || data.message || `Login failed with status ${response.status}`);
    }
    
    // Handle both old and new response formats
    let responseData = data;
    if (data.success && data.data) {
      // New format: {success: true, data: {...}}
      responseData = data.data;
      console.log('Using new response format, extracted data:', responseData);
    } else {
      console.log('Using old response format, data:', data);
    }
    
    // Check if responseData and responseData.user exist
    if (!responseData || !responseData.user) {
      console.error('Invalid response structure:', responseData);
      throw new Error('Invalid server response: missing user data');
    }
    
    // Check if required fields exist
    if (!responseData.token) {
      console.error('Missing token in response:', responseData);
      throw new Error('Invalid server response: missing authentication token');
    }
    
    if (!responseData.user.id || !responseData.user.username) {
      console.error('Missing required user fields:', responseData.user);
      throw new Error('Invalid server response: missing required user information');
    }
    
    console.log('Creating currentUser object with:', {
      id: responseData.user.id,
      username: responseData.user.username,
      avatar: responseData.user.avatar_url || 'will generate'
    });
    
    // Store token and user data
    localStorage.setItem('authToken', responseData.token);
    currentUser = {
      id: responseData.user.id,
      username: responseData.user.username,
      avatar: responseData.user.avatar_url || generateAvatar(responseData.user.username),
      status: 'online'
    };
    
    console.log('currentUser created successfully:', currentUser);
    
    // Verify that currentUser was set correctly
    if (!currentUser || !currentUser.username || !currentUser.avatar) {
      throw new Error('Failed to create user session');
    }
    
    // Authenticate with Socket.IO
    if (socket && socket.connected && isConnected && currentUser && currentUser.id && currentUser.username && currentUser.avatar) {
      socket.emit('authenticate_with_token', { token: responseData.token });
    }
    
    // Update UI
    updateUserInterface();
    showChatInterface();
    showStatus(`Welcome back, ${username}!`, 'success');
    
    // Join default channel
    joinChannel('general');
    
    // Store user data in localStorage for session restoration 
    localStorage.setItem('userData', JSON.stringify(currentUser));
    
  } catch (error) {
    console.error('Login error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Login failed. Please try again.';
    
    if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Unable to connect to server. Please check if the server is running.';
    } else if (error.message.includes('Invalid server response')) {
      errorMessage = 'Server returned invalid data. Please try again.';
    } else if (error.message.includes('Network error')) {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.message.includes('Неверное имя пользователя или пароль')) {
      errorMessage = 'Неверное имя пользователя или пароль. Проверьте правильность введенных данных.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    showStatus(errorMessage, 'error');
  }
}

// Logout handling
function handleLogout() {
  // Clear user data
  currentUser = null;
  onlineUsers.clear();
  
  // Clear token and user data (maybe stop?)
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  
  // Disconnect socket
  if (socket && socket.connected) {
    socket.disconnect();
  }
  
  // Reset UI
  if (messagesDiv) messagesDiv.innerHTML = '';
  if (membersList) membersList.innerHTML = '';
  if (onlineCount) onlineCount.textContent = '0';
  
  // Reset current channel and server
  currentChannel = 'general';
  currentServer = 'home';
  
  // Show login form
  showLoginInterface();
  showStatus('Logged out successfully', 'info');
}

// Generate avatar for user
function generateAvatar(username) {
  const colors = ['#5865f2', '#3ba55c', '#ed4245', '#faa61a', '#9b59b6', '#e67e22'];
  const color = colors[username.length % colors.length];
  const initial = username.charAt(0).toUpperCase();
  
  // Create SVG avatar instead of external placeholder
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="${color}" rx="16"/>
      <text x="16" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="bold" 
            text-anchor="middle" fill="white">${initial}</text>
    </svg>
  `)}`;
}

// Join channel function
function joinChannel(channelId) {
  // Check if user is logged in and has valid data
  if (!currentUser || !currentUser.username || !currentUser.avatar) {
    showStatus('Please log in to join channels', 'error');
    return;
  }
  
  if (channelId === currentChannel) return;
  
  // Update active channel
  document.querySelectorAll('.channel-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const channelElement = document.querySelector(`[data-channel-id="${channelId}"]`);
  if (channelElement) {
    channelElement.classList.add('active');
  }
  
  currentChannel = channelId;
  
  // Update channel info
  const channel = channels[currentServer]?.find(c => c.id === channelId);
  if (channel) {
    if (currentChannelName) currentChannelName.textContent = channel.name;
    if (channelTopic) channelTopic.textContent = channel.topic;
    if (messageInput) messageInput.placeholder = `Message #${channel.name}`;
  }
  
  // Clear messages for new channel
  if (messagesDiv) messagesDiv.innerHTML = '';
  
  // Load channel messages
  loadChannelMessages(channelId);
  
  // Emit join room event to server
  if (socket && socket.connected && isConnected && currentUser && currentUser.id && currentUser.username && currentUser.avatar) {
    const roomId = channelId === 'general' ? 1 : channelId;
    socket.emit('join_room', { roomId: roomId, roomType: 'text' });
  }
}

// Update user interface
function updateUserInterface() {
  if (!currentUser || !currentUser.username || !currentUser.avatar) {
    console.warn('Cannot update user interface: invalid user data');
    return;
  }
  
  // Update user panel
  if (userAvatar) userAvatar.src = currentUser.avatar;
  if (userDisplayName) userDisplayName.textContent = currentUser.username;
  if (userStatus) userStatus.textContent = currentUser.status;
  
  // Update channel name
  if (currentChannelName) currentChannelName.textContent = currentChannel;
  
  // Update channel topic
  const channel = channels[currentServer]?.find(c => c.id === currentChannel);
  if (channel && channelTopic) {
    channelTopic.textContent = channel.topic;
  }
  
  // Update online count
  updateOnlineCount();
  
  // Update members list
  updateMembersList();
}

// Show chat interface
function showChatInterface() {
  // Only show chat interface if user is logged in and has valid data
  if (!currentUser || !currentUser.username || !currentUser.avatar) {
    showStatus('Please log in to access chat', 'error');
    return;
  }
  
  if (loginContainer) loginContainer.style.display = 'none';
  if (chatContainer) chatContainer.style.display = 'flex';
  
  // Initialize interface based on device
  if (isMobileDevice()) {
    showMobileView('chat');
  }
  
  // Load friends and friend requests
  if (currentUser.id) {
    loadFriends();
    loadFriendRequests();
  }
}

// Show login interface
function showLoginInterface() {
  if (chatContainer) chatContainer.style.display = 'none';
  if (loginContainer) loginContainer.style.display = 'flex';
  
  // Clear form
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
}

// Server switching
function switchServer(serverId) {
  // Check if user is logged in and has valid data
  if (!currentUser || !currentUser.username || !currentUser.avatar) {
    showStatus('Please log in to switch servers', 'error');
    return;
  }
  
  if (serverId === currentServer) return;
  
  // Update active server
  document.querySelectorAll('.server-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const targetServerElement = document.querySelector(`[data-server-id="${serverId}"]`);
  if (targetServerElement) {
    targetServerElement.classList.add('active');
  }
  
  currentServer = serverId;
  
  // Update server header
  const server = servers.find(s => s.id === serverId);
  if (server) {
    const serverNameElement = document.querySelector('.server-name span');
    if (serverNameElement) {
      serverNameElement.textContent = server.name;
    }
  }
  
  // Switch to first available channel
  const serverChannels = channels[serverId] || [];
  if (serverChannels.length > 0) {
    joinChannel(serverChannels[0].id);
  }
  
  // Update channel list
  updateChannelList();
}

// Channel switching
function switchChannel(channelId) {
  // Check if user is logged in and has valid data
  if (!currentUser || !currentUser.username || !currentUser.avatar) {
    showStatus('Please log in to switch channels', 'error');
    return;
  }
  
  joinChannel(channelId);
}

// Update channel list
function updateChannelList() {
  const serverChannels = channels[currentServer] || [];
  
  // Update text channels
  const textChannels = serverChannels.filter(c => c.type === 'text');
  const textChannelsList = document.querySelector('.channel-category:first-child .channel-list');
  if (textChannelsList) {
    textChannelsList.innerHTML = textChannels.map(channel => `
      <div class="channel-item" data-channel-id="${channel.id}">
        <i class="fas fa-hashtag"></i>
        <span>${channel.name}</span>
      </div>
    `).join('');
  }
  

  
  // Re-attach event listeners
  document.querySelectorAll('.channel-item').forEach(item => {
    item.addEventListener('click', () => switchChannel(item.dataset.channelId));
  });
}

// Message handling
function handleMessageSubmit(e) {
  e.preventDefault();
  
  // Check if user is logged in and has required fields
  if (!currentUser || !currentUser.username || !currentUser.avatar) {
    showStatus('User session is invalid. Please log in again.', 'error');
    // Try to restore session or redirect to login
    handleLogout();
    return;
  }
  
  const message = messageInput.value.trim();
  if (!message) return;
  
  // Don't add message to UI locally - wait for server confirmation
  // This prevents duplicate messages
  
  // Send message to server
  if (socket && socket.connected && isConnected && currentUser && currentUser.id && currentUser.username && currentUser.avatar) {
    socket.emit('send_message', {
      content: message,
      roomId: currentChannel === 'general' ? 1 : currentChannel
    });
  }
  
  // Clear input
  if (messageInput) messageInput.value = '';
}

// Add message to UI
function addMessage(messageData) {
  const messageElement = document.createElement('div');
  const isOwnMessage = messageData.isOwn || (currentUser && currentUser.username && currentUser.avatar && messageData.username === currentUser.username);
  
  messageElement.className = `message ${isOwnMessage ? 'own' : 'other'}`;
  
  const timestamp = messageData.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageElement.innerHTML = `
    <div class="message-avatar">
      <img src="${messageData.avatar}" alt="${messageData.username}">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-username">${messageData.username}</span>
        <span class="message-timestamp">${timestamp}</span>
      </div>
      <div class="message-text">${messageData.content}</div>
    </div>
  `;
  
  if (messagesDiv) {
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

// Load channel messages
function loadChannelMessages(channelId) {
  // Implement with your backend
  // For now, just show a welcome message
  if (channelId === 'general') {
    addMessage({
      id: 1,
      username: 'System',
      avatar: generateAvatar('System'),
      content: `Welcome to #${channelId}! Start chatting with your friends.`,
      timestamp: new Date(),
      isOwn: false
    });
  }
}

// Update online count
function updateOnlineCount() {
  if (onlineCount) {
    const count = onlineUsers.size + (currentUser && currentUser.username && currentUser.avatar ? 1 : 0); // +1 for current user if logged in and valid
    onlineCount.textContent = count;
  }
}

// Update members list
function updateMembersList() {
  if (membersList && currentUser && currentUser.username && currentUser.avatar) {
    const members = Array.from(onlineUsers.values());
    // Only add currentUser if it exists and has required properties
    if (currentUser && currentUser.username && currentUser.avatar) {
      members.push(currentUser);
    }
    
    membersList.innerHTML = members.map(member => `
      <div class="member-item">
        <div class="member-avatar">
          <img src="${member.avatar}" alt="${member.username}">
          <div class="member-status ${member.status}"></div>
        </div>
        <div class="member-info">
          <div class="member-name">${member.username}</div>
          <div class="member-activity">Online</div>
        </div>
      </div>
    `).join('');
  }
}

// Server management
function createServer() {
  // Check if user is logged in and has valid data
  if (!currentUser || !currentUser.username || !currentUser.avatar) {
    showStatus('Please log in to create servers', 'error');
    return;
  }
  
  const name = serverNameInput ? serverNameInput.value.trim() : '';
  const description = serverDescriptionInput ? serverDescriptionInput.value.trim() : '';
  
  if (!name) {
    showStatus('Please enter a server name', 'error');
    return;
  }
  
  const newServer = {
    id: `server-${Date.now()}`,
    name: name,
    description: description,
    icon: 'fas fa-hashtag'
  };
  
  servers.push(newServer);
  channels[newServer.id] = [
    { id: 'general', name: 'general', type: 'text', topic: 'General discussion' }
  ];
  
  // Add server to UI
  addServerToUI(newServer);
  
  // Clear form and hide modal
  if (serverNameInput) serverNameInput.value = '';
  if (serverDescriptionInput) serverDescriptionInput.value = '';
  hideModal(addServerModal);
  
  showStatus(`Server "${name}" created successfully!`, 'success');
}

// Add server to UI
function addServerToUI(server) {
  const serverElement = document.createElement('div');
  serverElement.className = 'server-item';
  serverElement.dataset.serverId = server.id;
  
  serverElement.innerHTML = `
    <div class="server-icon">
      <i class="${server.icon}"></i>
    </div>
    <div class="server-tooltip">${server.name}</div>
  `;
  
  // Insert before add server button
  if (addServerBtn && addServerBtn.parentNode) {
    addServerBtn.parentNode.insertBefore(serverElement, addServerBtn);
    
    // Add event listener
    serverElement.addEventListener('click', () => switchServer(server.id));
  }
}

// Friend system
function addFriend() {
  // Check if user is logged in and has valid data
  if (!currentUser || !currentUser.username || !currentUser.avatar) {
    showStatus('Please log in to add friends', 'error');
    return;
  }
  
  const username = friendUsernameInput ? friendUsernameInput.value.trim() : '';
  
  if (!username) {
    showStatus('Please enter a username', 'error');
    return;
  }
  
  if (username === currentUser.username) {
    showStatus('You cannot add yourself as a friend', 'error');
    return;
  }
  
  // Send friend request using API
  sendFriendRequest(username);
}

// Update direct messages
function updateDirectMessages() {
  if (directMessagesList && currentUser && currentUser.username && currentUser.avatar) {
    directMessagesList.innerHTML = friends.map(friend => `
      <div class="channel-item" data-channel-id="dm-${friend.username}">
        <i class="fas fa-user"></i>
        <span>${friend.username}</span>
      </div>
    `).join('');
  }
}

// User controls
function toggleMute() {
  if (muteBtn && muteBtn.classList) {
    muteBtn.classList.toggle('muted');
    const icon = muteBtn.querySelector('i');
    if (icon && muteBtn.classList.contains('muted')) {
      icon.className = 'fas fa-microphone-slash';
      showStatus('Microphone muted', 'warning');
    } else if (icon) {
      icon.className = 'fas fa-microphone';
      showStatus('Microphone unmuted', 'success');
    }
  }
}

function toggleDeafen() {
  if (deafenBtn && deafenBtn.classList) {
    deafenBtn.classList.toggle('deafened');
    const icon = deafenBtn.querySelector('i');
    if (icon && deafenBtn.classList.contains('deafened')) {
      icon.className = 'fas fa-headphones-slash';
      showStatus('Audio disabled', 'warning');
    } else if (icon) {
      icon.className = 'fas fa-headphones';
      showStatus('Audio enabled', 'success');
    }
  }
}

function openUserSettings() {
  showStatus('User settings coming soon!', 'info');
}



// Modal management
function showModal(modal) {
  if (modal && modal.classList) {
    modal.classList.add('show');
  }
}

function hideModal(modal) {
  if (modal && modal.classList) {
    modal.classList.remove('show');
  }
}

function openModal(modal) {
  showModal(modal);
}

function closeModal(modal) {
  hideModal(modal);
}

// Status messages
function showStatus(message, type = 'info') {
  if (statusMessageDiv) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `status-message ${type} show`;
    
    setTimeout(() => {
      if (statusMessageDiv) {
        statusMessageDiv.classList.remove('show');
      }
    }, 3000);
  }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
  // Ctrl/Cmd + Shift + M for mute
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
    e.preventDefault();
    toggleMute();
  }
  
  // Escape to close modals
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal.show');
    if (openModal) {
      hideModal(openModal);
    }
  }
}

// Load user preferences
function loadUserPreferences() {
  // Load theme preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme && document.documentElement) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  
  // Load other preferences as needed
}

// Socket event handlers
socket.on('token_auth_success', (data) => {
  console.log('Socket authentication successful:', data);
  showStatus('Connected to chat server', 'success');
  
  // Update current user with server data
  if (data.user && currentUser) {
    currentUser.id = data.user.id;
    currentUser.username = data.user.username;
    currentUser.avatar = data.user.avatar_url || generateAvatar(data.user.username);
  }
  
  // Join general room after authentication
  if (socket && isConnected) {
    socket.emit('join_room', { roomId: 1, roomType: 'text' });
  }
});

socket.on('token_auth_error', (data) => {
  console.error('Socket authentication failed:', data);
  showStatus('Failed to connect to chat server', 'error');
});

socket.on('user_joined', (data) => {
  onlineUsers.set(data.username, {
    username: data.username,
    avatar: generateAvatar(data.username),
    status: 'online'
  });
  
  updateOnlineCount();
  updateMembersList();
  
  if (data.username !== currentUser?.username) {
    addMessage({
      id: Date.now(),
      username: 'System',
      avatar: generateAvatar('System'),
      content: `${data.username} joined the chat`,
      timestamp: new Date(),
      isOwn: false
    });
  }
});

socket.on('user_left', (data) => {
  onlineUsers.delete(data.username);
  
  updateOnlineCount();
  updateMembersList();
  
  addMessage({
    id: Date.now(),
    username: 'System',
    avatar: generateAvatar('System'),
    content: `${data.username} left the chat`,
    timestamp: new Date(),
    isOwn: false
  });
});

socket.on('room_joined', (data) => {
  console.log('Joined room:', data);
  if (data.messages && Array.isArray(data.messages)) {
    // Clear existing messages
    if (messagesDiv) messagesDiv.innerHTML = '';
    
    // Load messages from server
    data.messages.forEach(msg => {
      addMessage({
        id: msg.id,
        username: msg.username,
        avatar: generateAvatar(msg.username),
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        isOwn: msg.username === currentUser?.username
      });
    });
  }
});

socket.on('new_message', (data) => {
  addMessage({
    id: data.id || Date.now(),
    username: data.username,
    avatar: generateAvatar(data.username),
    content: data.content,
    timestamp: new Date(data.timestamp),
    isOwn: data.username === currentUser?.username
  });
});

// Handle server errors
socket.on('server_error', (data) => {
  console.error('Server error:', data);
  showStatus(data.message || 'Server error occurred', 'error');
  
  // If authentication error, redirect to login
  if (data.message && data.message.includes('Not authenticated')) {
    handleLogout();
  }
});

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  showStatus('Failed to connect to server. Please check if the server is running.', 'error');
  isConnected = false;
});

// Handle reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected to server');
  showStatus('Reconnected to server', 'success');
  isConnected = true;
});

socket.on('reconnecting', (attemptNumber) => {
  showStatus(`Reconnecting... (attempt ${attemptNumber})`, 'info');
});

socket.on('reconnect_failed', () => {
  showStatus('Failed to reconnect to server', 'error');
});

// Friend request notifications
socket.on('friend_request_received', (data) => {
    console.log('Friend request received:', data);
    
    // Update the friend request modal
    if (requestUsername) requestUsername.textContent = data.fromUsername;
    if (requestUserAvatar) {
        if (data.fromAvatar) {
            requestUserAvatar.innerHTML = `<img src="${data.fromAvatar}" alt="${data.fromUsername}">`;
        } else {
            requestUserAvatar.innerHTML = `<span>${data.fromUsername.charAt(0).toUpperCase()}</span>`;
        }
    }
    
    // Store the request data for accept/reject
    const requestId = data.requestId; // This should come from the server
    
    // Show the modal
    openModal(friendRequestModal);
    
    // Set up accept/reject handlers
    if (acceptFriendBtn) {
        acceptFriendBtn.onclick = () => {
            respondToFriendRequest(requestId, 'accepted');
            closeModal(friendRequestModal);
        };
    }
    
    if (rejectFriendBtn) {
        rejectFriendBtn.onclick = () => {
            respondToFriendRequest(requestId, 'rejected');
            closeModal(friendRequestModal);
        };
    }
    
    showStatus(`Friend request from ${data.fromUsername}!`, 'info');
});

// Test server connection function
async function testServerConnection() {
  try {
    console.log('Testing connection to:', SERVER_URL);
    const response = await fetch(`${SERVER_URL}/api/health`);
    
    if (!response.ok) {
      console.error('Health check failed with status:', response.status);
      return false;
    }
    
    const data = await response.json();
    console.log('Server health check response:', data);
    
    if (data.success && data.data && data.data.status === 'ok') {
      console.log('✅ Server is healthy');
      return true;
    } else {
      console.error('❌ Server health check failed:', data);
      return false;
    }
  } catch (error) {
    console.error('Server connection test failed:', error);
    
    // Check if it's a JSON parsing error (HTML response)
    if (error.message.includes('Unexpected token')) {
      console.error('❌ Server returned HTML instead of JSON. Server might be down or URL is wrong.');
    }
    
    return false;
  }
}

// Test connection on page load
document.addEventListener('DOMContentLoaded', () => {
  testServerConnection();
});

// Friends System Functions
async function sendFriendRequest(username) {
    try {
        const response = await fetch(`${SERVER_URL}/api/friends/send-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fromUserId: currentUser.id,
                toUsername: username
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Failed to send friend request: ${response.status} ${response.statusText}`);
            console.warn('Response:', errorText);
            
            // Try to parse as JSON for better error messages
            try {
                const errorData = JSON.parse(errorText);
                showStatus(errorData.message || 'Failed to send friend request', 'error');
            } catch {
                showStatus('Failed to send friend request', 'error');
            }
            return;
        }

        const data = await response.json();
        
        if (data.success) {
            showStatus('Friend request sent successfully!', 'success');
            closeModal(addFriendModal);
            friendUsernameInput.value = '';
            
            // Emit socket event to notify server
            if (socket && socket.connected) {
                socket.emit('friend_request_sent', { toUsername: username });
            }
        } else {
            showStatus(data.message || 'Failed to send friend request', 'error');
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        showStatus('Failed to send friend request', 'error');
    }
}

async function loadFriends() {
    try {
        const response = await fetch(`${SERVER_URL}/api/friends/list/${currentUser.id}`);
        
        if (!response.ok) {
            console.warn(`Failed to load friends: ${response.status} ${response.statusText}`);
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            friends = data.data.friends;
            renderFriendsList();
        }
    } catch (error) {
        console.error('Error loading friends:', error);
        // Don't show error to user for non-critical features
    }
}

async function loadFriendRequests() {
    try {
        const response = await fetch(`${SERVER_URL}/api/friends/requests/${currentUser.id}`);
        
        if (!response.ok) {
            console.warn(`Failed to load friend requests: ${response.status} ${response.statusText}`);
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            friendRequests = data.data.requests;
            renderFriendRequestsList();
        }
    } catch (error) {
        console.error('Error loading friend requests:', error);
        // Don't show error to user for non-critical features
    }
}

function renderFriendsList() {
    if (!friendsList) return;
    
    friendsList.innerHTML = '';
    
    if (friends.length === 0) {
        friendsList.innerHTML = '<p class="no-friends">No friends yet. Add some friends to get started!</p>';
        return;
    }
    
    friends.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        
        const avatar = friend.avatar_url || generateAvatar(friend.username);
        const status = friend.status || 'offline';
        
        friendItem.innerHTML = `
            <div class="friend-avatar">
                ${friend.avatar_url ? `<img src="${friend.avatar_url}" alt="${friend.username}">` : `<span>${friend.username.charAt(0).toUpperCase()}</span>`}
            </div>
            <div class="friend-info">
                <div class="friend-name">${friend.username}</div>
                <div class="friend-status ${status}">${status}</div>
            </div>
            <div class="friend-actions">
                <button class="friend-action-btn primary" onclick="openDirectMessage(${friend.friend_id}, '${friend.username}')">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="friend-action-btn" onclick="removeFriend(${friend.friend_id})">
                    <i class="fas fa-user-minus"></i>
                </button>
            </div>
        `;
        
        friendsList.appendChild(friendItem);
    });
}

function renderFriendRequestsList() {
    if (!friendRequestsList) return;
    
    friendRequestsList.innerHTML = '';
    
    if (friendRequests.length === 0) {
        friendRequestsList.innerHTML = '<p class="no-requests">No pending friend requests</p>';
        return;
    }
    
    friendRequests.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'friend-request-item';
        
        const avatar = request.avatar_url || generateAvatar(request.username);
        const timeAgo = getTimeAgo(new Date(request.created_at));
        
        requestItem.innerHTML = `
            <div class="request-avatar">
                ${request.avatar_url ? `<img src="${request.avatar_url}" alt="${request.username}">` : `<span>${request.username.charAt(0).toUpperCase()}</span>`}
            </div>
            <div class="request-info">
                <div class="request-name">${request.username}</div>
                <div class="request-time">${timeAgo}</div>
            </div>
            <div class="request-actions">
                <button class="request-action-btn primary" onclick="respondToFriendRequest(${request.id}, 'accepted')">
                    <i class="fas fa-check"></i>
                </button>
                <button class="request-action-btn danger" onclick="respondToFriendRequest(${request.id}, 'rejected')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        friendRequestsList.appendChild(requestItem);
    });
}

async function respondToFriendRequest(requestId, response) {
    try {
        const res = await fetch(`${SERVER_URL}/api/friends/respond-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requestId: requestId,
                response: response,
                userId: currentUser.id
            })
        });

        const data = await res.json();
        
        if (data.success) {
            showStatus(`Friend request ${response}`, 'success');
            await loadFriendRequests();
            await loadFriends();
        } else {
            showStatus(data.message || 'Failed to respond to friend request', 'error');
        }
    } catch (error) {
        console.error('Error responding to friend request:', error);
        showStatus('Failed to respond to friend request', 'error');
    }
}

function openDirectMessage(friendId, friendUsername) {
    // Switch to chat view
    showMobileView('chat');
    
    // Create or open direct message channel
    const channelId = `dm-${Math.min(currentUser.id, friendId)}-${Math.max(currentUser.id, friendId)}`;
    
    // Update UI to show DM
    currentChannel = channelId;
    currentChannelName.textContent = friendUsername;
    channelTopic.textContent = `Direct message with ${friendUsername}`;
    
    // Join the DM room
    socket.emit('join_room', { roomId: channelId, roomType: 'direct' });
    
    // Load messages for this DM
    loadMessages(channelId);
}

// Mobile Interface Functions
function showMobileView(view) {
    // Hide all mobile views
    document.querySelectorAll('.mobile-view').forEach(v => v.style.display = 'none');
    
    // Show selected view
    if (view === 'friends') {
        mobileFriendsView.style.display = 'block';
        loadFriends();
        loadFriendRequests();
    } else if (view === 'servers') {
        mobileServersView.style.display = 'block';
    }
    
    // Update navigation buttons
    mobileNavBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });
}

function initializeMobileInterface() {
    // Mobile navigation
    mobileNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            showMobileView(view);
        });
    });
    
    // Mobile friend tabs
    friendTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            friendTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.dataset.tab === 'friends') {
                friendsList.style.display = 'block';
                friendRequestsList.style.display = 'none';
            } else {
                friendsList.style.display = 'none';
                friendRequestsList.style.display = 'block';
            }
        });
    });
    
    // Mobile add friend button
    if (mobileAddFriendBtn) {
        mobileAddFriendBtn.addEventListener('click', () => {
            openModal(addFriendModal);
        });
    }
    
    // Mobile add server buttons
    if (mobileAddServerBtn) {
        mobileAddServerBtn.addEventListener('click', () => {
            openModal(addServerModal);
        });
    }
    
    if (mobileAddServerBtn2) {
        mobileAddServerBtn2.addEventListener('click', () => {
            openModal(addServerModal);
        });
    }
}

// Utility Functions
function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function removeFriend(friendId) {
    if (confirm('Are you sure you want to remove this friend?')) {
        // TODO: Implement remove friend API
        showStatus('Friend removed', 'success');
        loadFriends();
    }
}

// Load messages for a specific channel
async function loadMessages(channelId) {
    try {
        // Clear existing messages
        if (messagesDiv) messagesDiv.innerHTML = '';
        
        // Load messages from server (this would need to be implemented on the server side)
        // For now, we'll just show a placeholder
        if (messagesDiv) {
            messagesDiv.innerHTML = '<div class="message system-message">Loading messages...</div>';
        }
        
        // TODO: Implement actual message loading from server
        // const response = await fetch(`${SERVER_URL}/api/messages/${channelId}`);
        // const data = await response.json();
        // if (data.success) {
        //     data.messages.forEach(msg => addMessage(msg));
        // }
    } catch (error) {
        console.error('Error loading messages:', error);
        if (messagesDiv) {
            messagesDiv.innerHTML = '<div class="message system-message error">Failed to load messages</div>';
        }
    }
}

// Device detection
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
}

// Initialize mobile interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeMobileInterface();
    
    // Show appropriate interface based on device
    if (isMobileDevice()) {
        showMobileView('chat');
    }
});

