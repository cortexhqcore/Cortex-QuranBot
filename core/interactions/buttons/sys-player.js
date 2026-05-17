require('pathlra-aliaser')();

const { resetPlayer, stopPlayer } = require('@audio-core');
const logger = require('@logger');
// Reset player state for a guild, typically used in scenarios like voice recovery or state restoration
async function resetPlayerState(guildState, guildId) {
    return await resetPlayer(guildId, guildState);
}

module.exports.resetPlayerState = resetPlayerState;
module.exports.stopPlayer = stopPlayer;
