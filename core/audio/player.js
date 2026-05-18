require('pathlra-aliaser')();

// const { createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
const logger = require('@logger');
const voiceLogger = require('@voiceLogger');
const { voice_config } = require('@configConstants');
const { getGuildStateById } = require('../state/guild-state-store');
const MAX_ERROR_COUNT = voice_config.max_error_count;
const ERROR_RECOVERY_DELAY_MS = voice_config.error_recovery_delay_ms;
let errorRecoveryInProgress = false;

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
async function createNewPlayer() {
    voiceLogger.player(null, 'Lavalink player creation delegated to connection manager', { maxErrorCount: MAX_ERROR_COUNT });
    return null;
}
async function resetPlayer(guildId, guildState) {
    voiceLogger.player(guildId, 'Resetting player', {
        hasPlayer: !!guildState?.player,
        // status: guildState?.player?.state?.status,
    });
    if (!guildState?.player) return false;
    try {
        if (typeof guildState.player.stopPlaying === 'function') guildState.player.stopPlaying();
        guildState.errorCount = 0;
        guildState.isPaused = true;
        guildState.pauseReason = 'player_reset';

        logger.info(`Guild ${guildId} Player Reset`);
        voiceLogger.player(guildId, 'Player reset completed successfully');
        return true;
    } catch (error) {
        voiceLogger.error(guildId, 'Player reset failed', error);

        return false;
    }
}
function stopPlayer(guildState) {
    if (guildState?.player && !guildState.player.destroyed) {
        voiceLogger.player(null, 'Stopping player', { status: guildState.player?.state });
        if (typeof guildState.player.stopPlaying === 'function') guildState.player.stopPlaying();
    }
}
/**
function stopPlayer(guildState) {
    if (guildState?.player) {
        voiceLogger.player(null, 'Stopping player', { status: guildState.player.state?.status });
        guildState.player.stop();
    }
}
 */
