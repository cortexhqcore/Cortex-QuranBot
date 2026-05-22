require('pathlra-aliaser')();

// Actions that bypass voice check - support/complaint flows don't need audio
const allowed_without_voice = [
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

// Check if bot has active voice connection - quick truthy check on channel + connection
function isBotConnected(gs) {
    return gs?.connection && !gs.connection.destroyed && gs.channelId;
}

// Check if action is exempt from voice requirement
function isVoiceExempt(actionId) {
    return allowed_without_voice.includes(actionId);
}

// Block playback actions if bot not in voice, unless action is whitelisted
async function requireVoiceChannel(ixn, gs, actionId) {
    // Skip check for exempt actions or if bot already connected
    if (isBotConnected(gs) || isVoiceExempt(actionId)) return true;

    await ixn.deferUpdate().catch(() => {});
    await ixn
        .followUp({
            content:
                'البوت غير موجود في غرفة صوتية حالياً. يجب الضغط على زر دخول أولاً للانضمام إلى الغرفة الصوتية قبل استخدام أي ميزة أخرى',
            flags: 64,
        })
        .catch(() => {});
    return false;
}

module.exports.isBotConnected = isBotConnected;
module.exports.isVoiceExempt = isVoiceExempt;
module.exports.requireVoiceChannel = requireVoiceChannel;
module.exports.allowed_without_voice = allowed_without_voice;
