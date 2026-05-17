require('pathlra-aliaser')();

const { AudioPlayerStatus } = require('@discordjs/voice');
const logger = require('@logger');
const { createSurahResource } = require('@audioUtils-core_utils');
const { player_config } = require('@sys-config-core_interactions_buttons');

// Ensure playback is active after a brief delay, handling edge cases
async function ensurePlaybackStarted(guildState, guildId) {
    try {
        // Small delay to allow voice connection to fully stabilize
        await new Promise((resolve) => setTimeout(resolve, player_config.PLAYBACK_START_DELAY_MS));

        if (!guildState.connection || guildState.connection.destroyed) {
            logger.warn('Guild ' + guildId + ' Connection Lost During Playback Start');
            return false;
        }

        // Re-subscribe player to connection to ensure audio routing
        guildState.connection.subscribe(guildState.player);
        logger.info('Guild ' + guildId + ' Player Subscribed To Connection');

        // Start playback if player is idle
        if (guildState.player.state.status === AudioPlayerStatus.Idle) {
            logger.info('Guild ' + guildId + ' Player Idle After Join Starting Playback');

            if (guildState.playbackMode === 'surah') {
                const audioResource = await createSurahResource(guildState, guildState.currentSurah - 1, 0, 0, false);
                guildState.player.play(audioResource);
                guildState.isPaused = false;
                guildState.pauseReason = null;
            } else if (guildState.currentRadioUrl) {
                const { createRadioResource } = require('@audioUtils-core_utils');
                const radioResource = await createRadioResource(guildState.currentRadioUrl, 0);
                guildState.player.play(radioResource);
                guildState.isPaused = false;
                guildState.pauseReason = null;
            }

            logger.info('Guild ' + guildId + ' Playback Started Successfully');
            return true;
        }

        return true;
    } catch (error) {
        logger.error('Guild ' + guildId + ' Ensure Playback Failed', error);
        return false;
    }
}

// Start playback immediately based on current mode and state
async function startPlayback(guildState, guildId) {
    try {
        if (guildState.playbackMode === 'surah') {
            const audioResource = await createSurahResource(guildState, guildState.currentSurah - 1, 0, 0, false);
            guildState.player.play(audioResource);
        } else if (guildState.currentRadioUrl) {
            const { createRadioResource } = require('@audioUtils-core_utils');
            const radioResource = await createRadioResource(guildState.currentRadioUrl, 0);
            guildState.player.play(radioResource);
        }

        guildState.isPaused = false;
        guildState.pauseReason = null;
        guildState.lastActivity = Date.now();
        return true;
    } catch (error) {
        logger.error('Guild ' + guildId + ' Start Playback Failed', error);
        return false;
    }
}

module.exports.ensurePlaybackStarted = ensurePlaybackStarted;
module.exports.startPlayback = startPlayback;
