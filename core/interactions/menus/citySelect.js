require('pathlra-aliaser')();

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const logger = require('@logger');
const fetch = require('node-fetch').default;
const { getCitiesForCountry, getTimeFormatForCountry } = require('@data/prayerTimesData');
const { getBrowserHeaders, TimeoutRequest } = require('@http');
const { createStandardEmbed, createPrayerTimesDisplay, createLoadingEmbed } = require('@embedFactory');

function formatTime(time24, countryCode) {
    if (!time24 || typeof time24 !== 'string') return 'غير متاح';
    const displayFormat = getTimeFormatForCountry(countryCode);
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (displayFormat === '24') {
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    } else {
        const period = hours >= 12 ? 'م' : 'ص';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursStr = hours.toString().padStart(2, '0');
        const minutesStr = minutes.toString().padStart(2, '0');
        return `${hoursStr}:${minutesStr} ${period}`;
    }
}

// Fetch prayer times from aladhan API with region-specific calculation methods
async function fetchPrayerTimes(lat, lng, cityName, countryCode) {
    try {
        const currentDate = new Date();
        const unixTimestamp = Math.floor(currentDate.getTime() / 1000);
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

module.exports = {
    customId: 'select_city_prayer',
    async execute(interaction) {
        try {
            // Acknowledge the interaction to prevent timeout
            await interaction.deferUpdate();
            const selectedValue = interaction.values[0];
            const valueParts = selectedValue.split('_');
            const targetCountryCode = valueParts[0];
            const cityIndex = parseInt(valueParts[1]);
            const citiesList = getCitiesForCountry(targetCountryCode);
            const selectedCity = citiesList[cityIndex];
            if (!selectedCity) {
                return interaction.editReply({
                    content: 'المدينة غير متاحة',
                    flags: 64,
                });
            }
            // Show loading state while fetching prayer data
            const loadingEmbed = createLoadingEmbed(`المدينة: ${selectedCity.name}\nيرجى الانتظار...`);
            await interaction.editReply({
                embeds: [loadingEmbed],
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            const prayerInfo = await fetchPrayerTimes(selectedCity.lat, selectedCity.lng, selectedCity.name, targetCountryCode);
            if (!prayerInfo) {
                return interaction.editReply({
                    content: 'فشل في جلب مواقيت الصلاة. يرجى المحاولة لاحقاً',
                    flags: 64,
                });
            }
            const prayerEmbed = createPrayerTimesDisplay(prayerInfo.cityName, prayerInfo.countryCode, prayerInfo);
            const homeBtn = new ButtonBuilder().setCustomId('home_prayer').setLabel('الرئيسية').setStyle(ButtonStyle.Secondary);
            const refreshBtn = new ButtonBuilder().setCustomId('refresh_prayer').setLabel('تحديث').setStyle(ButtonStyle.Secondary);
            const actionRow = new ActionRowBuilder().addComponents(homeBtn, refreshBtn);

            await interaction.editReply({
                embeds: [prayerEmbed],
                components: [actionRow],
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('Error in city select', error);
            try {
                await interaction.editReply({
                    content: 'حدث خطأ',
                    flags: 64,
                });
            } catch (replyErr) {
                logger.error('Error replying to interaction', replyErr);
            }
        }
    },
};
