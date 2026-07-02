const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const requireOrgApiKey = require('../middleware/orgApiKey');
const copilotController = require('../controllers/copilotController');

// Copilot routes authenticate with per-org API keys (Chrome extension), not
// the server-to-server shared secret — mounted before requireApiKey in index.js.
router.use(requireOrgApiKey);

// Rate limit per org (the middleware above has already resolved req.orgId).
// req.orgId should always be set here since requireOrgApiKey runs first, but
// ipKeyGenerator normalizes the IPv6 fallback correctly if it's ever missing.
const draftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.orgId || ipKeyGenerator(req.ip),
  message: { error: 'Too many draft requests, please slow down.' },
});

router.post('/draft', draftLimiter, copilotController.draft);

module.exports = router;
