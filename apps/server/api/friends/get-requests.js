const { query } = require('../../utils/db.js');
const { sendResponse } = require('../../utils/response.js');

async function getFriendRequests(req, res) {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return sendResponse(res, 400, 'Missing user ID');
        }

        // Get pending friend requests for the user
        const requests = await query(
            `SELECT 
                fr.id,
                fr.from_user_id,
                fr.created_at,
                u.username,
                u.avatar_url
             FROM friend_requests fr
             JOIN users u ON fr.from_user_id = u.id
             WHERE fr.to_user_id = $1 AND fr.status = 'pending'
             ORDER BY fr.created_at DESC`,
            [userId]
        );

        sendResponse(res, 200, 'Friend requests retrieved successfully', {
            requests: requests.rows
        });
    } catch (error) {
        console.error('Error getting friend requests:', error);
        sendResponse(res, 500, 'Internal server error');
    }
}

module.exports = getFriendRequests;
