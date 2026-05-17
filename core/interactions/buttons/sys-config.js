require('pathlra-aliaser')();

const { channel_names } = require('@configConstants');

const player_config = {
   no_subscriber_timeout: 60000,
   max_missed_frames: 500,
   playback_start_delay_ms: 2000,
   max_surah_attempts: 10,
};
module.exports.channel_names = channel_names;

const ERRORS = {
   NO_SETUP: 'لم يتم إعداد فئة القرآن بعد استخدم setup أولا',
   NO_CHANNEL: 'القناة الصوتية قران كريم غير موجودة استخدم الامر setup لتجهيز كل شيء',
   NO_PERMISSIONS: 'البوت ليس لديه الصلاحيات الكاملة للانضمام إلى هذه الغرفة الصوتية',
   NOT_IN_VC: 'البوت غير موجود في غرفة صوتية حاليا',
   JOIN_FAILED: 'فشل في الانضمام ',
   ACTION_DENIED:
      'هذا الإجراء غير متاح للأعضاء العاديين في وضع الجميع فقط التنقل بين السور واختيار القارئ متاح مع تأخير 90 ثانية الأدمنز لديهم تحكم كامل',
   ADMIN_REQUIRED: 'تتطلب هذه العملية امتلاك صلاحيات المسؤول (Administrator)',
};
module.exports.player_config = player_config;
module.exports.ERRORS = ERRORS;
