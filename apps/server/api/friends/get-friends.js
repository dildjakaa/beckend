const { query } = require('../../utils/db.js');
const { sendResponse } = require('../../utils/response.js');

async function getFriends(req, res) {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return sendResponse(res, 400, 'Missing user ID');
        }

        // Get all friends for the user
        const friends = await query(
            `SELECT 
                f.friend_id,
                f.created_at,
                u.username,
                u.avatar_url,
                u.last_seen,
                CASE 
                    WHEN u.last_seen > NOW() - INTERVAL '5 minutes' THEN 'online'
                    WHEN u.last_seen > NOW() - INTERVAL '1 hour' THEN 'idle'
                    ELSE 'offline'
                END as status
             FROM friends f
             JOIN users u ON f.friend_id = u.id
             WHERE f.user_id = $1 AND f.status = 'accepted'
             ORDER BY u.username ASC`,
            [userId]
        );

        sendResponse(res, 200, 'Friends retrieved successfully', {
            friends: friends.rows
        });
    } catch (error) {
        console.error('Error getting friends:', error);
        sendResponse(res, 500, 'Internal server error');
    }
}

module.exports = getFriends;
