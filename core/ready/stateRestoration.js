require('pathlra-aliaser')();

const logger = require('@logger');
const { AudioPlayerStatus } = require('@discordjs/voice');
const { getGuildState } = require('../state/GuildStateManager');
const persistentStateManager = require('@PersistentStateManager-core_state');
const voiceManager = require('@voice-connection');
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
                const storedState = allStoredStates[guildId];
                const restoreResult = await persistentStateManager.restoreGuildState(guildId, client);
                if (restoreResult.success) {
                    const guildState = getGuildState(guildId);
                    if (!guildState) {
                        logger.warn('Guild ' + guildId + ' State Not Found Skipping Restoration');
                        failureCount++;
                    } else if (!guildState.connection || guildState.connection.destroyed) {
                        try {
                            await voiceManager.initializeConnection(
                                guildId,
                                guildState,
                                restoreResult.channel,
                                restoreResult.channel.guild.voiceAdapterCreator,
                            );
                            guildState.currentReciter = storedState.currentReciter;
                            guildState.currentSurah = storedState.currentSurahIndex + 1;
                            guildState.playbackMode = storedState.playbackMode;
                            guildState.currentRadioIndex = storedState.currentRadioIndex;
                            guildState.isPaused = false;
                            guildState.playedOffset = storedState.playedOffset || 0;
                            logger.info(`Guild ${guildId} Connection Subscribed On Restore`);
                            if (storedState.playbackMode === 'surah') {
                                try {
                                    const audioResource = await global.createSurahResource(guildState, storedState.currentSurahIndex, 0);
                                    guildState.player.play(audioResource);
                                    guildState.isPaused = false;
                                    guildState.playbackStartTime = Date.now();
                                    await new Promise((resolve) => setTimeout(resolve, 3000));
                                    if (guildState.player.state.status === AudioPlayerStatus.Idle) {
                                        logger.warn(`Guild ${guildId} Player Idle After Restore Retrying`);
                                        const retryResource = await global.createSurahResource(
                                            guildState,
                                            storedState.currentSurahIndex,
                                            0,
                                        );
                                        guildState.player.play(retryResource);
                                    }
                                    logger.info(`Started Playback On Restore For Guild ${guildId}`);
                                } catch (surahError) {
                                    logger.warn(`Failed To Play Surah On Restore For Guild ${guildId}`, surahError);
                                    guildState.isPaused = true;
                                }
                            }
                            persistentStateManager.setManualDisconnect(guildId, false);
                            await voiceManager.syncVoiceState(guildId, guildState);
                            successCount++;
                            logger.info(`Restored Voice Connection For Guild ${guildId}`);
                        } catch (connectionError) {
                            failureCount++;
                            logger.error(`Failed To Restore Voice Connection For Guild ${guildId}`, connectionError);
                        }
                    } else {
                        logger.info(`Guild ${guildId} Already Has Active Connection Skipping`);
                        if (guildState.player.state.status === AudioPlayerStatus.Idle) {
                            logger.info(`Guild ${guildId} Connection Exists But Player Idle Starting Playback`);
                            try {
                                if (storedState.playbackMode === 'surah') {
                                    const audioResource = await global.createSurahResource(guildState, storedState.currentSurahIndex, 0);
                                    guildState.player.play(audioResource);
                                    guildState.isPaused = false;
                                }
                            } catch (playbackError) {
                                logger.error(`Guild ${guildId} Playback Start Failed`, playbackError);
                            }
                        }
                        guildState.connection.subscribe(guildState.player);
                    }
                } else {
                    failureCount++;
                    logger.info(`Skipped Restoration For Guild ${guildId} ${restoreResult.reason}`);
                }
                if (successCount + failureCount === guildsToRestore.length) {
                    logger.info(`State Restoration Complete ${successCount} Restored ${failureCount} Failed Or Skipped`);
                    restorationActive = false;
                }
            }, index * 500);
        }
    }
}
module.exports.restoreGuildStates = restoreGuildStates;
