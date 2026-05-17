require('pathlra-aliaser')();

const logger = require('@logger');
const { db, isFirebaseReady } = require('@firebase-client-core_utils');
const { deepCloneForFirebase } = require('@firebase-clone-core_utils');

async function markGuildAsLeft(guildId) {
    if (!isFirebaseReady || !db) return;
    try {
        const now = Date.now();
        const updates = {
            [`setup_guilds/${guildId}/leftAt`]: now,
            [`setup_guilds/${guildId}/isLeft`]: true,
            [`guild_states/${guildId}/leftAt`]: now,
            [`guild_states/${guildId}/isLeft`]: true,
        };
        await db.ref().update(updates);
        logger.info(`Guild ${guildId} marked as left at ${now}`);
    } catch (error) {
        logger.error('Failed to mark guild as left', error);
    }
}

// Reset retention flags when bot rejoins a guild
async function markGuildAsPresent(guildId) {
    if (!isFirebaseReady || !db) return;
    try {
        const updates = {
            [`setup_guilds/${guildId}/isLeft`]: false,
            [`setup_guilds/${guildId}/leftAt`]: null,
            [`guild_states/${guildId}/isLeft`]: false,
            [`guild_states/${guildId}/leftAt`]: null,
        };
        await db.ref().update(updates);
        logger.info(`Guild ${guildId} marked as present (reset retention flags)`);
    } catch (error) {
        logger.error('Failed to mark guild as present', error);
    }
}

// retention_days + 15-day retention period for guild data after bot leaves, to allow for potential rejoin and data recovery
// Mark guild as left in Firebase to trigger 15-day retention window
const retention_days = 15;
const retention_ms = retention_days * 24 * 60 * 60 * 1000;

// Scan Firebase and delete guild data only after retention period expires
async function cleanExpiredLeftData(client) {
    if (!isFirebaseReady || !db) return { success: false, reason: 'Firebase not ready' };
    try {
        const now = Date.now();
        const cutoff = now - retention_ms;
        const [setupSnap, statesSnap, controlIdsSnap, trackedSnap] = await Promise.all([
            db.ref('setup_guilds').once('value'),
            db.ref('guild_states').once('value'),
            db.ref('control_ids').once('value'),
            db.ref('tracked_guilds').once('value'),
        ]);

        const setupGuilds = setupSnap.val() || {};
        const guildStates = statesSnap.val() || {};
        const controlIds = controlIdsSnap.val() || {};
        const trackedGuilds = trackedSnap.val() || [];

        const expiredGuildIds = [];
        for (const [gid, data] of Object.entries(setupGuilds)) {
            if (data.isLeft && data.leftAt && data.leftAt < cutoff) {
                expiredGuildIds.push(gid);
            }
        }

        if (expiredGuildIds.length === 0) {
            logger.info('No expired left guilds found for cleanup');
            return { success: true, cleaned: 0 };
        }

        const updates = {};
        expiredGuildIds.forEach((gid) => {
            updates[`setup_guilds/${gid}`] = null;
            updates[`guild_states/${gid}`] = null;
            if (controlIds[gid]) updates[`control_ids/${gid}`] = null;
        });

        const validTracked = trackedGuilds.filter((g) => !expiredGuildIds.includes(g.guildId));
        if (validTracked.length !== trackedGuilds.length) {
            updates['tracked_guilds'] = deepCloneForFirebase(validTracked);
        }

        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
        }

        if (client) {
            for (const gid of expiredGuildIds) {
                if (global.guildStates) global.guildStates.delete(gid);
                if (global.setupGuilds) delete global.setupGuilds[gid];
            }
        }

        logger.info(`Cleaned up ${expiredGuildIds.length} expired guilds after ${retention_days} days`);
        return { success: true, cleaned: expiredGuildIds.length };
    } catch (error) {
        logger.error('Error cleaning expired left data', error);
        return { success: false, reason: error.message };
    }
}

module.exports.markGuildAsLeft = markGuildAsLeft;
module.exports.markGuildAsPresent = markGuildAsPresent;
module.exports.cleanExpiredLeftData = cleanExpiredLeftData;
module.exports.retention_days = retention_days;
