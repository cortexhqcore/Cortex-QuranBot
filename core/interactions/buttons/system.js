require('pathlra-aliaser')();

const { getGuildState } = require('../../state/GuildStateManager');
const logger = require('@logger');
const { checkInteractionAuth } = require('@sys-perms-core_interactions_buttons');
const { joinVoiceChannelHandler } = require('@sys-join-core_interactions_buttons');
const { leaveVoiceChannelHandler } = require('@sys-leave-core_interactions_buttons');
const { toggleControlMode } = require('@sys-mode-core_interactions_buttons');
const { updateControlPanel } = require('@sys-ui-core_interactions_buttons');
const { handleSystemError, sendErrorReply } = require('@sys-errors-core_interactions_buttons');

module.exports = {
    customId: 'system',

    async execute(interaction) {
        const guildId = interaction.guildId;
        const guildState = getGuildState(guildId);

        const authCheck = checkInteractionAuth(interaction, guildState, interaction.customId);
        if (!authCheck.authorized) {
            await interaction.deferUpdate().catch(() => {});
            await sendErrorReply(interaction, authCheck.message);
            return;
        }

        try {
            await interaction.deferUpdate().catch(() => {});

            if (interaction.customId === 'toggle_control_mode') {
                await toggleControlMode(guildId, guildState);
            } else if (interaction.customId === 'join_vc') {
                const joinResult = await joinVoiceChannelHandler(interaction, guildId, guildState);
                if (!joinResult.success) {
                    await sendErrorReply(interaction, joinResult.error);
                    return;
                }
                await sendErrorReply(interaction, 'تم الانضمام وبدء التشغيل بنجاح');
            } else if (interaction.customId === 'leave_vc') {
                const leaveResult = await leaveVoiceChannelHandler(guildId, guildState);
                if (!leaveResult.success) {
                    await sendErrorReply(interaction, leaveResult.error);
                    return;
                }
                await sendErrorReply(interaction, 'تم الخروج من الغرفة الصوتية بنجاح');
            }

            // Refresh the control panel UI after any successful action
            await updateControlPanel(interaction, guildState, guildId);
        } catch (error) {
            await handleSystemError(interaction, guildId, error);
        }
    },
};
