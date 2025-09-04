require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { query } = require('./utils/db');

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
const onlineUsers = new Map(); // userId -> socketId
const pendingInvitations = new Map(); // invitationId -> { from, to, status }

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

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create users table
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT,
                email VARCHAR(255) UNIQUE,
                github_id VARCHAR(255) UNIQUE,
                avatar_url TEXT,
                email_verified BOOLEAN DEFAULT FALSE,
                verification_code VARCHAR(10),
                verification_code_expires TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_oauth_user BOOLEAN DEFAULT FALSE
            )
        `);

        // Ensure required columns exist on existing databases
        await query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
            ADD COLUMN IF NOT EXISTS github_id VARCHAR(255) UNIQUE,
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10),
            ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS is_oauth_user BOOLEAN DEFAULT FALSE;
        `);

        // Create chat_rooms table
        await query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                room_type VARCHAR(50) DEFAULT 'general',
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id)
            )
        `);

        // Create messages table
        await query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                room_id INTEGER NOT NULL DEFAULT 1,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(room_id) REFERENCES chat_rooms(id)
            )
        `);

        // Create chat_room_participants table
        await query(`
            CREATE TABLE IF NOT EXISTS chat_room_participants (
                id SERIAL PRIMARY KEY,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(room_id) REFERENCES chat_rooms(id),
                FOREIGN KEY(user_id) REFERENCES users(id),
                UNIQUE(room_id, user_id)
            )
        `);

        // Insert default general room if it doesn't exist
        await query(`
            INSERT INTO chat_rooms (id, name, room_type) 
            VALUES (1, 'General Chat', 'general') 
            ON CONFLICT (id) DO NOTHING
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Initialize database on startup
// initializeDatabase(); // Disabled for local development - using Render database

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

// Test endpoints
// Removed GitHub OAuth testing endpoint

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
    
    socket.on('join', (userData) => {
        connectedUsers.set(socket.id, userData);
        broadcastOnlineUsers();
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
                socket.join(chatId);
                if (initiatorSocketId && io.sockets.sockets.get(initiatorSocketId)) {
                    io.sockets.sockets.get(initiatorSocketId).join(chatId);
                }
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
        console.log('Received join_room:', data);
        
        if (!socket.userId) {
            console.log('User not authenticated for join_room');
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        
        try {
            const roomId = (data && data.roomId) ? data.roomId : 1;
            console.log('Getting room messages for room:', roomId);

            // Join socket.io room (string id to support UUID)
            try { socket.join(String(roomId)); } catch (e) { console.warn('join room error', e); }

            const isNumericRoom = (typeof roomId === 'number') || (/^\d+$/.test(String(roomId)));
            if (!isNumericRoom) {
                // Private ephemeral room -> no DB history
                socket.emit('room_joined', {
                    success: true,
                    roomId: roomId,
                    messages: []
                });
                return;
            }

            // Get room messages for numeric rooms
            const messagesResult = await query(
                `SELECT m.*, u.username 
             FROM messages m 
             JOIN users u ON m.user_id = u.id 
                 WHERE m.room_id = $1 
             ORDER BY m.timestamp ASC 
             LIMIT 50`,
                [Number(roomId)]
            );
            
            socket.emit('room_joined', {
                success: true,
                roomId: Number(roomId),
                messages: messagesResult.rows
            });
            
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });
    
    socket.on('message', async (data) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        
        try {
            const result = await query(
                'INSERT INTO messages (user_id, room_id, content) VALUES ($1, $2, $3) RETURNING *',
                [socket.userId, data.roomId || 1, data.content]
            );
            
            const message = result.rows[0];
            io.emit('new_message', {
                id: message.id,
                userId: socket.userId,
                username: socket.username,
                content: message.content,
                timestamp: message.timestamp,
                roomId: data.roomId || 1
            });
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });
    
    // Handle send_message event (frontend compatibility)
    socket.on('send_message', async (data) => {
        console.log('Received send_message:', data);
        
        if (!socket.userId) {
            console.log('User not authenticated for send_message');
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
                // Ephemeral private room: don't persist; emit to room only
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
            const messageData = {
                id: message.id,
                userId: socket.userId,
                username: socket.username,
                content: message.content,
                timestamp: message.timestamp,
                roomId: Number(roomId)
            };
            if (Number(roomId) === 1) {
                io.emit('new_message', messageData);
            } else {
                io.to(String(roomId)).emit('new_message', messageData);
            }
        } catch (error) {
            console.error('Error saving message:', error);
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
    
    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

const PORT = process.env.PORT || 3000;

// Start server without waiting for database initialization
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Note: Database initialization is disabled for local development');
    console.log('Using Render database:', process.env.DATABASE_URL ? 'Yes' : 'No');
});
