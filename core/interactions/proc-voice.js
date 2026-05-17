require('pathlra-aliaser')();

// List of interaction types allowed even when bot is not in a voice channel
const allowed_when_not_in_voice = [
    'join_vc',
    'leave_vc',
    'submit_complaint',
    'open_complaint_modal',
    'cancel_support',
    'more_features',
    'back_to_main',
    'webhook_azkar_info',
    'check_hafsat',
    'stop_webhook',
    'register_webhook',
];
function isBotInVoice(guildState) {
    return !!(guildState?.connection && !guildState.connection.destroyed && guildState.channelId);
}

// Check if an interaction type is permitted without an active voice connection
function isAllowedWithoutVoice(interactionType) {
    return allowed_when_not_in_voice.includes(interactionType);
}

// Validate that the bot is in a voice channel before allowing playback-related interactions
async function checkVoiceState(interaction, guildState, interactionType) {
    const isActuallyInVoice = isBotInVoice(guildState);

    // Block interactions that require voice connection if bot is not connected
    if (!isActuallyInVoice && !isAllowedWithoutVoice(interactionType)) {
        await interaction.deferUpdate().catch(() => {});

        await interaction
            .followUp({
                content:
                    'البوت غير موجود في غرفة صوتية حالياً. يجب الضغط على زر دخول أولاً للانضمام إلى الغرفة الصوتية قبل استخدام أي ميزة أخرى',
                flags: 64,
            })
            .catch(() => {});
        return false;
    }

    return true;
}

module.exports.isBotInVoice = isBotInVoice;
module.exports.isAllowedWithoutVoice = isAllowedWithoutVoice;
module.exports.checkVoiceState = checkVoiceState;
module.exports.allowed_when_not_in_voice = allowed_when_not_in_voice;
