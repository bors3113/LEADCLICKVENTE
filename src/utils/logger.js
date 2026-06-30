const config = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function ts() {
    return new Date().toISOString();
}

const logger = {
    error: (...args) => currentLevel >= LEVELS.error && console.error(`[${ts()}] ERROR`, ...args),
    warn:  (...args) => currentLevel >= LEVELS.warn  && console.warn( `[${ts()}] WARN `, ...args),
    info:  (...args) => currentLevel >= LEVELS.info  && console.log(  `[${ts()}] INFO `, ...args),
    debug: (...args) => currentLevel >= LEVELS.debug && console.log(  `[${ts()}] DEBUG`, ...args),
};

module.exports = logger;
