require('pathlra-aliaser')();

const { wrapInteraction, safeReply, safeError } = require('@interactions/flow/responder');
const { setupQuranCategory } = require('@commands/setupCommands');
const bootstrap = require('@bot/bootstrap');

module.exports = {
    async execute(interaction) {
        return await wrapInteraction(
            interaction,
            async () => {
                if (!interaction.guild) {
                    await safeError(interaction, 'هذا الأمر يمكن استخدامه فقط داخل السيرفرات وليس في الرسائل الخاصة', 'setup_dm_check');
                    return false;
                }
                const guildId = interaction.guildId;
                const guildState = bootstrap.getGuildState(guildId);
                if (!bootstrap.isAuthorized(interaction, guildState, null)) {
                    await safeError(interaction, 'يجب أن تمتلك صلاحية ادمنستريتر', 'setup_auth_check');
                    return false;
                }
                const botMember = interaction.guild.members.me;
                if (!botMember) {
                    await safeError(interaction, 'حدث خطأ في بيانات البوت يرجى إعادة المحاولة', 'setup_member_check');
                    return false;
                }
                const requiredPermissions = [
                    bootstrap.PermissionsBitField.Flags.ManageChannels,
                    bootstrap.PermissionsBitField.Flags.ManageRoles,
                    bootstrap.PermissionsBitField.Flags.ViewChannel,
                    bootstrap.PermissionsBitField.Flags.Connect,
                    bootstrap.PermissionsBitField.Flags.Speak,
                ];
                const missingPermissions = requiredPermissions.filter((perm) => !botMember.permissions.has(perm));
                if (missingPermissions.length > 0) {
                    await safeError(
                        interaction,
                        'صلاحيات البوت غير كافية لإعداد القنوات ادمن ستريتر مؤقتاً أثناء الإعداد',
                        'setup_perms_check',
                    );
                    return false;
                }
                const isReSetup = !!global.setupGuilds[guildId];
                let channelWillBeDeleted = false;
                let oldSetup = null;
                if (isReSetup) {
                    oldSetup = global.setupGuilds[guildId];
                    const oldChannels = [oldSetup.voiceChannelId, oldSetup.textChannelId, oldSetup.azkarChannelId];
                    channelWillBeDeleted = oldChannels.includes(interaction.channelId);
                    if (channelWillBeDeleted && interaction.channel.type !== bootstrap.ChannelType.GuildText) {
                        await safeError(interaction, 'لا يمكن تشغيل إعداد في قناة صوتية استخدمها في قناة نصية أولاً', 'setup_channel_type');
                        return false;
                    }
                }
                if (channelWillBeDeleted) {
                    await safeReply(
                        interaction,
                        {
                            content:
                                'إعادة إعداد مكتشفة هذه القناة ستحذف قريباً الإعداد مستمر تحقق من الفئة الجديدة quran للوحة التحكم والتأكيد النهائي',
                        },
                        'setup_re_setup_warn',
                    );
                    bootstrap.logger.info(`Guild ${guildId} Re-setup from doomed channel ${interaction.channelId} warned user`);
                } else {
                    await safeReply(interaction, { content: 'جاري إعداد فئة القرآن' }, 'setup_starting');
                }
                const setupResult = await setupQuranCategory(interaction.guild, interaction, {
                    channelWillBeDeleted,
                });
                // If the setup failed, setupQuranCategory will have already sent an error response, so we just return here
                const successEmbed = {
                    embeds: [
                        {
                            color: 0x1e1f22,
                            title: `${isReSetup ? 'إعادة إعداد' : 'إعداد'} فئة القرآن`,
                            description: `تم ${isReSetup ? 'تحديث' : 'إنشاء'} الفئة والقنوات بنجاح`,
                            fields: [
                                {
                                    name: 'الصوتي',
                                    value: `<#${setupResult.voiceChannel.id}>`,
                                    inline: true,
                                },
                                {
                                    name: 'النصي',
                                    value: `<#${setupResult.textChannel.id}>`,
                                    inline: true,
                                },
                                {
                                    name: 'الأذكار',
                                    value: `<#${setupResult.azkarChannel.id}>`,
                                    inline: true,
                                },
                                {
                                    name: 'الفئة',
                                    value: `<#${setupResult.category.id}>`,
                                    inline: true,
                                },
                            ],
                        },
                    ],
                };

                const replyTarget = channelWillBeDeleted ? interaction.guild.systemChannel : interaction.channel;
                if (replyTarget) {
                    await safeReply(
                        { channel: replyTarget },
                        {
                            content: channelWillBeDeleted
                                ? `إعادة إعداد مكتملة من <@${interaction.user.id}> تحقق من قناة التحكم في فئة quran`
                                : null,
                            embeds: successEmbed.embeds,
                        },
                        'setup_success',
                    );
                }
            },
            { ephemeral: true, label: 'setup_command' },
        );
    },
};
