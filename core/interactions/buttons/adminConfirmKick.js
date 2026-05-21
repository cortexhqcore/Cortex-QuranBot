require('pathlra-aliaser')();

const { EmbedBuilder } = require('discord.js');
const logger = require('@logger');
// Replaced inline global.SPE_USER_IDS check with centralized isSpecialUser helper
const { isSpecialUser } = require('@authManager');
const retentiondb = require('@retention-core_database');

module.exports = {
    customId: 'admin_confirm_kick',
    async execute(interaction) {
        if (!isSpecialUser(interaction.user.id)) {
            return interaction.reply({
                content: 'This feature is available for the developer only',
                flags: 64,
            });
        }
        await interaction.deferUpdate();
        const actionId = interaction.customId;
        const targetGuildId = actionId.replace('admin_confirm_kick_', '');
        const botClient = global.client;
        const targetGuild = botClient.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
            return interaction.followUp({ content: 'Server not found', flags: 64 });
        }
        try {
            await targetGuild.leave();
            // const { removeGuildState } = require('../../state/GuildStateManager');
            await retentiondb.clearGuildData(targetGuildId);
            logger.info(`Admin ${interaction.user.tag} kicked bot from guild ${targetGuild.name} (${targetGuildId})`);
            const confirmationEmbed = new EmbedBuilder()
                .setColor(0x1e1f22)
                .setTitle('Bot Left Successfully')
                .setDescription(
                    `**Bot removed from server:**\n${targetGuild.name}\n${targetGuild.memberCount} members\n\`${targetGuildId}\``,
                );
            await interaction.followUp({ embeds: [confirmationEmbed], flags: 64 });
        } catch (err) {
            logger.error('Error kicking bot from guild', err);
            await interaction.followUp({
                content: `An error occurred while leaving: ${err.message}`,
                flags: 64,
            });
        }
    },
};
