require('pathlra-aliaser')();

const logger = require('@logging/logger');
async function deferIfPending(interaction, ephemeral = false) {
    if (interaction.deferred || interaction.replied) return;
    try {
        if (interaction.isCommand()) {
            await interaction.deferReply({ flags: ephemeral ? 64 : undefined });
        } else {
            if (ephemeral) {
                await interaction.deferReply({ flags: 64 });
            } else {
                await interaction.deferUpdate();
            }
        }
    } catch (err) {
        // ignore known defer conflicts (code 40060)
        if (err.code !== 40060) {
            logger.debug('Defer skipped/failed: ' + err.message);
        }
    }
}

// reply chain: tries edit/followup first, falls back to channel.send if interaction expires (10062)
async function safeReply(interaction, options, ctx = 'unknown') {
    let result = null;
    try {
        if (interaction.replied) {
            result = await interaction.followUp(options);
            if (result) return result;
        } else if (interaction.deferred) {
            result = await interaction.editReply(options);
            if (result) return result;
        } else {
            result = await interaction.reply(options);
            if (result) return result;
        }
    } catch (primary) {
        logger.debug('Primary reply failed in ' + ctx + ': ' + primary.message);
    }
    // If we got here, primary methods failed or returned null - try channel fallback
    if (interaction.channel) {
        try {
            result = await interaction.channel.send(options);
            if (result) return result;
        } catch (chanErr) {
            logger.error('Channel fallback failed in ' + ctx, chanErr);
        }
    }

    return null;
}

async function safeError(interaction, message, ctx = 'unknown') {
    return safeReply(interaction, { content: message, flags: 64 }, ctx);
}

function getFriendlyErrorMessage(error) {
    if (!error) return 'حدث خطأ غير متوقع';
    const msg = error.message || String(error);
    if (msg.includes('Missing Permissions') || msg.includes('50013')) {
        return 'البوت لا يملك الصلاحيات المطلوبة لتنفيذ هذا الإجراء';
    }
    if (msg.includes('Unknown interaction') || msg.includes('10062')) {
        return 'انتهت صلاحية التفاعل، يرجى استخدام الأمر مجدداً';
    }
    if (msg.includes('Unknown Message') || msg.includes('10008')) {
        return 'تم حذف رسالة التحكم، يرجى إنشاء لوحة جديدة';
    }
    if (msg.includes('VoiceConnection') || msg.includes('4004')) {
        return 'حدث خطأ في الاتصال الصوتي، يرجى إعادة الدخول';
    }
    if (msg.includes('No compatible encryption modes')) {
        return 'تعذر الاتصال بخادم الصوت الحالي يرجى المحاولة لاحقا أو التواصل مع الدعم الفني';
    }
    return 'حدث خطأ أثناء معالجة الطلب، يرجى المحاولة لاحقاً';
}

async function handleInteractionError(interaction, error, ctx = 'unknown') {
    logger.error(`Interaction Error [${ctx}]: ${error.message}`, error);
    const friendly = getFriendlyErrorMessage(error);
    await safeError(interaction, friendly, ctx);
}

async function wrapInteraction(interaction, executor, opts = {}) {
    const { ephemeral = true, label = 'unknown' } = opts;
    await deferIfPending(interaction, ephemeral);
    try {
        return await executor(interaction, { label });
    } catch (err) {
        await handleInteractionError(interaction, err, label);
    }
}

module.exports.deferIfPending = deferIfPending;
module.exports.safeReply = safeReply;
module.exports.safeError = safeError;
module.exports.getFriendlyErrorMessage = getFriendlyErrorMessage;
module.exports.handleInteractionError = handleInteractionError;
module.exports.wrapInteraction = wrapInteraction;
