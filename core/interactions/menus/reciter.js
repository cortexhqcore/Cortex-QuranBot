require('pathlra-aliaser')();

const { wrapInteraction, safeError } = require('@deferReply');
const { checkAuthorization, resolveGuildState } = require('@guard');
const { rebuildAndSendControlPanel } = require('@controlPanelBuilder');
const { createSurahResource, getCurrentLinks, findAvailableSurahForReciter } = require('@audioUtils-core_utils');
const logger = require('@logger');
const persistentState = require('@PersistentStateManager-core_state');

module.exports = {
    customId: 'select_reciter',
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const { guildId, guildState } = resolveGuildState(interaction);
                const authorized = await checkAuthorization(interaction, interaction.customId);
                if (!authorized) return;
                // If the user is switching from radio mode to surah mode, we need to stop the radio and prepare for surah playback.
                if (guildState.playbackMode !== 'surah') {
                    guildState.playbackMode = 'surah';
                    guildState.currentRadioIndex = 0;
                    guildState.currentRadioUrl = null;
                }
                // Update the current reciter based on the user's selection
                const selectedReciterKey = interaction.values[0];
                let targetReciter = selectedReciterKey;
                const reciterData = global.reciters[selectedReciterKey];
                if (
                    !reciterData ||
                    !reciterData.links ||
                    reciterData.links.filter((l) => l && l.trim() !== '' && l.startsWith('http')).length === 0
                ) {
                    await safeError(interaction, 'القارئ المحدد غير متاح هذا القارئ لا يملك اي روابط صالحة اختر قارئ اخر');
                    return;
                }
                // If the selected reciter doesn't have a valid link for the current surah, find the next available surah with a valid link for that reciter before updating the state and control panel.
                if (targetReciter !== guildState.currentReciter) {
                    guildState.currentReciter = targetReciter;
                    const validLinks = reciterData.links.filter((l) => l && l.trim() !== '' && l.startsWith('http'));
                    const availableCount = validLinks.length > 0 ? validLinks.length : 114;
                    if (guildState.currentSurah > availableCount) {
                        const fallbackIndex = findAvailableSurahForReciter(guildState, -1);
                        guildState.currentSurah = fallbackIndex !== -1 ? fallbackIndex + 1 : 1;
                    }
                    if (guildState.connection && !guildState.connection.destroyed && guildState.channelId) {
                        if (guildState.player.state.status === 'playing') guildState.player.stop();
                        try {
                            const audioResource = await createSurahResource(guildState, guildState.currentSurah - 1, 0, 0, false);
                            guildState.player.play(audioResource);
                            guildState.isPaused = false;
                            guildState.pauseReason = null;
                            persistentState.updateGuildState(guildId, {
                                currentReciter: guildState.currentReciter,
                                currentSurahIndex: guildState.currentSurah - 1,
                                isPaused: false,
                                pauseReason: null,
                            });
                            await rebuildAndSendControlPanel(interaction, guildState, guildId);
                            return;
                        } catch (err) {
                            logger.error('Error Playing Surah With New Reciter In Guild ' + guildId, err);
                            await safeError(interaction, 'حدث خطأ اثناء تشغيل السورة مع القارئ المحدد');
                            return;
                        }
                    }
                }
                await rebuildAndSendControlPanel(interaction, guildState, guildId);
            },
            { context: { label: 'reciter_menu', logger } },
        );
    },
};
