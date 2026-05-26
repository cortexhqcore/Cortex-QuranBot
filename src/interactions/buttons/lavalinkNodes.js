require('pathlra-aliaser')();

const { wrapInteraction, safeError } = require('@interactions/flow/deferReply');
const { resolveGuildState } = require('@auth/guard');
const fetch = require('node-fetch').default;
const logger = require('@logging/logger');
const { createStandardEmbed } = require('@ui/embedFactory');
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { emoji } = require('@helpers/emojis');
const formatTimeDuration = require('@helpers/time/formatUptime');
const { getAllNodesInfo, getNodeInfo, parseNodeConfig } = require('@config/lavalinkConfig');
const { getApiHeaders, TimeoutRequest } = require('@config/http');

module.exports = {
    customId: 'lavalink_status',
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const nodes = getAllNodesInfo();
                if (nodes.length === 0) {
                    await safeError(interaction, 'لم يتم تكوين أي عقدة Lavalink');
                    return;
                }
                const stats = await Promise.allSettled(
                    nodes.map(async (node) => {
                        const protocol = node.secure ? 'https' : 'http';
                        const url = `${protocol}://${node.host}:${node.port}/v4/stats`;
                        const start = Date.now();
                        try {
                            const headers = {
                                ...getApiHeaders(),
                                Authorization: node.password,
                            };
                            const resp = await fetch(url, {
                                headers,
                                timeout: TimeoutRequest('default'),
                            });
                            const latency = Date.now() - start;
                            if (resp.ok) {
                                const data = await resp.json();
                                return {
                                    ...node,
                                    status: 'online',
                                    latency,
                                    players: data.players ?? 0,
                                    cpu: data.cpu?.systemLoad?.toFixed(2) || 'N/A',
                                    uptime: data.uptime,
                                };
                            }
                            return { ...node, status: 'error', latency, error: `HTTP ${resp.status}` };
                        } catch (err) {
                            return { ...node, status: 'offline', latency: Date.now() - start, error: err.message };
                        }
                    }),
                );
                const validStats = stats.filter((s) => s.status === 'fulfilled').map((s) => s.value);
                const onlineCount = validStats.filter((s) => s.status === 'online').length;
                const { guildState } = resolveGuildState(interaction);
                let activeNodeId = guildState?.player?.node?.id || guildState?.preferredLavalinkNode;
                let currentServerText = `${emoji.screenRotation} تحديد تلقائي (أقل حمل)`;
                if (activeNodeId) {
                    const currentNode = validStats.find((n) => n.id === activeNodeId);
                    if (currentNode) {
                        currentServerText = `${currentNode.flag} \`${currentNode.location}\``;
                    }
                }
                const des = `
${emoji.exclamation} **ما هو Lavalink؟**
هو نظام خارجي متخصص في معالجة وتشغيل الصوت، يستخدمه البوت لتحسين الأداء وتقليل الضغط على الموارد، مما يساعد على توفير تشغيل أكثر استقرارًا وجودة أفضل.
${emoji.barChart} **إحصائيات البوت الحالية:**
• **الخادم الحالي:** ${currentServerText}
• العقد المتصلة: \`${onlineCount}/${validStats.length}\`
**اختر الخادم الأنسب لك من القائمة أدناه**
يمكنك اختيار الخادم ذو أقل زمن استجابة (Ping) للحصول على أفضل سرعة،
أو اختيار أقرب منطقة إليك إذا كنت تفضل اتصالًا أكثر استقرارًا أثناء التشغيل.
`;
                const embed = createStandardEmbed().setTitle('حالة عقد Lavalink').setDescription(des);
                const options = validStats.map((s) => {
                    const latText = s.status === 'online' ? `${s.latency}ms` : 'غير متصل';
                    const serversText = s.status === 'online' ? `${s.players}` : '0';
                    const uptimeText = s.status === 'online' ? formatTimeDuration(s.uptime, 'en') : 'غير متصل';
                    // Check node capacity and mark as full if at limit
                    const nodeConfig = parseNodeConfig(s.index);
                    const maxPlayers = nodeConfig?.maxPlayers;
                    const isFull = s.status === 'online' && s.players >= maxPlayers;
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(`${s.index} ${s.location}${isFull ? '   (Full)' : ''}`)
                        .setValue(s.id)
                        .setDescription(`Ping: ${latText} | players: ${serversText}/${maxPlayers} | uptime: ${uptimeText}`)
                        .setEmoji(s.flag)
                        .setDefault(false);
                });
                if (options.length === 0) {
                    return safeError(interaction, 'لا توجد عقد مُكونة أو يمكن الوصول إليها');
                }
                const menu = new StringSelectMenuBuilder()
                    .setCustomId('select_lavalink_node')
                    .setPlaceholder('اختر عقدة Lavalink')
                    .addOptions(options);
                const row = new ActionRowBuilder().addComponents(menu);
                await interaction.followUp({
                    embeds: [embed],
                    components: [row],
                    flags: 64,
                });
            },
            { context: { label: 'lavalink_status_button', logger } },
        );
    },
};
