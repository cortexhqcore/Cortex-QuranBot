require('pathlra-aliaser')();

const { wrapInteraction, safeError, safeReply } = require('@responder');
const voiceManager = require('@voice-connection');
const core = require('@loader-core_bootstrap');
const logger = require('@logger');
const { createStandardEmbed } = require('@embedFactory');

module.exports = {
    name: 'دخول_قناة',
    description: 'الانضمام إلى غرفة صوتية محددة',
    options: [
        {
            name: 'قناة',
            description: 'اختر الغرفة الصوتية',
            type: 7,
            required: true,
            channel_types: [2],
        },
    ],
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const guildId = interaction.guildId;
                const guildState = core.getGuildState(guildId);
                if (!core.isAuthorized(interaction, guildState, null)) {
                    await safeError(interaction, 'لازم يكون معاك اكسس ادمنستريتر', 'join_channel_auth');
                    return;
                }
                const targetChannel = interaction.options.getChannel('قناة');
                if (!targetChannel || targetChannel.type !== core.ChannelType.GuildVoice) {
                    await safeError(interaction, 'يرجى اختيار غرفة صوتية صالحة', 'join_channel_validation');
                    return;
                }
                const botPerms = targetChannel.permissionsFor(interaction.guild.members.me);
                if (!botPerms.has(core.PermissionsBitField.Flags.Connect)) {
                    await safeError(
                        interaction,
                        'البوت ليس لديه الصلاحيات الكاملة للانضمام إلى هذه الغرفة الصوتية يرجى التحقق من الصلاحيات',
                        'join_channel_perms',
                    );
                    return;
                }

                // Replaced inline teardown & connection join with centralized voiceManager
                await voiceManager.initializeConnection(guildId, guildState, targetChannel, interaction.guild.voiceAdapterCreator);
                guildState.isPaused = false;
                guildState.pauseReason = null;
                guildState.playbackMode = guildState.playbackMode || 'surah';
                const reciterList = Object.keys(global.reciters || {});
                const chosenReciter = reciterList[Math.floor(Math.random() * reciterList.length)];
                guildState.currentReciter = chosenReciter;
                guildState.currentSurah = Math.floor(Math.random() * 114) + 1;
                if (guildState.playbackMode === 'surah') {
                    core.logger.info(`Guild ${guildId} Playing surah ${guildState.currentSurah} with reciter ${guildState.currentReciter}`);
                    const surahResource = await core.createSurahResource(guildState, guildState.currentSurah - 1);
                    guildState.player.play(surahResource);
                } else if (guildState.currentRadioUrl) {
                    const streamEndpoint =
                        global.radioHealthChecker?.getActiveRadioUrl(guildState.currentRadioUrl) || guildState.currentRadioUrl;
                    core.logger.info(`Guild ${guildId} Playing radio stream ${streamEndpoint}`);
                    const radioResource = await core.createRadioResource(streamEndpoint);
                    guildState.player.play(radioResource);
                    guildState.currentRadioUrl = streamEndpoint;
                }
                guildState.isPaused = false;
                guildState.pauseReason = null;

                // Replaced inline persistent state sync with centralized voiceManager.syncVoiceState
                await voiceManager.syncVoiceState(guildId, guildState);

                // Replaced object literal with factory
                const responseEmbed = createStandardEmbed()
                    .setTitle(`تم الانضمام إلى ${targetChannel.name}`)
                    .setDescription('جاري تشغيل سورة عشوائية بقارئ عشوائي استخدم تحكم لعرض لوحة التحكم');

                await safeReply(interaction, { embeds: [responseEmbed] }, 'join_channel_success');
                core.logger.info(`Guild ${guildId} joined channel ${targetChannel.id}`);
            },
            { ephemeral: true, label: 'join_channel_command' },
        );
    },
};
