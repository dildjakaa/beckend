const { success } = require('../utils/response');
const { addCorsHeaders, handleCorsPreflight } = require('../utils/cors');

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCorsPreflight(req, res)) return;
  
  // Add CORS headers
  addCorsHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'browser-messenger'
  });
};
