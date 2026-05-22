require('pathlra-aliaser')();

const logger = require('@logging/logger');
// Fixed case mismatch that caused undefined interval (0ms spam loop)
const { azkar_interval_ms } = require('@state/azkar-config');
const { setFirstMessage, getFirstMessage, deleteFirstMessage } = require('@state/azkar-cache');
const { sendRandomAzkar } = require('@state/azkar-sender');
function startAzkarTimerForGuild(gid, cid, isFirst = true) {
    const { getGuildState } = require('../state/GuildStateManager');
    const st = getGuildState(gid);
    if (!st) {
        logger.error('Azkar Cannot Start Timer Guild State Not Found ' + gid);
        return { success: false, reason: 'Guild state not found' };
    }
    if (st.azkarTimer) {
        clearInterval(st.azkarTimer);
        st.azkarTimer = null;
    }
    st.azkarChannelId = cid;
    if (isFirst) setFirstMessage(gid, true);
    logger.info('Azkar Starting Timer For Guild ' + gid + ' Channel ' + cid);
    sendRandomAzkar(cid, gid, 5, isFirst);
    st.azkarTimer = setInterval(() => sendRandomAzkar(cid, gid, 5, false), azkar_interval_ms);
    logger.info('Azkar Timer Started For Guild ' + gid + ' Interval 30 Minutes');
    return { success: true, channelId: cid };
}
function stopAzkarTimerForGuild(gid) {
    const st = global.guildStates.get(gid);
    if (st?.azkarTimer) {
        clearInterval(st.azkarTimer);
        st.azkarTimer = null;
        deleteFirstMessage(gid);
        logger.info('Azkar Timer Stopped For Guild ' + gid);
        return { success: true };
    }
    return { success: false, reason: 'No active timer' };
}
function resetAzkarFirstMessage(gid) {
    setFirstMessage(gid, true);
    logger.info('Azkar First Message Reset For Guild ' + gid);
    return { success: true };
}
function isAzkarTimerActive(gid) {
    const st = global.guildStates.get(gid);
    return st && st.azkarTimer !== null;
}
module.exports.startAzkarTimerForGuild = startAzkarTimerForGuild;
module.exports.stopAzkarTimerForGuild = stopAzkarTimerForGuild;
module.exports.resetAzkarFirstMessage = resetAzkarFirstMessage;
module.exports.isAzkarTimerActive = isAzkarTimerActive;
