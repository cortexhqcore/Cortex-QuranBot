require('pathlra-aliaser')();

const { wrapInteraction } = require('@deferReply');
const { resolveGuildState } = require('@guard');
const { rebuildAndSendControlPanel } = require('@controlPanelBuilder');
const logger = require('@logger');

module.exports = {
    customId: 'back_to_main',
    async execute(interaction) {
        await wrapInteraction(
            interaction,
            async () => {
                const { guildId, guildState } = resolveGuildState(interaction);
                await rebuildAndSendControlPanel(interaction, guildState, guildId);
            },
            { context: { label: 'back_to_main_button', logger } },
        );
    },
};
