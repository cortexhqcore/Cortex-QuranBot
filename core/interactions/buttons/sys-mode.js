require('pathlra-aliaser')();

const persistentState = require('@PersistentStateManager-core_state');

// Toggle control mode between 'everyone' and 'admins' and persist the change
async function toggleControlMode(guildId, guildState) {
    guildState.controlMode = guildState.controlMode === 'everyone' ? 'admins' : 'everyone';

    const storedState = persistentState.getGuildState(guildId);
    storedState.controlMode = guildState.controlMode;
    persistentState.updateGuildState(guildId, storedState);

    global.saveRuntimeStates();

    return { success: true, newMode: guildState.controlMode };
}

module.exports.toggleControlMode = toggleControlMode;
