require('pathlra-aliaser')();

const { azkar_expiry_ms, azkar_interval_ms } = require('@state/azkar-config');
const { getAudioData, getMessageTimestamp } = require('@state/azkar-cache');
const { sendRandomAzkar } = require('@state/azkar-sender');
const { startAzkarTimerForGuild, stopAzkarTimerForGuild, resetAzkarFirstMessage, isAzkarTimerActive } = require('@state/azkar-timer');

function getAzkarAudioUrl(customId) {
    return getAudioData(customId);
}

function getAzkarMessageTimestamp(messageId) {
    return getMessageTimestamp(messageId);
}

module.exports.sendRandomAzkar = sendRandomAzkar;
module.exports.startAzkarTimerForGuild = startAzkarTimerForGuild;
module.exports.stopAzkarTimerForGuild = stopAzkarTimerForGuild;
module.exports.resetAzkarFirstMessage = resetAzkarFirstMessage;
module.exports.getAzkarAudioUrl = getAzkarAudioUrl;
module.exports.getAzkarMessageTimestamp = getAzkarMessageTimestamp;
module.exports.isAzkarTimerActive = isAzkarTimerActive;
module.exports.AZKAR_EXPIRY_MS = azkar_expiry_ms;
module.exports.AZKAR_INTERVAL_MS = azkar_interval_ms;
