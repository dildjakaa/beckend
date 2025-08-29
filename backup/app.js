// Socket.IO client connection with Firefox compatibility options
const socket = io({
  transports: ['websocket', 'polling'],
  timeout: 20000,
  reconnection: true,
  // Exponential backoff
  reconnectionDelay: 500,
  reconnectionDelayMax: 8000,
  randomizationFactor: 0.5,
});

// DOM Elements - with null checks
const loginContainer = document.getElementById('loginContainer');
const chatContainer = document.getElementById('chatContainer');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const emailVerificationForm = document.getElementById('emailVerificationForm');
const messageForm = document.getElementById('messageForm');

// Login form elements (email + password)
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');

// Register form elements
const regUsernameInput = document.getElementById('regUsername');
const regEmailInput = document.getElementById('regEmail');
const regPasswordInput = document.getElementById('regPassword');
const regPasswordConfirmInput = document.getElementById('regPasswordConfirm');
const passwordStrengthBar = document.getElementById('passwordStrengthBar');
const passwordStrengthLabel = document.getElementById('passwordStrengthLabel');

// Verification form elements
const verificationEmailSpan = document.getElementById('verificationEmail');
const verificationCodeInput = document.getElementById('verificationCode');

// Navigation buttons
const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const backToRegisterBtn = document.getElementById('backToRegisterBtn');

// OAuth buttons removed
const emailLoginBtn = document.getElementById('emailLoginBtn');

// Other elements
const messageInput = document.getElementById('messageInput');
const messagesDiv = document.getElementById('messages');
const userInfoDiv = document.getElementById('userInfo');
const statusMessageDiv = document.getElementById('statusMessage');
const themeToggle = document.getElementById('themeToggle');
const onlineUsersList = document.getElementById('onlineUsersList');
const currentChatName = document.getElementById('currentChatName');
const currentChatStatus = document.getElementById('currentChatStatus');
const newChatBtn = document.getElementById('newChatBtn');
const chatList = document.querySelector('.chat-list');
// Tabs and friends UI
const tabChats = document.getElementById('tabChats');
const tabFriends = document.getElementById('tabFriends');
const chatsSection = document.getElementById('chatsSection');
const friendsSection = document.getElementById('friendsSection');
const friendsList = document.getElementById('friendsList');
const addFriendBtn = document.getElementById('addFriendBtn');

// Invitation modal elements
const ENABLE_PRIVATE = true;
const invitationModal = document.getElementById('invitationModal');
const invitationAvatar = document.getElementById('invitationAvatar');
const invitationTitle = document.getElementById('invitationTitle');
const invitationMessage = document.getElementById('invitationMessage');
const acceptInvitationBtn = document.getElementById('acceptInvitationBtn');
const declineInvitationBtn = document.getElementById('declineInvitationBtn');
const invitationNotification = document.getElementById('invitationNotification');
const invitationNotificationAvatar = document.getElementById('invitationNotificationAvatar');
const invitationNotificationTitle = document.getElementById('invitationNotificationTitle');
const invitationNotificationMessage = document.getElementById('invitationNotificationMessage');

// Check if required elements exist
if (!loginForm) console.warn('loginForm not found');
if (!registerForm) console.warn('registerForm not found');
if (!emailVerificationForm) console.warn('emailVerificationForm not found');
if (!messageForm) console.warn('messageForm not found');

// Check if CSS is loaded
function checkCSSLoaded() {
  const styles = document.styleSheets;
  let cssLoaded = false;
  
  for (let i = 0; i < styles.length; i++) {
    try {
      if (styles[i].href && styles[i].href.includes('style.css')) {
        cssLoaded = true;
        break;
      }
    } catch (e) {
      // CORS error, skip
    }
  }
  
  if (!cssLoaded) {
    console.warn('CSS file not loaded properly. Trying to reload...');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'style.css';
    link.onload = () => console.log('CSS loaded successfully');
    link.onerror = () => console.error('Failed to load CSS');
    document.head.appendChild(link);
  }
}

// Check CSS on page load
document.addEventListener('DOMContentLoaded', checkCSSLoaded);

// Application state
let currentUser = null;
let isConnected = false;
let currentRoom = { id: 1, name: 'General Chat', type: 'general' };
let onlineUsers = new Map();
let theme = localStorage.getItem('theme') || 'dark';
const directRooms = new Map(); // roomId -> { id, name, type }

// Initialize theme
document.documentElement.setAttribute('data-theme', theme);
updateThemeIcon();

