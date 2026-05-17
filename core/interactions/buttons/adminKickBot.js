require('pathlra-aliaser')();

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const logger = require('@logger');
// Replaced inline global.SPE_USER_IDS check with centralized isSpecialUser helper
const { isSpecialUser } = require('@authManager');

module.exports = {
    customId: 'admin_kick_bot',
    async execute(interaction) {
        if (!isSpecialUser(interaction.user.id)) {
            return interaction.reply({
                content: 'This feature is available for the developer only',
                flags: 64,
            });
        }
        const buttonId = interaction.customId;
        const targetGuildId = buttonId.replace('admin_kick_bot_', '');
        const botClient = global.client;
        const targetGuild = botClient.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
            return interaction.reply({ content: 'Server not found', flags: 64 });
        }
        const confirmationButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`admin_confirm_kick_${targetGuildId}`)
                .setLabel('Confirm Leave')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('admin_cancel_kick').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
        );
        const confirmationEmbed = new EmbedBuilder()
            .setColor(0x1e1f22)
            .setTitle('Confirm Bot Leave')
            .setDescription(
                `**Are you sure you want to remove the bot from:**\n${targetGuild.name}\n${targetGuild.memberCount} members\n\`${targetGuild.id}\``,
            )
            .addFields({
                name: 'Warning',
                value: 'This action cannot be undone. All bot settings for this server will be deleted.',
                inline: false,
            });
        await interaction.reply({
            embeds: [confirmationEmbed],
            components: [confirmationButtons],
            flags: 64,
        });
    },
};
