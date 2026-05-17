require('pathlra-aliaser')();

const { wrapInteraction, safeError } = require('@deferReply');
const { resolveGuildState } = require('@guard');
const { initializeConnection, syncVoiceState } = require('@audio-core');
const { createSurahResource, createRadioResource } = require('@audio-core');
const logger = require('@logger');
const voiceLogger = require('@voiceLogger');
const coreLoader = require('@loader-core_bootstrap');

module.exports = {
    name: 'دخول',
    description: 'الانضمام إلى الروم الصوتي المعد من الاعداد',
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const { guildId, guildState } = resolveGuildState(interaction);
                voiceLogger.connection(guildId, 'Join command executed', {
                    userId: interaction.user.id,
                    channelId: interaction.channelId,
                    guildName: interaction.guild?.name,
                });
                const setupConfig = global.setupGuilds ? global.setupGuilds[guildId] : null;
                if (!setupConfig || !setupConfig.voiceChannelId) {
                    voiceLogger.connection(guildId, 'Join failed - no setup config', {
                        hasSetup: !!setupConfig,
                        voiceChannelId: setupConfig?.voiceChannelId,
                    });
                    await safeError(interaction, 'لم يتم اعداد فئة القرآن بعد استخدم امر الاعداد اولا');
                    return;
                }
                const targetChannelId = setupConfig.voiceChannelId;
                voiceLogger.connection(guildId, 'Fetching target voice channel', {
                    targetChannelId,
                });
                const voiceChannel =
                    interaction.guild.channels.cache.get(targetChannelId) ||
                    (await interaction.guild.channels.fetch(targetChannelId).catch(() => null));
                if (!voiceChannel || voiceChannel.type !== coreLoader.ChannelType.GuildVoice) {
                    voiceLogger.connection(guildId, 'Join failed - invalid channel', {
                        channelFound: !!voiceChannel,
                        channelType: voiceChannel?.type,
                        expectedType: coreLoader.ChannelType.GuildVoice,
                    });
                    await safeError(interaction, 'القناة الصوتية المعدة غير موجودة او غير صالحة يرجى اعادة الاعداد');
                    return;
                }
                const botPerms = voiceChannel.permissionsFor(interaction.guild.members.me);
                if (!botPerms.has(coreLoader.PermissionsBitField.Flags.Connect)) {
                    voiceLogger.connection(guildId, 'Join failed - missing Connect permission', {
                        missingPerms: botPerms.missing([coreLoader.PermissionsBitField.Flags.Connect]),
                    });
                    await safeError(interaction, 'البوت ليس لديه الصلاحيات الكاملة للانضمام الى هذه الغرفة الصوتية');
                    return;
                }
                voiceLogger.connection(guildId, 'Initializing voice connection');
                const joinResult = await initializeConnection(guildId, guildState, voiceChannel, interaction.guild.voiceAdapterCreator);
                if (!joinResult.success) {
                    voiceLogger.error(guildId, 'Connection initialization failed', null, {
                        joinResult,
                    });
                    throw new Error('Connection initialization failed');
                }
                guildState.playbackMode = guildState.playbackMode || 'surah';
                const availableReciters = Object.keys(global.reciters || {});
                guildState.currentReciter = availableReciters[Math.floor(Math.random() * availableReciters.length)];
                guildState.currentSurah = Math.floor(Math.random() * 114) + 1;
                guildState.isPaused = false;
                guildState.pauseReason = null;
                voiceLogger.connection(guildId, 'Preparing playback', {
                    mode: guildState.playbackMode,
                    reciter: guildState.currentReciter,
                    surah: guildState.currentSurah,
                });
                if (guildState.playbackMode === 'surah') {
                    voiceLogger.connection(guildId, 'Creating surah resource for playback');
                    const audioResource = await createSurahResource(guildState, guildState.currentSurah - 1);
                    guildState.player.play(audioResource);
                    voiceLogger.connection(guildId, 'Started surah playback');
                } else if (guildState.currentRadioUrl) {
                    voiceLogger.connection(guildId, 'Creating radio resource for playback', {
                        url: guildState.currentRadioUrl,
                    });
                    const streamUrl =
                        global.radioHealthChecker?.getActiveRadioUrl(guildState.currentRadioUrl) || guildState.currentRadioUrl;
                    const radioResource = await createRadioResource(streamUrl);
                    guildState.player.play(radioResource);
                    guildState.currentRadioUrl = streamUrl;
                    voiceLogger.connection(guildId, 'Started radio playback');
                }
                await syncVoiceState(guildId, guildState);
                voiceLogger.connection(guildId, 'Voice state synced after join');
                await interaction.editReply({
                    content: 'تم الانضمام الى ' + voiceChannel.name + ' جاري التشغيل',
                    flags: 64,
                });
                voiceLogger.connection(guildId, 'Join command completed successfully');
            },
            { context: { label: 'join_command', logger } },
        );
    },
};
