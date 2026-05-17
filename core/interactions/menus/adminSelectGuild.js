require('pathlra-aliaser')();

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const logger = require('@logger');

module.exports = {
    customId: 'admin_select_guild',

    async execute(interaction) {
        // Verify developer-level access before proceeding
        const requesterId = interaction.user.id;
        const hasDeveloperAccess = global.SPE_USER_IDS.includes(requesterId);

        if (!hasDeveloperAccess) {
            return interaction.reply({
                content: 'This feature is available for the developer only',
                flags: 64,
            });
        }

        // Acknowledge the interaction to prevent timeout
        await interaction.deferUpdate();

        // Extract selected guild ID from dropdown values
        const selectedGuildId = interaction.values[0];
        const botClient = global.client;
        const targetGuild = botClient.guilds.cache.get(selectedGuildId);

        if (!targetGuild) {
            return interaction.followUp({
                content: 'Server not found',
                flags: 64,
            });
        }

        // Fetch guild owner info with fallback for unavailable data
        const guildOwner = await targetGuild.fetchOwner().catch(() => null);
        const setupData = global.setupGuilds?.[selectedGuildId];
        const hasStoredSetup = !!setupData && typeof setupData === 'object' && Object.keys(setupData).length > 0;
        const botStatusText = targetGuild ? 'Present in server' : 'Bot removed from server';
        let channelValidation = { voice: false, text: false, azkar: false };
        if (hasStoredSetup) {
            // Check voice channel
            if (setupData.voiceChannelId) {
                const voiceCh =
                    targetGuild.channels.cache.get(setupData.voiceChannelId) ||
                    (await targetGuild.channels.fetch(setupData.voiceChannelId).catch(() => null));
                channelValidation.voice = voiceCh?.type === ChannelType.GuildVoice;
            }
            // Check text channel for control panel
            if (setupData.textChannelId) {
                const textCh =
                    targetGuild.channels.cache.get(setupData.textChannelId) ||
                    (await targetGuild.channels.fetch(setupData.textChannelId).catch(() => null));
                channelValidation.text = textCh?.isTextBased?.();
            }
            // Check azkar channel for automated messages
            if (setupData.azkarChannelId) {
                const azkarCh =
                    targetGuild.channels.cache.get(setupData.azkarChannelId) ||
                    (await targetGuild.channels.fetch(setupData.azkarChannelId).catch(() => null));
                channelValidation.azkar = azkarCh?.isTextBased?.();
            }
        }

        // Build detailed setup status string based on actual channel existence
        const anyChannelExists = channelValidation.voice || channelValidation.text || channelValidation.azkar;
        let setupStatusText = hasStoredSetup && anyChannelExists ? 'Configured (setup system active)' : 'Not configured';
        let channelDetails = 'No channel data stored';
        if (hasStoredSetup) {
            channelDetails = `Voice: ${channelValidation.voice ? 'Exists' : 'Missing'} | Text: ${channelValidation.text ? 'Exists' : 'Missing'} | Azkar: ${channelValidation.azkar ? 'Exists' : 'Missing'}`;
        }
        const serverAgeDays = Math.floor((Date.now() - targetGuild.createdTimestamp) / 86400000);

        // Build detailed guild information embed
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
                { name: 'Bot Status', value: botStatusText, inline: true },
                { name: 'Setup Status', value: setupStatusText, inline: true },
                { name: 'Channel Data', value: channelDetails, inline: true },
                { name: 'Server Age', value: `${serverAgeDays} days`, inline: true },
            );

        // Create action buttons for guild management
        const managementButtons = new ActionRowBuilder().addComponents(
            //new ButtonBuilder()
            //   .setCustomId(`admin_send_msg_${targetGuild.id}`)
            //   .setLabel('Send Message')
            //   .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`admin_kick_bot_${targetGuild.id}`).setLabel('Kick Bot').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('admin_back_to_servers').setLabel('Back to List').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('admin_back_to_panel').setLabel('Control Panel').setStyle(ButtonStyle.Secondary),
        );

        // Send ephemeral response with guild details and controls
        await interaction.followUp({
            embeds: [guildInfoEmbed],
            components: [managementButtons],
            flags: 64,
        });
    },
};
