// Socket.IO client connection with Firefox compatibility options
const socket = io('https://krackenx.onrender.com', {  //DO NOT USE LOCALHOST
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
    
    // Simulate login (replace with actual authentication)
    currentUser = {
      username: username,
      avatar: generateAvatar(username),
      status: 'online'
    };
    
    // Update UI
    updateUserInterface();
    showChatInterface();
    showStatus(`Welcome back, ${username}!`, 'success');
    
    // Join default channel
    joinChannel('general');
    
  } catch (error) {
    console.error('Login error:', error);
    showStatus('Login failed. Please try again.', 'error');
  }
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
  if (socket && isConnected) {
    socket.emit('join_room', { roomId: channelId, roomType: 'text' });
  }
}

// Update user interface
function updateUserInterface() {
  if (!currentUser) return;
  
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
  if (loginContainer) loginContainer.style.display = 'none';
  if (chatContainer) chatContainer.style.display = 'flex';
}

// Server switching
function switchServer(serverId) {
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
  if (socket && isConnected) {
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
  const isOwnMessage = messageData.isOwn || messageData.username === currentUser?.username;
  
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
    const count = onlineUsers.size + 1; // +1 for current user
    onlineCount.textContent = count;
  }
}

// Update members list
function updateMembersList() {
  if (membersList) {
    const members = Array.from(onlineUsers.values());
    members.push(currentUser);
    
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
  if (directMessagesList) {
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

