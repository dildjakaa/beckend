require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { query } = require('./utils/db.js');

const app = express();
const server = createServer(app);
const io = new Server(server);

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

// Store connected users
const connectedUsers = new Map();
const userRooms = new Map();

// Invitation system state
// Maps: userId -> socketId and invitationId -> { from, to, status }
const onlineUsers = new Map();
const pendingInvitations = new Map();

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
                const { randomUUID } = require('crypto');
                const chatId = randomUUID();
                // Join both users to the private room
                socket.join(chatId);
                if (initiatorSocketId && io.sockets.sockets.get(initiatorSocketId)) {
                    io.sockets.sockets.get(initiatorSocketId).join(chatId);
                }
                // Notify both users
                socket.emit('chat-started', { chatId });
                if (initiatorSocketId) {
                    io.to(initiatorSocketId).emit('chat-started', { chatId });
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

    socket.on('join_room', async (data) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        
        try {
            // Get room messages
            const messagesResult = await query(
                `SELECT m.*, u.username 
             FROM messages m 
             JOIN users u ON m.user_id = u.id 
                 WHERE m.room_id = $1 
             ORDER BY m.timestamp DESC 
             LIMIT 50`,
                [data.roomId || 1]
            );
            
                socket.emit('room_joined', {
                    success: true,
                roomId: data.roomId || 1,
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
            const result = await query(
                'INSERT INTO messages (user_id, room_id, content) VALUES ($1, $2, $3) RETURNING *',
                [socket.userId, data.roomId || 1, trimmedContent]
            );
            
            const message = result.rows[0];
            
            // Get username for the message
            const userResult = await query(
                'SELECT username FROM users WHERE id = $1',
                [socket.userId]
            );
                
            const messageData = {
                id: message.id,
                userId: message.user_id,
                username: userResult.rows[0].username,
                content: message.content || trimmedContent,
                timestamp: message.timestamp || new Date().toISOString(),
                roomId: message.room_id
            };
            
            io.emit('new_message', messageData);
            
        } catch (error) {
            console.error('Error saving message:', error);
            socket.emit('error', { message: 'Failed to send message' });
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
