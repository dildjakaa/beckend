const { query, isDatabaseAvailable } = require('../../utils/db.js');
const { sendResponse } = require('../../utils/response.js');

async function sendFriendRequest(req, res) {
    try {
        const { fromUserId, toUsername } = req.body;
        
        if (!fromUserId || !toUsername) {
            return sendResponse(res, 400, 'Missing required fields: fromUserId and toUsername');
        }

        // Check if database is available
        if (!isDatabaseAvailable()) {
            console.warn('Database unavailable, cannot send friend request');
            return sendResponse(res, 503, 'Service temporarily unavailable - database connection failed');
        }

        // Check if the target user exists
        const targetUser = await query(
            'SELECT id, username FROM users WHERE username = $1',
            [toUsername]
        );

        if (targetUser.rows.length === 0) {
            return sendResponse(res, 404, 'User not found');
        }

        const targetUserId = targetUser.rows[0].id;

        // Check if users are the same
        if (fromUserId === targetUserId) {
            return sendResponse(res, 400, 'Cannot send friend request to yourself');
        }

        // Check if friend request already exists
        const existingRequest = await query(
            'SELECT * FROM friend_requests WHERE from_user_id = $1 AND to_user_id = $2',
            [fromUserId, targetUserId]
        );

        if (existingRequest.rows.length > 0) {
            return sendResponse(res, 400, 'Friend request already sent');
        }

        // Check if they are already friends
        const existingFriendship = await query(
            'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [fromUserId, targetUserId]
        );

        if (existingFriendship.rows.length > 0) {
            return sendResponse(res, 400, 'Users are already friends');
        }

        // Send friend request
        await query(
            'INSERT INTO friend_requests (from_user_id, to_user_id) VALUES ($1, $2)',
            [fromUserId, targetUserId]
        );

        sendResponse(res, 200, 'Friend request sent successfully');
    } catch (error) {
        console.error('Error sending friend request:', error);
        sendResponse(res, 500, 'Internal server error');
    }
}

module.exports = sendFriendRequest;
