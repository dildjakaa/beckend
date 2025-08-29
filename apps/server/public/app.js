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
  const userData = localStorage.getItem('userData');
  
  if (token && userData) {
    try {
      const user = JSON.parse(userData);
      if (user && user.id) {
        currentUser = user;
        console.log('Restored user session:', user);
        socket.emit('authenticate_with_token', { token: token });
      }
    } catch (error) {
      console.error('Failed to restore user session:', error);
      localStorage.removeItem('userData');
      localStorage.removeItem('authToken');
    }
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showStatus('Disconnected from server', 'warning');
  isConnected = false;
  isSocketAuthenticated = false;
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  showStatus('Failed to connect to server. Please check if the server is running.', 'error');
  isConnected = false;
});

socket.on('server_error', ({ message }) => {
  showStatus(message || 'Server error occurred', 'error');
});

// Handle token authentication responses
socket.on('token_auth_success', (data) => {
  console.log('✅ Socket authentication successful:', data);
  isSocketAuthenticated = true;
  showStatus('Socket authenticated successfully', 'success');
});

socket.on('token_auth_error', (data) => {
  console.error('❌ Socket authentication failed:', data);
  isSocketAuthenticated = false;
  showStatus('Socket authentication failed: ' + (data.error || 'Unknown error'), 'error');
});

// Handle room join responses
socket.on('room_joined', (data) => {
  console.log('✅ Joined room:', data);
  if (data.success) {
    showStatus(`Joined #${data.roomId}`, 'success');
    
    // Load messages if available
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
  } else {
    showStatus('Failed to join room', 'error');
  }
});

// Handle new messages
socket.on('new_message', (data) => {
  console.log('📨 New message received:', data);
  addMessage({
    id: data.id || Date.now(),
    username: data.username,
    avatar: generateAvatar(data.username),
    content: data.content,
    timestamp: new Date(data.timestamp),
    isOwn: data.username === currentUser?.username
  });
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
const connectionTestBtn = document.getElementById('connectionTestBtn');

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
const notificationsBtn = document.getElementById('notificationsBtn');
const pinsBtn = document.getElementById('pinsBtn');
const membersBtn = document.getElementById('membersBtn');
const searchBtn = document.getElementById('searchBtn');

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
let isSocketAuthenticated = false;
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
  notificationsBtn.addEventListener('click', toggleNotifications);
  pinsBtn.addEventListener('click', showPinnedMessages);
  membersBtn.addEventListener('click', toggleMembersSidebar);
  searchBtn.addEventListener('click', openSearch);
  
  // Modal close on outside click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      hideModal(e.target);
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Connection test button
  if (connectionTestBtn) {
    connectionTestBtn.addEventListener('click', async () => {
      connectionTestBtn.disabled = true;
      connectionTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      
      const isHealthy = await testServerConnection();
      
      if (isHealthy) {
        connectionTestBtn.className = 'connection-test-btn connected';
        connectionTestBtn.innerHTML = '<i class="fas fa-wifi"></i>';
        showStatus('✅ Server connection: OK', 'success');
      } else {
        connectionTestBtn.className = 'connection-test-btn disconnected';
        connectionTestBtn.innerHTML = '<i class="fas fa-wifi"></i>';
        showStatus('❌ Server connection: Failed', 'error');
      }
      
      connectionTestBtn.disabled = false;
      
      // Reset button state after 3 seconds
      setTimeout(() => {
        connectionTestBtn.className = 'connection-test-btn';
      }, 3000);
    });
  }
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
    
    // Store user data in localStorage for session restoration 
    localStorage.setItem('userData', JSON.stringify(currentUser));
    
    // Wait for socket authentication before joining channel
    setTimeout(() => {
      if (isSocketAuthenticated) {
        joinChannel('general');
      } else {
        console.warn('Socket not authenticated yet, retrying in 1 second...');
        setTimeout(() => {
          if (isSocketAuthenticated) {
            joinChannel('general');
          } else {
            console.error('Failed to authenticate socket after retry');
            showStatus('Failed to authenticate socket', 'error');
          }
        }, 1000);
      }
    }, 500);
    
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
  isSocketAuthenticated = false;
  
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
  
  // Check if socket is authenticated
  if (!isSocketAuthenticated) {
    showStatus('Please wait for socket authentication', 'warning');
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
  if (socket && socket.connected && isConnected && isSocketAuthenticated && currentUser && currentUser.id && currentUser.username && currentUser.avatar) {
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
  
  // Add message to UI
  addMessage({
    id: Date.now(),
    username: currentUser.username,
    avatar: currentUser.avatar,
    content: message,
    timestamp: new Date(),
    isOwn: true
  });
  
  // Send message to server
  if (socket && socket.connected && isConnected && isSocketAuthenticated && currentUser && currentUser.id && currentUser.username && currentUser.avatar) {
    socket.emit('send_message', {
      content: message,
      roomId: currentChannel === 'general' ? 1 : currentChannel
    });
  } else {
    console.error('Cannot send message: socket not ready or user not authenticated');
    showStatus('Cannot send message: not authenticated', 'error');
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
  
  // Add to friends list
  friends.push({
    username: username,
    avatar: generateAvatar(username),
    status: 'offline'
  });
  
  // Update direct messages
  updateDirectMessages();
  
  // Clear form and hide modal
  if (friendUsernameInput) friendUsernameInput.value = '';
  hideModal(addFriendModal);
  
  showStatus(`Friend request sent to ${username}`, 'success');
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

// Header controls
function toggleNotifications() {
  showStatus('Notifications toggled', 'info');
}

function showPinnedMessages() {
  showStatus('Pinned messages coming soon!', 'info');
}

function toggleMembersSidebar() {
  if (membersSidebar && membersSidebar.classList) {
    membersSidebar.classList.toggle('hidden');
  }
}

function openSearch() {
  showStatus('Search functionality coming soon!', 'info');
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
  // Ctrl/Cmd + K for search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }
  
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
document.addEventListener('DOMContentLoaded', async () => {
  const isHealthy = await testServerConnection();
  
  if (isHealthy) {
    showStatus('✅ Server connection: OK', 'success');
    if (connectionTestBtn) {
      connectionTestBtn.className = 'connection-test-btn connected';
    }
  } else {
    showStatus('❌ Server connection: Failed', 'error');
    if (connectionTestBtn) {
      connectionTestBtn.className = 'connection-test-btn disconnected';
    }
  }
});

