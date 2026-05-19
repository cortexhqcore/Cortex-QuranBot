require('pathlra-aliaser')();

const logger = require('@logger');
const redis = require('@redis');
const { loadGuildStatesFromFirebase } = require('@firebase/index');
const { isPlainObject } = require('@persist-utils-core_state');
const { createDefaultState, cleanState } = require('@persist-defaults-core_state');
const { saveGuildState, saveAllStates, scheduleSave, clearSaveTimeout } = require('@persist-storage-core_state');
const { shouldRestore, restoreGuildState, setManualDisconnect, clearGuildState } = require('@persist-restore-core_state');

class PersistentStateManager {
    constructor() {
        this.guildStates = new Map();
        this.isInitialized = false;
        this.recoveryAttempted = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            const states = await loadGuildStatesFromFirebase();
            for (const [guildId, state] of Object.entries(states)) {
                if (isPlainObject(state)) {
                    const cleaned = cleanState(state, createDefaultState);
                    this.guildStates.set(guildId, cleaned);
                    await redis.set(`quranbot:guild:${guildId}`, JSON.stringify(cleaned));
                }
            }
            this.isInitialized = true;
            logger.info('Persistent State Manager Initialized With ' + this.guildStates.size + ' Guild States cached to Redis');
        } catch (error) {
            logger.error('Failed To Initialize Persistent State Manager', error);
            this.isInitialized = true;
        }
    }

    async getGuildState(guildId) {
        try {
            const cached = await redis.get(`quranbot:guild:${guildId}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                this.guildStates.set(guildId, parsed);
                return parsed;
            }
        } catch (error) {
            logger.error(`Redis parse failed for guild state of ${guildId}`, error);
        }

        if (!this.guildStates.has(guildId)) {
            const defaultState = createDefaultState();
            this.guildStates.set(guildId, defaultState);
            await redis.set(`quranbot:guild:${guildId}`, JSON.stringify(defaultState));
        }
        return this.guildStates.get(guildId);
    }

    async updateGuildState(guildId, updates) {
        const state = await this.getGuildState(guildId);
        const { deepMerge } = require('@persist-utils-core_state');
        deepMerge(state, updates);
        state.timestamp = Date.now();
        this.guildStates.set(guildId, state);
        await redis.set(`quranbot:guild:${guildId}`, JSON.stringify(state));
        scheduleSave(guildId, this.guildStates, cleanState);
        return state;
    }

    async saveGuildState(guildId) {
        await saveGuildState(guildId, this.guildStates, (state) => cleanState(state, createDefaultState));
    }

    async saveAllStates() {
        await saveAllStates(this.guildStates, (state) => cleanState(state, createDefaultState));
    }

    async setManualDisconnect(guildId, value) {
        setManualDisconnect(guildId, this.guildStates, scheduleSave, value);
        const state = await this.getGuildState(guildId);
        state.manualDisconnect = value;
        this.guildStates.set(guildId, state);
        await redis.set(`quranbot:guild:${guildId}`, JSON.stringify(state));
    }

    async shouldRestore(guildId) {
        const state = await this.getGuildState(guildId);
        return shouldRestore(state);
    }

    async restoreGuildState(guildId, client) {
        return await restoreGuildState(guildId, this.guildStates, client);
    }

    async clearGuildState(guildId) {
        clearGuildState(guildId, this.guildStates, clearSaveTimeout);
        await redis.del(`quranbot:guild:${guildId}`);
    }

    async getAllStates() {
        try {
            const keys = await redis.keys('quranbot:guild:*');
            if (keys && keys.length > 0) {
                const allStates = {};
                for (const key of keys) {
                    const guildId = key.replace('quranbot:guild:', '');
                    const cached = await redis.get(key);
                    if (cached) {
                        allStates[guildId] = JSON.parse(cached);
                    }
                }
                return allStates;
            }
        } catch (error) {
            logger.error('Failed to retrieve states from Redis, falling back to local memory map', error);
        }

        return Object.fromEntries(
            Array.from(this.guildStates.entries()).map(([gid, state]) => [
                gid,
                cleanState(state, createDefaultState),
            ])
        );
    }
}

const persistentStateManager = new PersistentStateManager();
module.exports = persistentStateManager;
