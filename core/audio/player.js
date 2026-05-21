require('pathlra-aliaser')();

// const { createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
const logger = require('@logger');
const voiceLogger = require('@voiceLogger');
const { voice_config } = require('@configConstants');
const { getGuildStateById } = require('../state/guild-state-store');
const MAX_ERROR_COUNT = voice_config.max_error_count;

/**
function getGuildStateById(guildId) {
    if (!_getGuildStateById) {
        _getGuildStateById = require('@guild-state-store-core_state').getGuildStateById;
    }
    return _getGuildStateById(guildId);
}
function createNewPlayer() {
    voiceLogger.player(null, 'Creating new audio player', {
        noSubscriberTimeout: 60000,
        maxMissedFrames: 500,
    });
    return createAudioPlayer({
        behaviors: { noSubscriberTimeout: 60000, maxMissedFrames: 500 },
    });
}
**/
async function queueNextTrack(player, state) {
    try {
        let nextTrack = null;
        if (state.playbackMode === 'surah') {
            let nextIndex = state.currentSurah;
            const totalSurahs = global.surahNames?.length || 114;
            if (nextIndex >= totalSurahs) {
                nextIndex = 0;
            }
            nextTrack = await global.createSurahResource(state, nextIndex);
        } else if (state.playbackMode === 'radio' && state.currentRadioUrl) {
            nextTrack = await global.createRadioResource(state.currentRadioUrl);
        }

        if (nextTrack) {
            await player.queue.add(nextTrack);
            voiceLogger.player(player.guildId, 'Pre-loaded next track', {
                mode: state.playbackMode,
                index: nextTrack.info?.identifier,
            });
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`Failed to queue next track for guild ${player.guildId}: ${error.message}`);
        return false;
    }
}

function attachManagerEvents(manager) {
    manager.on('trackStart', async (player, track) => {
        const guildId = player.guildId;
        voiceLogger.player(guildId, 'Track started', { title: track.info?.title });
        const state = getGuildStateById(guildId);

        if (state) {
            state.errorCount = 0;
            state.isPaused = false;
            state.pauseReason = null;
            state.playbackStartTime = Date.now();
            state.disconnectAfterCurrentTrack = false;

            if (!state.isPaused && (state.playbackMode === 'surah' || (state.playbackMode === 'radio' && state.currentRadioUrl))) {
                queueNextTrack(player, state);
            }
        }
    });

    manager.on('trackEnd', async (player, track, payload) => {
        const guildId = player.guildId;
        const endReason = payload?.reason?.toLowerCase();

        if (endReason === 'replaced') return;

        voiceLogger.player(guildId, 'Track ended', { reason: endReason });
        const state = getGuildStateById(guildId);

        if (!state) return;
        if (state.isPaused) return;
        if (!state.player || state.player.destroyed) return;

        if (state.playbackMode === 'surah') {
            const totalSurahs = global.surahNames?.length || 114;
            state.currentSurah++;
            if (state.currentSurah > totalSurahs) {
                state.currentSurah = 1;
            }
        }

        if (player.queue.tracks.length === 0 && !player.playing && !player.paused) {
            const queued = await queueNextTrack(player, state);
            if (queued) {
                await player.play();
            }
        }

        if (state.errorCount >= MAX_ERROR_COUNT) {
            state.isPaused = true;
            state.pauseReason = 'max_errors_reached';
        } else {
            state.errorCount = 0;
        }

        if (typeof global.saveRuntimeStates === 'function') global.saveRuntimeStates();
    });

    manager.on('trackError', async (player, track, payload) => {
        const guildId = player.guildId;
        voiceLogger.error(guildId, 'Track error', {
            title: track?.info?.title,
        });
        const state = getGuildStateById(guildId);

        if (state) {
            state.errorCount = (state.errorCount || 0) + 1;
            if (state.errorCount >= MAX_ERROR_COUNT) {
                state.isPaused = true;
                state.pauseReason = 'track_error';
                logger.error(`Guild ${guildId} paused due to track errors`);
            }
        }
    });

    manager.on('trackStuck', async (player, track, payload) => {
        //
        const guildId = player.guildId;
        voiceLogger.error(guildId, 'Track stuck', { threshold: payload?.thresholdMs });
        const state = getGuildStateById(guildId);

        if (state && state.player) {
            try {
                await state.player.stopPlaying();
            } catch (e) {
                logger.error(`Guild ${guildId} failed to stop stuck track`, e);
            }
        }
    });

    manager.on('playerDisconnect', async (player, payload) => {
        voiceLogger.connection(player.guildId, 'Player disconnected', { code: payload?.code });
    });
}

function attachPlayerEvents(guildId, playerInstance) {
    logger.debug(`Player events attached for guild ${guildId} (Lavalink mode)`);
}

function stopPlayer(guildState) {
    if (guildState?.player && !guildState.player.destroyed) {
        if (typeof guildState.player.stopPlaying === 'function') {
            guildState.player.stopPlaying();
        } else if (typeof guildState.player.stop === 'function') {
            guildState.player.stop();
        }
    }
}

module.exports.attachManagerEvents = attachManagerEvents;
module.exports.attachPlayerEvents = attachPlayerEvents;
module.exports.stopPlayer = stopPlayer;
// module.exports.createNewPlayer = createNewPlayer;
// module.exports.resetPlayer = resetPlayer;
