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

  // Check if ADMIN_PASSWORD is configured
  if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error: ADMIN_PASSWORD not set' });
  }

  // Check admin password
  const adminPassword = req.headers['x-admin-password'];
  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Clear logs by importing the logs module and clearing its storage
  try {
    const logsModule = require('./logs');
    if (logsModule.clearLogs) {
      logsModule.clearLogs();
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
  }

  return success(res, {
    message: 'Logs cleared successfully',
    timestamp: new Date().toISOString()
  });
};
