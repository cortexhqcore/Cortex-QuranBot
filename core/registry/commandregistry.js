require('pathlra-aliaser')();

const { ChannelType, PermissionsBitField, SlashCommandBuilder, Routes, REST } = require('discord.js');
const logger = require('@logger');

async function registerCommands() {
    const cmds = [
        new SlashCommandBuilder().setName('دليل').setDescription('دليل استخدام البوت وخيارات الإعداد').setDefaultMemberPermissions('0'),
        new SlashCommandBuilder()
            .setName('دخول')
            .setDescription('الانضمام إلى الروم الصوتي المعد من الإعداد')
            .setDefaultMemberPermissions('8'),
        /**
            new SlashCommandBuilder()
            .setName('دخول_قناة')
            .setDescription('الانضمام إلى غرفة صوتية محددة')
            .addChannelOption((opt) =>
                opt.setName('قناة').setDescription('اختر الغرفة الصوتية').addChannelTypes(ChannelType.GuildVoice).setRequired(true),
            )
            .setDefaultMemberPermissions('8'),
              **/
        new SlashCommandBuilder().setName('خروج').setDescription('الخروج من الروم الصوتي').setDefaultMemberPermissions('8'),
        new SlashCommandBuilder().setName('تحكم').setDescription('لوحة التحكم للقرآن').setDefaultMemberPermissions('0'),
        new SlashCommandBuilder()
            .setName('إعداد')
            .setDescription('إعداد فئة القرآن مع القنوات للإداريين فقط')
            .setDefaultMemberPermissions('8'),
        new SlashCommandBuilder()
            .setName('سرعة')
            .setDescription('يعرض سرعة البوت ومدة التشغيل والساعات وعدد السيرفرات الحالي')
            .setDefaultMemberPermissions('0'),
        new SlashCommandBuilder()
            .setName('مواقيت_الصلاة')
            .setDescription('عرض مواقيت الصلاة لجميع الدول والمناطق')
            .setDefaultMemberPermissions('0'),
        new SlashCommandBuilder()
            .setName('مصادر')
            .setDescription('عرض مصادر المعلومات والروابط التي يستخدمها البوت')
            .setDefaultMemberPermissions('0'),
    ].map((c) => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(global.token);
    try {
        await rest.put(Routes.applicationCommands(global.clientId), { body: cmds });
        logger.info(`Registered ${cmds.length} commands`);
    } catch (err) {
        logger.error('Failed to register commands', err);
    }
}
async function applyCommandPermissions(guild) {
    const rest = new REST({ version: '10' }).setToken(global.token);
    try {
        const guildCmds = await rest.get(Routes.applicationGuildCommands(global.clientId, guild.id));
        const restricted = ['دخول', 'دخول_قناة', 'خروج', 'إعداد', 'مواقيت_الصلاة'];

        for (const cmd of guildCmds) {
            if (!restricted.includes(cmd.name)) continue;

            const perms = [];
            // add special user if exists
            if (global.SPE_USER_ID) {
                perms.push({ id: global.SPE_USER_ID, type: 2, permission: true });
            }

            let permId = guild.roles.cache.find((r) => r.name === 'Quran Admin')?.id;
            let permType = 1;

            if (!permId) {
                permId = guild.members.cache.find((m) => m.permissions.has(PermissionsBitField.Flags.Administrator))?.id;
                permType = 2;
            }

            if (permId) {
                perms.push({ id: permId, type: permType, permission: true });
            }

            await rest.put(Routes.guildCommandPermissions(global.clientId, guild.id, cmd.id), {
                body: { permissions: perms },
            });
        }
    } catch (err) {
        logger.error(`Perm apply failed for guild ${guild.id}`, err);
    }
}

module.exports = { registerCommands, applyCommandPermissions };
