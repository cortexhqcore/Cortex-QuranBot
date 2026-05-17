require('pathlra-aliaser')();

const logger = require('@logger');
const { db, isFirebaseReady } = require('@firebase-client-core_utils');
const { deepCloneForFirebase } = require('@firebase-clone-core_utils');
const { loadSetupGuildsFromFirebase, loadGuildStatesFromFirebase, loadControlIdsFromFirebase } = require('@firebase-guilds-core_utils');

async function clearGuildData(guildId) {
    logger.warn('Clear Guild Data Called For ' + guildId + ' Operation Blocked To Preserve Data');
    return false;
}

async function backupAllData() {
    if (!isFirebaseReady || !db) {
        logger.warn('Firebase Not Available Cannot Backup Data');
        return false;
    }
    try {
        const setupGuilds = await loadSetupGuildsFromFirebase();
        const guildStates = await loadGuildStatesFromFirebase();
        const controlIds = await loadControlIdsFromFirebase();
        const dhikrSnapshot = await db.ref('dhikr_data').once('value');
        const dhikrData = dhikrSnapshot.val();
        const backupData = {
            setupGuilds: setupGuilds,
            guildStates: guildStates,
            controlIds: controlIds,
            dhikrData: dhikrData,
            timestamp: Date.now(),
        };
        const firebaseReadyData = deepCloneForFirebase(backupData);
        await db.ref('backup/last').set(firebaseReadyData);
        logger.info('Full Backup Created Successfully');
        return true;
    } catch (error) {
        logger.error('Error Creating Full Backup');
        return false;
    }
}

module.exports.clearGuildData = clearGuildData;
module.exports.backupAllData = backupAllData;
