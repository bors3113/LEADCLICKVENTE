const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const config = require('../config');

const LOG_LEVELS = ['error', 'warn', 'info', 'debug'];
const level = LOG_LEVELS.includes(config.logLevel) ? config.logLevel : 'info';

if (!fs.existsSync('logs')) fs.mkdirSync('logs');

const logger = createLogger({
  level,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level: lvl, message, stack }) =>
      stack
        ? `[${timestamp}] ${lvl.toUpperCase()}: ${message}\n${stack}`
        : `[${timestamp}] ${lvl.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = logger;
