require('pathlra-aliaser')();

const logger = require('@logger');
const voiceLogger = require('@voiceLogger');
const { ChannelType } = require('discord.js');
// const { AudioPlayerStatus } = require('@discordjs/voice');
const { getGuildStateById } = require('@guild-state-store-core_state');
const persistentStateManager = require('@PersistentStateManager-core_state');
const { initializeConnection, syncVoiceState } = require('@audio-core');

async function recoverVoiceConnection(guild, fixedSetupData, guildId) {
    voiceLogger.recovery(guildId, 'Starting voice recovery', {
        voiceChannelId: fixedSetupData?.voiceChannelId,
        hasSetupData: !!fixedSetupData,
    });
    if (!fixedSetupData.voiceChannelId) {
        voiceLogger.recovery(guildId, 'Recovery skipped no voice channel ID in setup');
        return;
    }
    let targetVoiceChannel = null;
    try {
        voiceLogger.recovery(guildId, 'Fetching target voice channel', {
            channelId: fixedSetupData.voiceChannelId,
        });
        targetVoiceChannel =
            guild.channels.cache.get(fixedSetupData.voiceChannelId) ||
            (await guild.channels.fetch(fixedSetupData.voiceChannelId).catch(() => null));
    } catch (error) {
        voiceLogger.recovery(guildId, 'Failed to fetch voice channel', {
            channelId: fixedSetupData.voiceChannelId,
            error: error.message,
        });
        logger.info(`Guild ${guildId} Voice Channel ${fixedSetupData.voiceChannelId} Not Accessible`);
    }
    if (targetVoiceChannel && targetVoiceChannel.type === ChannelType.GuildVoice) {
        voiceLogger.recovery(guildId, 'Target voice channel found', {
            channelId: targetVoiceChannel.id,
            channelName: targetVoiceChannel.name,
        });
        const guildState = getGuildStateById(guildId);
        const storedState = persistentStateManager.getGuildState(guildId);
        const wasManuallyDisconnected = storedState?.manualDisconnectFlag;
        const playerNeedsInit =
            !guildState?.player || typeof guildState.player.destroy === 'function' || typeof guildState.player.play !== 'function';
        if (playerNeedsInit) {
            if (!wasManuallyDisconnected && storedState?.connectionStatus === true) {
                voiceLogger.recovery(guildId, 'Attempting voice reconnection', {
                    manualDisconnect: wasManuallyDisconnected,
                    hasGuildState: !!guildState,
                    connectionStatus: storedState?.connectionStatus,
                });
                try {
                    await initializeConnection(guildId, guildState, targetVoiceChannel, guild.voiceAdapterCreator);
                    voiceLogger.recovery(guildId, 'Voice connection re-established');
                    guildState.playbackMode = storedState?.playbackMode || 'surah';
                    guildState.isPaused = false;
                    const availableReciters = Object.keys(global.reciters || {});
                    guildState.currentReciter =
                        storedState?.currentReciter || availableReciters[Math.floor(Math.random() * availableReciters.length)];
                    guildState.currentSurah = (storedState?.currentSurahIndex || 0) + 1;
                    guildState.playedOffset = storedState?.playedOffset || 0;
                    guildState.playbackStartTime = Date.now();
                    guildState.lastActivity = Date.now();
                    guildState.currentRadioIndex = storedState?.currentRadioIndex ?? 0;
                    guildState.currentRadioUrl = storedState?.currentRadioUrl ?? null;
                    voiceLogger.recovery(guildId, 'Restored playback state', {
                        mode: guildState.playbackMode,
                        reciter: guildState.currentReciter,
                        surah: guildState.currentSurah,
                    });
                    try {
                        let trackToPlay = null;
                        if (guildState.playbackMode === 'surah') {
                            trackToPlay = await global.createSurahResource(guildState, guildState.currentSurah - 1);
                        } else if (guildState.playbackMode === 'radio') {
                            if (!guildState.currentRadioUrl && global.quranRadios?.length > 0) {
                                guildState.currentRadioIndex = 0;
                                guildState.currentRadioUrl = global.quranRadios[0].url;
                            }
                            if (guildState.currentRadioUrl) {
                                trackToPlay = await global.createRadioResource(guildState.currentRadioUrl);
                            }
                            if (!trackToPlay) {
                                voiceLogger.warn(guildId, 'Radio resource failed during recovery, falling back to surah');
                                guildState.playbackMode = 'surah';
                                trackToPlay = await global.createSurahResource(guildState, guildState.currentSurah - 1);
                            }
                        }
                        if (trackToPlay) {
                            guildState.player.play({ track: trackToPlay });
                            guildState.isPaused = false;
                            guildState.pauseReason = null;
                            voiceLogger.recovery(guildId, 'Started playback after recovery');
                            await new Promise((resolve) => setTimeout(resolve, 3000));
                            if (guildState.player.state?.status === 'idle') {
                                voiceLogger.recovery(guildId, 'Player idle after recovery - retrying');
                                const retryResource = await global.createSurahResource(guildState, guildState.currentSurah - 1);
                                if (retryResource) {
                                    guildState.player.play({ track: retryResource });
                                }
                                voiceLogger.recovery(guildId, 'Playback retry completed');
                            }
                        }
                    } catch (playbackError) {
                        voiceLogger.error(guildId, 'Failed to start playback after recovery', playbackError);
                        logger.error(`Failed To Start Playback For Guild ${guildId}`, playbackError);
                        guildState.isPaused = true;
                    }
                    storedState.connectionStatus = true;
                    storedState.voiceChannelId = targetVoiceChannel.id;
                    persistentStateManager.updateGuildState(guildId, storedState);
                    await syncVoiceState(guildId, guildState);
                    voiceLogger.recovery(guildId, 'Voice recovery completed successfully');
                } catch (connectionError) {
                    voiceLogger.error(guildId, 'Failed to reconnect voice channel', connectionError);
                    logger.error(`Failed To Connect To Voice Channel For Guild ${guildId}`, connectionError);
                }
            } else {
                voiceLogger.recovery(guildId, 'Skipping recovery', {
                    reason: wasManuallyDisconnected ? 'manual disconnect flag set' : 'connectionStatus not true',
                    manualDisconnect: wasManuallyDisconnected,
                    connectionStatus: storedState?.connectionStatus,
                });
                logger.info(
                    `Skipping Voice Connection For Guild ${guildId}: manualDisconnect=${wasManuallyDisconnected}, connectionStatus=${storedState?.connectionStatus}`,
                );
            }
        } else {
            voiceLogger.recovery(guildId, 'Connection already active - checking playback state', {
                playerStatus: guildState.player?.state?.status,
            });
            logger.info(`Guild ${guildId} Has Valid Player Connection`);
            if (guildState.player.paused) {
                try {
                    const audioResource = await global.createSurahResource(guildState, guildState.currentSurah - 1);
                    if (audioResource) {
                        guildState.player.play({ track: audioResource });
                    }
                    guildState.isPaused = false;
                    guildState.pauseReason = null;
                    voiceLogger.recovery(guildId, 'Started playback for idle player');
                } catch (playbackError) {
                    voiceLogger.error(guildId, 'Playback start failed for active connection', playbackError);
                    logger.error(`Guild ${guildId} Playback Start Failed`, playbackError);
                }
            }
        }
    } else {
        voiceLogger.recovery(guildId, 'Voice channel not found or invalid type', {
            channelFound: !!targetVoiceChannel,
            channelType: targetVoiceChannel?.type,
            expectedType: ChannelType.GuildVoice,
        });
        logger.info(`Guild ${guildId} Voice Channel Not Found Or Invalid Type Skipping`);
        const guildState = getGuildStateById(guildId);
        const storedState = persistentStateManager.getGuildState(guildId);
        if (guildState) guildState.channelId = null;
        if (storedState) storedState.voiceChannelId = null;
    }
}

module.exports.recoverVoiceConnection = recoverVoiceConnection;
