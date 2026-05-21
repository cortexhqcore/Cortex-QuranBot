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

let lastCpuUsage = process.cpuUsage();
let lastCpuCheck = process.hrtime.bigint();

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

function getCpuLoadPct() {
    // CPU = core * 100%
    const cores = os.cpus().length;
    const currentUsage = process.cpuUsage(lastCpuUsage);
    const currentTime = process.hrtime.bigint();
    const elapsedNanos = currentTime - lastCpuCheck;
    lastCpuUsage = process.cpuUsage();
    lastCpuCheck = currentTime;
    const elapsedMicros = Number(elapsedNanos) / 1000;
    const totalCpuMicros = (currentUsage.user + currentUsage.system) / 1000;
    if (elapsedMicros <= 0) {
        return `0.00% / ${cores * 100}%`;
    }
    const cpuPercent = ((totalCpuMicros / elapsedMicros) * 100).toFixed(2);
    // Removed ${cores * 100}%
    // and now showing actual bot process CPU usage only
    return `${cpuPercent}%`;
}

async function deferOnce(ix) {
    if (!ix.deferred && !ix.replied) {
        await ix.deferReply({ flags: bootstrap.MessageFlags.Ephemeral });
    }
}

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

function sumCachedUsers() {
    const client = global.client;
    if (!client) return 0;
    let total = 0;
    for (const guild of client.guilds.cache.values()) {
        total += guild.memberCount || 0;
    }
    return total;
}

function getBotVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
        return pkg.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

netBytesPrev = getExternalNetBytes();

module.exports = {
    async execute(ix) {
        await deferOnce(ix);
        const client = ix.client;

        const tBotStart = Date.now();
        await ix.editReply({ content: 'Measuring speed' });
        const botLat = Math.max(0, Date.now() - tBotStart);

        const wsLat = client.ws.ping;

        const tApiStart = Date.now();
        await client.application.fetch();
        const apiLat = Date.now() - tApiStart;

        const uptimeFmt = formatTimeDuration(client.uptime, 'en');

        const guilds = client.guilds.cache.size;
        const users = sumCachedUsers();
        const fbStats = await pullFirebaseStats();
        const ver = getBotVersion();

        const azkar = fbStats?.azkarSent || 0;
        const cmds = fbStats?.commandsUsed || 0;
        const voiceCxns = fbStats?.voiceConnections ?? countVoiceCxns();
        const cpuUsage = getCpuLoadPct();

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
                { name: 'CPU Usage', value: cpuUsage, inline: true },
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

function countVoiceCxns() {
    const client = global.client;
    if (!client) return 0;
    let count = 0;

    if (client.guilds?.cache) {
        for (const guild of client.guilds.cache.values()) {
            if (guild.members?.me?.voice?.channelId) count++;
        }
    }
    if (count) return count;

    if (global.guildStates) {
        for (const [gid, state] of global.guildStates) {
            if (state.connection && !state.connection.destroyed && state.channelId) {
                const g = client.guilds.cache.get(gid);
                if (g?.members?.me?.voice?.channelId) count++;
            }
        }
    }
    if (count) return count;

    if (client.voice?.adapters) {
        return client.voice.adapters.size;
    }
    return 0;
}
