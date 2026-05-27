require('pathlra-aliaser')();

const { wrapInteraction, safeReply } = require('@interactions/flow/responder');
const { createStandardEmbed } = require('@ui/embedFactory');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { emoji, gif } = require('@helpers/emojis');

const link = {
    website: 'https://cortex-quranbot.pages.dev/',
    github: 'https://github.com/cortexhqcore/Cortex-QuranBot',
    support: 'https://discord.gg/DwtAPzrbZS',
    invite: 'https://discord.com/oauth2/authorize?client_id=1505646575962292314&permissions=8&integration_type=0&scope=bot+applications.commands',
    privacy: 'https://cortex-quranbot.pages.dev/site/privacy',
    terms: 'https://cortex-quranbot.pages.dev/site/terms',
    topgg: 'https://top.gg/bot/1436018817988825138',
};

module.exports = {
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const embed = createStandardEmbed()
                    .setTitle(`${emoji.link} روابط البوت`)
                    .setDescription('جميع الروابط الرسمية المتعلقة ببوت القرآن الكريم')
                    .addFields(
                        {
                            name: `${emoji.globe} الموقع الرسمي`,
                            value: `[زيارة الموقع](${link.website})`,
                            inline: true,
                        },
                        {
                            name: `${emoji.chat} سيرفر الدعم`,
                            value: `[انضم الآن](${link.support})`,
                            inline: true,
                        },
                        {
                            name: `${emoji.chat} إضافة البوت`,
                            value: `[دعوة البوت](${link.invite})`,
                            inline: true,
                        },
                        {
                            name: `${emoji.code} كود المصدر`,
                            value: `[GitHub](${link.github})`,
                            inline: true,
                        },
                        {
                            name: `${emoji.globe} Top.gg`,
                            value: `[تصويت ودعم](${link.topgg})`,
                            inline: true,
                        },
                        {
                            name: `${emoji.globe} سياسة الخصوصية`,
                            value: `[اقرأ المزيد](${link.privacy})`,
                            inline: true,
                        },
                        {
                            name: `شروط الخدمة`,
                            value: `[اقرأ المزيد](${link.terms})`,
                            inline: true,
                        },
                        {
                            name: `${emoji.book} دليل الاستخدام`,
                            value: `استخدم الأمر **/دليل** لعرض جميع أوامر البوت مع شرح كل أمر بالتفصيل`,
                            inline: false,
                        },
                    )
                    .setFooter({ text: 'Made By mgv150 | Powered By Cortex HQ' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('الموقع').setStyle(ButtonStyle.Link).setURL(link.website),
                    new ButtonBuilder().setLabel(`الدعم`).setStyle(ButtonStyle.Link).setURL(link.support),
                    new ButtonBuilder().setLabel('GitHub').setStyle(ButtonStyle.Link).setURL(link.github),
                    new ButtonBuilder().setLabel('دعوة البوت').setStyle(ButtonStyle.Link).setURL(link.invite),
                );

                await safeReply(interaction, { embeds: [embed], components: [row], flags: 64 }, 'help_command');
            },
            { ephemeral: true, label: 'help_command' },
        );
    },
};
