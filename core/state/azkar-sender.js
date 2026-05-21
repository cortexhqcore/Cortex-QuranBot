require('pathlra-aliaser')();

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('@logger');
const { clean_Dhikr } = require('@azkar');
const {
    adhkar_base_url,
    azkar_expiry_ms,
    azkar_max_retry_attempts,
    azkar_retry_delay_ms,
    request_timeout_ms,
    fallback_azkar_data,
} = require('@azkar-config-core_state');
const { setAudioData, deleteAudioData, setMessageTimestamp, deleteMessageTimestamp } = require('@azkar-cache-core_state');

const persistentStateManager = require('@PersistentStateManager-core_state');

// Classify Discord API errors to determine retry strategy
function categorizeDiscordError(err) {
    if (!err) return 'UNKNOWN';
    const code = err.code || err.message;
    if (code === 10003 || code === 10008 || code === 'Unknown Channel' || code === 'Unknown Message') return 'UNKNOWN_CHANNEL';
    if (code === 50013 || code === 50001) return 'MISSING_PERMISSIONS';
    if (code === 429) return 'RATE_LIMIT';
    if (code === 503 || err.message?.includes('ETIMEDOUT') || err.message?.includes('ECONNRESET')) return 'TRANSIENT';
    return 'OTHER';
}

async function sendWithRetry(ch, content, maxRetry, gid, cid) {
    let lastErr;
    for (let att = 1; att <= maxRetry; att++) {
        try {
            const msg = await ch.send(content);
            return { success: true, message: msg, error: null, type: null };
        } catch (err) {
            lastErr = err;
            const errType = categorizeDiscordError(err);
            if (errType === 'UNKNOWN_CHANNEL' || errType === 'MISSING_PERMISSIONS') {
                logger.info(`Azkar ${errType === 'MISSING_PERMISSIONS' ? 'Missing Permissions' : 'Channel Not Found'} In Channel ${cid}`);
                return { success: false, error: err, type: errType, guildId: gid, channelId: cid };
            }
            if (errType === 'RATE_LIMIT') {
                await new Promise((r) => setTimeout(r, (err.retry_after || 5) * 1000));
                continue;
            }
            if (att < maxRetry) {
                await new Promise((r) => setTimeout(r, azkar_retry_delay_ms * att));
            }
        }
    }
    logger.info('Azkar Send Failed In Guild ' + gid + ' After ' + maxRetry + ' Attempts');
    return { success: false, error: lastErr, type: categorizeDiscordError(lastErr), guildId: gid, channelId: cid };
}

function trackAzkarMessage(mid, ts) {
    setMessageTimestamp(mid, ts);
    setTimeout(() => deleteMessageTimestamp(mid), azkar_expiry_ms);
}

function trackAudioData(id, data) {
    setAudioData(id, data);
    setTimeout(() => deleteAudioData(id), 10000);
}

async function incStat() {
    try {
        const { incrementStat } = require('@StatisticsTracker-core_statistics');
        if (typeof incrementStat === 'function') incrementStat('azkarSent', 1);
    } catch {
        logger.debug('Statistics tracking not available for azkar');
    }
}

async function sendImageAzkar(ch, imgUrl, ts, gid, maxRetry, cid) {
    try {
        const res = await fetch(imgUrl, {
            headers: { 'User-Agent': 'QuranBot/1.0' },
            timeout: request_timeout_ms,
        });
        if (!res.ok) return { success: false, type: 'OTHER', reason: 'HTTP ' + res.status, guildId: gid, channelId: cid };
        const result = await sendWithRetry(ch, { embeds: [new EmbedBuilder().setColor(0x1e1f22).setImage(imgUrl)] }, maxRetry, gid, cid);
        if (result.success) {
            trackAzkarMessage(result.message.id, ts);
            await incStat();
        }
        return result;
    } catch (err) {
        logger.warn('Failed to load adhkar image ' + err.message);
        return { success: false, type: categorizeDiscordError(err), reason: err.message, guildId: gid, channelId: cid };
    }
}

async function sendAudioAzkar(ch, dhikr, text, ts, gid, maxRetry, cid) {
    if (!dhikr.audio) return { success: false, type: 'OTHER', reason: 'No audio available', guildId: gid, channelId: cid };
    const url = adhkar_base_url + dhikr.audio;
    const id = dhikr.filename || 'dhikr_' + dhikr.id;
    const customId = 'play_azkar_' + id + '_' + ts;

    trackAudioData(customId, { url, filename: id, timestamp: ts });

    const result = await sendWithRetry(
        ch,
        {
            embeds: [
                new EmbedBuilder()
                    .setColor(0x1e1f22)
                    .setTitle('🕋 ذكر')
                    .setDescription(
                        text +
                            '\n\n> **ملاحظة**\nللاستماع إلى الذكر بطريقة أوضح وأدق، يُرجى الضغط على زر **استماع**.\nوقد يساعد ذلك على فهم الذكر وقراءته بالشكل الصحيح.',
                    ),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(customId).setLabel('استماع').setStyle(ButtonStyle.Secondary),
                ),
            ],
        },
        maxRetry,
        gid,
        cid,
    );

    if (result.success) {
        trackAzkarMessage(result.message.id, ts);
        await incStat();
    }
    return result;
}

