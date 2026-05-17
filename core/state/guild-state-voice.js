require('pathlra-aliaser')();

const voiceLogger = require('@voiceLogger');

// Check if bot can join another voice channel based on shard limit
function canJoinVoice() {
    if (!global.MAX_VOICE_CONNECTIONS_PER_SHARD) {
        voiceLogger.trace(null, 'Voice capacity check - no limit configured, allowing join');
        return true;
    }
    if (!global.activeVoiceConnections) global.activeVoiceConnections = 0;
    const canJoin = global.activeVoiceConnections < global.MAX_VOICE_CONNECTIONS_PER_SHARD;
    voiceLogger.trace(null, 'Voice capacity check', {
        current: global.activeVoiceConnections,
        max: global.MAX_VOICE_CONNECTIONS_PER_SHARD,
        canJoin,
    });
    return canJoin;
}

function incrementVoiceConnections() {
    if (!global.activeVoiceConnections) global.activeVoiceConnections = 0;
    global.activeVoiceConnections++;
    voiceLogger.trace(null, 'Voice connections counter incremented', {
        newCount: global.activeVoiceConnections,
    });
}

function decrementVoiceConnections() {
    if (!global.activeVoiceConnections) global.activeVoiceConnections = 0;
    if (global.activeVoiceConnections > 0) {
        global.activeVoiceConnections--;
        voiceLogger.trace(null, 'Voice connections counter decremented', {
            newCount: global.activeVoiceConnections,
        });
    }
}

function getActiveVoiceConnections() {
    const count = global.activeVoiceConnections || 0;
    voiceLogger.trace(null, 'Voice connections count requested', { count });
    return count;
}

module.exports.canJoinVoice = canJoinVoice;
module.exports.incrementVoiceConnections = incrementVoiceConnections;
module.exports.decrementVoiceConnections = decrementVoiceConnections;
module.exports.getActiveVoiceConnections = getActiveVoiceConnections;
