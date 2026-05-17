require('pathlra-aliaser')();

const firstMsg = new Map();
const audioData = new Map();
const msgTs = new Map();

function setFirstMessage(gid, val) {
    firstMsg.set(gid, val);
}
function getFirstMessage(gid) {
    return firstMsg.get(gid);
}
function deleteFirstMessage(gid) {
    return firstMsg.delete(gid);
}

function setAudioData(id, data) {
    audioData.set(id, data);
}
function getAudioData(id) {
    return audioData.get(id);
}
function deleteAudioData(id) {
    return audioData.delete(id);
}

function setMessageTimestamp(mid, ts) {
    msgTs.set(mid, ts);
}
function getMessageTimestamp(mid) {
    return msgTs.get(mid);
}
function deleteMessageTimestamp(mid) {
    return msgTs.delete(mid);
}

function clearAllCaches() {
    firstMsg.clear();
    audioData.clear();
    msgTs.clear();
}

module.exports.setFirstMessage = setFirstMessage;
module.exports.getFirstMessage = getFirstMessage;
module.exports.deleteFirstMessage = deleteFirstMessage;
module.exports.setAudioData = setAudioData;
module.exports.getAudioData = getAudioData;
module.exports.deleteAudioData = deleteAudioData;
module.exports.setMessageTimestamp = setMessageTimestamp;
module.exports.getMessageTimestamp = getMessageTimestamp;
module.exports.deleteMessageTimestamp = deleteMessageTimestamp;
module.exports.clearAllCaches = clearAllCaches;
