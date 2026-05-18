require('pathlra-aliaser')();

const { getGuildState, isAuthorized } = require('../../state/GuildStateManager');
const { createRadioResource, createSurahResource } = require('@audioUtils-core_utils');
const { createControlEmbed } = require('@embeds-core_ui');
const { createRadioRow, createButtonRow, createNavigationRow } = require('@components-core_ui');
const { updateControlMessage, saveControlId } = require('@messageUpdater');
const logger = require('@logger');

module.exports = {
    customId: 'select_radio',

    async execute(interaction) {
        const guildId = interaction.guildId;
        const guildState = getGuildState(guildId);

        // Verify user has permission to change radio stations
        if (!isAuthorized(interaction, guildState, interaction.customId)) {
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate();
                }
                return interaction.editReply({
                    content:
                        guildState.controlMode === 'everyone'
                            ? 'هذا الإجراء غير متاح للأعضاء العاديين في وضع الجميع فقط التنقل بين السور واختيار القارئ متاح مع تأخير 90 ثانية الأدمنز لديهم تحكم كامل'
                            : 'تتطلب هذه العملية امتلاك صلاحيات المسؤول (Administrator)',
                    flags: 64,
                });
            } catch (err) {
                logger.error('Error Sending Permission Error', err);
                return;
            }
        }

        try {
            // Defer interaction if not already done
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }

            // Ensure radio selection is only processed in radio mode
            if (guildState.playbackMode !== 'radio') {
                logger.warn('Radio Menu Accessed In Surah Mode Guild ' + guildId + ' Mode ' + guildState.playbackMode);
                return interaction.editReply({
                    content: 'اختيار الراديو غير متاح في وضع السور',
                    flags: 64,
                });
            }

            // Parse selected radio index from dropdown value
            const selectedValue = interaction.values[0];
            const radioIndex = parseInt(selectedValue);

            if (radioIndex >= 0 && radioIndex < global.quranRadios.length) {
                guildState.currentRadioIndex = radioIndex;
                guildState.currentRadioUrl = global.quranRadios[radioIndex].url;

                // Use the radio URL directly without health check validation
                const radioUrl = guildState.currentRadioUrl;
                /**
                  if (!radioUrl) {
                     // Fallback to surah mode if radio URL is invalid
                     guildState.playbackMode = 'surah';
                     const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                     guildState.player.play(surahAudio);
                     guildState.isPaused = false;
                     guildState.pauseReason = null;
                  }
               **/
                if (!radioUrl) {
                    // Fallback to surah mode if radio URL is invalid
                    guildState.playbackMode = 'surah';
                    const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                    if (surahAudio) guildState.player.play({ track: surahAudio });
                } else {
                    try {
                        guildState.player.stopPlaying();
                        const radioAudio = await createRadioResource(radioUrl);
                        if (radioAudio) {
                            guildState.player.play({ track: radioAudio });
                            guildState.isPaused = false;
                            guildState.pauseReason = null;
                        }
                    } catch (radioErr) {
                        logger.warn(`Radio Stream Failed Guild ${guildId}: ${radioErr.message}`);
                        const fallbackRadio = global.quranRadios.find((r) => r.url && r.url !== radioUrl);
                        if (fallbackRadio?.url) {
                            try {
                                const fallbackAudio = await createRadioResource(fallbackRadio.url);
                                guildState.currentRadioUrl = fallbackRadio.url;
                                guildState.currentRadioIndex = global.quranRadios.indexOf(fallbackRadio);
                                guildState.player.play({ track: fallbackAudio });
                            } catch (fallbackErr) {
                                logger.warn('Fallback Radio Also Failed Switching To Surah Mode');
                                guildState.playbackMode = 'surah';

                                const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                                if (surahAudio) guildState.player.play({ track: surahAudio });
                            }
                        } else {
                            guildState.playbackMode = 'surah';
                            const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                            if (surahAudio) guildState.player.play({ track: surahAudio });
                        }
                    }
                }

                await global.saveRuntimeStates();
            }
            const refreshedEmbed = createControlEmbed(guildState, guildId);
            const uiComponents = [];

            uiComponents.push(createRadioRow(guildState));
            uiComponents.push(createButtonRow(guildState));
            uiComponents.push(...createNavigationRow(guildState, guildId));

            await updateControlMessage(interaction, refreshedEmbed, uiComponents);
            await saveControlId(guildId, interaction.channelId, interaction.message.id);
        } catch (error) {
            logger.error('Error' + guildId, error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferUpdate();
                }
                await interaction.editReply({
                    content: 'حدث خطأ',
                    flags: 64,
                });
            } catch (replyErr) {
                logger.error('Error Sending Error Reply', replyErr);
            }
        }
    },
};

/** ?
            if (radioIndex >= 0 && radioIndex < global.quranRadios.length) {
                guildState.currentRadioIndex = radioIndex;
                guildState.currentRadioUrl = global.quranRadios[radioIndex].url;

                // Use the radio URL directly without health check validation
                const radioUrl = guildState.currentRadioUrl;

                if (!radioUrl) {
                    // Fallback to surah mode if radio URL is invalid
                    guildState.playbackMode = 'surah';
                    const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                    guildState.player.play(surahAudio);
                    guildState.isPaused = false;
                    guildState.pauseReason = null;
                } else {
                    try {
                        // Attempt to play the selected radio stream
                        const radioAudio = await createRadioResource(radioUrl);
                        guildState.player.stop();
                        guildState.player.play(radioAudio);
                        guildState.isPaused = false;
                        guildState.pauseReason = null;
                    } catch (radioErr) {
                        logger.warn('Radio Stream Failed Trying Fallback Radio', radioErr);

                        // Try fallback to first available radio if primary fails
                        if (global.quranRadios && global.quranRadios.length > 0) {
                            const fallbackRadio = global.quranRadios.find((r) => r.url && r.url !== guildState.currentRadioUrl);
                            if (fallbackRadio?.url) {
                                try {
                                    const fallbackAudio = await createRadioResource(fallbackRadio.url);
                                    guildState.currentRadioUrl = fallbackRadio.url;
                                    guildState.player.stop();
                                    guildState.player.play(fallbackAudio);
                                    guildState.isPaused = false;
                                    guildState.pauseReason = null;
                                } catch (fallbackErr) {
                                    logger.warn('Fallback Radio Also Failed Switching To Surah Mode', fallbackErr);
                                    // Final fallback to surah mode
                                    guildState.playbackMode = 'surah';
                                    const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                                    // Stop any existing playback before switching to surah mode
                                    guildState.player.play(surahAudio);
                                    guildState.isPaused = false;
                                    guildState.pauseReason = null;
                                }
                            } else {
                                // No fallback available - switch to surah mode
                                guildState.playbackMode = 'surah';
                                const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                                guildState.player.play(surahAudio);
                                guildState.isPaused = false;
                                guildState.pauseReason = null;
                            }
                        } else {
                            // No fallback available - switch to surah mode
                            guildState.playbackMode = 'surah';
                            const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                            guildState.player.play(surahAudio);
                            guildState.isPaused = false;
                            guildState.pauseReason = null;
                        }
                    }
                }

                // Persist state changes
                await global.saveRuntimeStates();
            }
**/
