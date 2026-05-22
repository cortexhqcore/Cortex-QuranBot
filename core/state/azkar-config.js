require('pathlra-aliaser')();

const { time_constants, urls } = require('@config/constants');

const adhkar_base_url = urls.adhkar_base_url;
const adhkar_images_base_url = urls.adhkar_images_base_url;

const azkar_expiry_ms = time_constants.azkar_expiry_ms;
const azkar_interval_ms = time_constants.azkar_interval_ms;
const azkar_max_retry_attempts = time_constants.azkar_max_retry_attempts;
const azkar_retry_delay_ms = time_constants.azkar_retry_delay_ms;
const request_timeout_ms = time_constants.request_timeout_ms;

const fallback_azkar_data = [
    {
        id: 1,
        category: 'تسبيح',
        audio: '/audio/ar_7esn_AlMoslem_by_Doors_028.mp3',
        filename: 'ar_7esn_AlMoslem_by_Doors_028',
        array: [
            {
                id: 1,
                text: 'سبحان الله وبحمده',
                count: 100,
                audio: '/audio/91.mp3',
                filename: '91',
            },
        ],
    },
];

module.exports.adhkar_base_url = adhkar_base_url;
module.exports.adhkar_images_base_url = adhkar_images_base_url;
module.exports.azkar_expiry_ms = azkar_expiry_ms;
module.exports.azkar_interval_ms = azkar_interval_ms;
module.exports.azkar_max_retry_attempts = azkar_max_retry_attempts;
module.exports.azkar_retry_delay_ms = azkar_retry_delay_ms;
module.exports.request_timeout_ms = request_timeout_ms;
module.exports.fallback_azkar_data = fallback_azkar_data;
