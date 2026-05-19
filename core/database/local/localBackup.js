require('pathlra-aliaser')();

const fs = require('fs');
const fsPromises = require('fs').promises;
const pathlra = require('path');
const { get, ref } = require('firebase/database');
const logger = require('@logger');
const { db, isFirebaseReady } = require('../firebase/index');
const { paths } = require('@configConstants');
const zlib = require('zlib');

const BACKUP_INTERVAL_MS = parseInt(process.env.BACKUP_INTERVAL_MS);
const BACKUP_DIR = pathlra.resolve(__dirname, '../../../storage/backups');

function getCurrentEnv() {
   const envPath = pathlra.resolve(__dirname, '../../.env');
   if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/NODE_ENV\s*=\s*(\w+)/);
      if (match) return match[1].trim();
   }
   return 'development';
}

function getBackupChannelId() {
   return getCurrentEnv() === 'production'
      ? process.env.PRODUCTION_CHANNEL_ID
      : process.env.DEVELOPMENT_CHANNEL_ID;
}

function getBackupServerId() {
   return getCurrentEnv() === 'production'
      ? process.env.PRODUCTION_SERVER_ID
      : process.env.DEVELOPMENT_SERVER_ID;
}

function generateBackupFilename() {
   const now = new Date();
   const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
      String(now.getMilliseconds()).padStart(3, '0'),
   ].join('-');
   return `backup_${ts}.json.gz`;
}

async function ensureBackupDirectory() {
   try {
      await fsPromises.mkdir(BACKUP_DIR, { recursive: true });
   } catch (err) {
      logger.error('Failed To Create Backup Directory', err);
   }
}

function compressFile(input, output) {
   return new Promise((resolve, reject) => {
      fs.createReadStream(input)
         .pipe(zlib.createGzip())
         .pipe(fs.createWriteStream(output))
         .on('finish', () => {
            fs.unlink(input, () => { });
            resolve();
         })
         .on('error', reject);
   });
}

async function sendBackupToDiscord(backupPath, backupFilename) {
   try {
      const client = global.client;
      if (!client) {
         logger.warn('Client Not Available Skipping Discord Backup Send');
         return;
      }
      const channelId = getBackupChannelId();
      const serverId = getBackupServerId();
      const env = getCurrentEnv();

      const channel =
         client.channels.cache.get(channelId) ||
         (await client.channels.fetch(channelId).catch(() => null));
      if (!channel) {
         logger.warn('Backup Channel Not Found ' + channelId);
         return;
      }
      const guild = channel.guild;
      if (!guild || guild.id !== serverId) {
         logger.warn(
            'Backup Channel Not In Expected Server Expected ' +
            serverId +
            ' Got ' +
            (guild?.id || 'none'),
         );
         return;
      }

      const buffer = await fsPromises.readFile(backupPath);
      await channel.send({
         content:
            '**Backup Created**\n' +
            'Environment: ' + env +
            '\nTime: ' + new Date().toISOString(),
         files: [{ attachment: buffer, name: backupFilename }],
      });
      logger.info('Backup Sent To Discord Channel ' + channelId + ' In Server ' + serverId);
   } catch (err) {
      logger.error('Failed To Send Backup To Discord', err);
   }
}

async function performBackup() {
   if (!isFirebaseReady || !db) {
      logger.warn('Firebase Not Ready Skipping Backup');
      return;
   }
   try {
      const snap = await get(ref(db, '/'));
      if (!snap.exists()) {
         logger.warn('Database Is Empty Skipping Backup');
         return;
      }
      const data = snap.val();
      const filename = generateBackupFilename();
      const backupPath = pathlra.join(BACKUP_DIR, filename);
      const tmpPath = backupPath.replace('.gz', '.tmp.json');
      await ensureBackupDirectory();
      await fsPromises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      const origSize = (await fsPromises.stat(tmpPath)).size;
      await compressFile(tmpPath, backupPath);
      const compSize = (await fsPromises.stat(backupPath)).size;
      const ratio = ((1 - compSize / origSize) * 100).toFixed(2);

      logger.info(
         'Local Backup Created Successfully At ' +
         backupPath +
         ' Original ' +
         origSize +
         ' bytes Compressed ' +
         compSize +
         ' bytes Reduced ' +
         ratio +
         '%',
      );
      await sendBackupToDiscord(backupPath, filename);
   } catch (err) {
      logger.error('Failed To Create Local Backup', err);
   }
}

function startBackupService() {
   const env = getCurrentEnv();
   const serverId = getBackupServerId();
   const channelId = getBackupChannelId();
   logger.info('Environment: ' + env + ' Channel: ' + channelId);
   setTimeout(() => {
      setInterval(performBackup, BACKUP_INTERVAL_MS);
   }, 5000);
}

startBackupService();
