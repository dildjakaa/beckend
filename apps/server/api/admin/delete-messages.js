const { success } = require('../../utils/response');
const { addCorsHeaders, handleCorsPreflight } = require('../../utils/cors');

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

  // Get the database instance
  const db = require('../../utils/database.js');

  db.run('DELETE FROM messages', function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete messages' });
    }

    return success(res, {
      message: 'All messages deleted successfully',
      deletedCount: this.changes,
      timestamp: new Date().toISOString()
    });
  });
};
