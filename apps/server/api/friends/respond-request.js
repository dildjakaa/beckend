const { query, isDatabaseAvailable } = require('../../utils/db.js');
const { sendResponse } = require('../../utils/response.js');

async function respondToFriendRequest(req, res) {
    try {
        const { requestId, action } = req.body;
        
        if (!requestId || !action) {
            return sendResponse(res, 400, 'Missing required fields: requestId and action');
        }

        if (!['accept', 'reject'].includes(action)) {
            return sendResponse(res, 400, 'Invalid action. Use "accept" or "reject"');
        }

        // Check if database is available
        if (!isDatabaseAvailable()) {
            console.warn('Database unavailable, cannot respond to friend request');
            return sendResponse(res, 503, 'Service temporarily unavailable - database connection failed');
        }

        // Get the friend request
        const friendRequest = await query(
            'SELECT * FROM friend_requests WHERE id = $1',
            [requestId]
        );

        if (friendRequest.rows.length === 0) {
            return sendResponse(res, 404, 'Friend request not found');
        }

        const request = friendRequest.rows[0];

        if (action === 'accept') {
            // Add both users as friends
            await query(
                'INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3), ($2, $1, $3) ON CONFLICT (user_id, friend_id) DO NOTHING',
                [request.from_user_id, request.to_user_id, 'accepted']
            );

            // Update friend request status
            await query(
                'UPDATE friend_requests SET status = $1 WHERE id = $2',
                ['accepted', requestId]
            );

            sendResponse(res, 200, 'Friend request accepted successfully');
        } else {
            // Reject the request
            await query(
                'UPDATE friend_requests SET status = $1 WHERE id = $2',
                ['rejected', requestId]
            );

            sendResponse(res, 200, 'Friend request rejected successfully');
        }
    } catch (error) {
        console.error('Error responding to friend request:', error);
        sendResponse(res, 500, 'Internal server error');
    }
}

module.exports = respondToFriendRequest;
