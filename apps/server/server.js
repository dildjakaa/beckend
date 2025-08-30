require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { query } = require('./utils/db.js');
const { addCorsHeaders, handleCorsPreflight } = require('./utils/cors.js');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Global CORS middleware
app.use((req, res, next) => {
  if (handleCorsPreflight(req, res)) return; //i want a delete api/health check 
  addCorsHeaders(res);
  next();
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Import API routes
const registerHandler = require('./api/auth/register.js');
const verifyEmailHandler = require('./api/auth/verify-email.js');
const loginEmailVerifyHandler = require('./api/auth/login-email-verify.js');
const resendCodeHandler = require('./api/auth/resend-code.js');
const loginHandler = require('./api/auth/login.js');
const healthHandler = require('./api/health.js');
const pingHandler = require('./api/ping.js');
// Admin API handlers
const adminLogsHandler = require('./api/admin/logs.js');
const adminClearLogsHandler = require('./api/admin/clear-logs.js');
const adminDeleteUsersHandler = require('./api/admin/delete-users.js');
const adminDeleteMessagesHandler = require('./api/admin/delete-messages.js');
const adminSendSupportMessageHandler = require('./api/admin/send-support-message.js');

// Friends API handlers
const sendFriendRequestHandler = require('./api/friends/send-request.js');
const respondToFriendRequestHandler = require('./api/friends/respond-request.js');
const getFriendRequestsHandler = require('./api/friends/get-requests.js');
const getFriendsHandler = require('./api/friends/get-friends.js');

// Store connected users
const connectedUsers = new Map();
const userRooms = new Map();

// Invitation system state
// Maps: userId -> socketId and invitationId -> { from, to, status }
const onlineUsers = new Map();
const pendingInvitations = new Map();

// Ensure required tables exist (friends system)
async function ensureAuxTables() {
    try {
        // Create friends table
        await query(`
            CREATE TABLE IF NOT EXISTS friends (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, friend_id)
            );
        `, []);
        
        // Create friend requests table
        await query(`
            CREATE TABLE IF NOT EXISTS friend_requests (
                id SERIAL PRIMARY KEY,
                from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(from_user_id, to_user_id)
            );
        `, []);
        
        // Create indexes for better performance
        await query(`CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);`, []);
        await query(`CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);`, []);
        await query(`CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);`, []);
        await query(`CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user_id ON friend_requests(to_user_id);`, []);
        await query(`CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);`, []);
        
        console.log('✅ Friends system tables and indexes created/verified');
    } catch (e) {
        console.error('Failed to ensure friends tables:', e);
    }
}

// Create or get an existing direct chat room for two users
async function getOrCreateDirectRoom(userIdA, userIdB) {
    const a = Number(userIdA);
    const b = Number(userIdB);
    const [minId, maxId] = a < b ? [a, b] : [b, a];
    // Try find existing direct room with both participants
    const existing = await query(
        `SELECT cr.id, cr.name
         FROM chat_rooms cr
         WHERE cr.room_type = 'direct'
           AND EXISTS (
             SELECT 1 FROM chat_room_participants p1 WHERE p1.room_id = cr.id AND p1.user_id = $1
           )
           AND EXISTS (
             SELECT 1 FROM chat_room_participants p2 WHERE p2.room_id = cr.id AND p2.user_id = $2
           )
         LIMIT 1`,
        [minId, maxId]
    );
    if (existing.rows.length > 0) {
        return existing.rows[0];
    }
    // Create new direct room and add both participants
    const roomName = `Direct ${minId}-${maxId}`;
    const newRoom = await query(
        `INSERT INTO chat_rooms (name, room_type, created_by) VALUES ($1, 'direct', $2) RETURNING id, name`,
        [roomName, minId]
    );
    const roomId = newRoom.rows[0].id;
    await query(
        `INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING`,
        [roomId, minId]
    );
    await query(
        `INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING`,
        [roomId, maxId]
    );
    return { id: roomId, name: roomName };
}

// Send friend request notification via Socket.IO
async function sendFriendRequestNotification(fromUserId, toUserId) {
    try {
        // Get user information
        const fromUser = await query(
            'SELECT username, avatar_url FROM users WHERE id = $1',
            [fromUserId]
        );
        
        if (fromUser.rows.length === 0) return;
        
        const userData = fromUser.rows[0];
        
        // Find the socket of the recipient
        const recipientSocket = Array.from(connectedUsers.values())
            .find(user => user.userId === toUserId);
        
        if (recipientSocket) {
            io.to(recipientSocket.socketId).emit('friend_request_received', {
                fromUserId: fromUserId,
                fromUsername: userData.username,
                fromAvatar: userData.avatar_url,
                timestamp: new Date()
            });
        }
    } catch (error) {
        console.error('Error sending friend request notification:', error);
    }
}

// Helper function to broadcast online users
function broadcastOnlineUsers() {
    const onlineUsers = Array.from(connectedUsers.values())
        .filter((user, index, arr) => 
            arr.findIndex(u => u.userId === user.userId) === index
        )
        .map(user => ({
            id: user.userId,
            username: user.username
        }));
    
    io.emit('online_users', onlineUsers);
}



// Initialize database on startup (Postgres boot migrations run on first query)

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-panel.html'));
});

