require('pathlra-aliaser')();

const logger = require('@logger');
const { azkar_image_urls } = require('@data-loader-constants-core_data');

// Initialize azkar image URLs in global state for easy access across modules
async function loadAzkarImages() {
    global.azkarImages = azkar_image_urls;
    logger.info(`Loaded ${global.azkarImages.length} azkar image URLs`);
    return true;
}

module.exports.loadAzkarImages = loadAzkarImages;
