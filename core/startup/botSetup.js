require('../package/Envira/src/lib/main');
require('pathlra-aliaser')();
const fs = require('fs').promises;
const pathlra = require('path');
const { Mutex } = require('async-mutex');
const logger = require('@logger');
require('@cooldown-core_state');
const { getBrowserHeaders, TimeoutRequest } = require('@http');
global.logger = logger;
const mutex = new Mutex();
const {
    createSurahResource,
    getCurrentLinks,
    getCurrentDurations,
    createReciterRow,
    createControlModeRow,
    getGuildState,
    removeGuildState,
    createControlEmbed,
    createSelectRow,
    createButtonRow,
    createNavigationRow,
    sendRandomAzkar,
    startAzkarTimerForGuild,
    registerCommands,
    isAuthorized,
    setupQuranCategory,
    checkCooldown,
    applyCommandPermissions,
    checkRateLimit,
    checkVoiceCooldown,
    createRadioRow,
    createRadioResource,
} = require('@registry');
const { loadData, saveSetupGuilds } = require('@data-manager-core_data');
const { Client, GatewayIntentBits, REST } = require('discord.js');
const { LavalinkManager } = require('../package/lavalink-client/dist/index');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || token?.split('.')[0];
const specialUserIds = process.env.SPE_USER_ID || '0';

global.SPE_USER_IDS = specialUserIds
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
global.SPE_USER_ID = global.SPE_USER_IDS[0] || '0';

if (!token) {
    logger.error('Fatal Discord Token Not Found In Env File');
    process.exit(1);
}

global.token = token;
global.clientId = clientId;

logger.info('Current Date In Cairo ' + new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const nodeConfigs = new Map();
function build() {
    let nodes = [];
    let total = parseInt(process.env.LAVALINK_NODES || '1', 10);

    for (let i = 1; i <= total; i++) {
        const prefix = `LAVALINK_NODE_${i}`;
        const host = process.env[`${prefix}_HOST`];
        const port = process.env[`${prefix}_PORT`];
        const password = process.env[`${prefix}_PASSWORD`];

        if (!host || !port || !password) {
            logger.warn(`Skipping node ${i} because config is incomplete`);
            continue;
        }

        const nodeId = `node-${i}`;
        const config = {
            id: nodeId,
            host,
            port: Number(port),
            password,
            secure: process.env[`${prefix}_SECURE`] === 'true',
            maxPlayers: parseInt(process.env[`${prefix}_MAX_PLAYERS`] || '100', 10),
            location: process.env[`${prefix}_LOCATION`] || 'Unknown',
            flag: process.env[`${prefix}_FLAG`] || '',
            playerCreateDelay: parseInt(process.env[`${prefix}_PLAYER_CREATE_DELAY`] || '0', 10),
        };

        nodeConfigs.set(nodeId, config);


        nodes.push({
            id: config.id,
            host: config.host,
            port: config.port,
            authorization: config.password,
            secure: config.secure,
            retryAmount: 10,
            retryDelay: 5000,
        });


        logger.lavalink(
            `Configured ${nodeId} | ${config.host}:${config.port} | Max Players: ${config.maxPlayers} | ${config.location} ${config.flag}`,
        );
    }

    if (!nodes.length) {
        logger.error('No Lavalink nodes configured');
    }

    return nodes;
}


function getBestNode(manager) {
    let nodes = Array.from(manager.nodeManager.nodes.values());
    let availableNodes = nodes.filter((node) => {
        if (!node.connected) return false;
        const config = nodeConfigs.get(node.id);
        if (!config) return false;
        const players = Array.from(manager.players.values()).filter((p) => p.node?.id === node.id).length;
        return players < config.maxPlayers;

    });

    if (!availableNodes.length) {
        return null;

    }

    
    availableNodes.sort((a, b) => {
        const aPlayers = Array.from(manager.players.values()).filter((p) => p.node?.id === a.id).length;
        const bPlayers = Array.from(manager.players.values()).filter((p) => p.node?.id === b.id).length;
        return aPlayers - bPlayers;

    });

    return availableNodes[0];
}

const manager = new LavalinkManager({
    // Lavalink configuration
    nodes: build(),
    sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild?.shard) {
            guild.shard.send(payload);
        }
    },
    client: {
        id: clientId,
        username: 'QuranBot',
        name: 'QuranBot/1.0',
    },
    autoSkip: true,
    playerOptions: {
        applyVolumeAsFilter: false,
        clientBasedPositionUpdateInterval: 50,
        defaultSearchPlatform: 'ytmsearch',
        volumeDecrementer: 0.75,
        onDisconnect: {
            autoReconnect: true,
            destroyPlayer: false,
        },
        onEmptyQueue: {
            destroyAfterMs: 6690000,
        },
        useUnresolvedData: true,
    },
});

