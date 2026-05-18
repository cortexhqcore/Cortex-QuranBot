require('pathlra-aliaser')();

const logger = require('@logger');
const persistentState = require('@PersistentStateManager-core_state');
const { initializeConnection, teardownConnection, syncVoiceState } = require('@audio-core');
const { getVoiceChannel, checkBotPermissions } = require('@sys-voice-core_interactions_buttons');
const { startPlayback } = require('@sys-playback-core_interactions_buttons');
const { ERRORS } = require('@sys-config-core_interactions_buttons');

async function joinVoiceChannelHandler(interaction, guildId, guildState) {
    const targetGuild = interaction.guild;
    const guildSetup = global.setupGuilds ? global.setupGuilds[guildId] : null;

    const channelLookup = await getVoiceChannel(targetGuild, guildSetup, guildState);
    if (!channelLookup.channel) {
        return { success: false, error: channelLookup.error };
    }
    const { channel: targetVoiceChannel, channelId: targetChannelId } = channelLookup;

    if (!checkBotPermissions(targetVoiceChannel, targetGuild.members.me)) {
        return { success: false, error: ERRORS.NO_PERMISSIONS };
    }

    try {
        const joinResult = await initializeConnection(guildId, guildState, targetVoiceChannel, targetGuild.voiceAdapterCreator);
        if (!joinResult.success) {
            return { success: false, error: ERRORS.JOIN_FAILED };
        }

        guildState.playbackMode = 'surah';
        const availableReciters = Object.keys(global.reciters || {});
        if (availableReciters.length === 0) {
            throw new Error('No reciters loaded yet Please wait for data initialization');
        }
        guildState.currentReciter = availableReciters[Math.floor(Math.random() * availableReciters.length)];
        guildState.currentSurah = Math.floor(Math.random() * 114) + 1;

        await startPlayback(guildState, guildId);
        await syncVoiceState(guildId, guildState);

        if (!global.setupGuilds) global.setupGuilds = {};
        if (!global.setupGuilds[guildId]) {
            global.setupGuilds[guildId] = { voiceChannelId: targetChannelId };
        }
        return { success: true, voiceChannelId: targetChannelId };
    } catch (err) {
        logger.error('Error Joining Via Button In Guild ' + guildId, err);
        await teardownConnection(guildId, guildState);
        return { success: false, error: ERRORS.JOIN_FAILED + ' ' + err.message };
    }
}

module.exports.joinVoiceChannelHandler = joinVoiceChannelHandler;
