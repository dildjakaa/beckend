const { query } = require('../../utils/db.js');
const { sendResponse } = require('../../utils/response.js');

async function sendFriendRequest(req, res) {
    try {
        const { fromUserId, toUsername } = req.body;
        
        if (!fromUserId || !toUsername) {
            return sendResponse(res, 400, 'Missing required fields');
        }

        // Check if user exists
        const userCheck = await query(
            'SELECT id, username FROM users WHERE username = $1',
            [toUsername]
        );

        if (userCheck.rows.length === 0) {
            return sendResponse(res, 404, 'User not found');
        }

        const toUserId = userCheck.rows[0].id;

        // Check if it's the same user
        if (fromUserId === toUserId) {
            return sendResponse(res, 400, 'Cannot send friend request to yourself');
        }

        // Check if friend request already exists
        const existingRequest = await query(
            'SELECT * FROM friend_requests WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)',
            [fromUserId, toUserId]
        );

        if (existingRequest.rows.length > 0) {
            return sendResponse(res, 400, 'Friend request already exists');
        }

        // Check if they are already friends
        const existingFriendship = await query(
            'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [fromUserId, toUserId]
        );

        if (existingFriendship.rows.length > 0) {
            return sendResponse(res, 400, 'Users are already friends');
        }

        // Create friend request
        await query(
            'INSERT INTO friend_requests (from_user_id, to_user_id) VALUES ($1, $2)',
            [fromUserId, toUserId]
        );

        // Send notification via Socket.IO (this will be handled by the main server)
        // The server will emit a 'friend_request_sent' event that the client can listen to
        
        sendResponse(res, 200, 'Friend request sent successfully');
    } catch (error) {
        console.error('Error sending friend request:', error);
        sendResponse(res, 500, 'Internal server error');
    }
}

module.exports = sendFriendRequest;
