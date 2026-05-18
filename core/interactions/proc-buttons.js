require('pathlra-aliaser')();

const coreLoader = require('@loader-core_bootstrap');

/**
 * Button routing configuration.
 * Maps button custom IDs to their corresponding handler modules in coreLoader.
 * Structured as grouped arrays for maintainability and cleaner routing logic.
 */
const ROUTE_GROUPS = {
    navigationButtons: ['prev_page', 'next_page', 'prev_reciter_page', 'next_reciter_page'],
    playbackButtons: ['prev', 'next', 'pause', 'resume'],
    radioButtons: ['toggle_radio', 'prev_radio_page', 'next_radio_page'],
    systemButtons: ['toggle_control_mode', 'join_vc', 'leave_vc'],
    adminServerListButton: ['admin_server_list', 'admin_refresh_servers', 'admin_back_to_servers'],
    adminBotStatsButton: ['admin_bot_stats', 'admin_refresh_stats'],
    adminVoiceChannelsPagination: ['admin_voice_channels', 'admin_prev_voice', 'admin_next_voice', 'admin_refresh_voice'],
    adminServerListPagination: ['admin_prev_servers', 'admin_next_servers'],
    complaintButton: ['submit_complaint'],
    openComplaintModalButton: ['open_complaint_modal'],
    adminPanelButton: ['admin_back_to_panel', 'admin_close_panel'],
    adminSendMessageButton: ['admin_send_message'],
    adminResponseModalButton: ['admin_response_modal'],
    moreFeaturesButton: ['more_features'],
    backToMainButton: ['back_to_main'],
};

// Prefix mappings for dynamically generated button IDs
const PREFIX_ROUTES = {
    admin_kick_bot_: 'adminKickBotButton',
    admin_confirm_kick_: 'adminConfirmKickButton',
};

function getButtonHandler(customId) {
    // Step 1: Check exact matches within grouped arrays
    for (const [moduleKey, idArray] of Object.entries(ROUTE_GROUPS)) {
        if (Array.isArray(idArray) && idArray.includes(customId)) {
            return coreLoader[moduleKey];
        }
    }

    // Step 2: Check prefix matches for dynamic IDs, admin_kick_bot_)
    for (const [prefix, moduleKey] of Object.entries(PREFIX_ROUTES)) {
        if (customId.startsWith(prefix)) {
            return coreLoader[moduleKey];
        }
    }

    // No matching route found
    return null;
}

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    const handler = getButtonHandler(customId);
    if (!handler) {
        if (customId === 'cancel_support' || customId === 'admin_cancel_kick') {
            const replyText = customId === 'cancel_support' ? 'تم إغلاق نافذة الدعم' : 'تم إلغاء عملية الخروج';

            await interaction.reply({ content: replyText, flags: 64 });
            return true;
        }
        return false;
    }

    // Apply unified cooldown for voice control buttons to match slash commands
    if (customId === 'join_vc' || customId === 'leave_vc') {
        const cmdKey = customId === 'join_vc' ? 'join' : 'leave';
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const cdResult = coreLoader.checkCooldown(userId, guildId, cmdKey);
        if (!cdResult.allowed) {
            await interaction.deferUpdate().catch(() => {});
            await interaction
                .followUp({
                    content: coreLoader.getCooldownResponse(cdResult.remaining, cdResult.type),
                    flags: 64,
                })
                .catch(() => {});
            return true;
        }
    }

    if (typeof handler.execute === 'function') {
        const success = await handler.execute(interaction);
        // Persist cooldown after successful execution to prevent rapid toggling
        if ((customId === 'join_vc' || customId === 'leave_vc') && success !== false) {
            const cmdKey = customId === 'join_vc' ? 'join' : 'leave';
            coreLoader.setCooldown(interaction.user.id, interaction.guildId, cmdKey);
        }
        return true;
    }

    return false;
}

module.exports.handleButtonInteraction = handleButtonInteraction;
module.exports.getButtonHandler = getButtonHandler;
module.exports.NAVIGATION_BUTTONS = ROUTE_GROUPS.navigationButtons;
module.exports.PLAYBACK_BUTTONS = ROUTE_GROUPS.playbackButtons;
module.exports.RADIO_BUTTONS = ROUTE_GROUPS.radioButtons;
module.exports.SYSTEM_BUTTONS = ROUTE_GROUPS.systemButtons;
