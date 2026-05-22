require('pathlra-aliaser')();

const { wrapInteraction, safeReply } = require('@interactions/flow/responder');
const { createStandardEmbed } = require('@ui/embedFactory');

const msg = [
    {
        title: 'القرآن الكريم والتلاوات',
        value: '[mp3quran.net](https://www.mp3quran.net/ar)\nمصدر رسمي لتلاوات القرآن الكريم بأصوات القراء',
    },
    {
        title: 'مواقيت الصلاة',
        value: '[aladhan.com](https://api.aladhan.com)\nمصدر عالمي لمواقيت الصلاة لجميع الدول والمدن',
    },
    {
        title: 'الأذكار والأدعية',
        value: '[adhkar.json](https://hub-mgv.github.io/QuranBotData/adhkar.json)\nمصدر متخصص لبيانات الأذكار مع الملفات الصوتية',
    },
    {
        title: 'قاعدة البيانات',
        value: 'Firebase Realtime Database\nلتخزين الإعدادات والبيانات بشكل آمن ومستمر',
    },
    {
        title: 'الإذاعات القرآنية',
        value: '[mp3quran.net/radios](https://www.mp3quran.net/ar/radios)\nبث مباشر للإذاعات القرآنية من مختلف الدول',
    },
];

module.exports = {
    async execute(ix) {
        // wrapInteraction handles defer/reply + error boundary — cmd stays focused
        await wrapInteraction(
            ix,
            async () => {
                const embed = createStandardEmbed()
                    .setTitle('مصادر معلومات البوت')
                    .setDescription('البوت يستخدم المصادر الرسمية التالية لجلب البيانات')
                    .addFields(
                        ...msg.map((s) => ({
                            // Map each source to an embed field
                            name: s.title,
                            value: s.value,
                            inline: false,
                        })),
                    )
                    .setFooter({ text: 'جميع المصادر رسمية وموثوقة' });
                await safeReply(ix, { embeds: [embed], flags: 64 }, 'sources_cmd');
            },
            { ephemeral: true, label: 'sources_cmd' },
        );
    },
};
