require('pathlra-aliaser')();

const { EmbedBuilder } = require('discord.js');

// ui constants for consistent styling
const prayer_times_footer =
    'تحذير: هذه المعلومات من api.aladhan.com - يرجى التحقق من الموقع الرسمي لمواقيت الصلاة في بلدك للمواعيد الدقيقة المصدر https://aladhan.com/prayer-times';

// standard embed with theme color
function createStandardEmbed() {
    return new EmbedBuilder().setColor(0x1e1f22);
}

// loading embed (standard style)
function createLoadingEmbed(desc) {
    return createStandardEmbed().setTitle('جاري التحميل').setDescription(desc);
}

// prayer times display embed
function createPrayerTimesDisplay(city, country, data, flag = '') {
    return createStandardEmbed()
        .setTitle(`${flag} مواقيت الصلاة`)
        .setDescription(`**${city} - ${country}**`)
        .addFields(
            { name: 'الفجر', value: data.fajr, inline: true },
            { name: 'الشروق', value: data.sunrise, inline: true },
            { name: 'الظهر', value: data.dhuhr, inline: true },
            { name: 'العصر', value: data.asr, inline: true },
            { name: 'المغرب', value: data.maghrib, inline: true },
            { name: 'العشاء', value: data.isha, inline: true },
            { name: 'التاريخ الهجري', value: data.hijriDate, inline: false },
            { name: 'التاريخ الميلادي', value: data.gregorianDate, inline: false },
        )
        .setFooter({ text: prayer_times_footer });
}

// country selection menu embed
function createCountrySelectionEmbed(page, total) {
    return createStandardEmbed()
        .setTitle('مواقيت الصلاة')
        .setDescription('اختر الدولة من القائمة أدناه')
        .setFooter({ text: `صفحة ${page + 1} من ${total}` });
}

module.exports.createStandardEmbed = createStandardEmbed;
module.exports.createLoadingEmbed = createLoadingEmbed;
module.exports.createPrayerTimesDisplay = createPrayerTimesDisplay;
module.exports.createCountrySelectionEmbed = createCountrySelectionEmbed;
module.exports.prayer_times_footer = prayer_times_footer;
