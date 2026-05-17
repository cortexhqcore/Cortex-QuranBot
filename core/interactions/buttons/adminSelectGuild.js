require('pathlra-aliaser')();

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const logger = require('@logger');
// Replaced inline global.SPE_USER_IDS check with centralized isSpecialUser helper
const { isSpecialUser } = require('@authManager');

module.exports = {
    customId: 'admin_select_guild',
    async execute(interaction) {
        if (!isSpecialUser(interaction.user.id)) {
            return interaction.reply({
                content: 'This feature is available for the developer only',
                flags: 64,
            });
        }
        await interaction.deferUpdate();
        const selectedGuildId = interaction.values[0];
        const botClient = global.client;
        const targetGuild = botClient.guilds.cache.get(selectedGuildId);
        if (!targetGuild) {
            return interaction.followUp({ content: 'Server not found', flags: 64 });
        }
        const guildOwner = await targetGuild.fetchOwner().catch(() => null);
        const guildInfoEmbed = new EmbedBuilder()
            .setColor(0x1e1f22)
            .setTitle(targetGuild.name)
            .setThumbnail(targetGuild.iconURL({ size: 256 }) || null)
            .setDescription(`**Server Information**`)
            .addFields(
                { name: 'ID', value: `\`${targetGuild.id}\``, inline: true },
                {
                    name: 'Owner',
                    value: guildOwner ? `<@${guildOwner.id}>` : 'Unknown',
                    inline: true,
                },
                {
                    name: 'Created At',
                    value: `<t:${Math.floor(targetGuild.createdTimestamp / 1000)}:R>`,
                    inline: true,
                },
                { name: 'Total Members', value: `${targetGuild.memberCount}`, inline: true },
            );
        const managementButtons = new ActionRowBuilder().addComponents(
            //new ButtonBuilder()
            //   .setCustomId(`admin_send_msg_${targetGuild.id}`)
            //   .setLabel('Send Message')
            //   .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`admin_kick_bot_${targetGuild.id}`).setLabel('Kick Bot').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('admin_back_to_servers').setLabel('Back to List').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('admin_back_to_panel').setLabel('Control Panel').setStyle(ButtonStyle.Secondary),
        );
        await interaction.followUp({
            embeds: [guildInfoEmbed],
            components: [managementButtons],
            flags: 64,
        });
    },
};
