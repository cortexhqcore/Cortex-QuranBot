require('pathlra-aliaser')();

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('@logging/logger');
const { emoji } = require('@helpers/emojis');

async function resolveChannel(guild) {
    if (
        guild.systemChannel &&
        guild.systemChannel.isTextBased() &&
        guild.systemChannel.permissionsFor(guild.members.me)?.has('SendMessages')
    ) {
        return guild.systemChannel;
    }

    const cached = guild.channels.cache.find(
        (channel) => channel.isTextBased() && channel.permissionsFor(guild.members.me)?.has('SendMessages'),
    );

    if (cached) return cached;

    const fetched = await guild.channels.fetch();
    return fetched.find((channel) => channel?.isTextBased() && channel.permissionsFor(guild.members.me)?.has('SendMessages'));
}

async function sendWelcome(guild) {
    const channel = await resolveChannel(guild);

    if (!channel) {
        logger.warn(`No writable channel found in ${guild.name} (${guild.id})`);
        return;
    }
    const embed = new EmbedBuilder()
        .setColor('#1e1f22')
        .setTitle(`${emoji.welcome} أهلاً بك في بوت القرآن الكريم`)
        .setDescription(
            `
مرحبًا بك، وشكرًا لإضافة البوت إلى سيرفرك.

${emoji.features} **ماذا يوفر البوت؟**

${emoji.book} بث قرآني مستمر بجودة عالية مع دعم أكثر من 150 قارئ
${emoji.radio} إذاعات قرآنية مباشرة على مدار الساعة
${emoji.prayer_times} مواقيت صلاة دقيقة لجميع المناطق
${emoji.crescent_moon} أذكار وتنبيهات تفاعلية
لوحة تحكم سهلة لإدارة التشغيل

${emoji.edit} **للبدء سريعًا**

\`/إعداد\` — تجهيز القنوات تلقائيًا
\`/دخول\` — تشغيل البوت داخل الروم الصوتي
\`/تحكم\` — فتح لوحة التحكم
\`/دليل\` — عرض جميع الأوامر

يعتمد البوت على بنية صوتية مستقرة لضمان تشغيل متواصل بدون انقطاع.
        `,
        )
        .setFooter({
            text: 'Made by mgv150 • Powered by Cortex HQ',
        })
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('سيرفر الدعم').setStyle(ButtonStyle.Link).setURL('https://discord.gg/5qYXAucMpc'),

        new ButtonBuilder().setLabel('GitHub').setStyle(ButtonStyle.Link).setURL('https://github.com/cortexhqcore/Cortex-QuranBot'),
    );

    await channel.send({
        embeds: [embed],
        components: [buttons],
    });
}

module.exports = {
    sendWelcome,
};
