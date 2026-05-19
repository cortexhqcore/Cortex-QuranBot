require('pathlra-aliaser')();

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');
const logger = require('@logger');
const fetch = require('node-fetch').default;
const { getCountries, getCitiesForCountry, getCountryByCode, getTimeFormatForCountry } = require('@data/prayerTimesData');
const { getBrowserHeaders, TimeoutRequest } = require('@http');
const { prayer_times_config } = require('@configConstants');

function truncateText(text, maxLength) {
    if (!text) return '';
    const str = String(text);
    return str.length > maxLength ? str.substring(0, maxLength) : str;
}

function formatTime(time24, countryCode) {
    if (!time24 || typeof time24 !== 'string') return 'غير متاح';
    const timeFormat = getTimeFormatForCountry(countryCode);
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (timeFormat === '24') {
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    } else {
        const ampm = hours >= 12 ? 'م' : 'ص';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursStr = hours.toString().padStart(2, '0');
        const minutesStr = minutes.toString().padStart(2, '0');
        return `${hoursStr}:${minutesStr} ${ampm}`;
    }
}

// Fetch prayer times from aladhan API with region-specific calculation methods
async function fetchPrayerTimes(lat, lng, cityName, countryCode) {
    try {
        const currentDate = new Date();
        const unixTimestamp = Math.floor(currentDate.getTime() / 1000);
        // Select calculation method based on country for accurate timings
        let calculationMethod = 2;
        if (countryCode === 'EG') {
            calculationMethod = 5;
        } else if (countryCode === 'SA') {
            calculationMethod = 4;
        } else if (countryCode === 'KW' || countryCode === 'QA' || countryCode === 'BH') {
            calculationMethod = 3;
        } else if (countryCode === 'AE') {
            calculationMethod = 1;
        }
        const apiUrl = `https://api.aladhan.com/v1/timings/${unixTimestamp}?latitude=${lat}&longitude=${lng}&method=${calculationMethod}`;
        const response = await fetch(apiUrl, {
            headers: getBrowserHeaders(),
            timeout: TimeoutRequest('default'),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const apiData = await response.json();
        const prayerTimings = apiData.data.timings;
        const hijriDate = apiData.data.date.hijri;
        const gregorianDate = apiData.data.date.gregorian;
        return {
            fajr: formatTime(prayerTimings.Fajr, countryCode),
            sunrise: formatTime(prayerTimings.Sunrise, countryCode),
            dhuhr: formatTime(prayerTimings.Dhuhr, countryCode),
            asr: formatTime(prayerTimings.Asr, countryCode),
            maghrib: formatTime(prayerTimings.Maghrib, countryCode),
            isha: formatTime(prayerTimings.Isha, countryCode),
            hijriDate: `${hijriDate.day} ${hijriDate.month.ar} ${hijriDate.year}`,
            gregorianDate: `${gregorianDate.day} ${gregorianDate.month.en} ${gregorianDate.year}`,
            cityName: cityName,
            countryCode: countryCode,
            method: calculationMethod,
        };
    } catch (error) {
        logger.error('Error fetching prayer times', error);
        return null;
    }
}

function createCountrySelectionEmbed(currentPage, totalPages) {
    return new EmbedBuilder()
        .setColor(0x1e1f22)
        .setTitle('مواقيت الصلاة')
        .setDescription('اختر الدولة من القائمة أدناه')
        .setFooter({ text: `صفحة ${currentPage + 1} من ${totalPages}` });
}
function createCountryComponents(countries, currentPage, totalPages) {
    const ITEMS_PER_PAGE = prayer_times_config.cities_per_page; // 25
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, countries.length);
    const menuOptions = countries.slice(startIndex, endIndex).map((country) => {
        const flag = country.flag || '🌍';
        const label = truncateText(`${country.name}`, 100);
        const value = truncateText(country.code, 100);
        const description = truncateText(`${country.nameEn}`, 100);
        return new StringSelectMenuOptionBuilder().setLabel(label).setValue(value).setDescription(description).setEmoji(flag);
    });
    const countrySelect = new StringSelectMenuBuilder()
        .setCustomId('select_country_prayer')
        .setPlaceholder('اختر الدولة')
        .addOptions(menuOptions);
    const prevBtn = new ButtonBuilder()
        .setCustomId(`prev_country_page_${currentPage}`)
        .setLabel('السابق')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0);
    const nextBtn = new ButtonBuilder()
        .setCustomId(`next_country_page_${currentPage}`)
        .setLabel('التالي')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1);
    const cancelBtn = new ButtonBuilder().setCustomId('cancel_prayer').setLabel('إلغاء').setStyle(ButtonStyle.Secondary);
    const selectRow = new ActionRowBuilder().addComponents(countrySelect);
    const navRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
    const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);
    return [selectRow, navRow, cancelRow];
}

