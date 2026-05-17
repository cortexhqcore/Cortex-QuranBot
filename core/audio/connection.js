require('pathlra-aliaser')();

const { joinVoiceChannel } = require('@discordjs/voice');
const persistentState = require('../state/PersistentStateManager');
const logger = require('@logger');
const voiceLogger = require('@voiceLogger');

if (!global.activeVoiceConnections) {
    global.activeVoiceConnections = 0;
}

function canJoinVoice() {
    if (!global.MAX_VOICE_CONNECTIONS_PER_SHARD) return true;
    const canJoin = global.activeVoiceConnections < global.MAX_VOICE_CONNECTIONS_PER_SHARD;
    voiceLogger.debug(
        `Voice capacity check: ${global.activeVoiceConnections}/${global.MAX_VOICE_CONNECTIONS_PER_SHARD} - canJoin: ${canJoin}`,
    );
    return canJoin;
}

function incrementVoiceConnections() {
    if (!global.activeVoiceConnections) global.activeVoiceConnections = 0;
    global.activeVoiceConnections++;
    voiceLogger.debug(`Voice connections incremented to ${global.activeVoiceConnections}`);
}

function decrementVoiceConnections() {
    if (!global.activeVoiceConnections) global.activeVoiceConnections = 0;
    if (global.activeVoiceConnections > 0) {
        global.activeVoiceConnections--;
        voiceLogger.debug(`Voice connections decremented to ${global.activeVoiceConnections}`);
    }
}

async function teardownConnection(guildId, guildState) {
    voiceLogger.connection(guildId, 'Starting teardown', {
        hasConnection: !!guildState?.connection,
        hasChannel: !!guildState?.channelId,
    });
    if (!guildState) {
        voiceLogger.connection(guildId, 'Teardown skipped - no guild state');
        return;
    }
    // Stop adhkar timer to prevent orphaned intervals after disconnect
    if (guildState.azkarTimer) {
        clearInterval(guildState.azkarTimer);
        guildState.azkarTimer = null;
        guildState.azkarChannelId = null;
        voiceLogger.connection(guildId, 'Cleared azkar timer during teardown');
    }

    if (guildState.connection && !guildState.connection.destroyed) {
        try {
            guildState.connection.unsubscribe(guildState.player);
            voiceLogger.connection(guildId, 'Unsubscribed player from connection');
        } catch (err) {
            voiceLogger.connection(guildId, 'Unsubscribe failed (expected during teardown)', {
                error: err.message,
            });
        }
        try {
            guildState.connection.destroy();
            voiceLogger.connection(guildId, 'Destroyed voice connection');
        } catch (err) {
            voiceLogger.connection(guildId, 'Destroy failed (expected during teardown)', {
                error: err.message,
            });
        }
    }
    guildState.connection = null;
    guildState.channelId = null;
    voiceLogger.connection(guildId, 'Teardown complete - state cleared');
}

async function syncVoiceState(guildId, guildState) {
    voiceLogger.connection(guildId, 'Syncing voice state to persistent storage', {
        channelId: guildState.channelId,
        playbackMode: guildState.playbackMode,
        reciter: guildState.currentReciter,
        surahIndex: guildState.currentSurah,
        connectionStatus: !!guildState.connection && !guildState.connection?.destroyed,
        isPaused: guildState.isPaused,
    });
    const storedState = persistentState.getGuildState(guildId);
    storedState.voiceChannelId = guildState.channelId;
    storedState.playbackMode = guildState.playbackMode;
    storedState.currentReciter = guildState.currentReciter;
    storedState.currentSurahIndex = guildState.currentSurah - 1;
    storedState.connectionStatus = !!guildState.connection && !guildState.connection.destroyed;
    storedState.isPaused = guildState.isPaused;
    storedState.currentRadioIndex = guildState.currentRadioIndex;
    storedState.currentRadioPage = guildState.currentRadioPage;
    persistentState.updateGuildState(guildId, storedState);

    if (typeof global.saveRuntimeStates === 'function') {
        await global.saveRuntimeStates();
        voiceLogger.connection(guildId, 'Runtime states saved after sync');
    }
    voiceLogger.connection(guildId, 'Voice state sync completed');
}

async function initializeConnection(guildId, guildState, targetChannel, adapterCreator) {
    voiceLogger.connection(guildId, 'Initializing voice connection', {
        channelId: targetChannel.id,
        guildName: targetChannel.guild?.name,
        adapterAvailable: !!adapterCreator,
    });
    await teardownConnection(guildId, guildState);
    const { resetPlayer } = require('./player');
    await resetPlayer(guildId, guildState);
    try {
        voiceLogger.connection(guildId, 'Calling joinVoiceChannel', { selfDeaf: true });
        guildState.connection = await joinVoiceChannel({
            channelId: targetChannel.id,
            guildId,
            adapterCreator,
            selfDeaf: true,
        });
        voiceLogger.connection(guildId, 'Voice connection established successfully', {
            connectionReady: !!guildState.connection,
            connectionDestroyed: guildState.connection?.destroyed,
        });
        guildState.channelId = targetChannel.id;
        persistentState.setManualDisconnect(guildId, false);
        guildState.connection.subscribe(guildState.player);
        incrementVoiceConnections();
        logger.info(`Guild ${guildId} Voice Connection Established`);
        voiceLogger.connection(guildId, 'Connection subscribed to player and counters updated');
        return { success: true, connection: guildState.connection };
    } catch (err) {
        voiceLogger.error(guildId, 'Failed to establish voice connection', err, {
            channelId: targetChannel.id,
            hasAdapter: !!adapterCreator,
        });
        throw err;
    }
}

module.exports.canJoinVoice = canJoinVoice;
module.exports.incrementVoiceConnections = incrementVoiceConnections;
module.exports.decrementVoiceConnections = decrementVoiceConnections;
module.exports.teardownConnection = teardownConnection;
module.exports.syncVoiceState = syncVoiceState;
// Added missing export to resolve 'initializeConnection is not a function' error in recovery javascript``
//
// 2026-05-08T13:11:50.965Z ERROR Failed To Connect To Voice Channel For Guild 1455855604676689922 initializeConnection is not a function
// {
//  stack: 'TypeError: initializeConnection is not a function\n' +
//    '    at recoverVoiceConnection (D:\\Data\\bot\\QuranBot\\NV\\QuranBot\\core\\ready\\voiceRecovery.js:53:22)\n' +
//    '    at Timeout._onTimeout (D:\\Data\\bot\\QuranBot\\NV\\QuranBot\\core\\startup\\readyHandler.js:72:22)\n' +
//    '    at runNextTicks (node:internal/process/task_queues:65:5)\n' +
//    '    at listOnTimeout (node:internal/timers:555:9)\n' +
//    '    at process.processTimers (node:internal/timers:529:7)',
//  name: 'TypeError'
// }
//}
module.exports.initializeConnection = initializeConnection;