function attachPlayerEvents(guildId, player) {
    voiceLogger.player(guildId, 'Attaching player event listeners');
    player.on('trackStart', async (track) => {
        voiceLogger.player(guildId, 'Track started', { title: track.info?.title });
        const state = getGuildStateById(guildId);
        if (state) {
            state.errorCount = 0;
            state.isPaused = false;
            state.pauseReason = null;
            state.playbackStartTime = Date.now();
        }
    });
    player.on('trackEnd', async () => {
        voiceLogger.player(guildId, 'Track ended - triggering sequential playback');
        const state = getGuildStateById(guildId);
        if (!state || state.isPaused || state.connectionStatus === false) return;
        try {
            if (state.playbackMode === 'surah' && state.disconnectAfterCurrentTrack === true) {
                voiceLogger.player(guildId, 'Auto-disconnect enabled tearing down connection after track completion');
                state.disconnectAfterCurrentTrack = false;
                const { teardownConnection, syncVoiceState } = require('./connection');
                const persistentState = require('../state/PersistentStateManager');
                await teardownConnection(guildId, state);
                persistentState.setManualDisconnect(guildId, true);
                await syncVoiceState(guildId, state);
                logger.info(`Guild ${guildId} Auto-disconnected after single surah playback`);
                voiceLogger.player(guildId, 'Connection torn down successfully after single track');
                return;
            }
            let track = null;
            if (state.playbackMode === 'surah') {
                const reciterData = global.reciters?.[state.currentReciter];
                const availableLinks = reciterData?.links || [];
                const maxSurahs = availableLinks.filter((l) => l?.startsWith('http')).length || 114;
                let attempts = 0;
                let nextSurahIndex = state.currentSurah;
                while (attempts < maxSurahs && !track) {
                    nextSurahIndex = nextSurahIndex >= maxSurahs ? 1 : nextSurahIndex + 1;
                    attempts++;
                    const link = availableLinks[nextSurahIndex - 1];
                    if (!link || typeof link !== 'string' || !link.startsWith('http')) {
                        voiceLogger.debug(guildId, `Surah ${nextSurahIndex} missing for ${state.currentReciter}, skipping`);
                        continue;
                    }
                    try {
                        track = await global.createSurahResource(state, nextSurahIndex - 1);
                    } catch (err) {
                        voiceLogger.debug(guildId, `Surah ${nextSurahIndex} failed to load for ${state.currentReciter}, skipping`);
                    }
                }
                if (!track) {
                    const nextReciter = global.findWorkingReciter ? global.findWorkingReciter(state.currentReciter) : null;
                    if (nextReciter) {
                        state.currentReciter = nextReciter;
                        state.currentSurah = 1;
                        voiceLogger.info(guildId, `Reciter exhausted, switching to ${nextReciter} and resetting to Surah 1`);
                        const nextLink = global.reciters?.[nextReciter]?.links?.[0];
                        if (nextLink?.startsWith('http')) {
                            try {
                                track = await global.createSurahResource(state, 0);
                            } catch (switchErr) {
                                voiceLogger.debug(guildId, 'Failed to load first surah for new reciter');
                            }
                        }
                    }
                }
            } else if (state.playbackMode === 'radio' && state.currentRadioUrl) {
                track = await global.createRadioResource(state.currentRadioUrl);
            }
            if (track) {
                state.currentSurah = state.playbackMode === 'surah' ? nextSurahIndex : state.currentSurah;
                state.playedOffset = 0;
                await state.player.play({ track: track });
                state.isPaused = false;
                state.pauseReason = null;
                state.errorCount = 0;
                voiceLogger.player(guildId, `Sequential playback resumed: Surah ${state.currentSurah}`);
                if (typeof global.saveRuntimeStates === 'function') {
                    global.saveRuntimeStates();
                }
            } else {
                state.isPaused = true;
                state.pauseReason = 'sequential_exhausted';
                voiceLogger.player(guildId, 'Playback paused: No valid tracks found. Voice connection preserved');
            }
        } catch (error) {
            voiceLogger.error(guildId, 'Track end sequential handler failed', error);
            state.errorCount = (state.errorCount || 0) + 1;
            if (state.errorCount >= MAX_ERROR_COUNT) {
                state.isPaused = true;
                state.pauseReason = 'auto_resume_failed';
                voiceLogger.player(guildId, 'Player paused due to error threshold');
                //errorCount: state.errorCount,
                // });
            }
        }
    });

    player.on('error', async (error) => {
        voiceLogger.error(guildId, 'Player error event', error);
        const state = getGuildStateById(guildId);
        if (state) {
            state.errorCount = (state.errorCount || 0) + 1;
            if (state.errorCount >= MAX_ERROR_COUNT) {
                state.isPaused = true;
                state.pauseReason = 'player_error';
            }
            if (!errorRecoveryInProgress) {
                errorRecoveryInProgress = true;
                await new Promise((resolve) => setTimeout(resolve, ERROR_RECOVERY_DELAY_MS));
                try {
                    if (typeof state.player.stopPlaying === 'function') state.player.stopPlaying();
                    if (state.playbackMode === 'surah') {
                        const res = await global.createSurahResource(state, state.currentSurah - 1);
                        if (res) state.player.play({ track: res });
                    } else if (state.playbackMode === 'radio' && state.currentRadioUrl) {
                        const res = await global.createRadioResource(state.currentRadioUrl);
                        if (res) state.player.play({ track: res });
                    }
                    state.isPaused = false;
                    state.errorCount = 0;
                } catch (recoveryErr) {
                    voiceLogger.error(guildId, 'Error recovery failed', recoveryErr);
                } finally {
                    errorRecoveryInProgress = false;
                }
            }
        }
    });
    /**
    player.on(AudioPlayerStatus.Playing, () => {
        const state = getGuildStateById(guildId);
        voiceLogger.player(guildId, 'Player entered Playing state', {
            mode: state?.playbackMode,
            surah: state?.currentSurah,
            radioUrl: state?.currentRadioUrl,
        });
        if (state) {
            state.errorCount = 0;
            state.isPaused = false;
            state.pauseReason = null;
        }
    });
    player.on(AudioPlayerStatus.Paused, () => {
        voiceLogger.player(guildId, 'Player entered Paused state');
    });
    player.on(AudioPlayerStatus.AutoPaused, () => {
        voiceLogger.player(guildId, 'Player entered AutoPaused state');
    });
    player.on(AudioPlayerStatus.Buffering, () => {
        voiceLogger.player(guildId, 'Player entered Buffering state');
    });
   **/
    voiceLogger.player(guildId, 'All player event listeners attached');
}
module.exports.createNewPlayer = createNewPlayer;
module.exports.resetPlayer = resetPlayer;
module.exports.stopPlayer = stopPlayer;
module.exports.attachPlayerEvents = attachPlayerEvents;
