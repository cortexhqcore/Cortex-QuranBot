require('pathlra-aliaser')();

function setupPlayerEvents(guildId, playerInstance) {
    const { attachPlayerEvents } = require('@audio-core').player;
    attachPlayerEvents(guildId, playerInstance);
}

module.exports = { setupPlayerEvents };
