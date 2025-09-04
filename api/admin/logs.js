const { success } = require('../../utils/response');
const { addCorsHeaders, handleCorsPreflight } = require('../../utils/cors');

// In-memory log storage (in production you'd want to use a proper logging system)
let serverLogs = [];

// Function to add log entry
function addLog(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  };
  serverLogs.push(logEntry);
  
  // Keep only last 1000 logs
  if (serverLogs.length > 1000) {
    serverLogs = serverLogs.slice(-1000);
  }
}

// Function to clear logs
function clearLogs() {
  serverLogs = [];
}

// Export the addLog function for use in other parts of the server
module.exports.addLog = addLog;
module.exports.clearLogs = clearLogs;

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCorsPreflight(req, res)) return;
  
  // Add CORS headers
  addCorsHeaders(res);

  if (req.method !== 'GET') {
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

  const limit = parseInt(req.query.limit) || 100;
  const logs = serverLogs.slice(-limit);

  return success(res, {
    logs,
    total: serverLogs.length,
    limit
  });
};
