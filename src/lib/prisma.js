require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Use the session-mode pooler (DIRECT_URL) for runtime queries.
// The transaction-mode pooler (DATABASE_URL, pgbouncer=true) does not support
// the session-level SET statements that @prisma/adapter-pg sends.
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
