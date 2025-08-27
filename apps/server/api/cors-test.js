const { success } = require('../utils/response');
const { addCorsHeaders, handleCorsPreflight } = require('../utils/cors');

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCorsPreflight(req, res)) return;
  
  // Add CORS headers
  addCorsHeaders(res);

  return success(res, {
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin || 'No origin',
    method: req.method,
    headers: req.headers
  });
};
