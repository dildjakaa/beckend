const { success } = require('../../utils/response');

module.exports = async function handler(req, res) {
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

  // Delete messages first (due to foreign key constraints)
  db.run('DELETE FROM messages', function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete messages' });
    }

    // Then delete users
    db.run('DELETE FROM users', function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete users' });
      }

      return success(res, {
        message: 'All users and messages deleted successfully',
        deletedUsersCount: this.changes,
        timestamp: new Date().toISOString()
      });
    });
  });
};
