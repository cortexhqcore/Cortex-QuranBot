require('pathlra-aliaser')();

const logger = require('@logger');
const { db, isFirebaseReady } = require('@firebase-client-core_utils');
const { deepCloneForFirebase } = require('@firebase-clone-core_utils');

async function loadTrackedGuildsFromFirebase() {
    if (!isFirebaseReady || !db) {
        logger.warn('Firebase Not Available Returning Empty Tracked Guilds');
        return [];
    }
    try {
        const snapshot = await db.ref('tracked_guilds').once('value');
        const data = snapshot.val();
        if (data && Array.isArray(data)) {
            logger.info('Tracked Guilds Loaded From Firebase ' + data.length + ' Guilds');
            return data;
        }
        logger.info('No Tracked Guilds Found In Firebase');
        return [];
    } catch (error) {
        logger.error('Error Loading Tracked Guilds From Firebase');
        return [];
    }
}

async function saveTrackedGuildsToFirebase(data) {
    if (!isFirebaseReady || !db) {
        logger.warn('Firebase Not Available Tracked Guilds Not Saved');
        return false;
    }
    try {
        const cleanData = deepCloneForFirebase(Array.isArray(data) ? data : []);
        await db.ref('tracked_guilds').set(cleanData);
        logger.info('Tracked Guilds Saved To Firebase ' + (Array.isArray(data) ? data.length : 0) + ' Guilds');
        return true;
    } catch (error) {
        logger.error('Error Saving Tracked Guilds To Firebase');
        return false;
    }
}

module.exports.loadTrackedGuildsFromFirebase = loadTrackedGuildsFromFirebase;
module.exports.saveTrackedGuildsToFirebase = saveTrackedGuildsToFirebase;
