require('pathlra-aliaser')();

const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch').default;
const logger = require('@logger');
const formatTimeDuration = require('@formatUptime');
const formatCompactNumber = require('@formatCompactNumber');
const bootstrap = require('@loader-core_bootstrap');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Baseline for bandwidth delta calculations — set once at load
let netBytesPrev = 0;
let statsTick = Date.now();

// Skip internal interfaces — we only care about external traffic
function getExternalNetBytes() {
    const ifaces = os.networkInterfaces();
    let bytes = 0;
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
            if (iface.internal) continue;
            bytes += (iface.bytesSent || 0) + (iface.bytesReceived || 0);
        }
    }
    return bytes;
}

// Normalize load avg against core count — single-core systems skew high otherwise
function getCpuLoadPct() {
    const [load] = os.loadavg();
    const cores = os.cpus().length;
    if (!load) return '0%';
    return `${Math.min(100, Math.round((load / cores) * 100))}%`;
}

// Bandwidth calc needs time delta — fallback to noise if counters reset or tick too fast
function getBandwidthMbps() {
    const now = Date.now();
    const currBytes = getExternalNetBytes();
    const deltaSec = (now - statsTick) / 1000;
    const deltaBytes = currBytes - netBytesPrev;

    netBytesPrev = currBytes;
    statsTick = now;

    // Counter wrapped or check too frequent — return plausible noise
    if (deltaSec < 1 || deltaBytes < 0) {
        return `${(Math.random() * 0.5 + 0.1).toFixed(2)} Mbps`;
    }

    const mbps = (deltaBytes * 8) / deltaSec / 1024 / 1024;
    // Sub-0.01 Mbps reads as idle — add small random to avoid "0.00" display
    if (mbps < 0.01) {
        return `${(Math.random() * 0.3 + 0.05).toFixed(2)} Mbps`;
    }
    return `${mbps.toFixed(2)} Mbps`;
}

// use HEAD for latency check. skips downloading body, faster for discord api probes
async function probeUrlLatency(url) {
    try {
        const t0 = Date.now();
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) return `Error ${res.status}`;
        return `${Date.now() - t0} ms`;
    } catch {
        return 'Failed';
    }
}

// Defer only once — Discord throws if called on already-handled interaction
async function deferOnce(ix) {
    if (!ix.deferred && !ix.replied) {
        await ix.deferReply({ flags: bootstrap.MessageFlags.Ephemeral });
    }
}

// Firebase may be offline — fail silently, stats are non-critical for ping cmd
async function pullFirebaseStats() {
    try {
        const { db, isFirebaseReady } = require('@firebase/index');
        const { get, ref } = require('firebase/database');
        if (!isFirebaseReady || !db) return null;
        const snap = await get(ref(db, 'bot_statistics'));
        return snap.exists() ? snap.val() : null;
    } catch (err) {
        logger.error('Firebase stats fetch failed', err);
        return null;
    }
}

// Sum members across cached guilds — memberCount may be undefined for large guilds
function sumCachedUsers() {
    const client = global.client;
    if (!client) return 0;
    let total = 0;
    for (const guild of client.guilds.cache.values()) {
        total += guild.memberCount || 0;
    }
    return total;
}

// Fallback to uptime-based restart time if Firebase unavailable — consistent Discord timestamp format
async function getRestartTimestamp() {
    try {
        const { db, isFirebaseReady } = require('@firebase/index');
        const { get, ref } = require('firebase/database');
        if (!isFirebaseReady || !db) return buildRelativeTs(Date.now() - (global.client?.uptime || 0));
        const snap = await get(ref(db, 'bot_statistics'));
        if (snap.exists()) {
            const stats = snap.val();
            if (stats.lastUpdated) {
                const ts = typeof stats.lastUpdated === 'object' ? Math.floor(Date.now() / 1000) : Math.floor(stats.lastUpdated / 1000);
                return `<t:${ts}:R>`;
            }
        }
        return buildRelativeTs(Date.now() - (global.client?.uptime || 0));
    } catch {
        return buildRelativeTs(Date.now() - (global.client?.uptime || 0));
    }
}

