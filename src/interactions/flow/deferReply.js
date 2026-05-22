require('pathlra-aliaser')();

const logger = require('@logging/logger');

async function deferInteraction(interaction, ephemeral = false) {
    if (interaction.deferred || interaction.replied) return;
    try {
        if (interaction.isCommand()) {
            await interaction.deferReply({ flags: ephemeral ? 64 : undefined });
        } else {
            await interaction.deferUpdate();
        }
    } catch (error) {
        logger.debug('Defer failed: ' + error.message);
    }
}

async function safeReply(interaction, options, loggerRef = logger) {
    try {
        if (interaction.deferred && !interaction.replied) {
            return await interaction.editReply(options);
        } else if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        try {
            if (interaction.channel) {
                return await interaction.channel.send(options);
            }
        } catch (fallbackError) {
            loggerRef.error('All reply methods failed: ' + error.message);
        }
    }
}

async function safeError(interaction, message, loggerRef = logger) {
    await safeReply(interaction, { content: message, flags: 64 }, loggerRef);
}

async function wrapInteraction(interaction, executor, options = {}) {
    const { ephemeral = true, context = {} } = options;
    await deferInteraction(interaction, ephemeral);
    try {
        return await executor(interaction, context);
    } catch (error) {
        logger.error(`Interaction error in ${context.label || 'handler'}: ${error.message}`, error);
        await safeError(interaction, 'حدث خطأ أثناء معالجة الطلب', context.logger || logger);
    }
}

module.exports.deferInteraction = deferInteraction;
module.exports.safeReply = safeReply;
module.exports.safeError = safeError;
module.exports.wrapInteraction = wrapInteraction;
