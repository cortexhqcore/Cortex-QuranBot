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

// send msg with exponential backoff retry
async function sendWithRetry(ch, content, maxRetry, gid, cid) {
    let lastErr;
    for (let att = 1; att <= maxRetry; att++) {
        try {
            const msg = await ch.send(content);
            return { success: true, message: msg };
        } catch (err) {
            lastErr = err;
            if (err.code === 50013) {
                logger.info('Azkar Missing Permissions In Channel ' + cid);
                break;
            }
            if (err.code === 429) {
                await new Promise((r) => setTimeout(r, (err.retry_after || 5) * 1000));
                continue;
            }
            if (att < maxRetry) await new Promise((r) => setTimeout(r, azkar_retry_delay_ms * att));
        }
    }
    logger.info('Azkar Send Failed In Guild ' + gid + ' After ' + maxRetry + ' Attempts');
    return { success: false, error: lastErr };
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
        if (!res.ok) return { success: false, reason: 'HTTP ' + res.status };
        const result = await sendWithRetry(ch, { embeds: [new EmbedBuilder().setColor(0x1e1f22).setImage(imgUrl)] }, maxRetry, gid, cid);
        if (result.success) {
            trackAzkarMessage(result.message.id, ts);
            await incStat();
        }
        return result;
    } catch (err) {
        logger.warn('Failed to load adhkar image ' + err.message);
        return { success: false, reason: err.message };
    }
}

async function sendAudioAzkar(ch, dhikr, text, ts, gid, maxRetry, cid) {
    if (!dhikr.audio) return { success: false, reason: 'No audio available' };
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
    if (!cat.audio) return { success: false, reason: 'No category audio available' };
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

    return { success: false, reason: 'All send methods failed' };
}

module.exports.sendRandomAzkar = sendRandomAzkar;
module.exports.sendWithRetry = sendWithRetry;
module.exports.trackAzkarMessage = trackAzkarMessage;
module.exports.trackAudioData = trackAudioData;
