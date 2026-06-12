require('pathlra-aliaser')();

const logger = require('@logging/logger');
const { ChannelType } = require('discord.js');
const { saveSetupGuildsToFirebase } = require('@database/firebase');

// Validate channel IDs in setup data and auto-correct if channels no longer exist
async function validateAndFixSetupData(guild, setupData) {
    const guildId = guild.id;
    let requiresUpdate = false;
    let correctedData = { ...setupData };

    // Validate adhkar channel ID
    if (setupData.azkarChannelId) {
        let adhkarChannel = guild.channels.cache.get(setupData.azkarChannelId);
        if (!adhkarChannel) {
            adhkarChannel = await guild.channels.fetch(setupData.azkarChannelId).catch(() => null);
        }
        if (!adhkarChannel || !adhkarChannel.isTextBased()) {
            const fallbackChannel =
                guild.channels.cache.find((c) => c.name === '🌙︱الأذكار' && c.type === ChannelType.GuildText) ||
                guild.channels.cache.find((c) => c.name.includes('أذكار') && c.type === ChannelType.GuildText);
            if (fallbackChannel) {
                correctedData.azkarChannelId = fallbackChannel.id;
                requiresUpdate = true;
                logger.info('Guild ' + guildId + ' Fixed Azkar Channel ID To ' + fallbackChannel.id);
            } else {
                //  correctedData.azkarChannelId = null;
                //  requiresUpdate = true;
                logger.warn('Guild ' + guildId + ' Azkar Channel Not Found Cleared ID');
            }
        }
    }

    // Validate voice channel ID
    if (setupData.voiceChannelId) {
        let voiceChannel = guild.channels.cache.get(setupData.voiceChannelId);
        if (!voiceChannel) {
            voiceChannel = await guild.channels.fetch(setupData.voiceChannelId).catch(() => null);
        }
        if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
            const fallbackVoice = guild.channels.cache.find(
                (c) => c.name === '🕌︱بثّ القُرآن الكريم' && c.type === ChannelType.GuildVoice,
            );
            if (fallbackVoice) {
                correctedData.voiceChannelId = fallbackVoice.id;
                requiresUpdate = true;
                logger.info('Guild ' + guildId + ' Fixed Voice Channel ID To ' + fallbackVoice.id);
            } else {
                correctedData.voiceChannelId = null;
                requiresUpdate = true;
                logger.warn('Guild ' + guildId + ' Voice Channel Not Found Cleared ID');
            }
        }
    }

    // Validate text channel ID for control panel
    if (setupData.textChannelId) {
        let textChannel = guild.channels.cache.get(setupData.textChannelId);
        if (!textChannel) {
            textChannel = await guild.channels.fetch(setupData.textChannelId).catch(() => null);
        }
        if (!textChannel || !textChannel.isTextBased()) {
            const fallbackText = guild.channels.cache.find((c) => c.name === '📖︱تحكم البوت القرآني' && c.type === ChannelType.GuildText);
            if (fallbackText) {
                correctedData.textChannelId = fallbackText.id;
                requiresUpdate = true;
                logger.info('Guild ' + guildId + ' Fixed Text Channel ID To ' + fallbackText.id);
            } else {
                correctedData.textChannelId = null;
                requiresUpdate = true;
                logger.info('Guild ' + guildId + ' Text Channel Not Found Cleared ID');
            }
        }
    }

    // Validate category ID for bot channels
    if (setupData.categoryId) {
        let category = guild.channels.cache.get(setupData.categoryId);
        if (!category) {
            category = await guild.channels.fetch(setupData.categoryId).catch(() => null);
        }
        if (!category || category.type !== ChannelType.GuildCategory) {
            const fallbackCategory = guild.channels.cache.find(
                (c) => c.name === '🕋︱القُرآن الكريم' && c.type === ChannelType.GuildCategory,
            );
            if (fallbackCategory) {
                correctedData.categoryId = fallbackCategory.id;
                requiresUpdate = true;
                logger.info('Guild ' + guildId + ' Fixed Category ID To ' + fallbackCategory.id);
            } else {
                correctedData.categoryId = null;
                requiresUpdate = true;
                logger.warn('Guild ' + guildId + ' Category Not Found Cleared ID');
            }
        }
    }

    if (requiresUpdate) {
        global.setupGuilds[guildId] = correctedData;
        await saveSetupGuildsToFirebase(global.setupGuilds);
        logger.info('Guild ' + guildId + ' Setup Data Updated In Firebase');
    }

    return correctedData;
}

module.exports.validateAndFixSetupData = validateAndFixSetupData;
