require('pathlra-aliaser')();

const { wrapInteraction, safeReply } = require('@interactions/flow/responder');
const { createStandardEmbed } = require('@ui/embedFactory');
const { emoji, gif } = require('@helpers/emojis');

const msg = [
    {
        title: `${emoji.sound} ترقية البث الصوتي إلى Lavalink v4`,
        value: '• نقل معالجة وتشغيل الصوت بالكامل إلى سيرفرات Lavalink الخارجية.\n• خفض استهلاك المعالج (CPU) في السيرفر المحلي إلى **0%** أثناء تشغيل الصوت.\n• حل مشكلة تقطيع وتوقف الصوت نهائياً ودعم أكثر من 150+ بث صوتي متزامن بجودة فائقة.',
    },
    {
        title: `${emoji.electric_bolt} كاش الحالة الموزع عبر Redis`,
        value: '• ترحيل بيانات السيرفرات النشطة من الذاكرة المحلية (Map Cache) إلى كاش **Redis** سريع وآمن.\n• تمكين ميزة التجزئة المتعددة (Stateless Sharding) لتوزيع الأحمال بكفاءة عالية.\n• نظام حماية ذكي (Resilient Fallback) يقوم بالتبديل التلقائي للذاكرة المحلية في حال تعطل Redis لمنع توقف البوت.',
    },
    {
        title: `${emoji.build} إصلاحات وتحسينات شاملة`,
        value: '• إصلاح جميع الأخطاء البرمجية (Reference Errors) المتعلّقة بهيكلة التشغيل الجديدة.\n• تسريع عملية استعادة وتكامل البث الصوتي بعد إعادة التشغيل والتوقف التلقائي.\n• إزالة الشيفرات والتعليقات غير المستخدمة لتحسين أداء قراءة الملفات وسرعة تشغيل البوت.',
    },
    {
        title: `${emoji.globe} الدعم الفني والعلامة التجارية الجديدة`,
        value: '• استبدال قنوات الدعم عبر البريد الإلكتروني بروابط مباشرة لسيرفر الدعم الفني على Discord لسرعة الاستجابة.\n• تحديث شامل لسياسة الخصوصية وشروط الخدمة وتوجيهها للمستودع الجديد.\n• تحديث توقيع وإسناد البوت الرسمي: **Made By mgv150 | Powered By Cortex HQ**.',
    },
];

module.exports = {
    async execute(ix) {
        await wrapInteraction(
            ix,
            async () => {
                const embed = createStandardEmbed()
                    .setTitle(`${emoji.change} سجل التحديثات والتغييرات الأخيرة`)
                    .setDescription(
                        'تم ترقية البنية التحتية للبوت بالكامل لضمان تشغيل مستقر وعلى مدار الساعة لأكثر من 5,000 سيرفر بكفاءة عالية.',
                    )
                    .addFields(
                        ...msg.map((u) => ({
                            name: u.title,
                            value: u.value,
                            inline: false,
                        })),
                    )
                    .setFooter({ text: 'Made By mgv150 | Powered By Cortex HQ' });

                await safeReply(ix, { embeds: [embed], flags: 64 }, 'changelog_cmd');
            },
            { ephemeral: true, label: 'changelog_cmd' },
        );
    },
};
