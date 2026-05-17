require('pathlra-aliaser')();

const voiceManager = require('@voice-connection');
const persistentState = require('@PersistentStateManager-core_state');

// Sync runtime guild state to persistent storage for recovery across restarts
// Replaced inline persistent sync logic with centralized voiceManager.syncVoiceState
async function saveGuildState(guildId, guildState) {
    await voiceManager.syncVoiceState(guildId, guildState);
}

// Retrieve the persistent state object for a guild
function getPersistentState(guildId) {
    return persistentState.getGuildState(guildId);
}

module.exports.saveGuildState = saveGuildState;
module.exports.getPersistentState = getPersistentState;
