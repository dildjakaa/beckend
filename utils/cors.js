function addCorsHeaders(res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Password');
  res.header('Access-Control-Allow-Credentials', 'true');
}

function handleCorsPreflight(req, res) {
  if (req.method === 'OPTIONS') {
    addCorsHeaders(res);
    return res.status(200).end();
  }
  return false; // Continue with normal request
}

module.exports = {
  addCorsHeaders,
  handleCorsPreflight
};
