require('pathlra-aliaser')();

const fs = require('fs').promises;
const pathlra = require('path');
const { ChannelType, PermissionsBitField, OverwriteType } = require('discord.js');
const { getGuildState } = require('../state/GuildStateManager');
const logger = require('@logging/logger');
const { loadSetupGuildsFromFirebase, saveSetupGuildsToFirebase } = require('@database/firebase');
const { channel_names } = require('@config/constants');
const { createControlEmbed } = require('@ui/embeds');
const { createReciterRow, createSelectRow, createButtonRow, createNavigationRow, createRadioRow } = require('@ui/components');
const { saveControlId } = require('@database/trackers/controlIds');

let startAzkarTimerForGuild;
try {
    ({ startAzkarTimerForGuild } = require('../state/azkarManager'));
} catch (err) {
    logger.error('AzkarManager load failed — using fallback', err);
    startAzkarTimerForGuild = (gid, cid) => {
        logger.warn('Fallback azkar active for guild ' + gid);
        const st = getGuildState(gid);
        if (st.azkarTimer) return;
        st.azkarChannelId = cid;
        st.azkarTimer = setInterval(() => {
            const ch = global.client.channels.cache.get(cid);
            if (ch) ch.send('🕋 ذكر لا يمكن توليد الصور حالياً');
        }, 10000);
    };
}

async function persistSetupData() {
    try {
        const remote = await loadSetupGuildsFromFirebase();
        const local = global.setupGuilds || {};
        const merged = { ...remote };
        for (const [gid, data] of Object.entries(local)) {
            merged[gid] = { ...merged[gid], ...data };
        }
        await saveSetupGuildsToFirebase(merged);
        global.setupGuilds = merged;
        logger.info('Setup data synced');
    } catch (e) {
        logger.error('Setup save failed', e);
    }
}

