require('pathlra-aliaser')();

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} = require('discord.js');
const { getCitiesForCountry, getCountryByCode } = require('@data/prayerTimesData');
const { createStandardEmbed, createCountrySelectionEmbed } = require('@embedFactory');
const logger = require('@logger');

module.exports = {
    customId: 'select_country_prayer',
    async execute(interaction) {
        try {
            await interaction.deferUpdate();
            const selectedCountryCode = interaction.values[0];
            const countryInfo = getCountryByCode(selectedCountryCode);
            const countryFlag = countryInfo?.flag || '';
            const availableCities = getCitiesForCountry(selectedCountryCode);
            if (availableCities.length === 0) {
                return interaction.editReply({
                    content: 'لا توجد مدن متاحة لهذه الدولة',
                    flags: 64,
                });
            }
            const cityMenuOptions = availableCities.map((city, index) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(city.name)
                    .setValue(`${selectedCountryCode}_${index}`)
                    .setDescription(city.nameEn)
                    .setEmoji(countryFlag),
            );
            const citySelect = new StringSelectMenuBuilder()
                .setCustomId('select_city_prayer')
                .setPlaceholder(`${countryFlag} اختر المدينة`)
                .addOptions(cityMenuOptions.slice(0, 25));
            const cityRow = new ActionRowBuilder().addComponents(citySelect);
            const backBtn = new ButtonBuilder().setCustomId('back_country_prayer').setLabel('رجوع للدول').setStyle(ButtonStyle.Secondary);
            const backRow = new ActionRowBuilder().addComponents(backBtn);
            const countryEmbed = createStandardEmbed()
                .setTitle(`مواقيت الصلاة`)
                .setDescription(`**الدولة المختارة:** ${countryFlag} ${countryInfo?.name || ''}\n**اختر المدينة من القائمة أدناه**`)
                .addFields(
                    {
                        name: 'الدولة',
                        value: `${countryFlag} ${countryInfo?.name} (${countryInfo?.nameEn})`,
                        inline: true,
                    },
                    { name: 'عدد المدن', value: `${availableCities.length} مدينة`, inline: true },
                );
            await interaction.editReply({
                embeds: [countryEmbed],
                components: [cityRow, backRow],
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('Error in country select', error);
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
