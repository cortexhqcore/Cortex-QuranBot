require('pathlra-aliaser')();

const coreLoader = require('@loader-core_bootstrap');
const { handleInteractionError } = require('@interactionErrors-core_interactions');
const { checkGlobalCooldown } = require('@interactionCooldown-core_interactions');
const { checkDuplicateInteraction, addToInteractionCache } = require('@proc-cache-core_interactions');
const { handleCommandInteraction } = require('@proc-commands-core_interactions');
const { isModalSubmit, handleModalInteraction } = require('@proc-modals-core_interactions');
const { isPublicFeature, handlePublicInteraction } = require('@proc-public-core_interactions');
const { checkVoiceState } = require('@proc-voice-core_interactions');
const { checkAuthorization } = require('@proc-auth-core_interactions');
const { checkVoiceCooldown } = require('@proc-cooldown-core_interactions');
const { handleButtonInteraction } = require('@proc-buttons-core_interactions');
const { handleMenuInteraction } = require('@proc-menus-core_interactions');

// Central routing function for all validated interactions
async function handleInteraction(interaction) {
    // Skip processing if this is a duplicate of a recently handled interaction
    if (checkDuplicateInteraction(interaction)) {
        return;
    }

    // Cache interaction metadata for duplicate detection and analytics
    addToInteractionCache(interaction);

    try {
        // Apply global cooldown and rate limiting checks
        const isBlocked = await checkGlobalCooldown(interaction);
        if (isBlocked) {
            return;
        }

        // Final type validation before routing
        if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) {
            return;
        }

        const guildId = interaction.guildId;
        const guildState = coreLoader.getGuildState(guildId);

        // Route slash commands to dedicated handler
        if (interaction.isCommand()) {
            await handleCommandInteraction(interaction, guildState);
            return;
        }

        // Handle modal form submissions
        if (isModalSubmit(interaction)) {
            const handled = await handleModalInteraction(interaction);
            if (handled) return;
        }

        // Route public features that don't require guild state or authorization
        if (isPublicFeature(interaction)) {
            await handlePublicInteraction(interaction);
            return;
        }

        // Extract interaction identifier for authorization and cooldown checks
        const interactionType = interaction.isButton() ? interaction.customId : interaction.customId;

        // Validate voice connection state before allowing playback-related actions
        const voiceValid = await checkVoiceState(interaction, guildState, interactionType);
        if (!voiceValid) {
            return;
        }

        // Verify user has permission to execute the requested action
        const authValid = await checkAuthorization(interaction, guildState, interactionType);
        if (!authValid) {
            return;
        }

        // Check action-specific cooldowns (e.g., skip command rate limits)
        const cooldownValid = await checkVoiceCooldown(interaction, guildState, interactionType, guildId);
        if (!cooldownValid) {
            return;
        }

        // Route to final handler based on interaction component type
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await handleMenuInteraction(interaction);
        }
    } catch (error) {
        // Catch-all error handler with user notification and recovery attempts
        await handleInteractionError(interaction, error, 'interactionHandler');
    }
}

module.exports.handleInteraction = handleInteraction;
