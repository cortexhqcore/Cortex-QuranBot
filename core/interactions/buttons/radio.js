require('pathlra-aliaser')();

const { wrapInteraction, safeError } = require('@deferReply');
const { checkAuthorization, resolveGuildState } = require('@guard');
const { rebuildAndSendControlPanel } = require('@controlPanelBuilder');
const { createRadioResource, createSurahResource, stopPlayer } = require('@audio-core');
const logger = require('@logger');

module.exports = {
    customId: 'radio',
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const { guildId, guildState } = resolveGuildState(interaction);
                const authorized = await checkAuthorization(interaction, interaction.customId);
                if (!authorized) return;

                if (interaction.customId === 'toggle_radio') {
                    /**
                    if (guildState.player.state.status === 'playing') stopPlayer(guildState);
                    if (guildState.playbackMode === 'surah') {
                        guildState.playbackMode = 'radio';
                        guildState.currentRadioIndex = guildState.currentRadioIndex ?? 0;
                        guildState.currentRadioUrl = global.quranRadios[guildState.currentRadioIndex]?.url ?? global.quranRadios[0]?.url;
                        guildState.currentRadioPage = Math.floor(guildState.currentRadioIndex / 25);

                        if (guildState.currentRadioUrl) {
                            const radioUrl = guildState.currentRadioUrl;
                            if (!radioUrl) {
                                guildState.playbackMode = 'surah';
                                const surahAudio = await createSurahResource(guildState, guildState.currentSurah - 1);
                                guildState.player.play(surahAudio);
                            } else {
                                const radioAudio = await createRadioResource(radioUrl);
                                guildState.player.play(radioAudio);
                  **/
                    try {
                        if (guildState.player && !guildState.player.destroyed) {
                            guildState.player.stopPlaying();
                        }
                        if (guildState.playbackMode === 'surah') {
                            guildState.playbackMode = 'radio';
                            guildState.currentRadioIndex = guildState.currentRadioIndex ?? 0;
                            if (!global.quranRadios || global.quranRadios.length === 0) {
                                throw new Error('No radio stations loaded');
                            }
                            guildState.currentRadioUrl =
                                global.quranRadios[guildState.currentRadioIndex]?.url ?? global.quranRadios[0]?.url;
                            const radioTrack = await createRadioResource(guildState.currentRadioUrl);
                            if (!radioTrack) throw new Error('Failed to fetch radio track');
                            guildState.player.play({ track: radioTrack });
                        } else {
                            guildState.playbackMode = 'surah';
                            guildState.currentRadioUrl = null;
                            if (guildState.currentSurah < 1 || guildState.currentSurah > 114) {
                                guildState.currentSurah = 1;
                            }
                            const surahTrack = await createSurahResource(guildState, guildState.currentSurah - 1);
                            if (!surahTrack) throw new Error('Failed to fetch surah track');
                            guildState.player.play({ track: surahTrack });
                        }

                        guildState.isPaused = false;
                        guildState.pauseReason = null;
                        if (typeof global.saveRuntimeStates === 'function') await global.saveRuntimeStates();
                        await rebuildAndSendControlPanel(interaction, guildState, guildId);
                    } catch (err) {
                        logger.error('Toggle Radio Playback Error', err);
                        guildState.playbackMode = 'surah';
                        guildState.currentRadioUrl = null;
                        guildState.isPaused = false;
                        guildState.pauseReason = null;
                        if (typeof global.saveRuntimeStates === 'function') await global.saveRuntimeStates();
                        await rebuildAndSendControlPanel(interaction, guildState, guildId);
                    }
                } else if (interaction.customId === 'prev_radio_page' || interaction.customId === 'next_radio_page') {
                    if (guildState.playbackMode !== 'radio') {
                        return await safeError(interaction, 'تصفح صفحات الراديو غير متاح في وضع السور');
                    }
                    const totalRadioPages = Math.ceil(global.quranRadios.length / 25);
                    const currentPage = guildState.currentRadioPage || 0;
                    if (interaction.customId === 'prev_radio_page' && currentPage > 0) {
                        guildState.currentRadioPage = currentPage - 1;
                    } else if (interaction.customId === 'next_radio_page' && currentPage < totalRadioPages - 1) {
                        guildState.currentRadioPage = currentPage + 1;
                    }
                    guildState.currentRadioIndex = guildState.currentRadioPage * 25;
                    global.saveRuntimeStates();
                }

                await rebuildAndSendControlPanel(interaction, guildState, guildId);
            },
            { context: { label: 'radio_button', logger } },
        );
    },
};
