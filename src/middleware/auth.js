const config = require('../config');

module.exports = function requireApiKey(req, res, next) {
  const apiKey = config.apiKey;
  // Auth is disabled when API_KEY is not set in the environment
  if (!apiKey) return next();

  const provided =
    req.headers['x-api-key'] ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');

  if (!provided || provided !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid API key' });
  }
  next();
};