// Avatar generation functions
function generateAvatar(username) {
  // Use DiceBear API for consistent avatars
  const style = 'avataaars';
  const seed = username.toLowerCase();
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=6366f1&size=40`;
}

function getAvatarInitials(username) {
  return username.charAt(0).toUpperCase();
}

function createAvatarElement(username, size = 40) {
  const avatar = document.createElement('div');
  avatar.className = 'user-avatar';
  avatar.style.width = `${size}px`;
  avatar.style.height = `${size}px`;
  
  // Try to load image avatar, fallback to initials
  const img = document.createElement('img');
  img.src = generateAvatar(username);
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.borderRadius = 'inherit';
  
  img.onerror = () => {
    avatar.innerHTML = getAvatarInitials(username);
    avatar.style.background = 'var(--bg-accent)';
    avatar.style.color = 'white';
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.fontWeight = '600';
    avatar.style.fontSize = `${size * 0.4}px`;
  };
  
  img.onload = () => {
    avatar.innerHTML = '';
    avatar.appendChild(img);
  };
  
  return avatar;
}

// Theme management
function toggleTheme() {
  theme = theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'light' ? 'Theme' : 'Theme';
  }
}

// Reset functions
function resetToLogin() {
  console.log('Resetting to login state');
  
  // Clear user state
  currentUser = null;
  isConnected = false;
  onlineUsers.clear();
  
  // Reset UI
  loginContainer.style.display = 'flex';
  chatContainer.style.display = 'none';
  
  // Clear forms and messages
  if (loginEmailInput) loginEmailInput.value = '';
  messageInput.value = '';
  messagesDiv.innerHTML = '';
  onlineUsersList.innerHTML = '';
  
  // Reset button states
  const submitButton = loginForm.querySelector('button');
  const sendButton = messageForm.querySelector('.send-btn');
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = 'Join Chat';
  }
  if (sendButton) {
    sendButton.disabled = false;
  }
  
  // Focus email input
  if (loginEmailInput) loginEmailInput.focus();
  
  showStatus('Connection lost. Please login again.', 'error');

  // Clear any invitation UI/state so it won't cover the login screen
  try {
    if (typeof hideInvitationModal === 'function') hideInvitationModal();
    if (typeof hideInvitationNotification === 'function') hideInvitationNotification();
  } catch (e) {}
  try {
    if (typeof pendingInvitations !== 'undefined' && pendingInvitations && pendingInvitations.clear) {
      pendingInvitations.clear();
    }
  } catch (e) {}
  try {
    if (typeof currentInvite !== 'undefined') {
      currentInvite = null;
    }
  } catch (e) {}
}

// Utility Functions
function showStatus(message, type = 'info') {
  statusMessageDiv.textContent = message;
  statusMessageDiv.className = `status-message show ${type}`;
  
  setTimeout(() => {
    statusMessageDiv.classList.remove('show');
  }, 4000);
}

function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}

function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  const safeDate = isValidDate(date) ? date : new Date();
  return safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  const safeDate = isValidDate(date) ? date : new Date();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (safeDate.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (safeDate.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return safeDate.toLocaleDateString();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

function addMessage(messageData, isOwn = false, isSystem = false) {
  const messageDiv = document.createElement('div');
  
  if (isSystem) {
    messageDiv.className = 'system-message';
    messageDiv.innerHTML = `
      <div class="system-content">${escapeHtml(messageData.message)}</div>
      <div class="system-time">${formatTime(messageData.timestamp || new Date())}</div>
    `;
  } else {
    messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
    
    const safeUsername = (messageData && messageData.username) ? messageData.username : 'User';
    const safeContent = (messageData && messageData.content != null) ? String(messageData.content) : '';
    const safeTimestamp = (messageData && messageData.timestamp) ? messageData.timestamp : new Date();
    const avatar = createAvatarElement(safeUsername, 32);
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${!isOwn ? avatar.outerHTML : ''}</div>
      <div class="message-body">
        <div class="message-header">
          <span class="message-author">${escapeHtml(safeUsername)}</span>
          <span class="message-time">${formatTime(safeTimestamp)}</span>
        </div>
        <div class="message-content">${escapeHtml(safeContent)}</div>
      </div>
    `;
  }
  
  messagesDiv.appendChild(messageDiv);
  scrollToBottom();
}

function updateOnlineUsers(users) {
  onlineUsers.clear();
  onlineUsersList.innerHTML = '';
  
  users.forEach(user => {
    onlineUsers.set(user.id, user);
    
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.innerHTML = `
      <div class="user-avatar">${getAvatarInitials(user.username)}</div>
      <span class="user-name">${escapeHtml(user.username)}</span>
      <div class="user-status"></div>
    `;
    
    // Click to send invitation
    if (ENABLE_PRIVATE && currentUser && user.id !== currentUser.id) {
      userItem.style.cursor = 'pointer';
      userItem.addEventListener('click', () => {
        try {
          socket.emit('invite-user', { targetUsername: user.username });
          showStatus(`Приглашение отправлено: ${user.username}`, 'info');
          // Keep a lightweight hint of last invite target for labeling later
          lastInviteTarget = user.username;
        } catch (_) {
          showStatus('Не удалось отправить приглашение', 'error');
        }
      });
    }
    
    onlineUsersList.appendChild(userItem);
  });
}

// Deprecated: replaced by invite flow
function startPrivateChat(user) {}

