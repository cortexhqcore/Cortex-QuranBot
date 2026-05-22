require('pathlra-aliaser')();

const { wrapInteraction, safeReply } = require('@interactions/flow/responder');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createStandardEmbed } = require('@ui/embedFactory');

module.exports = {
    customId: 'more_features',
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const featuresEmbed = createStandardEmbed()
                    .setTitle('المزيد من الميزات')
                    .setDescription('**الميزات الإضافية**\n' + 'سيتم إضافة خيارات جديدة في المستقبل. حالياً، يتوفر فقط زر مواقيت الصلاة.');
                const featuresRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prayer_times').setLabel('مواقيت الصلاة').setStyle(ButtonStyle.Secondary),
                );
                await safeReply(interaction, { embeds: [featuresEmbed], components: [featuresRow], flags: 64 }, 'more_features_button');
            },
            { ephemeral: true, label: 'more_features_button' },
        );
    },
};
