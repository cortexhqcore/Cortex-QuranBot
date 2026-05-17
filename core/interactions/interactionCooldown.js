require('pathlra-aliaser')();

const coreLoader = require('@loader-core_bootstrap');

// Check if user interaction should be blocked due to global cooldown or rate limiting
async function checkGlobalCooldown(interaction) {
    const userId = interaction.user.id;

    // Check global cooldown first (applies to all users regardless of guild)
    if (coreLoader.isUserInGlobalCooldown(userId)) {
        try {
            // Send appropriate ephemeral response based on interaction type
            if (!interaction.replied && !interaction.deferred) {
                if (interaction.isCommand()) {
                    await interaction.reply({
                        content: 'أنت في وضع الانتظار المؤقت بسبب كثرة الطلبات. يرجى المحاولة لاحقًا.',
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content: 'أنت في وضع الانتظار المؤقت بسبب كثرة الطلبات. يرجى المحاولة لاحقًا.',
                        ephemeral: true,
                    });
                }
            } else if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'أنت في وضع الانتظار المؤقت بسبب كثرة الطلبات. يرجى المحاولة لاحقًا.',
                    ephemeral: true,
                });
            }

            coreLoader.logger.warn(`Blocked Interaction From User ${userId} Due To Global Cooldown`);
            return true;
        } catch (error) {
            // Log but continue blocking if message send fails
            coreLoader.logger.debug('Failed To Send Cooldown Message To User');
            return true;
        }
    }

    // Check guild-specific rate limits
    const rateLimitResult = coreLoader.checkRateLimit(userId, interaction.guildId);
    if (!rateLimitResult.valid) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                if (interaction.isCommand()) {
                    await interaction.reply({
                        content: rateLimitResult.message,
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content: rateLimitResult.message,
                        ephemeral: true,
                    });
                }
            } else if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: rateLimitResult.message,
                    ephemeral: true,
                });
            }

            coreLoader.logger.warn(`Blocked Interaction From User ${userId} Due To Rate Limit`);
            return true;
        } catch (error) {
            coreLoader.logger.error('Failed To Send Rate Limit Message');
            return true;
        }
    }

    // Interaction passed all cooldown checks
    return false;
}

module.exports.checkGlobalCooldown = checkGlobalCooldown;