async function setupQuranCategory(guild, ix, opts = {}) {
    // Core function to create or reuse Quran category and channels, update permissions, and store setup state. Returns created channels for confirmation message
    const { channelWillBeDeleted = false } = opts;
    const gid = guild.id;
    const st = getGuildState(gid);
    st.isPaused = true;
    st.pauseReason = 'manual';
    st.playbackMode = 'radio';
    if (st.connection && !st.connection.destroyed) {
        try {
            st.connection.unsubscribe(st.player);
        } catch (e) {
            logger.info('Unsubscribe skip in ' + gid, e);
        }
    }
    if (st.azkarTimer) {
        clearInterval(st.azkarTimer);
        st.azkarTimer = null;
        st.azkarChannelId = null;
    }
    const isReSetup = !!global.setupGuilds?.[gid];
    if (isReSetup) {
        const old = global.setupGuilds[gid];
        const toDelete = [old.voiceChannelId, old.textChannelId, old.azkarChannelId];
        for (const id of toDelete) {
            if (!id) continue;
            try {
                const ch = guild.channels.cache.get(id) || (await guild.channels.fetch(id).catch(() => null));
                if (ch) {
                    await ch.delete('Quran bot re-setup');
                    await new Promise((r) => setTimeout(r, 800));
                }
            } catch (e) {
                logger.error('Channel delete failed ' + id, e);
            }
        }
        if (old.categoryId) {
            try {
                const cat = guild.channels.cache.get(old.categoryId) || (await guild.channels.fetch(old.categoryId).catch(() => null));
                if (cat) {
                    for (const [, child] of cat.children.cache) {
                        await child.delete('Re-setup child cleanup').catch(() => {});
                    }
                    await new Promise((r) => setTimeout(r, 500));
                    await cat.delete('Quran bot re-setup');
                    await new Promise((r) => setTimeout(r, 800));
                }
            } catch (e) {
                logger.error('Category delete failed in ' + gid, e);
            }
        }
    }
    try {
        let cat = guild.channels.cache.find((c) => c.name === channel_names.category && c.type === ChannelType.GuildCategory);
        if (!cat) {
            cat = await guild.channels.create({
                name: channel_names.category,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    {
                        id: ix.user.id,
                        type: OverwriteType.Member,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels],
                    },
                ],
                reason: (isReSetup ? 'Re-setup' : 'Setup') + ' by ' + ix.user.tag,
            });
        }
        let voice = guild.channels.cache.find(
            (c) => c.name === channel_names.voice && c.type === ChannelType.GuildVoice && c.parentId === cat.id,
        );
        if (!voice) {
            // Voice channel creation
            voice = await guild.channels.create({
                name: channel_names.voice,
                type: ChannelType.GuildVoice,
                parent: cat.id,
                bitrate: 64000,
                userLimit: 0,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
                        deny: [
                            PermissionsBitField.Flags.Speak,
                            PermissionsBitField.Flags.Stream,
                            PermissionsBitField.Flags.UseEmbeddedActivities,
                            PermissionsBitField.Flags.UseSoundboard,
                        ],
                    },
                    {
                        id: ix.user.id,
                        type: OverwriteType.Member,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.ManageChannels,
                        ],
                    },
                ],
                reason: (isReSetup ? 'Re-setup' : 'Setup') + ' by ' + ix.user.tag,
            });
        }
        let text = guild.channels.cache.find(
            (c) => c.name === channel_names.text && c.type === ChannelType.GuildText && c.parentId === cat.id,
        );
        if (!text) {
            // Text channel creation
            text = await guild.channels.create({
                name: channel_names.text,
                type: ChannelType.GuildText,
                parent: cat.id,
                rateLimitPerUser: 0,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
                        deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions],
                    },
                    {
                        id: ix.user.id,
                        type: OverwriteType.Member,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.AddReactions,
                        ],
                    },
                ],
                reason: (isReSetup ? 'Re-setup' : 'Setup') + ' by ' + ix.user.tag,
            });
        }
        let azkar = guild.channels.cache.find(
            (c) => c.name === channel_names.azkar && c.type === ChannelType.GuildText && c.parentId === cat.id,
        );
        if (!azkar) {
            // Azkar channel creation
            azkar = await guild.channels.create({
                name: channel_names.azkar,
                type: ChannelType.GuildText,
                parent: cat.id,
                rateLimitPerUser: 0,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
                        deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions],
                    },
                    {
                        id: ix.user.id,
                        type: OverwriteType.Member,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.AddReactions,
                        ],
                    },
                ],
                reason: (isReSetup ? 'Re-setup' : 'Setup') + ' by ' + ix.user.tag,
            });
        }
        st.azkarChannelId = azkar.id;
        startAzkarTimerForGuild(gid, azkar.id, true);
        if (!global.setupGuilds) global.setupGuilds = {};
        global.setupGuilds[gid] = {
            // Store setup data in global state for quick access and persistence
            categoryId: cat.id,
            voiceChannelId: voice.id,
            textChannelId: text.id,
            azkarChannelId: azkar.id,
            // leftAt: null,
            // isLeft: false,
        };
        await persistSetupData();
        const embed = createControlEmbed(st, gid);
        const rows = [];
        if (st.playbackMode === 'surah') {
            rows.push(createReciterRow(st), createSelectRow(st));
        } else {
            rows.push(createRadioRow(st));
        }
        rows.push(createButtonRow(st), ...createNavigationRow(st, gid));
        const msg = await text.send({
            content:
                'تم ' +
                (isReSetup ? 'إعادة ' : '') +
               'إعداد فئة القرآن بواسطة أحد مسؤولي هذا الخادم. استخدم اللوحة أدناه.',
            embeds: [embed],
            components: rows,
        });
        await saveControlId(gid, text.id, msg.id);
        return { category: cat, voiceChannel: voice, textChannel: text, azkarChannel: azkar };
    } catch (err) {
        if (!err.message?.includes('Missing Permissions') && !err.message?.includes('Missing Access') && err.code !== 50013) {
            logger.error('Setup failed in guild ' + gid, err);
        }
        throw err;
    }
}

async function autoSetupAllGuilds(client) {
    // Utility to auto-setup all guilds with existing setup data on bot startup, useful for recovery after crashes or redeploys
    try {
        const setups = global.setupGuilds || {};
        let ok = 0,
            fail = 0;
        for (const [gid, data] of Object.entries(setups)) {
            try {
                const guild = client.guilds.cache.get(gid);
                if (!guild) {
                    logger.warn('Guild missing for auto-setup: ' + gid);
                    fail++;
                    continue;
                }
                const mockIx = {
                    guild,
                    user: client.user,
                    channel:
                        (await guild.channels.fetch(data.textChannelId).catch(() => null)) ||
                        guild.channels.cache.find((c) => c.type === ChannelType.GuildText),
                };
                if (!mockIx.channel) {
                    logger.warn('No text channel for guild ' + gid);
                    fail++;
                    continue;
                }
                await setupQuranCategory(guild, mockIx, { channelWillBeDeleted: false });
                ok++;
                logger.info('Auto-setup OK: ' + gid);
            } catch (e) {
                logger.error('Auto-setup failed: ' + gid, e);
                fail++;
            }
        }
        logger.info(`Auto-setup done: ${ok} ok, ${fail} failed`);
        return { success: ok, failed: fail };
    } catch (e) {
        logger.error('Auto-setup batch failed', e);
        return {
            success: 0,
            failed: Object.keys(global.setupGuilds || {}).length,
            error: e.message,
        };
    }
}

module.exports.setupQuranCategory = setupQuranCategory;
module.exports.autoSetupAllGuilds = autoSetupAllGuilds;
