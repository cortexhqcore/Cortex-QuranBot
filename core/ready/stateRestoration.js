require('pathlra-aliaser')();

const logger = require('@logger');
// const { AudioPlayerStatus } = require('@discordjs/voice');
const { getGuildState } = require('../state/GuildStateManager');
const persistentStateManager = require('@PersistentStateManager-core_state');
// const voiceManager = require('@voice-connection');
const { initializeConnection, syncVoiceState, createSurahResource, createRadioResource } = require('@audio-core');
let restorationActive = false;

async function restoreGuildStates(client, activeGuildIds) {
    const allStoredStates = persistentStateManager.getAllStates();
    logger.info(`Attempting To Restore ${Object.keys(allStoredStates).length} Guild States From Persistent State Manager`);
    const guildsToRestore = Object.keys(allStoredStates).filter((gid) => activeGuildIds.has(gid));
    logger.info(`Will Restore States For ${guildsToRestore.length} Guilds Bot Is Actually In`);
    if (!restorationActive && guildsToRestore.length > 0) {
        restorationActive = true;
        let successCount = 0;
        let failureCount = 0;
        for (let index = 0; index < guildsToRestore.length; index++) {
            const guildId = guildsToRestore[index];
            setTimeout(async () => {
                try {
                    const storedState = allStoredStates[guildId];
                    const guildState = getGuildState(guildId);
                    if (!guildState) {
                        logger.warn('Guild ' + guildId + ' State Not Found Skipping Restoration');
                        failureCount++;
                        return;
                    }
                    const isConnected = guildState.player && !guildState.player.destroyed && guildState.channelId;
                    if (!isConnected) {
                        const restoreResult = await persistentStateManager.restoreGuildState(guildId, client);
                        if (!restoreResult.success || !restoreResult.channel) {
                            logger.info(`Skipped Restoration For Guild ${guildId}: ${restoreResult.reason}`);
                            failureCount++;
                            return;
                        }
                        logger.info(`Guild ${guildId} Re-establishing Lavalink Connection...`);
                        const joinResult = await initializeConnection(
                            guildId,
                            guildState,
                            restoreResult.channel,
                            restoreResult.channel.guild.voiceAdapterCreator,
                        );
                        if (!joinResult.success) {
                            logger.error(`Failed To Re-connect Guild ${guildId}`);
                            failureCount++;
                            return;
                        }
                        logger.info(`Guild ${guildId} Connection Re-established`);
                    }
                    guildState.currentReciter = storedState.currentReciter;
                    guildState.currentSurah = storedState.currentSurahIndex + 1;
                    guildState.playbackMode = storedState.playbackMode;
                    guildState.currentRadioIndex = storedState.currentRadioIndex;
                    guildState.currentRadioUrl = storedState.currentRadioUrl;
                    guildState.isPaused = false;
                    guildState.playedOffset = storedState.playedOffset || 0;
                    persistentStateManager.setManualDisconnect(guildId, false);
                    await syncVoiceState(guildId, guildState);
                    if (guildState.playbackMode === 'surah') {
                        try {
                            const audioResource = await createSurahResource(guildState, guildState.currentSurah - 1);
                            if (audioResource) {
                                guildState.player.play({ track: audioResource });
                                guildState.isPaused = false;
                                guildState.playbackStartTime = Date.now();
                                logger.info(`Started Surah Playback On Restore For Guild ${guildId}`);
                            }
                        } catch (surahError) {
                            logger.warn(`Failed To Play Surah On Restore For Guild ${guildId}`, surahError);
                            guildState.isPaused = true;
                        }
                    } else if (guildState.playbackMode === 'radio' && guildState.currentRadioUrl) {
                        try {
                            if (guildState.player.state.status === AudioPlayerStatus.Idle) {
                                logger.warn(`Guild ${guildId} Player Idle After Restore Retrying`);
                                const retryResource = await global.createSurahResource(guildState, storedState.currentSurahIndex, 0);
                                guildState.player.play(retryResource);
                            }
                            logger.info(`Started Playback On Restore For Guild ${guildId}`);
                        } catch (radioError) {
                            logger.warn(`Failed To Play Radio On Restore For Guild ${guildId}`, radioError);
                            guildState.isPaused = true;
                        }
                    }
                    successCount++;
                    logger.info(`Restored State For Guild ${guildId} Successfully`);
                } catch (error) {
                    failureCount++;
                    logger.error(`Error Restoring Guild ${guildId}`, error);
                } finally {
                    if (successCount + failureCount === guildsToRestore.length) {
                        logger.info(`State Restoration Complete ${successCount} Restored ${failureCount} Failed Or Skipped`);
                        restorationActive = false;
                    }
                }
            }, index * 1000);
        }
    }
}
module.exports.restoreGuildStates = restoreGuildStates;