function switchChat(room) {
  if (!room || !room.id) return;
  document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
  let chatItem = document.querySelector(`[data-room-id="${room.id}"]`);
  if (!chatItem) {
    // Create chat item dynamically
    const item = document.createElement('div');
    item.className = 'chat-item';
    item.setAttribute('data-room-id', String(room.id));
    item.setAttribute('data-room-type', room.type || 'private');
    item.innerHTML = `
      <div class="chat-avatar"><div class="avatar-placeholder">#</div></div>
      <div class="chat-info">
        <div class="chat-name">${escapeHtml(room.name || 'Private chat')}</div>
        <div class="chat-last-message"></div>
      </div>
      <div class="chat-meta"><div class="unread-count" style="display: none;">0</div></div>
    `;
    item.addEventListener('click', () => switchChat(room));
    const list = document.querySelector('.chat-list');
    if (list) list.appendChild(item);
    chatItem = item;
  }
  if (chatItem) chatItem.classList.add('active');
  currentRoom = { id: room.id, name: room.name || 'Private chat', type: room.type || 'private' };
  currentChatName.textContent = currentRoom.name;
  currentChatStatus.textContent = currentRoom.type === 'general' ? 'Public room' : 'Private room';
  messagesDiv.innerHTML = '';
  socket.emit('join_room', { roomId: currentRoom.id, roomType: currentRoom.type });
}

// Tabs toggle
function showChats() {
  if (!tabChats || !tabFriends || !chatsSection || !friendsSection) return;
  tabChats.classList.add('active');
  tabFriends.classList.remove('active');
  chatsSection.style.display = '';
  friendsSection.style.display = 'none';
}

function showFriends() {
  if (!tabChats || !tabFriends || !chatsSection || !friendsSection) return;
  tabFriends.classList.add('active');
  tabChats.classList.remove('active');
  chatsSection.style.display = 'none';
  friendsSection.style.display = '';
  try { socket.emit('friends:list'); } catch (_) {}
}

// Socket Event Handlers
socket.on('connect', () => {
  console.log('Connected to server');
  isConnected = true;
  try {
    // Auto-authenticate on (re)connect if we have a stored token
    if (!currentUser) {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        socket.emit('authenticate_with_token', { token: storedToken });
      }
    }
  } catch (_) {}
});

socket.on('disconnect', (reason) => {
  try {
    const hasToken = !!localStorage.getItem('accessToken');
    console.log('Disconnected from server. Reason:', reason, 'hasToken:', hasToken, 'hadUser:', !!currentUser);
  } catch (_) {
    console.log('Disconnected from server. Reason:', reason);
  }
  isConnected = false;
  
  // Check if this is an unexpected disconnect (not user-initiated)
  if (reason === 'io server disconnect' || reason === 'transport close') {
    showStatus('Connection lost. Reconnecting...', 'error');
    // Do not reset UI immediately; allow auto re-auth on reconnect if token exists
  } else {
    showStatus('Disconnected from server', 'error');
  }
});

socket.on('login_success', (data) => {
  if (data.success) {
    currentUser = data.user;
    currentUser.avatar_url = data.user.avatar_url || generateAvatar(currentUser.username);
    
    loginContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    
    // Update user info with avatar
    const avatar = createAvatarElement(currentUser.username, 32);
    userInfoDiv.innerHTML = `
      <div class="user-info-container">
        ${avatar.outerHTML}
        <div class="user-info-text">
          <div class="username">${currentUser.username}</div>
        </div>
      </div>
    `;
    
    showStatus(`Добро пожаловать, ${currentUser.username}!`, 'success');
    messageInput.focus();
    
    // Join default room
    socket.emit('join_room', { roomId: 1, roomType: 'general' });
  } else {
    showStatus(data.error || 'Ошибка входа', 'error');
  }
});

socket.on('login_error', (data) => {
  showStatus(data.error || 'Неверное имя пользователя или пароль', 'error');
});

socket.on('token_auth_success', (data) => {
  if (data.success) {
    currentUser = data.user;
    currentUser.avatar_url = data.user.avatar_url || generateAvatar(currentUser.username);
    
    loginContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    
    // Update user info with avatar
    const avatar = createAvatarElement(currentUser.username, 32);
    userInfoDiv.innerHTML = `
      <div class="user-info-container">
        ${avatar.outerHTML} 
        <div class="user-info-text">
          <div class="username">${currentUser.username}</div>
        </div>
      </div>
    `;
    
    showStatus(`Добро пожаловать, ${currentUser.username}!`, 'success');
    messageInput.focus();
    
    // Join default room
    socket.emit('join_room', { roomId: 1, roomType: 'general' });
  } else {
    showStatus(data.error || 'Ошибка аутентификации', 'error');
  }
});

socket.on('token_auth_error', (data) => {
  showStatus(data.error || 'Ошибка аутентификации по токену', 'error');
});

