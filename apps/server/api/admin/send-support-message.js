const { success } = require('../../utils/response');
const { addCorsHeaders, handleCorsPreflight } = require('../../utils/cors');
const { query } = require('../../utils/db.js');

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCorsPreflight(req, res)) return;
  
  // Add CORS headers
  addCorsHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required and cannot be empty' });
  }

  try {
    // Create a special support user if it doesn't exist
    let supportUser = await query('SELECT id FROM users WHERE username = $1', ['KrackenX Support']);
    
    if (supportUser.rows.length === 0) {
      // Create support user
      const newUser = await query(
        'INSERT INTO users (username, is_oauth_user, email_verified) VALUES ($1, $2, $3) RETURNING id',
        ['KrackenX Support', true, true]
      );
      supportUser = newUser;
    }

    const userId = supportUser.rows[0].id;
    
    // Insert the support message
    const result = await query(
      'INSERT INTO messages (user_id, content, timestamp) VALUES ($1, $2, $3) RETURNING id',
      [userId, message.trim(), new Date()]
    );

    return success(res, {
      message: 'Support message sent successfully',
      messageId: result.rows[0].id,
      content: message.trim(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error sending support message:', err);
    return res.status(500).json({ error: 'Failed to send support message' });
  }
};
