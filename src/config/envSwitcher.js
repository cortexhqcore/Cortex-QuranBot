require('pathlra-aliaser')();

const path = require('path');
const Envira = require('../package/envira/src/lib/main');
const logger = require('@logging/logger');
const fs = require('fs');

const baseEnvFilePath = path.resolve(__dirname, '../../.env');
let baseEnvConfig = {};

if (fs.existsSync(baseEnvFilePath)) {
    const rawBaseEnv = fs.readFileSync(baseEnvFilePath, 'utf8');
    baseEnvConfig = Envira.parse(rawBaseEnv);
}

const activeEnv = baseEnvConfig.NODE_ENV;
const targetedEnvPath = path.resolve(__dirname, `../../${activeEnv}.env`);

const loadResult = Envira.config({ path: targetedEnvPath });

if (loadResult.error) {
    logger.error(`Could Not Load ${activeEnv} Env File`, loadResult.error.message);
    process.exit(1);
} else {
    logger.info(`Loaded ${activeEnv} Env`);
}

// Remove TOPGG_TOKEN in development to prevent accidental use of production API key during dev
if (activeEnv === 'development') {
    if (process.env.TOPGG_TOKEN) {
        delete process.env.TOPGG_TOKEN;
        logger.info('Development Mode TOPGG_TOKEN Removed');
    }
}

module.exports.isDevelopment = activeEnv === 'development';
module.exports.isProduction = activeEnv === 'production';
module.exports.currentEnv = activeEnv;
