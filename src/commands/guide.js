require('pathlra-aliaser')();

const { wrapInteraction, safeReply } = require('@interactions/flow/responder');
const coreLoader = require('@bot/bootstrap');
const { emoji, gif } = require('@helpers/emojis');

module.exports = {
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const guildState = coreLoader.getGuildState(interaction.guildId);
                // Construct guide embed with usage instructions
                const guideEmbed = {
                    embeds: [
                        {
                            color: 0x1e1f22,
                            title: `${emoji.help} دليل استخدام البوت`,
                            description:
                                '**/إعداد**: إعداد فئة القرآن الكريم (سيتم إنشاء قنوات تلقائيًا)\n' +
                                '**/دخول**: الانضمام إلى الروم الصوتي (بعد الإعداد)\n' +
                                '**/دخول_قناة**: الانضمام إلى غرفة صوتية محددة\n' +
                                '**/خروج**: الخروج من الروم الصوتي\n' +
                                '**/تحكم**: عرض لوحة التحكم\n' +
                                '**/سرعة**: عرض سرعة البوت، ومدة التشغيل، وعدد السيرفرات الحالي',
                        },
                    ],
                };
                await safeReply(interaction, guideEmbed, 'guide_command');
            },
            { ephemeral: true, label: 'guide_command' },
        );
    },
};
