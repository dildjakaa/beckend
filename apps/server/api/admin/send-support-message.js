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

  // Check admin password
  const adminPassword = req.headers['x-admin-password'];
  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { message } = req.body;
  
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required and cannot be empty' });
  }

  try {
    console.log('Sending support message:', { message: message.trim() });
    
    // Create a special support user if it doesn't exist
    let supportUser = await query('SELECT id FROM users WHERE username = $1', ['KrackenX Support']);
    
    if (supportUser.rows.length === 0) {
      console.log('Creating support user...');
      // Create support user
      const newUser = await query(
        'INSERT INTO users (username, is_oauth_user, email_verified) VALUES ($1, $2, $3) RETURNING id',
        ['KrackenX Support', true, true]
      );
      supportUser = newUser;
      console.log('Support user created with ID:', newUser.rows[0].id);
    } else {
      console.log('Support user found with ID:', supportUser.rows[0].id);
    }

    const userId = supportUser.rows[0].id;
    
    console.log('Inserting support message with room_id...');
    // Insert the support message (with room_id for new schema)
    const result = await query(
      'INSERT INTO messages (user_id, room_id, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, 1, message.trim(), new Date()]
    );
    
    console.log('Support message inserted successfully with ID:', result.rows[0].id);

    return success(res, {
      message: 'Support message sent successfully',
      messageId: result.rows[0].id,
      content: message.trim(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error sending support message:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    return res.status(500).json({ error: 'Failed to send support message' });
  }
};