// Receive user rooms after auth
socket.on('user_rooms', ({ rooms }) => {
  if (!Array.isArray(rooms)) return;
  rooms.forEach(r => {
    const roomId = String(r.id);
    if (roomId !== '1') {
      directRooms.set(roomId, { id: r.id, name: r.name || `Chat ${r.id}`, type: r.room_type || 'private' });
      let chatItem = document.querySelector(`[data-room-id="${roomId}"]`);
      if (!chatItem) {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.setAttribute('data-room-id', roomId);
        item.setAttribute('data-room-type', r.room_type || 'private');
        item.innerHTML = `
          <div class="chat-avatar"><div class="avatar-placeholder">#</div></div>
          <div class="chat-info">
            <div class="chat-name">${escapeHtml(r.name || 'Private chat')}</div>
            <div class="chat-last-message"></div>
          </div>
          <div class="chat-meta"><div class="unread-count" style="display: none;">0</div></div>
        `;
        item.addEventListener('click', () => switchChat({ id: r.id, name: r.name || 'Private chat', type: r.room_type || 'private' }));
        const list = document.querySelector('.chat-list');
        if (list) list.appendChild(item);
      }
    }
  });
});

socket.on('new_message', (messageData) => {
  const incomingUserId = (messageData && (messageData.userId ?? messageData.user_id));
  const currentId = currentUser ? (currentUser.id ?? currentUser.userId) : null;
  const isOwnMessage = currentId != null && String(incomingUserId) === String(currentId);
  addMessage(messageData, isOwnMessage);
  
  // Update last message in chat list
  const chatItem = document.querySelector(`[data-room-id="${messageData.roomId || 1}"]`);
  if (chatItem) {
    const lastMessageEl = chatItem.querySelector('.chat-last-message');
    if (lastMessageEl) {
      const contentText = (messageData && messageData.content != null) ? String(messageData.content) : '';
      lastMessageEl.textContent = contentText.length > 30 
        ? contentText.substring(0, 30) + '...'
        : contentText;
    }
  }
});

socket.on('user_joined', (data) => {
  if (currentUser && data.username !== currentUser.username) {
    addMessage({
      message: data.message,
      timestamp: new Date()
    }, false, true);
    showStatus(`${data.username} joined the chat`, 'info');
  }
});

socket.on('user_left', (data) => {
  if (currentUser && data.username !== currentUser.username) {
    addMessage({
      message: data.message,
      timestamp: new Date()
    }, false, true);
    showStatus(`${data.username} left the chat`, 'info');
  }
});

socket.on('online_users', (users) => {
  updateOnlineUsers(users);
});

socket.on('room_joined', (data) => {
  if (data.success) {
    // Load room history
    if (data.messages && data.messages.length > 0) {
      messagesDiv.innerHTML = '';
      data.messages.forEach(msg => {
        const incomingUserId = (msg && (msg.user_id ?? msg.userId));
        const currentId = currentUser ? (currentUser.id ?? currentUser.userId) : null;
        const isOwnMessage = currentId != null && String(incomingUserId) === String(currentId);
        addMessage({
          username: msg.username,
          content: msg.content,
          timestamp: msg.timestamp,
          userId: msg.user_id
        }, isOwnMessage);
      });
    }
  }
});

// Handle server-side errors without triggering socket.io reserved error semantics
socket.on('server_error', (data) => {
  showStatus(data && data.message ? data.message : 'An error occurred', 'error');
});

// Form Event Handlers
// Email login start (request code)
let emailLoginContext = { email: null };

// Only add event listeners if forms exist
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginEmailInput ? loginEmailInput.value.trim() : '';
    const password = loginPasswordInput ? loginPasswordInput.value : '';
    if (!email || !email.includes('@')) {
      showStatus('Пожалуйста, введите корректный email', 'error');
      return;
    }
    if (!password || password.length < 6) {
      showStatus('Пароль должен содержать минимум 6 символов', 'error');
      return;
    }
    const submitButton = loginForm.querySelector('button');
    if (!submitButton) {
      showStatus('Ошибка: кнопка отправки не найдена', 'error');
      return;
    }
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Вход...';
    submitButton.disabled = true;

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    .then(r => r.json())
    .then(data => {
      const token = data && (data.token || (data.data && data.data.token));
      if (data.success && token) {
        localStorage.setItem('accessToken', token);
        socket.emit('authenticate_with_token', { token });
      } else {
        showStatus(data.error || 'Ошибка входа', 'error');
      }
    })
    .catch(() => showStatus('Ошибка входа', 'error'))
    .finally(() => {
      if (submitButton) {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    });
  });
}