// Health check endpoint for Render
app.get('/api', (req, res) => {
    res.json({ success: true, message: 'OK' });
});

// Health and ping endpoints
app.get('/api/health', healthHandler);
app.get('/api/ping', pingHandler);

// API Routes
app.post('/api/auth/register', registerHandler);
app.post('/api/auth/verify-email', verifyEmailHandler);
app.post('/api/auth/login-email-verify', loginEmailVerifyHandler);
app.post('/api/auth/resend-code', resendCodeHandler);
app.post('/api/auth/login', loginHandler);

// Admin routes
app.get('/api/admin/logs', adminLogsHandler);
app.post('/api/admin/clear-logs', adminClearLogsHandler);
app.post('/api/admin/delete-users', adminDeleteUsersHandler);
app.post('/api/admin/delete-messages', adminDeleteMessagesHandler);
app.post('/api/admin/send-support-message', adminSendSupportMessageHandler);

// Friends routes
app.post('/api/friends/send-request', sendFriendRequestHandler);
app.post('/api/friends/respond-request', respondToFriendRequestHandler);
app.get('/api/friends/requests/:userId', getFriendRequestsHandler);
app.get('/api/friends/list/:userId', getFriendsHandler);

// GitHub OAuth endpoint
app.get('/api/auth/github', (req, res) => {
    res.status(404).json({ error: 'GitHub OAuth disabled' });
});

app.get('/api/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect('/?error=github_auth_failed');
    }
    
    try {
        // Exchange code for access token
        const axios = require('axios');
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code
        }, {
            headers: {
                'Accept': 'application/json'
            }
        });

        const { access_token } = tokenResponse.data;

        if (!access_token) {
            console.error('Failed to get access token:', tokenResponse.data);
            return res.redirect('/?error=github_auth_failed');
        }

        // Get user data from GitHub
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${access_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Get user emails
        const emailsResponse = await axios.get('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `token ${access_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        const userData = userResponse.data;
        const emails = emailsResponse.data;
        const primaryEmail = emails.find(email => email.primary)?.email || emails[0]?.email;

        // Check if user already exists
        const existingUser = await query(
            'SELECT * FROM users WHERE github_id = $1',
            [userData.id.toString()]
        );

        if (existingUser.rows.length > 0) {
            // User exists, update last seen
            await query(
                'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [existingUser.rows[0].id]
            );
            
            // Generate JWT token
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { userId: existingUser.rows[0].id, username: existingUser.rows[0].username },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );
            
            res.redirect(`/?token=${token}`);
        } else {
            // Create new user
            const username = userData.login || `github_${userData.id}`;
            const avatarUrl = userData.avatar_url;
            
            const newUser = await query(
                `INSERT INTO users (username, email, github_id, avatar_url, email_verified, is_oauth_user) 
                 VALUES ($1, $2, $3, $4, true, true) 
                 RETURNING *`,
                [username, primaryEmail, userData.id.toString(), avatarUrl]
            );
            
            // Add user to general chat room
            await query(
                'INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING',
                [1, newUser.rows[0].id]
            );
            
            // Send welcome email
            const { sendWelcomeEmail } = require('./utils/email.js');
            if (primaryEmail) {
                sendWelcomeEmail(primaryEmail, username).catch(emailErr => {
                    console.error('Error sending welcome email:', emailErr);
                });
            }
            
            // Generate JWT token
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { userId: newUser.rows[0].id, username: username },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );
            
            res.redirect(`/?token=${token}`);
        }
    } catch (error) {
        console.error('GitHub OAuth error:', error);
        res.redirect('/?error=github_auth_failed');
    }
});

