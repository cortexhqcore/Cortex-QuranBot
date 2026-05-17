require('pathlra-aliaser')();

const coreLoader = require('@loader-core_bootstrap');
const { cache_config, memory_config, limits } = require('@configConstants');

// In-memory cache for tracking recent interactions to prevent duplicate processing
const interactionCache = new Map();

// Cache for embed messages to reduce redundant rebuilds
const embedCache = new Map();

// Configuration constants for cache behavior and memory management
const max_interaction_cache_size = cache_config.interaction.max_size;
const interaction_cache_ttl_ms = cache_config.interaction.ttl_ms;
const memory_cleanup_interval_ms = memory_config.cleanup_interval_ms;
const memory_check_interval_ms = memory_config.check_interval_ms;
const high_memory_threshold_mb = memory_config.high_threshold_mb;
const max_concurrent_guilds = limits.max_concurrent_guilds;

// Track which guilds currently have active audio playback to enforce concurrency limits
const activeGuildPlays = new Map();

// Check if a guild can start new audio playback based on global concurrency limit
function canPlayAudio(guildId) {
    const activeCount = Array.from(activeGuildPlays.values()).filter((v) => v).length;
    if (activeCount >= max_concurrent_guilds) {
        return false;
    }
    return true;
}

// Update the playback status for a guild in the active tracking map
function setGuildPlaying(guildId, isPlaying) {
    activeGuildPlays.set(guildId, isPlaying);
}

// Initialize periodic memory cleanup and monitoring intervals
function setupMemoryManagement() {
    // Regular cleanup of expired cache entries
    setInterval(() => {
        cleanupMemory();
    }, memory_cleanup_interval_ms);

    // Monitor heap usage and trigger aggressive cleanup if threshold exceeded
    setInterval(() => {
        const memoryStats = process.memoryUsage();
        const heapUsedMB = memoryStats.heapUsed / 1024 / 1024;

        if (heapUsedMB > high_memory_threshold_mb) {
            coreLoader.logger.warn(`High Memory Usage ${heapUsedMB.toFixed(2)}MB`);
            aggressiveMemoryCleanup();
        }
    }, memory_check_interval_ms);
}

// Remove expired entries from interaction and embed caches based on TTL
function cleanupMemory() {
    const currentTime = Date.now();

    // Clean expired interaction cache entries
    for (const [cacheKey, timestamp] of interactionCache.entries()) {
        if (currentTime - timestamp > interaction_cache_ttl_ms) {
            interactionCache.delete(cacheKey);
        }
    }

    // Clean embed cache with different TTL for active vs inactive entries
    const EMBED_CACHE_TTL = 30000;
    for (const [cacheKey, { timestamp, active }] of embedCache.entries()) {
        const effectiveTTL = active ? EMBED_CACHE_TTL : EMBED_CACHE_TTL * 2;
        if (currentTime - timestamp > effectiveTTL) {
            embedCache.delete(cacheKey);
        }
    }
}

// Aggressive memory cleanup triggered when heap usage exceeds threshold
function aggressiveMemoryCleanup() {
    try {
        // Remove oldest 50% of interaction cache entries
        const interactionEntries = Array.from(interactionCache.entries());
        const interactionToRemove = Math.max(1, Math.floor(interactionEntries.length / 2));
        for (let i = 0; i < interactionToRemove; i++) {
            interactionCache.delete(interactionEntries[i][0]);
        }

        // Remove oldest 33% of embed cache entries
        const embedEntries = Array.from(embedCache.entries());
        const embedToRemove = Math.max(1, Math.floor(embedEntries.length / 3));
        for (let i = 0; i < embedToRemove; i++) {
            embedCache.delete(embedEntries[i][0]);
        }

        // Trigger manual garbage collection if available (Node.js --expose-gc flag)
        if (global.gc) {
            global.gc();
        }

        coreLoader.logger.info('Memory Cleaned Up Successfully');
    } catch (error) {
        coreLoader.logger.error('Aggressive Memory Cleanup Failed');
    }
}

// Start memory management background tasks
setupMemoryManagement();

module.exports.interactionCache = interactionCache;
module.exports.embedCache = embedCache;
module.exports.max_interaction_cache_size = max_interaction_cache_size;
module.exports.interaction_cache_ttl_ms = interaction_cache_ttl_ms;
module.exports.canPlayAudio = canPlayAudio;
module.exports.setGuildPlaying = setGuildPlaying;
module.exports.cleanupMemory = cleanupMemory;
module.exports.aggressiveMemoryCleanup = aggressiveMemoryCleanup;