manager.nodeManager.on('connect', (node) => {
    const config = nodeConfigs.get(node.id);
    logger.lavalink(`Lavalink node "${node.id}" connected | ${config?.location || 'Unknown'} ${config?.flag || ''}`);
});

manager.nodeManager.on('disconnect', (node, reason) => {
    logger.error(`Node "${node.id}" disconnected`, reason?.message || reason);
});

manager.nodeManager.on('error', (node, error) => {
    logger.error(`Node "${node.id}" error`, error);
});

manager.on('playerCreate', (player) => {
    const nodeId = player.node?.id || 'unknown';
    const config = nodeConfigs.get(nodeId);
    const players = Array.from(manager.players.values()).filter((p) => p.node?.id === nodeId).length;
    logger.lavalink(`Player created | Guild: ${player.guildId} | Node: ${nodeId} | Load: ${players}/${config?.maxPlayers || 'N/A'}`);
});

client.lavalink = manager;
global.client = client;
global.guildStates = new Map();
global.cooldowns = new Map();
global.commandCooldowns = new Map();
global.azkarData = [];

client.on('raw', (data) => {
    if (client.lavalink) {
        client.lavalink.sendRawData(data);
    }
});

(async () => {
    try {
        const response = await fetch('https://hub-mgv.github.io/QuranBotData/adhkar.json', {
            headers: getBrowserHeaders(),
            timeout: TimeoutRequest('default'),
        });
        if (response.ok) {
            global.azkarData = await response.json();
            logger.info('Loaded ' + global.azkarData.length + ' Adhkar Categories From New adhkar.json');
            let totalAdhkar = 0;
            global.azkarData.forEach((cat) => {
                if (cat.array && Array.isArray(cat.array)) {
                    totalAdhkar += cat.array.length;
                }
            });
            logger.info('Total adhkar entries: ' + totalAdhkar);
        } else {
            throw new Error('HTTP ' + response.status);
        }
    } catch (error) {
        logger.warn('Failed To Load New Adhkar Data From adhkar.json Using Minimal Fallback');
        global.azkarData = [
            {
                id: 1,
                category: 'تسبيح',
                audio: '/audio/ar_7esn_AlMoslem_by_Doors_028.mp3',
                filename: 'ar_7esn_AlMoslem_by_Doors_028',
                array: [
                    { text: 'سبحان الله', count: 100, audio: '/audio/91.mp3', filename: '91' },
                    { text: 'الحمد لله', count: 100, audio: '/audio/92.mp3', filename: '92' },
                    { text: 'الله أكبر', count: 100, audio: '/audio/93.mp3', filename: '93' },
                ],
            },
        ];
    }
})();

const rest = new REST({ version: '10' }).setToken(token);
global.rest = rest;

process.on('warning', (warning) => {
    logger.warn('Node Js Warning ' + warning.name + ' ' + warning.message);
});

setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const mbUsed = memoryUsage.heapUsed / 1024 / 1024;
    if (mbUsed > 300) {
        logger.warn('Detected Cache:' + mbUsed.toFixed(2) + ' MB');
        Object.keys(require.cache).forEach((key) => {
            if (key.includes('temp') || key.includes('cache')) delete require.cache[key];
        });
    }
}, 60000);

const runtimeStates = require('@RuntimeState');
const { saveRuntimeStates, restoreRuntimeStates, loadRuntimeStates } = runtimeStates;
global.saveRuntimeStates = saveRuntimeStates;

module.exports.client = client;
module.exports.mutex = mutex;
module.exports.saveRuntimeStates = saveRuntimeStates;
module.exports.restoreRuntimeStates = restoreRuntimeStates;
module.exports.loadRuntimeStates = loadRuntimeStates;
module.exports.lavalinkManager = manager;
module.exports.getBestNode = getBestNode;
module.exports.nodeConfigs = nodeConfigs;