// Test endpoints
app.get('/api/test/github-oauth', async (req, res) => {
    try {
        const config = {
            githubClientId: process.env.GITHUB_CLIENT_ID ? '✅ Настроен' : '❌ Не настроен',
            githubClientSecret: process.env.GITHUB_CLIENT_SECRET ? '✅ Настроен' : '❌ Не настроен',
            githubCallbackUrl: process.env.GITHUB_CALLBACK_URL || 'https://beckend-yaj1.onrender.com/api/auth/github/callback',
            jwtSecret: process.env.JWT_SECRET ? '✅ Настроен' : '❌ Не настроен',
            environment: process.env.NODE_ENV || 'development'
        };

        res.json({
            success: true,
            message: 'GitHub OAuth Configuration Status',
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('GitHub OAuth test error:', error);
        res.status(500).json({ success: false, error: 'Failed to check GitHub OAuth configuration' });
    }
});

app.post('/api/test/email', async (req, res) => {
    try {
        const { template, to, data } = req.body;

        if (!template || !to) {
            return res.status(400).json({ success: false, error: 'Template and recipient email are required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }

        const { sendWelcomeEmail, verifyEmailConfig } = require('./utils/email.js');
        let result;

        switch (template) {
            case 'welcome':
                if (!data || !data.username) {
                    return res.status(400).json({ success: false, error: 'Username is required for welcome email' });
                }
                result = await sendWelcomeEmail(to, data.username);
                break;

            case 'test':
                const configResult = await verifyEmailConfig();
                if (!configResult.success) {
                    return res.status(500).json({ success: false, error: `Email configuration error: ${configResult.error}` });
                }
                result = await sendWelcomeEmail(to, 'TestUser');
                break;

            default:
                return res.status(400).json({ success: false, error: 'Invalid email template. Use "welcome" or "test"' });
        }

        if (result.success) {
            res.json({
                success: true,
                message: 'Email sent successfully',
                messageId: result.messageId,
                template,
                recipient: to
            });
        } else {
            res.status(500).json({ success: false, error: `Failed to send email: ${result.error}` });
        }

    } catch (error) {
        console.error('Email test error:', error);
        res.status(500).json({ success: false, error: 'Failed to send test email' });
    }
});

// GitHub OAuth endpoint
app.get('/api/auth/github', (req, res) => {
    // Redirect to GitHub OAuth
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
        return res.status(500).json({ error: 'GitHub Client ID not configured' });
    }
    // Use different callback URLs for Electron and web
    const isElectron = req.query.client === 'electron';
    const redirectUri = isElectron 
        ? `${req.protocol}://${req.get('host')}/api/auth/github/electron-callback`
        : (process.env.GITHUB_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/github/callback`);
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
    
    res.redirect(githubAuthUrl);
});

// Special endpoint for Electron to get GitHub OAuth token
app.get('/api/auth/github/electron-callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).json({ success: false, error: 'No authorization code provided' });
    }
    
    try {
        // Exchange code for access token
        const axios = require('axios');
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code
        }, {
            headers: {
                'Accept': 'application/json'
            }
        });

        const { access_token } = tokenResponse.data;

        if (!access_token) {
            console.error('Failed to get access token:', tokenResponse.data);
            return res.status(400).json({ success: false, error: 'Failed to get access token' });
        }

        // Get user data from GitHub
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${access_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Get user emails
        let emails = [];
        try {
            const emailsResponse = await axios.get('https://api.github.com/user/emails', {
                headers: {
                    'Authorization': `token ${access_token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            emails = emailsResponse.data || [];
        } catch (e) {
            emails = [];
        }

        const userData = userResponse.data;
        const primaryEmail = emails.find(email => email.primary)?.email || emails[0]?.email;

        // Check if user already exists
        const existingUser = await query(
            'SELECT * FROM users WHERE github_id = $1',
            [userData.id.toString()]
        );

        if (existingUser.rows.length > 0) {
                    // User exists, update last seen
            await query(
                'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [existingUser.rows[0].id]
            );
                            
                            // Generate JWT token
                            const jwt = require('jsonwebtoken');
                            const token = jwt.sign(
                { userId: existingUser.rows[0].id, username: existingUser.rows[0].username },
                                process.env.JWT_SECRET || 'your-secret-key',
                                { expiresIn: '7d' }
                            );
                            
                            // For Electron, redirect to success page with token
                            res.redirect(`/electron-callback.html?token=${token}`);
                } else {
                    // Create new user
                    const username = userData.login || `github_${userData.id}`;
                    const avatarUrl = userData.avatar_url;
                    
            const newUser = await query(
                        `INSERT INTO users (username, email, github_id, avatar_url, email_verified, is_oauth_user) 
                 VALUES ($1, $2, $3, $4, true, true) 
                 RETURNING *`,
                [username, primaryEmail, userData.id.toString(), avatarUrl]
            );
                            
                            // Add user to general chat room
            await query(
                'INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING',
                [1, newUser.rows[0].id]
            );
                                    
                                    // Send welcome email
            const { sendWelcomeEmail } = require('./utils/email.js');
                                    if (primaryEmail) {
                                        sendWelcomeEmail(primaryEmail, username).catch(emailErr => {
                                            console.error('Error sending welcome email:', emailErr);
                                        });
                                    }
                                    
                                    // Generate JWT token
                                    const jwt = require('jsonwebtoken');
                                    const token = jwt.sign(
                { userId: newUser.rows[0].id, username: username },
                                        process.env.JWT_SECRET || 'your-secret-key',
                                        { expiresIn: '7d' }
                                    );
                                    
                                    // For Electron, redirect to success page with token
                                    res.redirect(`/electron-callback.html?token=${token}`);
                                }
    } catch (error) {
        console.error('GitHub OAuth error:', error);
        res.status(500).json({ success: false, error: 'OAuth error' });
    }
});

app.get('/api/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect('/?error=github_auth_failed');
    }
    
    try {
        // Exchange code for access token
        const axios = require('axios');
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code
        }, {
            headers: {
                'Accept': 'application/json'
            }
        });

        const { access_token } = tokenResponse.data;

        if (!access_token) {
            console.error('Failed to get access token:', tokenResponse.data);
            return res.redirect('/?error=github_auth_failed');
        }

        // Get user data from GitHub
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${access_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Get user emails (optional; may be forbidden for some tokens)
        let emails = [];
        try {
            const emailsResponse = await axios.get('https://api.github.com/user/emails', {
                headers: {
                    'Authorization': `token ${access_token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            emails = emailsResponse.data || [];
        } catch (e) {
            // Continue without emails; will create user without email
            emails = [];
        }

        const userData = userResponse.data;
        const primaryEmail = emails.find(email => email.primary)?.email || emails[0]?.email;

        // Check if user already exists
        const existingUser = await query(
            'SELECT * FROM users WHERE github_id = $1',
            [userData.id.toString()]
        );

        if (existingUser.rows.length > 0) {
                    // User exists, update last seen
            await query(
                'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [existingUser.rows[0].id]
            );
                            
                            // Generate JWT token
                            const jwt = require('jsonwebtoken');
                            const token = jwt.sign(
                { userId: existingUser.rows[0].id, username: existingUser.rows[0].username },
                                process.env.JWT_SECRET || 'your-secret-key',
                                { expiresIn: '7d' }
                            );
                            
                            // Check if this is an Electron request
                            const userAgent = req.headers['user-agent'] || '';
                            const isElectron = userAgent.includes('Electron') || req.query.client === 'electron';
                            
                            if (isElectron) {
                                // For Electron, return JSON response instead of redirect
                                res.json({ success: true, token: token });
                            } else {
                                // For web, redirect as usual
                                res.redirect(`/?token=${token}`);
                            }
                } else {
                    // Create new user
                    const username = userData.login || `github_${userData.id}`;
                    const avatarUrl = userData.avatar_url;
                    
            const newUser = await query(
                        `INSERT INTO users (username, email, github_id, avatar_url, email_verified, is_oauth_user) 
                 VALUES ($1, $2, $3, $4, true, true) 
                 RETURNING *`,
                [username, primaryEmail, userData.id.toString(), avatarUrl]
            );
                            
                            // Add user to general chat room
            await query(
                'INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING',
                [1, newUser.rows[0].id]
            );
                                    
                                    // Send welcome email
            const { sendWelcomeEmail } = require('./utils/email.js');
                                    if (primaryEmail) {
                                        sendWelcomeEmail(primaryEmail, username).catch(emailErr => {
                                            console.error('Error sending welcome email:', emailErr);
                                        });
                                    }
                                    
                                    // Generate JWT token
                                    const jwt = require('jsonwebtoken');
                                    const token = jwt.sign(
                { userId: newUser.rows[0].id, username: username },
                                        process.env.JWT_SECRET || 'your-secret-key',
                                        { expiresIn: '7d' }
                                    );
                                    
                                    // Check if this is an Electron request
                                    const userAgent = req.headers['user-agent'] || '';
                                    const isElectron = userAgent.includes('Electron') || req.query.client === 'electron';
                                    
                                    if (isElectron) {
                                        // For Electron, return JSON response instead of redirect
                                        res.json({ success: true, token: token });
                                    } else {
                                        // For web, redirect as usual
                                        res.redirect(`/?token=${token}`);
                                    }
                                }
    } catch (error) {
        console.error('GitHub OAuth error:', error);
        res.redirect('/?error=github_auth_failed');
    }
});

// API endpoints for authentication are now handled by imported handlers above

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Handle token authentication
    socket.on('authenticate_with_token', async (data) => {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'your-secret-key');
            
            // Get user from database
            const userResult = await query(
                'SELECT id, username, email, avatar_url FROM users WHERE id = $1',
                [decoded.userId]
            );
            
            if (userResult.rows.length === 0) {
                socket.emit('token_auth_error', { error: 'User not found' });
                return;
            }
            
            const user = userResult.rows[0];
            
            // Store user info in socket
            socket.userId = user.id;
            socket.username = user.username;
            
            // Add to connected users
            connectedUsers.set(socket.id, {
                userId: user.id,
                username: user.username,
                socketId: socket.id
            });

            // Track latest socket for this user
            onlineUsers.set(user.id, socket.id);
            
            // Update last seen
            await query(
                'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );
            
            // Ensure user is in general chat room
            await query(
                'INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING',
                [1, user.id]
            );
            // Ensure friends table exists (idempotent)
            ensureAuxTables().catch(() => {});
            // Load user rooms (general + any direct/private)
            const roomsResult = await query(
                `SELECT cr.id, cr.name, cr.room_type
                 FROM chat_rooms cr
                 JOIN chat_room_participants p ON p.room_id = cr.id
                 WHERE p.user_id = $1
                 ORDER BY cr.id ASC`,
                [user.id]
            );
                    
                    // Send success response
                    socket.emit('token_auth_success', {
                        success: true,
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email,
                    avatar_url: user.avatar_url
                        }
                    });
                    socket.emit('user_rooms', { rooms: roomsResult.rows });
                    
                    // Broadcast online users
                    broadcastOnlineUsers();
                    
        } catch (error) {
            console.error('Token authentication error:', error);
            socket.emit('token_auth_error', { error: 'Invalid token' });
        }
    });

    // Invite a user to a private chat
    socket.on('invite-user', async (data) => {
        try {
            if (!socket.userId || !socket.username) {
                socket.emit('server_error', { message: 'Not authenticated' });
                return;
            }
            const targetUsername = (data && data.targetUsername) ? String(data.targetUsername).trim() : '';
            if (!targetUsername) {
                socket.emit('server_error', { message: 'Target username is required' });
                return;
            }
            if (targetUsername === socket.username) {
                socket.emit('server_error', { message: 'Cannot invite yourself' });
                return;
            }

            // Find target user's socketId among connected users by username
            let targetSocketId = null;
            for (const userInfo of connectedUsers.values()) {
                if (userInfo && userInfo.username === targetUsername) {
                    targetSocketId = userInfo.socketId;
                    break;
                }
            }

            if (!targetSocketId) {
                socket.emit('server_error', { message: 'Target user is not online' });
                return;
            }

            const { randomUUID } = require('crypto');
            const invitationId = randomUUID();
            pendingInvitations.set(invitationId, {
                from: socket.username,
                to: targetUsername,
                status: 'pending'
            });

            // Notify target user
            io.to(targetSocketId).emit('invitation-received', {
                from: socket.username,
                invitationId
            });

            // Acknowledge to initiator (optional)
            socket.emit('invitation-sent', { invitationId, to: targetUsername });
        } catch (err) {
            console.error('invite-user error:', err);
            socket.emit('server_error', { message: 'Failed to send invitation' });
        }
    });

    // Respond to an invitation
    socket.on('respond-to-invitation', async (data) => {
        try {
            const invitationId = data && data.invitationId ? String(data.invitationId) : '';
            const response = data && data.response ? String(data.response) : '';
            if (!invitationId || !response) {
                socket.emit('server_error', { message: 'Invalid invitation response' });
                return;
            }
            const invitation = pendingInvitations.get(invitationId);
            if (!invitation) {
                socket.emit('server_error', { message: 'Invitation not found or expired' });
                return;
            }

            // Only the invited target can respond
            if (!socket.username || socket.username !== invitation.to) {
                socket.emit('server_error', { message: 'You are not the invitation recipient' });
                return;
            }

            // Find initiator socket by username
            let initiatorSocketId = null;
            for (const info of connectedUsers.values()) {
                if (info && info.username === invitation.from) {
                    initiatorSocketId = info.socketId;
                    break;
                }
            }

            if (response === 'accept') {
                invitation.status = 'accepted';
                // Create/find persistent direct room in DB
                const initiatorUser = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [invitation.from]);
                if (!initiatorUser.rows.length) {
                    socket.emit('server_error', { message: 'Initiator user not found' });
                    return;
                }
                const room = await getOrCreateDirectRoom(initiatorUser.rows[0].id, socket.userId);
                const roomId = String(room.id);
                // Join both users to the room
                try { socket.join(roomId); } catch (_) {}
                if (initiatorSocketId && io.sockets.sockets.get(initiatorSocketId)) {
                    try { io.sockets.sockets.get(initiatorSocketId).join(roomId); } catch (_) {}
                }
                // Notify both users with numeric room id
                socket.emit('chat-started', { chatId: room.id, name: room.name, type: 'direct' });
                if (initiatorSocketId) {
                    io.to(initiatorSocketId).emit('chat-started', { chatId: room.id, name: room.name, type: 'direct' });
                }
                pendingInvitations.delete(invitationId);
            } else if (response === 'reject') {
                invitation.status = 'declined';
                if (initiatorSocketId) {
                    io.to(initiatorSocketId).emit('invitation-declined', { invitationId, by: socket.username });
                }
                pendingInvitations.delete(invitationId);
            } else {
                socket.emit('server_error', { message: 'Unknown response type' });
            }
        } catch (err) {
            console.error('respond-to-invitation error:', err);
            socket.emit('server_error', { message: 'Failed to process invitation response' });
        }
    });

    // Friends: list
    socket.on('friends:list', async () => {
        if (!socket.userId) {
            socket.emit('server_error', { message: 'Not authenticated' });
            return;
        }
        try {
            await ensureAuxTables();
            const result = await query(
                `SELECT f.friend_id AS id, u.username, f.status
                 FROM friends f
                 JOIN users u ON u.id = f.friend_id
                 WHERE f.user_id = $1
                 UNION ALL
                 SELECT f.user_id AS id, u.username, f.status
                 FROM friends f
                 JOIN users u ON u.id = f.user_id
                 WHERE f.friend_id = $1`,
                [socket.userId]
            );
            socket.emit('friends:list', { friends: result.rows });
        } catch (e) {
            console.error('friends:list error', e);
            socket.emit('server_error', { message: 'Failed to load friends' });
        }
    });

    // Friends: request
    socket.on('friends:request', async ({ username }) => {
        if (!socket.userId || !username) {
            socket.emit('server_error', { message: 'Invalid friend request' });
            return;
        }
        try {
            await ensureAuxTables();
            const target = await query('SELECT id, username FROM users WHERE username = $1 LIMIT 1', [String(username).trim()]);
            if (!target.rows.length) {
                socket.emit('server_error', { message: 'User not found' });
                return;
            }
            const targetId = target.rows[0].id;
            if (Number(targetId) === Number(socket.userId)) {
                socket.emit('server_error', { message: 'Cannot add yourself' });
                return;
            }
            // Create reciprocal pending rows (optional single row approach simplified to single canonical direction)
            const [minId, maxId] = Number(socket.userId) < Number(targetId)
                ? [Number(socket.userId), Number(targetId)]
                : [Number(targetId), Number(socket.userId)];
            // Insert canonical pending row (user_id=min, friend_id=max)
            await query(
                `INSERT INTO friends (user_id, friend_id, status)
                 VALUES ($1, $2, 'pending')
                 ON CONFLICT (user_id, friend_id) DO NOTHING`,
                [minId, maxId]
            );
            // Notify target if online
            const targetSocketId = onlineUsers.get(targetId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('friends:request', { from: socket.username });
            }
            socket.emit('friends:request:ok', { to: target.rows[0].username });
        } catch (e) {
            console.error('friends:request error', e);
            socket.emit('server_error', { message: 'Failed to send friend request' });
        }
    });

    // Friends: respond
    socket.on('friends:respond', async ({ from, accept }) => {
        if (!socket.userId || !from) {
            socket.emit('server_error', { message: 'Invalid friend response' });
            return;
        }
        try {
            await ensureAuxTables();
            const initiator = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [String(from).trim()]);
            if (!initiator.rows.length) {
                socket.emit('server_error', { message: 'User not found' });
                return;
            }
            const initId = initiator.rows[0].id;
            const [minId, maxId] = Number(initId) < Number(socket.userId)
                ? [Number(initId), Number(socket.userId)]
                : [Number(socket.userId), Number(initId)];
            await query(
                `UPDATE friends SET status = $3 WHERE user_id = $1 AND friend_id = $2`,
                [minId, maxId, accept ? 'accepted' : 'declined']
            );
            // Echo updates
            socket.emit('friends:respond:ok', { user: from, accepted: !!accept });
            const initiatorSocketId = onlineUsers.get(initId);
            if (initiatorSocketId) {
                io.to(initiatorSocketId).emit('friends:update', { user: socket.username, accepted: !!accept });
            }
        } catch (e) {
            console.error('friends:respond error', e);
            socket.emit('server_error', { message: 'Failed to respond to friend request' });
        }
    });

    socket.on('join_room', async (data) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        
        try {
            const roomId = (data && data.roomId) ? data.roomId : 1;
            try { socket.join(String(roomId)); } catch (_) {}
            const isNumericRoom = (typeof roomId === 'number') || (/^\d+$/.test(String(roomId)));
            if (!isNumericRoom) {
                socket.emit('room_joined', {
                    success: true,
                    roomId: roomId,
                    messages: []
                });
                return;
            }
            const messagesResult = await query(
                `SELECT m.*, u.username 
             FROM messages m 
             JOIN users u ON m.user_id = u.id 
                 WHERE m.room_id = $1 
             ORDER BY m.timestamp DESC 
             LIMIT 50`,
                [Number(roomId)]
            );
            socket.emit('room_joined', {
                success: true,
                roomId: Number(roomId),
                messages: messagesResult.rows.reverse()
            });
            
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });
    
    socket.on('send_message', async (data) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        
        try {
            const rawContent = (data && data.content != null) ? String(data.content) : '';
            const trimmedContent = rawContent.trim();
            if (!trimmedContent) {
                socket.emit('server_error', { message: 'Message cannot be empty' });
                return;
            }
            const roomId = (data && data.roomId) ? data.roomId : 1;
            const isNumericRoom = (typeof roomId === 'number') || (/^\d+$/.test(String(roomId)));
            if (!isNumericRoom) {
                const messageData = {
                    id: `ephemeral-${Date.now()}`,
                    userId: socket.userId,
                    username: socket.username,
                    content: trimmedContent,
                    timestamp: new Date().toISOString(),
                    roomId: roomId
                };
                io.to(String(roomId)).emit('new_message', messageData);
                return;
            }
            const result = await query(
                'INSERT INTO messages (user_id, room_id, content) VALUES ($1, $2, $3) RETURNING *',
                [socket.userId, Number(roomId), trimmedContent]
            );
            const message = result.rows[0];
            const userResult = await query('SELECT username FROM users WHERE id = $1', [socket.userId]);
            const messageData = {
                id: message.id,
                userId: message.user_id,
                username: userResult.rows[0].username,
                content: message.content || trimmedContent,
                timestamp: message.timestamp || new Date().toISOString(),
                roomId: Number(roomId)
            };
            if (Number(roomId) === 1) {
                io.emit('new_message', messageData);
            } else {
                io.to(String(roomId)).emit('new_message', messageData);
            }
            
        } catch (error) {
            console.error('Error saving message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });
    
    socket.on('friend_request_sent', async (data) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        
        try {
            const { toUsername } = data;
            
            // Get the recipient user ID
            const recipientResult = await query(
                'SELECT id FROM users WHERE username = $1',
                [toUsername]
            );
            
            if (recipientResult.rows.length > 0) {
                const toUserId = recipientResult.rows[0].id;
                
                // Send notification to the recipient
                await sendFriendRequestNotification(socket.userId, toUserId);
            }
        } catch (error) {
            console.error('Error handling friend request sent:', error);
        }
    });
    
    socket.on('disconnect', () => {
            const info = connectedUsers.get(socket.id);
            if (info && onlineUsers.get(info.userId) === socket.id) {
                onlineUsers.delete(info.userId);
            }
            connectedUsers.delete(socket.id);
            broadcastOnlineUsers();
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;

// Start server (Postgres migrations are lazy-initialized)
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
