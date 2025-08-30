const { query } = require('../../utils/db.js');
const { sendResponse } = require('../../utils/response.js');

async function respondToFriendRequest(req, res) {
    try {
        const { requestId, response, userId } = req.body;
        
        if (!requestId || !response || !userId) {
            return sendResponse(res, 400, 'Missing required fields');
        }

        if (!['accepted', 'rejected'].includes(response)) {
            return sendResponse(res, 400, 'Invalid response. Must be "accepted" or "rejected"');
        }

        // Get the friend request
        const request = await query(
            'SELECT * FROM friend_requests WHERE id = $1 AND to_user_id = $2',
            [requestId, userId]
        );

        if (request.rows.length === 0) {
            return sendResponse(res, 404, 'Friend request not found');
        }

        const friendRequest = request.rows[0];

        // Update the request status
        await query(
            'UPDATE friend_requests SET status = $1 WHERE id = $2',
            [response, requestId]
        );

        if (response === 'accepted') {
            // Add both users to friends table
            await query(
                'INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3) ON CONFLICT (user_id, friend_id) DO NOTHING',
                [friendRequest.from_user_id, friendRequest.to_user_id, 'accepted']
            );
            
            await query(
                'INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3) ON CONFLICT (user_id, friend_id) DO NOTHING',
                [friendRequest.to_user_id, friendRequest.from_user_id, 'accepted']
            );
        }

        sendResponse(res, 200, `Friend request ${response} successfully`);
    } catch (error) {
        console.error('Error responding to friend request:', error);
        sendResponse(res, 500, 'Internal server error');
    }
}

module.exports = respondToFriendRequest;