module.exports = {
    customId: 'prayer_navigation',
    async execute(interaction) {
        try {
            // Defer to keep interaction alive during async operations
            await interaction.deferUpdate().catch(() => {});
            const availableCountries = getCountries();
            if (!availableCountries || availableCountries.length === 0) {
                return interaction
                    .followUp({
                        content: 'لا توجد دول متاحة',
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            }
            const ITEMS_PER_PAGE = prayer_times_config.cities_per_page; // 25
            const totalPages = Math.ceil(availableCountries.length / ITEMS_PER_PAGE);
            const actionId = interaction.customId;
            if (actionId === 'home_prayer') {
                const components = createCountryComponents(availableCountries, 0, totalPages);
                const embed = createCountrySelectionEmbed(0, totalPages);
                await interaction
                    .followUp({
                        embeds: [embed],
                        components: components,
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            } else if (actionId === 'refresh_prayer') {
                const currentEmbed = interaction.message.embeds[0];
                if (!currentEmbed || !currentEmbed.description) {
                    return interaction
                        .followUp({
                            content: 'لا توجد بيانات لتحديثها',
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }

                const description = currentEmbed.description;
                const match = description.match(/\*\*(.+?) - (.+?)\*\*/);
                if (!match) {
                    return interaction
                        .followUp({
                            content: 'لا توجد بيانات لتحديثها',
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }
                const targetCityName = match[1];
                const targetCountryCode = match[2];
                // Look up city coordinates for API request
                let targetCity = null;
                const citiesList = getCitiesForCountry(targetCountryCode);
                if (citiesList) {
                    targetCity = citiesList.find((c) => c.name === targetCityName);
                }
                if (!targetCity) {
                    return interaction
                        .followUp({
                            content: 'المدينة غير متاحة',
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }
                await interaction
                    .followUp({
                        embeds: [
                            {
                                color: 0x1e1f22,
                                title: 'جاري تحديث مواقيت الصلاة',
                                description: `المدينة: ${targetCity.name} يرجى الانتظار...`,
                            },
                        ],
                        components: [],
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
                const freshPrayerData = await fetchPrayerTimes(targetCity.lat, targetCity.lng, targetCity.name, targetCountryCode);
                if (!freshPrayerData) {
                    return interaction
                        .followUp({
                            content: 'فشل في جلب مواقيت الصلاة. يرجى المحاولة لاحقاً',
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }

                const countryInfo = getCountryByCode(targetCountryCode);
                const countryFlag = countryInfo?.flag || '';
                const refreshedEmbed = new EmbedBuilder()
                    .setColor(0x1e1f22)
                    .setTitle(`${countryFlag} مواقيت الصلاة`)
                    .setDescription(`**${freshPrayerData.cityName} - ${freshPrayerData.countryCode}**`)
                    .addFields(
                        { name: 'الفجر', value: freshPrayerData.fajr, inline: true },
                        { name: 'الشروق', value: freshPrayerData.sunrise, inline: true },
                        { name: 'الظهر', value: freshPrayerData.dhuhr, inline: true },
                        { name: 'العصر', value: freshPrayerData.asr, inline: true },
                        { name: 'المغرب', value: freshPrayerData.maghrib, inline: true },
                        { name: 'العشاء', value: freshPrayerData.isha, inline: true },
                        { name: 'التاريخ الهجري', value: freshPrayerData.hijriDate, inline: false },
                        {
                            name: 'التاريخ الميلادي',
                            value: freshPrayerData.gregorianDate,
                            inline: false,
                        },
                    )
                    .setFooter({
                        text: `تحذير: هذه المعلومات من api.aladhan.com - يرجى التحقق من الموقع الرسمي لمواقيت الصلاة في بلدك للمواعيد الدقيقة | المصدر: https://aladhan.com/prayer-times`,
                    });
                const homeBtn = new ButtonBuilder().setCustomId('home_prayer').setLabel('الرئيسية').setStyle(ButtonStyle.Secondary);
                const refreshBtn = new ButtonBuilder().setCustomId('refresh_prayer').setLabel('تحديث').setStyle(ButtonStyle.Secondary);
                const actionRow = new ActionRowBuilder().addComponents(homeBtn, refreshBtn);
                await interaction
                    .followUp({
                        embeds: [refreshedEmbed],
                        components: [actionRow],
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            } else if (actionId === 'back_country_prayer') {
                const components = createCountryComponents(availableCountries, 0, totalPages);
                const embed = createCountrySelectionEmbed(0, totalPages);
                await interaction
                    .followUp({
                        embeds: [embed],
                        components: components,
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            } else if (actionId === 'cancel_prayer') {
                await interaction
                    .followUp({
                        embeds: [
                            {
                                color: 0x1e1f22,
                                title: 'تم الإلغاء',
                                description: 'تم إلغاء عملية اختيار مواقيت الصلاة',
                            },
                        ],
                        components: [],
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            } else if (actionId.startsWith('prev_country_page_')) {
                // Handle previous page navigation for country list
                const currentPage = parseInt(actionId.split('_').pop());
                const newPage = Math.max(0, currentPage - 1);
                const components = createCountryComponents(availableCountries, newPage, totalPages);
                const embed = createCountrySelectionEmbed(newPage, totalPages);
                await interaction
                    .followUp({
                        embeds: [embed],
                        components: components,
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            } else if (actionId.startsWith('next_country_page_')) {
                const currentPage = parseInt(actionId.split('_').pop());
                const newPage = Math.min(totalPages - 1, currentPage + 1);
                const components = createCountryComponents(availableCountries, newPage, totalPages);
                const embed = createCountrySelectionEmbed(newPage, totalPages);
                await interaction
                    .followUp({
                        embeds: [embed],
                        components: components,
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            }
        } catch (error) {
            logger.error('Error in prayer navigation', error);
            try {
                await interaction
                    .followUp({
                        content: 'حدث خطأ',
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            } catch (replyErr) {
                logger.error('Error replying to interaction', replyErr);
            }
        }
    },
};