// Register form handler
if (registerForm) {
  // Password visibility toggles
  registerForm.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');
      btn.textContent = isPassword ? '🙈' : '👁️';
    });
  });

  // Strength evaluation during typing
  if (regPasswordInput) {
    regPasswordInput.addEventListener('input', () => {
      const value = regPasswordInput.value || '';
      const { score, label } = evaluatePasswordStrength(value);
      updateStrengthUI(score, label);
    });
  }

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = regUsernameInput ? regUsernameInput.value.trim() : '';
    const email = regEmailInput ? regEmailInput.value.trim() : '';
    const password = regPasswordInput ? regPasswordInput.value : '';
    const passwordConfirm = regPasswordConfirmInput ? regPasswordConfirmInput.value : '';
    const tosAccepted = document.getElementById('regTos') ? document.getElementById('regTos').checked : false;
    
    // Validation
    if (!username || !email || !password || !passwordConfirm) {
      showStatus('Пожалуйста, заполните все поля', 'error');
      return;
    }
    
    if (username.length < 3) {
      showStatus('Имя пользователя должно содержать минимум 3 символа', 'error');
      return;
    }
    
    if (password.length < 6) {
      showStatus('Пароль должен содержать минимум 6 символов', 'error');
      return;
    }

    // Block weak passwords: require at least Normal
    const strength = evaluatePasswordStrength(password);
    if (strength.score < 2) {
      showStatus('Пароль слишком слабый. Требуется уровень не ниже: Normal', 'error');
      return;
    }
    
    if (password !== passwordConfirm) {
      showStatus('Пароли не совпадают', 'error');
      return;
    }
    
    if (!email.includes('@')) {
      showStatus('Пожалуйста, введите корректный email', 'error');
      return;
    }
    
    if (!tosAccepted) {
      showStatus('Нужно принять условия соглашения и политику конфиденциальности', 'error');
      return;
    }
    
    // Disable form while processing
    const submitButton = registerForm.querySelector('button');
    if (!submitButton) {
      showStatus('Ошибка: кнопка отправки не найдена', 'error');
      return;
    }
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Регистрация...';
    submitButton.disabled = true;
  
  // Send registration request
  fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password, tosAccepted: true })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showStatus('Код подтверждения отправлен на ваш email', 'success');
      showVerificationForm(email);
    } else {
      showStatus(data.error || 'Ошибка при регистрации', 'error');
    }
  })
  .catch(error => {
    console.error('Registration error:', error);
    showStatus('Ошибка при регистрации', 'error');
  })
  .finally(() => {
    if (submitButton) {
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });
  });
}

// Password strength helpers
function evaluatePasswordStrength(password) {
  let score = 0;
  if (!password) return { score, label: '—' };

  // Length checks
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;

  // Character variety
  const hasLower = /[a-zа-я]/.test(password);
  const hasUpper = /[A-ZА-Я]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^\w\s]/.test(password);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (variety >= 2) score++;
  if (variety >= 3) score++;

  // Penalize common/obvious patterns
  const common = /(password|qwerty|111111|123456|654321|letmein|admin)/i.test(password);
  if (common) score = Math.max(0, score - 2);

  // Cap score 0..4
  score = Math.max(0, Math.min(4, score));

  const label = score <= 1 ? 'Weak' : score === 2 ? 'Normal' : score === 3 ? 'Strong' : 'Very strong';
  return { score, label };
}

function updateStrengthUI(score, label) {
  if (!passwordStrengthBar || !passwordStrengthLabel) return;
  const widths = ['0%', '25%', '50%', '75%', '100%'];
  passwordStrengthBar.style.width = widths[score];
  passwordStrengthBar.setAttribute('data-score', String(score));
  passwordStrengthLabel.textContent = `Сила пароля: ${label}`;
}

// Email verification form handler
if (emailVerificationForm) {
  emailVerificationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Sanitize input: keep only digits
    const code = verificationCodeInput ? (verificationCodeInput.value || '').replace(/\D/g, '').slice(0, 6) : '';
    const emailForVerification = verificationEmailSpan ? verificationEmailSpan.textContent.trim() : '';
    
    if (!code || code.length !== 6) {
      showStatus('Пожалуйста, введите 6-значный код', 'error');
      return;
    }
    
    // Disable form while processing
    const submitButton = emailVerificationForm.querySelector('button');
    if (!submitButton) {
      showStatus('Ошибка: кнопка отправки не найдена', 'error');
      return;
    }
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Проверка...';
    submitButton.disabled = true;
  
  // Determine flow: login vs registration
  const isLoginFlow = emailLoginContext.email && emailLoginContext.email.toLowerCase() === (emailForVerification || '').toLowerCase();
  const url = isLoginFlow ? '/api/auth/login-email-verify' : '/api/auth/verify-email';
  // Send email alongside code for registration flow too, to disambiguate on server
  const payload = isLoginFlow ? { email: emailForVerification, code } : { code, email: emailForVerification };

  // Send verification request
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      const token = data && (data.token || (data.data && data.data.token));
      if (isLoginFlow && token) {
        localStorage.setItem('accessToken', token);
        showStatus('Вход по email выполнен', 'success');
        socket.emit('authenticate_with_token', { token });
        emailLoginContext.email = null;
      } else {
        showStatus('Email подтвержден! Теперь вы можете войти', 'success');
        showLoginForm();
        // Clear register form
        registerForm.reset();
      }
    } else {
      showStatus(data.error || 'Неверный код подтверждения', 'error');
    }
  })
  .catch(error => {
    console.error('Verification error:', error);
    showStatus('Ошибка при проверке кода', 'error');
  })
  .finally(() => {
    if (submitButton) {
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });
  });
}

