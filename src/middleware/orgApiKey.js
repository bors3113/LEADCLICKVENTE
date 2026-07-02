const crypto = require('crypto');
const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

// Per-organization API-key auth for endpoints called directly by end clients
// (the LinkedIn copilot Chrome extension), as opposed to the single shared
// secret in ./auth.js that protects server-to-server routes.
//
// Keys are issued from the dashboard (web/src/app/api/api-keys) with an lcv_
// prefix; only their SHA-256 hash is stored in api_keys.key_hash. Looking the
// hash up via the unique index is timing-safe: an attacker without the key
// can't produce a matching hash, so no constant-time compare is needed.
module.exports = async function requireOrgApiKey(req, res, next) {
  const provided =
    req.headers['x-api-key'] ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');

  if (!provided || !provided.startsWith('lcv_')) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid API key' });
  }

  const keyHash = crypto.createHash('sha256').update(provided).digest('hex');

  let record;
  try {
    record = await prisma.api_keys.findUnique({
      where: { key_hash: keyHash },
      select: { id: true, organization_id: true },
    });
  } catch (err) {
    logger.error(`API key lookup failed: ${err.message}`);
    return res.status(500).json({ error: 'Internal error' });
  }

  if (!record) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid API key' });
  }

  req.orgId = record.organization_id;
  req.apiKeyId = record.id;

  // Best-effort usage stamp — never block or fail the request on it.
  prisma.api_keys
    .update({ where: { id: record.id }, data: { last_used_at: new Date() } })
    .catch((err) => logger.warn(`Failed to update api_keys.last_used_at: ${err.message}`));

  next();
};
