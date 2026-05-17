require('pathlra-aliaser')();

const { createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
const logger = require('@logger');
const voiceLogger = require('@voiceLogger');
const { voice_config } = require('@configConstants');
const MAX_ERROR_COUNT = voice_config.max_error_count;
const error_recovery_delay_ms = voice_config.error_recovery_delay_ms;
let _getGuildStateById;

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
async function resetPlayer(guildId, guildState) {
    voiceLogger.player(guildId, 'Resetting player', {
        hasPlayer: !!guildState?.player,
        status: guildState?.player?.state?.status,
    });
    if (!guildState?.player) {
        voiceLogger.player(guildId, 'Reset skipped - no player instance');
        return false;
    }
    try {
        guildState.player.stop();
        guildState.player.removeAllListeners();
        const freshPlayer = createNewPlayer();
        guildState.player = freshPlayer;
        guildState.errorCount = 0;
        guildState.isPaused = true;
        guildState.pauseReason = 'player_reset';
        attachPlayerEvents(guildId, freshPlayer);
        logger.info(`Guild ${guildId} Player Reset`);
        voiceLogger.player(guildId, 'Player reset completed successfully');
        return true;
    } catch (error) {
        voiceLogger.error(guildId, 'Player reset failed', error);
        logger.error(`Guild ${guildId} Player Reset Failed`, error);
        return false;
    }
}
function stopPlayer(guildState) {
    if (guildState?.player) {
        voiceLogger.player(null, 'Stopping player', { status: guildState.player.state?.status });
        guildState.player.stop();
    }
}

function attachPlayerEvents(guildId, player) {
    voiceLogger.player(guildId, 'Attaching player event listeners');
    let idleHandled = false;
    let errorRecoveryInProgress = false;
    player.on(AudioPlayerStatus.Idle, async () => {
        voiceLogger.player(guildId, 'Player entered Idle state', {
            idleHandled,
            isPaused: getGuildStateById(guildId)?.isPaused,
        });
        if (idleHandled) {
            voiceLogger.player(guildId, 'Idle event ignored - already handled');
            return;
        }
        idleHandled = true;
        const state = getGuildStateById(guildId);
        if (!state || state.isPaused || !state.connection || state.connection.destroyed) {
            voiceLogger.player(guildId, 'Idle handler skipped - paused or no connection', {
                hasState: !!state,
                isPaused: state?.isPaused,
                hasConnection: !!state?.connection,
                connectionDestroyed: state?.connection?.destroyed,
            });
            idleHandled = false;
            return;
        }
        try {
            let resource;
            if (state.playbackMode === 'surah') {
                voiceLogger.player(guildId, 'Preparing next surah resource', {
                    currentSurah: state.currentSurah,
                    reciter: state.currentReciter,
                });
                state.currentSurah = ((state.currentSurah - 1) % 114) + 1;
                state.playedOffset = 0;
                state.playbackStartTime = Date.now();
                try {
                    resource = await global.createSurahResource(state, state.currentSurah - 1, 0, 0, false);
                    voiceLogger.player(guildId, 'Surah resource created successfully');
                } catch (surahError) {
                    voiceLogger.player(guildId, 'Surah resource creation failed - attempting fallback', {
                        error: surahError.message,
                    });
                    const { findWorkingReciter, findAvailableSurahForReciter } = require('./resource');
                    const working = findWorkingReciter(state.currentReciter);
                    if (working) {
                        voiceLogger.player(guildId, 'Fallback: switching to working reciter', {
                            newReciter: working,
                        });
                        state.currentReciter = working;
                        state.currentSurah = 1;
                        state.playedOffset = 0;
                        resource = await global.createSurahResource(state, 0, 0, 0, true);
                    } else {
                        const alt = findAvailableSurahForReciter(state, state.currentSurah - 1);
                        if (alt !== -1) {
                            voiceLogger.player(guildId, 'Fallback: using alternative surah', {
                                newIndex: alt + 1,
                            });
                            state.currentSurah = alt + 1;
                            resource = await global.createSurahResource(state, alt, 0, 0, true);
                        }
                    }
                }
            } else if (state.currentRadioUrl) {
                voiceLogger.player(guildId, 'Preparing radio resource', {
                    url: state.currentRadioUrl,
                });
                const activeUrl = global.radioHealthChecker?.getActiveRadioUrl(state.currentRadioUrl) || state.currentRadioUrl;
                state.currentRadioUrl = activeUrl;
                resource = await global.createRadioResource(activeUrl, 0);
                voiceLogger.player(guildId, 'Radio resource created');
            }
            if (resource) {
                state.player.play(resource);
                state.isPaused = false;
                state.pauseReason = null;
                state.errorCount = 0;
                voiceLogger.player(guildId, 'Started playback after idle', {
                    mode: state.playbackMode,
                });
            } else {
                voiceLogger.player(guildId, 'No resource available - playback skipped');
            }
        } catch (error) {
            voiceLogger.error(guildId, 'Idle handler error', error);
            state.errorCount++;
            if (state.errorCount >= MAX_ERROR_COUNT) {
                state.isPaused = true;
                state.pauseReason = 'auto_resume_failed';
                voiceLogger.player(guildId, 'Auto-resume failed - max errors reached', {
                    errorCount: state.errorCount,
                });
            }
        }
        setTimeout(() => {
            idleHandled = false;
            voiceLogger.player(guildId, 'Idle handler reset flag');
        }, 1000);
    });

    player.on('error', async (error) => {
        voiceLogger.error(guildId, 'Player error event', error, {
            status: player.state?.status,
            errorCount: getGuildStateById(guildId)?.errorCount,
        });
        logger.error(`Guild ${guildId} Player Error`, error.message);
        const state = getGuildStateById(guildId);
        if (state) {
            state.errorCount++;
            if (state.errorCount >= MAX_ERROR_COUNT) {
                state.isPaused = true;
                state.pauseReason = 'player_error';
                voiceLogger.player(guildId, 'Player paused due to error threshold', {
                    errorCount: state.errorCount,
                });
            }
            if (!errorRecoveryInProgress) {
                errorRecoveryInProgress = true;
                voiceLogger.player(guildId, 'Starting error recovery');
                try {
                    await new Promise((r) => setTimeout(r, error_recovery_delay_ms));
                    if (state.connection && !state.connection.destroyed) {
                        state.connection.subscribe(state.player);
                        state.player.stop();
                        if (state.playbackMode === 'surah') {
                            const res = await global.createSurahResource(state, state.currentSurah - 1, 0, 0, true);
                            state.player.play(res);
                            state.isPaused = false;
                            state.pauseReason = null;
                            state.errorCount = 0;
                            voiceLogger.player(guildId, 'Recovery: playback resumed');
                        } // TODO consider auto-switching to radio mode if surah playback repeatedly fails and radio is available
                        else if (state.playbackMode === 'radio' && state.currentRadioUrl) {
                            const activeUrl = global.radioHealthChecker?.getActiveRadioUrl(state.currentRadioUrl) || state.currentRadioUrl;
                            state.currentRadioUrl = activeUrl;
                            voiceLogger.player(guildId, 'Recovery: attempting radio stream restart', { url: activeUrl });
                            const radioRes = await global.createRadioResource(activeUrl, 0);
                            state.player.play(radioRes);
                            state.isPaused = false;
                            state.pauseReason = null;
                            state.errorCount = 0;
                            voiceLogger.player(guildId, 'Recovery: radio playback resumed');
                        }
                    } else {
                        voiceLogger.player(guildId, 'Recovery skipped');
                    }
                } catch (recoveryErr) {
                    voiceLogger.error(guildId, 'Error recovery failed', recoveryErr);
                } finally {
                    errorRecoveryInProgress = false;
                    voiceLogger.player(guildId, 'Error recovery flag cleared');
                }
            }
        }
    });

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
    voiceLogger.player(guildId, 'All player event listeners attached');
}
module.exports.createNewPlayer = createNewPlayer;
module.exports.resetPlayer = resetPlayer;
module.exports.stopPlayer = stopPlayer;
module.exports.attachPlayerEvents = attachPlayerEvents;
