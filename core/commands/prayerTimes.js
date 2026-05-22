require('pathlra-aliaser')();

const { wrapInteraction, safeReply } = require('@interactions/flow/responder');
const bootstrap = require('@bot/bootstrap');
const { createStandardEmbed } = require('@ui/embedFactory');

const prayer_times_disclaimer =
    'هذه المعلومات يتم جلبها من https://aladhan.com وقد تختلف عن مواقيت الصلاة الرسمية في بلدك\n' +
    '**نوصي بالتحقق من الموقع الرسمي** للمواعيد الدقيقة: https://alaghan.com/prayer-times';
module.exports = {
    async execute(ix) {
        // wrapInteraction handles defer/reply logic + error boundary — keeps cmd focused on happy path
        await wrapInteraction(
            ix,
            async () => {
                const embed = createStandardEmbed()
                    .setTitle('مواقيت الصلاة')
                    .setDescription('اختر الدولة ثم المنطقة لعرض مواقيت الصلاة\n' + '**تحذير مهم**\n' + prayer_times_disclaimer)
                    .addFields({
                        name: 'طريقة الاستخدام',
                        value: 'اضغط على زر مواقيت الصلاة لاختيار الدولة والمنطقة',
                        inline: false,
                    });

                const rows = [];
                if (bootstrap?.createPrayerTimesButtonRow) {
                    rows.push(bootstrap.createPrayerTimesButtonRow());
                }

                await safeReply(
                    ix,
                    {
                        embeds: [embed],
                        components: rows,
                        flags: 64,
                    },
                    'prayer_times_cmd',
                );
            },
            { ephemeral: true, label: 'prayer_times_cmd' },
        );
    },
};
