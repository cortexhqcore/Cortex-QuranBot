require('pathlra-aliaser')();

const coreLoader = require('@loader-core_bootstrap');

// Classify Discord API errors into user-friendly categories for appropriate handling
function getErrorType(error) {
    if (!error) return 'UNKNOWN_ERROR';

    // Interaction expired or already acknowledged errors
    if (
        error.message?.includes('Unknown interaction') ||
        error.message?.includes('10062') ||
        error.message?.includes('InteractionNotReplied') ||
        error.code === 10062
    ) {
        return 'INTERACTION_EXPIRED';
    }

    // Permission-related errors from Discord API
    if (
        error.message?.includes('Missing Permissions') ||
        error.message?.includes('50013') ||
        error.message?.includes('Missing Access') ||
        error.code === 50013
    ) {
        return 'PERMISSION_DENIED';
    }

    // Voice connection state errors
    if (error.message?.includes('VoiceConnection not available') || error.message?.includes('4004') || error.code === 4004) {
        return 'VOICE_CONNECTION_ERROR';
    }

    // JavaScript runtime errors indicating state corruption
    if (
        error.message?.includes('Cannot read properties of undefined') ||
        error.message?.includes('Cannot destructure property') ||
        error.message?.includes('Cannot read property')
    ) {
        return 'STATE_ERROR';
    }

    // Message lookup failures
    if (error.message?.includes('Unknown Message') || error.message?.includes('10008') || error.code === 10008) {
        return 'MESSAGE_NOT_FOUND';
    }

    // Network connectivity issues
    if (error.message?.includes('ETIMEDOUT') || error.message?.includes('ECONNRESET') || error.message?.includes('fetch failed')) {
        return 'NETWORK_ERROR';
    }

    // Fallback for uncategorized errors
    return 'GENERAL_ERROR';
}

// Map error types to localized, user-friendly messages
function getErrorMessage(errorType, originalMessage = '') {
    switch (errorType) {
        case 'INTERACTION_EXPIRED':
            return 'التفاعل لم يعد صالحًا يرجى استخدام الأمر control لإنشاء لوحة تحكم جديدة';
        case 'PERMISSION_DENIED':
            return 'البوت لا يملك الصلاحيات المطلوبة للقيام بهذا الإجراء';
        case 'VOICE_CONNECTION_ERROR':
            return 'حدث خطأ في الاتصال الصوتي يرجى استخدام leave ثم join مرة أخرى';
        case 'STATE_ERROR':
            return 'جاري تهيئة السيرفر يرجى المحاولة مرة أخرى بعد بضع ثوان';
        case 'MESSAGE_NOT_FOUND':
            return 'رسالة التحكم غير موجودة يرجى استخدام control لإنشاء لوحة جديدة';
        case 'NETWORK_ERROR':
            return 'خطأ في الاتصال بالشبكة يرجى المحاولة مرة أخرى';
        default:
            coreLoader.logger.debug('Uncategorized Error: ' + (originalMessage || 'Unknown'));
            return 'حدث خطأ أثناء معالجة طلبك يرجى المحاولة مرة أخرى لاحقًا';
    }
}

// Centralized error handler for all interaction failures with recovery attempts
async function handleInteractionError(interaction, error, context) {
    try {
        const errorType = getErrorType(error);

        // Skip user notification for expected expiration errors
        if (errorType === 'INTERACTION_EXPIRED' || errorType === 'MESSAGE_NOT_FOUND') {
            coreLoader.logger.debug(`Interaction Expired Or Message Not Found In ${context} Skipping Error Message`);
            return;
        }

        // Log non-permission errors for monitoring
        if (errorType !== 'PERMISSION_DENIED') {
            coreLoader.logger.error(`Interaction Error ${context} ${errorType}`, error);
        }

        const userMessage = getErrorMessage(errorType, error.message);

        // Attempt to send error message to user with appropriate interaction method
        try {
            if (!interaction.replied && !interaction.deferred) {
                if (interaction.isCommand()) {
                    await interaction
                        .reply({
                            content: userMessage,
                            flags: coreLoader.MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                } else {
                    await interaction.deferUpdate().catch(() => {});
                    await interaction
                        .followUp({
                            content: userMessage,
                            flags: coreLoader.MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }
            } else if (interaction.deferred && !interaction.replied) {
                await interaction
                    .editReply({
                        content: userMessage,
                        flags: coreLoader.MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            } else {
                await interaction
                    .followUp({
                        content: userMessage,
                        flags: coreLoader.MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            }
        } catch (replyError) {
            // Handle secondary error if error message itself fails to send
            const replyErrorType = getErrorType(replyError);
            if (replyErrorType === 'INTERACTION_EXPIRED' || replyErrorType === 'MESSAGE_NOT_FOUND') {
                coreLoader.logger.debug('Cannot Send Error Message Interaction Or Message Expired');
                return;
            }
            coreLoader.logger.error('Failed To Send Error Message To User', replyError);
        }

        // Attempt automatic recovery for state errors by refreshing control panel
        if (errorType === 'STATE_ERROR' && context === 'interactionHandler') {
            try {
                const guildId = interaction.guildId;
                const guildState = coreLoader.getGuildState(guildId);
                if (guildState) {
                    await coreLoader.updateControlPanel(interaction, guildState);
                    coreLoader.logger.info(`Recovered Control Panel For Guild ${guildId} After Error`);
                }
            } catch (recoveryError) {
                coreLoader.logger.debug('Failed To Recover Control Panel After Error');
            }
        }
    } catch (finalError) {
        // Log critical failures in error handling itself
        coreLoader.logger.critical('Complete Failure In Handling Interaction Error', finalError);
    }
}

module.exports.getErrorType = getErrorType;
module.exports.getErrorMessage = getErrorMessage;
module.exports.handleInteractionError = handleInteractionError;
