require('pathlra-aliaser')();

const { wrapInteraction, safeError } = require('@deferReply');
const { checkAuthorization, resolveGuildState } = require('@guard');
const { rebuildAndSendControlPanel } = require('@controlPanelBuilder');
const { createSurahResource, createRadioResource, stopPlayer } = require('@audio-core');
const logger = require('@logger');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    customId: 'playback',
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const { guildId, guildState } = resolveGuildState(interaction);
                const authorized = await checkAuthorization(interaction, interaction.customId);
                if (!authorized) return;

                if (!guildState || !guildState.player) {
                    await safeError(interaction, 'حدث خطأ في حالة التشغيل يرجى استخدام زر الخروج ثم الدخول مرة اخرى');
                    return;
                }
                if (!guildState.connection || guildState.connection.destroyed) {
                    await safeError(interaction, 'الاتصال الصوتي غير متوفر');
                    return;
                }
                if (!guildState.channelId) {
                    await safeError(interaction, 'معرف القناة مفقود');
                    return;
                }

                const currentStatus = guildState.player.state.status;
                if (currentStatus === AudioPlayerStatus.AutoPaused) {
                    guildState.player.unpause();
                }
                guildState.connection.subscribe(guildState.player);

                if (interaction.customId === 'next' && guildState.playbackMode !== 'surah') {
                    await safeError(interaction, 'السورة التالية غير متاحة في وضع الراديو');
                    return;
                }
                if (interaction.customId === 'prev' && guildState.playbackMode !== 'surah') {
                    await safeError(interaction, 'السورة السابقة غير متاحة في وضع الراديو');
                    return;
                }

                let targetSurah = guildState.currentSurah;
                if (interaction.customId === 'next') {
                    targetSurah = guildState.currentSurah < global.surahNames.length ? guildState.currentSurah + 1 : 1;
                    guildState.currentSurah = targetSurah;
                } else if (interaction.customId === 'prev') {
                    targetSurah = guildState.currentSurah > 1 ? guildState.currentSurah - 1 : global.surahNames.length;
                    guildState.currentSurah = targetSurah;
                } else if (interaction.customId === 'pause' && currentStatus === 'playing') {
                    guildState.player.pause();
                    guildState.isPaused = true;
                    guildState.pauseReason = 'manual';
                    guildState.lastActivity = Date.now();
                    global.saveRuntimeStates();
                    await rebuildAndSendControlPanel(interaction, guildState, guildId);
                    return;
                } else if (interaction.customId === 'resume' && (currentStatus === 'paused' || currentStatus === 'idle')) {
                    let audioResource;
                    if (guildState.playbackMode === 'surah') {
                        audioResource = await createSurahResource(guildState, guildState.currentSurah - 1);
                    } else if (guildState.currentRadioUrl) {
                        const validatedUrl =
                            global.radioHealthChecker?.getActiveRadioUrl(guildState.currentRadioUrl) || guildState.currentRadioUrl;
                        audioResource = await createRadioResource(validatedUrl);
                    }
                    if (audioResource) {
                        guildState.player.play(audioResource);
                        guildState.isPaused = false;
                        guildState.pauseReason = null;
                        guildState.lastActivity = Date.now();
                        global.saveRuntimeStates();
                    }
                    await rebuildAndSendControlPanel(interaction, guildState, guildId);
                    return;
                }

                if (interaction.customId === 'next' || interaction.customId === 'prev') {
                    guildState.player.stop();
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    const audioResource = await createSurahResource(guildState, guildState.currentSurah - 1);
                    guildState.player.play(audioResource);
                    guildState.isPaused = false;
                    guildState.pauseReason = null;
                    guildState.lastActivity = Date.now();
                    global.saveRuntimeStates();
                }

                await rebuildAndSendControlPanel(interaction, guildState, guildId);
            },
            { context: { label: 'playback_button', logger } },
        );
    },
};
