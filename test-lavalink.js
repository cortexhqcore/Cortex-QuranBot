/**
 * Test file for Lavalink client connection and basic functionality.
 */
require('pathlra-aliaser')();
require('./core/config/envSwitcher.js');
const { LavalinkManager } = require('lavalink-client');
const logger = require('./core/logging/logger');

const manager = new LavalinkManager({
    nodes: [
        {
            id: 'test',
            host: process.env.LAVALINK_HOST,
            port: parseInt(process.env.LAVALINK_PORT),
            authorization: process.env.LAVALINK_PASSWORD,
            secure: process.env.LAVALINK_SECURE === 'true',
        },
    ],
    sendToShard: () => {},
    client: {
        id: process.env.CLIENT_ID,
        username: 'QuranBot',
        name: 'QuranBot/0',
    },
});

manager.nodeManager.on('connect', () => logger.info('Node connected'));
manager.nodeManager.on('disconnect', (n, r) => logger.error('Disconnected:', r));
manager.nodeManager.on('error', (n, e) => logger.error('Error:', e));

async function start() {
    try {
        await manager.init();
        logger.info('Lavalink Manager initialized');
        setInterval(() => {
            logger.info('Node alive check running');
        }, 5000);
    } catch (err) {
        logger.error('Failed to start Lavalink', err);
    }
}

start();
