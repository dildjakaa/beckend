const { success } = require('../utils/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return success(res, {
    pong: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};
