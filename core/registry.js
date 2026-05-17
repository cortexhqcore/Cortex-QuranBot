require('pathlra-aliaser')();

// lazy-load audio to avoid circular deps
let _audio;
function getAudio() {
    if (!_audio) _audio = require('@audio-core');
    return _audio;
}

const { createReciterRow, createRadioRow, createSelectRow, createButtonRow, createNavigationRow } = require('@components-core_ui');

const { createControlEmbed } = require('@embeds-core_ui');
const { getGuildState, removeGuildState, isAuthorized } = require('./state/GuildStateManager');

const { sendRandomAzkar, startAzkarTimerForGuild } = require('@AzkarManager-core_state');
const { registerCommands, applyCommandPermissions } = require('@commandregistry');
const { checkCooldown, checkRateLimit, checkVoiceCooldown, COOLDOWN_TYPES } = require('@cooldown-core_state');

const { loadPrayerTimesData, getCountries, getCitiesByCountry, getCitiesForCountry, getCountryByCode } = require('@data/prayerTimesData');
const databaseCleaner = require('./database/firebase/maintenance/databaseCleaner');

module.exports = {
    // Exporting all core registry functions and properties in a single object for easy access throughout the bot
    createSurahResource: () => getAudio().resource?.createSurahResource || getAudio().createSurahResource,
    createRadioResource: () => getAudio().resource?.createRadioResource || getAudio().createRadioResource,
    getCurrentLinks: () => getAudio().resource?.getReciterLinks || getAudio().getCurrentLinks,
    getCurrentDurations: () => getAudio().duration?.getDurationForSurah || getAudio().getDurationForSurah,

    createReciterRow,
    createRadioRow,
    createSelectRow,
    createButtonRow,
    createNavigationRow,
    createControlEmbed,
    getGuildState,
    removeGuildState,
    isAuthorized,
    sendRandomAzkar,
    startAzkarTimerForGuild,
    registerCommands,
    applyCommandPermissions,
    checkCooldown,
    checkRateLimit,
    checkVoiceCooldown,
    COOLDOWN_TYPES,
    loadPrayerTimesData,
    getCountries,
    getCitiesByCountry,
    getCitiesForCountry,
    getCountryByCode,
    databaseCleaner,
};