// Resend code button handler
const resendCodeBtn = document.getElementById('resendCodeBtn');
if (resendCodeBtn) {
  resendCodeBtn.addEventListener('click', () => {
    const email = regEmailInput ? regEmailInput.value.trim() : '';
    if (!email) {
      showStatus('Email не найден', 'error');
      return;
    }
    
    const button = document.getElementById('resendCodeBtn');
    if (!button) {
      showStatus('Ошибка: кнопка не найдена', 'error');
      return;
    }
    button.disabled = true;
    button.textContent = 'Отправка...';
  
  fetch('/api/auth/resend-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showStatus('Код подтверждения отправлен повторно', 'success');
    } else {
      showStatus(data.error || 'Ошибка при отправке кода', 'error');
    }
  })
  .catch(error => {
    console.error('Resend error:', error);
    showStatus('Ошибка при отправке кода', 'error');
  })
  .finally(() => {
    if (button) {
      button.disabled = false;
      button.textContent = 'Отправить снова';
    }
  });
  });
}

if (messageForm) {
  messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const content = messageInput.value.trim();
  
  if (!content) {
    showStatus('Message cannot be empty', 'error');
    return;
  }
  
  if (!currentUser) {
    showStatus('Please set a username first', 'error');
    return;
  }
  
  if (!isConnected) {
    showStatus('Not connected to server', 'error');
    return;
  }
  
  // Debug logging for Firefox
  console.log('Sending message:', {
    content,
    roomId: currentRoom.id,
    roomType: currentRoom.type,
    browser: navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other',
    socketConnected: socket.connected,
    currentUser: currentUser?.username
  });
  
  // Disable send button while processing
  const sendButton = messageForm.querySelector('.send-btn');
  sendButton.disabled = true;
  
  // Store original values in case we need to restore them
  const originalValue = messageInput.value;
  
  try {
    socket.emit('send_message', { 
      content, 
      roomId: currentRoom.id,
      roomType: currentRoom.type
    });
    
    // Clear input only after successful emit
    messageInput.value = '';
    
  } catch (error) {
    console.error('Error sending message:', error);
    showStatus('Failed to send message', 'error');
    // Restore original value on error
    messageInput.value = originalValue;
  }
  
  // Re-enable button after delay
  setTimeout(() => {
    if (sendButton) sendButton.disabled = false;
    if (messageInput) messageInput.focus();
  }, 500);
  });
}

// Theme toggle event handler
if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

// New chat button handler
if (newChatBtn) {
  newChatBtn.addEventListener('click', () => {
    showStatus('Выберите пользователя слева, чтобы пригласить в приватный чат', 'info');
  });
}

// Tabs handlers
if (tabChats && tabFriends) {
  tabChats.addEventListener('click', showChats);
  tabFriends.addEventListener('click', showFriends);
}

// Add friend prompt
if (addFriendBtn) {
  addFriendBtn.addEventListener('click', () => {
    const username = prompt('Введите имя пользователя для добавления в друзья:');
    if (username && username.trim()) {
      try { socket.emit('friends:request', { username: username.trim() }); } catch (_) {}
    }
  });
}

