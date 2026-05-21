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
} = require('@registry/core');
const { loadData, saveSetupGuilds } = require('@data-manager-core_data');
const { Client, GatewayIntentBits, REST } = require('discord.js');
const { ClusterClient, getInfo } = require('discord-hybrid-sharding');
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
const clusterInfo = getInfo();

const clientOptions = {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
};

if (clusterInfo) {
    clientOptions.shards = clusterInfo.SHARD_LIST;
    clientOptions.shardCount = clusterInfo.TOTAL_SHARDS;
}

const client = new Client(clientOptions);
ClusterClient.addToClient(client);
const manager = new LavalinkManager({
    // Lavalink configuration
    nodes: [
        {
            id: 'primary',
            host: process.env.LAVALINK_HOST || '127.0.0.1',
            port: parseInt(process.env.LAVALINK_PORT, 10) || 2333,
            authorization: process.env.LAVALINK_PASSWORD || '',
            secure: process.env.LAVALINK_SECURE === 'true',
        },
    ],
    sendToShard: (guildId, payload) => {
        client.cluster.send(payload);
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
            destroyAfterMs: 0,
         },
        useUnresolvedData: true,
    },
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
