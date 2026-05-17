require('pathlra-aliaser')();

const logger = require('@logger');
const { loadCachedData } = require('@data-cache-core_data');
const { parseDurationToSeconds } = require('@data-utils-core_data');

async function fetchSurahs(languageCode) {
    try {
        const cache = await loadCachedData();
        const surahData = cache.surah || {};
        return (surahData.suwar || []).map((surah) => ({
            id: surah.id,
            name: surah.name,
            start_page: surah.start_page,
            end_page: surah.end_page,
            isMeccan: surah.makkia === 1,
            type: surah.type,
            language: languageCode,
        }));
    } catch (error) {
        logger.error('Error Fetching Surahs For ' + languageCode, error);
        return [];
    }
}

async function fetchReciters(languageCode) {
    try {
        const cache = await loadCachedData();
        const reciterData = cache.reciters || {};
        const reciters = {};
        (reciterData.reciters || []).forEach((reciter) => {
            const key = 'reciter_' + reciter.id + '_' + languageCode;
            const durations = reciter.moshaf ? reciter.moshaf.flatMap((m) => m.surah_list.split(',').map(() => 0)) : Array(114).fill(0);
            reciters[key] = {
                name: reciter.name,
                photo: reciter.photo || '',
                links: reciter.moshaf
                    ? reciter.moshaf.flatMap((m) => {
                          const server = m.server;
                          return m.surah_list.split(',').map((id) => server + id.padStart(3, '0') + '.mp3');
                      })
                    : [],
                durations: durations,
                language: languageCode,
            };
        });
        return reciters;
    } catch (error) {
        logger.error('Error fetching reciters for ' + languageCode, error);
        return {};
    }
}

/**
 * Helper fetchers for auxiliary Quran data types from cached dataset
 */
async function fetchRiwayat(languageCode) {
    try {
        const cache = await loadCachedData();
        return cache.rewayah?.riwayat || [];
    } catch (error) {
        logger.error('Error fetching riwayat for ' + languageCode, error);
        return [];
    }
}

async function fetchMoshaf(languageCode) {
    try {
        const cache = await loadCachedData();
        return cache.moshaf?.moshaf || [];
    } catch (error) {
        logger.error('Error fetching moshaf for ' + languageCode, error);
        return [];
    }
}

async function fetchRadios(languageCode) {
    try {
        const cache = await loadCachedData();
        return cache.radios?.radios || [];
    } catch (error) {
        logger.error('Error fetching radios for ' + languageCode, error);
        return [];
    }
}

async function fetchTafasir(languageCode) {
    try {
        const cache = await loadCachedData();
        return cache.tafasir?.tafasir || [];
    } catch (error) {
        logger.error('Error fetching tafasir for ' + languageCode, error);
        return [];
    }
}

module.exports.fetchSurahs = fetchSurahs;
module.exports.fetchReciters = fetchReciters;
module.exports.fetchRiwayat = fetchRiwayat;
module.exports.fetchMoshaf = fetchMoshaf;
module.exports.fetchRadios = fetchRadios;
module.exports.fetchTafasir = fetchTafasir;