// Friends events rendering
socket.on('friends:list', ({ friends }) => {
  if (!friendsList) return;
  friendsList.innerHTML = '';
  (friends || []).forEach(f => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <div class="user-avatar">${getAvatarInitials(f.username)}</div>
      <span class="user-name">${escapeHtml(f.username)}</span>
      <span class="friend-status" style="margin-left:auto; font-size:0.75rem; opacity:0.8;">${escapeHtml(f.status || '')}</span>
    `;
    item.addEventListener('click', () => {
      if ((f.status || '') === 'accepted') {
        showStatus('Открывайте диалог через список чатов или пригласите заново, если не появился', 'info');
      } else if ((f.status || '') === 'pending') {
        showStatus('Заявка в друзья в ожидании', 'info');
      }
    });
    friendsList.appendChild(item);
  });
});

socket.on('friends:request', ({ from }) => {
  const accept = confirm(`Пользователь ${from} хочет добавить вас в друзья. Принять?`);
  try { socket.emit('friends:respond', { from, accept }); } catch (_) {}
});

socket.on('friends:request:ok', ({ to }) => {
  showStatus(`Заявка отправлена пользователю ${to}`, 'success');
});

socket.on('friends:update', ({ user, accepted }) => {
  showStatus(accepted ? `Вы теперь друзья с ${user}` : `${user} отклонил заявку`, accepted ? 'success' : 'info');
  try { socket.emit('friends:list'); } catch (_) {}
});

// General chat click handler
const generalChatItem = document.querySelector('.chat-item');
if (generalChatItem) {
  generalChatItem.addEventListener('click', () => {
    switchChat({ id: 1, name: 'General Chat', type: 'general' });
  });
}

// Keyboard shortcuts
if (messageInput) {
  messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (messageForm) messageForm.dispatchEvent(new Event('submit'));
  }
  });
}

// Form switching functions
function showLoginForm() {
  if (loginForm) loginForm.style.display = 'block';
  if (registerForm) registerForm.style.display = 'none';
  if (emailVerificationForm) emailVerificationForm.style.display = 'none';
  if (loginEmailInput) loginEmailInput.focus();
}

function showRegisterForm() {
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'block';
  if (emailVerificationForm) emailVerificationForm.style.display = 'none';
  if (regUsernameInput) regUsernameInput.focus();
}

function showVerificationForm(email) {
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'none';
  if (emailVerificationForm) emailVerificationForm.style.display = 'block';
  if (verificationEmailSpan) verificationEmailSpan.textContent = email;
  if (verificationCodeInput) verificationCodeInput.focus();
}

// Form navigation event listeners
if (showRegisterBtn) {
  showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
}

if (showLoginBtn) {
  showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });
}

if (backToRegisterBtn) {
  backToRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
}

// GitHub OAuth removed

// Remove emailLoginBtn behavior (button removed from DOM)

// Auto-focus on email input when page loads
document.addEventListener('DOMContentLoaded', () => {
  if (loginEmailInput) loginEmailInput.focus();
  // Ensure invitation notification is hidden at boot
  try {
    const toast = document.getElementById('invitationNotification');
    if (toast) {
      toast.classList.remove('show');
      toast.classList.remove('invitation-pulse');
    }
  } catch (_) {}
  
  // OAuth token callback handling removed

  // If there's already a stored token (e.g., username/password or previous OAuth), try to auto-login
  try {
    if (!currentUser) {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        socket.emit('authenticate_with_token', { token: storedToken });
      }
    }
  } catch (_) {}
});

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  showStatus('Failed to connect to server', 'error');
});

// Handle reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected to server');
  showStatus('Reconnected to server', 'success');
  isConnected = true;
  // Ensure authentication is restored on reconnect
  try {
    const storedToken = localStorage.getItem('accessToken');
    if (storedToken) {
      socket.emit('authenticate_with_token', { token: storedToken });
    }
  } catch (_) {}
});

socket.on('reconnecting', (attemptNumber) => {
  showStatus(`Reconnecting... (attempt ${attemptNumber})`, 'info');
});

socket.on('reconnect_failed', () => {
  showStatus('Failed to reconnect to server', 'error');
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentUser) {
    scrollToBottom();
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  if (currentUser) {
    scrollToBottom();
  }
});

// Mobile sidebar functionality removed

// Handle escape key for invitation modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentInvite) {
    hideInvitationModal();
  }
});

// ===== INVITATION MODAL FUNCTIONALITY =====

// State for managing invitations
let pendingInvitations = new Map();
let currentInvite = null;
let notificationTimer = null;

// UI Helper Functions for Invitation Modal
function showInvitationModal(invite) {
  if (!invite) return;
  
  currentInvite = invite;
  
  // Fill modal content
  invitationAvatar.textContent = getAvatarInitials(invite.fromUser.username);
  invitationTitle.textContent = 'Приглашение в приватный чат';
  invitationMessage.textContent = invite.message || `${invite.fromUser.username} хочет начать приватный чат с вами.`;
  
  // Show modal
  invitationModal.classList.add('show');
  
  // Add blur background effect
  document.body.style.overflow = 'hidden';
  
  // Hide notification toast if it's showing
  hideInvitationNotification();
}

function hideInvitationModal() {
  invitationModal.classList.remove('show');
  document.body.style.overflow = '';
  currentInvite = null;
}

function showInvitationNotification(invite) {
  if (!invite) return;
  
  // Clear any existing notification timer
  if (notificationTimer) {
    clearTimeout(notificationTimer);
  }
  
  // Fill notification content
  invitationNotificationAvatar.textContent = getAvatarInitials(invite.fromUser.username);
  invitationNotificationTitle.textContent = 'Новое приглашение';
  invitationNotificationMessage.textContent = `${invite.fromUser.username} приглашает в приватный чат`;
  
  // Show notification
  invitationNotification.classList.add('show');
  invitationNotification.classList.add('invitation-pulse');
  
  // Auto-hide after 6 seconds
  notificationTimer = setTimeout(() => {
    hideInvitationNotification();
  }, 6000);
  
  // Add click handler to open full modal
  const clickHandler = () => {
    hideInvitationNotification();
    showInvitationModal(invite);
    invitationNotification.removeEventListener('click', clickHandler);
  };
  
  invitationNotification.addEventListener('click', clickHandler);
}

function hideInvitationNotification() {
  invitationNotification.classList.remove('show');
  invitationNotification.classList.remove('invitation-pulse');
  
  if (notificationTimer) {
    clearTimeout(notificationTimer);
    notificationTimer = null;
  }
}

// Handle invitation response
function respondToInvite(accepted) {
  // If not logged in, do nothing
  if (!currentUser) return;
  if (!currentInvite) return;
  
  const invite = currentInvite;
  
  // Disable buttons to prevent double-click
  acceptInvitationBtn.disabled = true;
  declineInvitationBtn.disabled = true;
  
  // Send response to server
  try {
    socket.emit('respond-to-invitation', {
      invitationId: invite.invitationId,
      response: accepted ? 'accept' : 'reject'
    });
  } catch (_) {}
  
  // Remove from pending invitations
  pendingInvitations.delete(invite.invitationId);
  
  // Hide modal
  hideInvitationModal();
  
  // Show appropriate status message
  if (accepted) {
    showStatus(`Принято приглашение от ${invite.from}`, 'success');
  } else {
    showStatus(`Отклонено приглашение от ${invite.from}`, 'info');
  }
  
  // Re-enable buttons after delay
  setTimeout(() => {
    acceptInvitationBtn.disabled = false;
    declineInvitationBtn.disabled = false;
  }, 1000);
}

// Event Listeners for invitation buttons
acceptInvitationBtn.addEventListener('click', () => respondToInvite(true));
declineInvitationBtn.addEventListener('click', () => respondToInvite(false));

// Close modal when clicking outside of it
invitationModal.addEventListener('click', (e) => {
  if (e.target === invitationModal) {
    hideInvitationModal();
  }
});

// Note: Escape key handling is done in the main Escape handler above

// Socket event handler for incoming invitations (new API)
socket.on('invitation-received', (payload) => {
  if (!currentUser) return;
  if (!payload || !payload.invitationId || !payload.from) return;
  const invite = {
    invitationId: payload.invitationId,
    from: payload.from
  };
  pendingInvitations.set(payload.invitationId, invite);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  // Adapt modal content
  invitationAvatar.textContent = getAvatarInitials(payload.from);
  invitationTitle.textContent = 'Приглашение в приватный чат';
  invitationMessage.textContent = `${payload.from} хочет начать приватный чат с вами.`;
  if (!isMobile) {
    showInvitationNotification({ fromUser: { username: payload.from } });
  } else {
    showInvitationModal({ fromUser: { username: payload.from }, invitationId: payload.invitationId });
  }
  // Ensure currentInvite is set when opening modal via notification click
  currentInvite = { invitationId: payload.invitationId, from: payload.from };
});

// When a private chat begins
const privateChats = new Map(); // chatId -> { name }
let lastInviteTarget = null;
socket.on('chat-started', ({ chatId, name, type }) => {
  if (!chatId) return;
  const displayName = name || (lastInviteTarget ? `Private chat with ${lastInviteTarget}` : 'Private chat');
  privateChats.set(chatId, { name: displayName });
  let chatItem = document.querySelector(`[data-room-id="${chatId}"]`);
  if (!chatItem) {
    const item = document.createElement('div');
    item.className = 'chat-item';
    item.setAttribute('data-room-id', String(chatId));
    item.setAttribute('data-room-type', type || 'private');
    item.innerHTML = `
      <div class="chat-avatar"><div class="avatar-placeholder">#</div></div>
      <div class="chat-info">
        <div class="chat-name">${escapeHtml(displayName)}</div>
        <div class="chat-last-message"></div>
      </div>
      <div class="chat-meta"><div class="unread-count" style="display: none;">0</div></div>
    `;
    item.addEventListener('click', () => switchChat({ id: chatId, name: displayName, type: type || 'private' }));
    const list = document.querySelector('.chat-list');
    if (list) list.appendChild(item);
  }
  switchChat({ id: chatId, name: displayName, type: type || 'private' });
  lastInviteTarget = null;
});

socket.on('invitation-declined', ({ invitationId, by }) => {
  showStatus(`Пользователь ${by} отклонил приглашение`, 'info');
  if (invitationId) pendingInvitations.delete(invitationId);
});

// Socket event handler for invitation response acknowledgment
// Old invitation ack handler removed (using new events)

// ===== TESTING FUNCTIONS (for demonstration) =====

// Enable test utilities only on localhost or when explicitly requested via ?debug=1
(function enableTestUtilitiesIfDebug() {
  try {
    const params = new URLSearchParams(location.search || '');
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const isDebug = params.get('debug') === '1';

    if (!(isLocalhost || isDebug)) {
      return; // Do not expose any test utilities in production
    }

    // Test function to simulate invitation (for testing purposes)
    function testInvitation() {
      const mockInvitation = {
        inviteId: 'test-invite-' + Date.now(),
        roomId: 'private_1_2',
        fromUser: {
          id: 2,
          username: 'TestUser'
        },
        message: 'Хочу обсудить с вами важный вопрос в приватном чате.'
      };

      console.log('Testing invitation modal with mock data:', mockInvitation);

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                       window.innerWidth <= 768;

      if (!isMobile) {
        showInvitationNotification(mockInvitation);
      } else {
        console.log('Skipping invitation notification on mobile device');
      }
    }

    // Expose test function only in debug
    window.testInvitation = testInvitation;

    // Console helper message in debug only
    console.log('🔧 [DEBUG] Invitation modal test utilities enabled. Call testInvitation() to simulate.');
  } catch (_) {}
})();