async function sendCategoryAudioAzkar(ch, cat, text, ts, gid, maxRetry, cid) {
    if (!cat.audio) return { success: false, type: 'OTHER', reason: 'No category audio available', guildId: gid, channelId: cid };
    const url = adhkar_base_url + cat.audio;
    const id = cat.filename || 'category_' + cat.id;
    const customId = 'play_azkar_category_' + id + '_' + ts;

    trackAudioData(customId, { url, filename: id, timestamp: ts });

    const result = await sendWithRetry(
        ch,
        {
            embeds: [
                new EmbedBuilder()
                    .setColor(0x1e1f22)
                    .setTitle('🕋 ذكر')
                    .setDescription(
                        text +
                            '\n\n> **ملاحظة**\nللاستماع إلى الذكر بطريقة أوضح وأدق، يُرجى الضغط على زر **استماع**.\nوقد يساعد ذلك على فهم الذكر وقراءته بالشكل الصحيح.',
                    ),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(customId).setLabel('استماع للقسم').setStyle(ButtonStyle.Secondary),
                ),
            ],
        },
        maxRetry,
        gid,
        cid,
    );

    if (result.success) {
        trackAzkarMessage(result.message.id, ts);
        await incStat();
    }
    return result;
}

async function handleAzkarDeliveryFailure(result) {
    if (result.success || !result.type || !result.guildId) return;

    const { type, guildId, channelId } = result;
    if (type === 'UNKNOWN_CHANNEL') {
        logger.info(`Azkar self-healing: Clearing invalid channel ${channelId} for guild ${guildId}`);
        persistentStateManager.updateGuildState(guildId, { azkarChannelId: null, azkarFail: 0 });
        const runtimeState = global.guildStates?.get(guildId);
        if (runtimeState?.azkarTimer) {
            clearInterval(runtimeState.azkarTimer);
            runtimeState.azkarTimer = null;
        }
    } else if (type === 'MISSING_PERMISSIONS') {
        const st = persistentStateManager.getGuildState(guildId);
        const currentFailures = (st.azkarFail || 0) + 1;
        logger.warn(`Azkar permission failure ${currentFailures}/10 for guild ${guildId} channel ${channelId}`);

        if (currentFailures >= 10) {
            logger.info(`Azkar auto-disabled: Excessive permission failures for guild ${guildId}`);
            persistentStateManager.updateGuildState(guildId, { azkarChannelId: null, azkarFail: 0 });
            const runtimeState = global.guildStates?.get(guildId);
            if (runtimeState?.azkarTimer) {
                clearInterval(runtimeState.azkarTimer);
                runtimeState.azkarTimer = null;
            }
        } else {
            persistentStateManager.updateGuildState(guildId, { azkarFail: currentFailures });
        }
    }
}

async function sendRandomAzkar(cid, gid, maxRetry = azkar_max_retry_attempts, forceImg = false) {
    const ch = global.client.channels.cache.get(cid) || (await global.client.channels.fetch(cid).catch(() => null));
    if (!ch || !ch.isTextBased?.()) {
        logger.info('Azkar Channel Not Found Or Invalid ' + cid);
        const st = global.guildStates.get(gid);
        if (st) {
            st.azkarChannelId = null;
            if (st.azkarTimer) {
                clearInterval(st.azkarTimer);
                st.azkarTimer = null;
            }
        }
        await handleAzkarDeliveryFailure({
            success: false,
            type: 'UNKNOWN_CHANNEL',
            guildId: gid,
            channelId: cid,
        });
        return { success: false, reason: 'Channel not found or invalid' };
    }

    let data = global.azkarData || [];
    if (!Array.isArray(data) || !data.length) {
        logger.warn('Azkar No Data For Guild ' + gid + ' Using Fallback');
        data = fallback_azkar_data;
    }

    const cat = data[Math.floor(Math.random() * data.length)];
    if (!cat?.array?.length) return { success: false, reason: 'No valid azkar category' };
    const dhikr = cat.array[Math.floor(Math.random() * cat.array.length)];
    if (!dhikr) return { success: false, reason: 'No valid dhikr' };

    const ts = Date.now();
    const text = clean_Dhikr(dhikr.text || 'لا يوجد');
    const useImg = forceImg || (global.azkarImages?.length && Math.random() > 0.5);

    if (useImg && global.azkarImages?.length) {
        const img = global.azkarImages[Math.floor(Math.random() * global.azkarImages.length)];
        const res = await sendImageAzkar(ch, img, ts, gid, maxRetry, cid);
        if (res.success) return { success: true, type: 'image' };
    }

    if (dhikr.audio) {
        const res = await sendAudioAzkar(ch, dhikr, text, ts, gid, maxRetry, cid);
        if (res.success) return { success: true, type: 'audio' };
    }

    if (cat.audio && !dhikr.audio) {
        const res = await sendCategoryAudioAzkar(ch, cat, text, ts, gid, maxRetry, cid);
        if (res.success) return { success: true, type: 'category_audio' };
    }

    await handleAzkarDeliveryFailure({ success: false, type: 'OTHER', guildId: gid, channelId: cid });
    return { success: false, reason: 'All send methods failed' };
}

module.exports.sendRandomAzkar = sendRandomAzkar;
module.exports.sendWithRetry = sendWithRetry;
module.exports.trackAzkarMessage = trackAzkarMessage;
module.exports.trackAudioData = trackAudioData;
