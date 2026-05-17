require('pathlra-aliaser')();

const logger = require('@logger');
const { isFirebaseReady, db } = require('../index');
const { cleanSetupGuilds } = require('./cleaners/setupGuilds.cleaner');
const { cleanGuildStates } = require('./cleaners/guildStates.cleaner');
const { cleanControlIds } = require('./cleaners/controlIds.cleaner');

class DatabaseCleaner {
    constructor() {
        this.client = null;
        this.isInitialized = false;
    }

    // attach client + set ready flag
    initialize(client) {
        this.client = client;
        this.isInitialized = true;
        logger.info('Database Cleaner Initialized');
    }

    // exec cleanup routines + return summary
    async performCleanup() {
        if (!this.isInitialized) {
            logger.warn('Database Cleaner Not Initialized');
            return { success: false, reason: 'Not initialized' };
        }

        if (!isFirebaseReady || !db) {
            logger.warn('Firebase Not Available Skipping Cleanup');
            return { success: false, reason: 'Firebase not ready' };
        }

        logger.info('Starting Database Cleanup Process');

        // run all cleaners in parallel-ish style
        const results = {
            setupGuilds: await cleanSetupGuilds(this.client),
            guildStates: await cleanGuildStates(this.client),
            controlIds: await cleanControlIds(this.client),
        };

        logger.info('Database Cleanup Complete', results);
        return { success: true, results };
    }
}

const databaseCleaner = new DatabaseCleaner();
module.exports = databaseCleaner;