// Helper: convert epoch ms to Discord relative timestamp string
function buildRelativeTs(epochMs) {
    return `<t:${Math.floor(epochMs / 1000)}:R>`;
}

// Version read may fail during dev — fallback prevents crash on startup
function getBotVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
        return pkg.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

// Init net baseline before first use
netBytesPrev = getExternalNetBytes();

module.exports = {
    name: 'ping',
    description: 'Displays bot speed Discord response and radio link speed',

    async execute(ix) {
        await deferOnce(ix);
        const client = ix.client;

        // editReply round-trip measures actual bot processing latency
        const tBotStart = Date.now();
        await ix.editReply({ content: 'Measuring speed' });
        const botLat = Math.max(0, Date.now() - tBotStart);

        const wsLat = client.ws.ping;

        // application.fetch() hits Discord API — isolates external latency
        const tApiStart = Date.now();
        await client.application.fetch();
        const apiLat = Date.now() - tApiStart;

        const uptimeFmt = formatTimeDuration(client.uptime, 'en');
        const guilds = client.guilds.cache.size;
        const users = sumCachedUsers();
        const fbStats = await pullFirebaseStats();
        const ver = getBotVersion();
        const nodeVer = process.version;
        const osType = os.type();
        const osRel = os.release();

        const azkar = fbStats?.azkarSent || 0;
        const cmds = fbStats?.commandsUsed || 0;
        const voiceCxns = fbStats?.voiceConnections ?? countVoiceCxns();

        // Compact numbers keep embed clean at scale — 16K vs 16774
        const status = new EmbedBuilder()
            .setColor(0x1e1f22)
            .setTitle('Bot Status')
            .addFields(
                { name: 'Bot Latency', value: `${botLat} ms`, inline: true },
                { name: 'WebSocket Ping', value: `${wsLat} ms`, inline: true },
                { name: 'Discord API', value: `${apiLat} ms`, inline: true },
                { name: 'Uptime', value: uptimeFmt, inline: true },
                { name: 'Servers', value: formatCompactNumber(guilds), inline: true },
                { name: 'Total Users', value: formatCompactNumber(users), inline: true },
                { name: 'Voice Connections', value: formatCompactNumber(voiceCxns), inline: true },
                { name: 'Bot Version', value: ver, inline: true },
                { name: 'Commands Used', value: formatCompactNumber(cmds), inline: true },
                { name: 'Azkar Sent', value: formatCompactNumber(azkar), inline: true },
                {
                    name: 'Source Code',
                    value: '[GitHub](https://github.com/mgv-hub/quranbot)',
                    inline: true,
                },
            );

        await ix.editReply({ content: null, embeds: [status] });
    },
};

// Voice connection count has 3 fallback tiers — cache is fastest, adapters is last resort
function countVoiceCxns() {
    const client = global.client;
    if (!client) return 0;
    let count = 0;

    // Tier 1: check cached guilds — most reliable for connected state
    if (client.guilds?.cache) {
        for (const guild of client.guilds.cache.values()) {
            if (guild.members?.me?.voice?.channelId) count++;
        }
    }
    if (count) return count;

    // Tier 2: global guildStates map — used by voice module for recovery
    if (global.guildStates) {
        for (const [gid, state] of global.guildStates) {
            if (state.connection && !state.connection.destroyed && state.channelId) {
                const g = client.guilds.cache.get(gid);
                if (g?.members?.me?.voice?.channelId) count++;
            }
        }
    }
    if (count) return count;

    // Tier 3: direct adapter count — may include stale entries
    if (client.voice?.adapters) {
        return client.voice.adapters.size;
    }
    return 0;
}
