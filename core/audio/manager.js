require('pathlra-aliaser')();

const { getGuildStateById } = require('../state/guild-state-store');
const { initializeConnection, teardownConnection, syncVoiceState } = require('./connection');
const { stopPlayer } = require('./player');
const { validateStreamUrl } = require('./resource');
const logger = require('@logger');

async function handleJoin(interaction, guildId, guildState, targetChannel) {
    const joinResult = await initializeConnection(guildId, guildState, targetChannel, interaction.guild.voiceAdapterCreator);

    if (!joinResult.success) throw new Error('Failed to establish voice connection');

    guildState.playbackMode = 'surah';
    const availableReciters = Object.keys(global.reciters || {});
    guildState.currentReciter = availableReciters[Math.floor(Math.random() * availableReciters.length)];
    guildState.currentSurah = Math.floor(Math.random() * 114) + 1;
    guildState.isPaused = false;
    guildState.pauseReason = null;

    logger.info(`Guild ${guildId} Bot Joined Voice Channel ${targetChannel.id} Playing Surah ${guildState.currentSurah}`);
    await syncVoiceState(guildId, guildState);
    return true;
}

async function handleLeave(guildId, guildState) {
    if (!guildState.connection || guildState.connection.destroyed) {
        throw new Error('Bot not in voice channel');
    }

    stopPlayer(guildState);
    guildState.isPaused = true;
    guildState.pauseReason = 'manual_leave';

    await teardownConnection(guildId, guildState);
    require('@PersistentStateManager-core_state').setManualDisconnect(guildId, true);
    await syncVoiceState(guildId, guildState);
    logger.info(`Guild ${guildId} Bot Disconnected From Voice Channel`);
    return true;
}

async function handlePlaybackControl(guildId, guildState, action) {
    if (!guildState.connection || guildState.connection.destroyed) {
        throw new Error('No active voice connection');
    }

    switch (action) {
        case 'next': {
            if (guildState.playbackMode !== 'surah') throw new Error('Next unavailable in radio mode');
            let targetSurah = guildState.currentSurah < global.surahNames.length ? guildState.currentSurah + 1 : 1;
            guildState.currentSurah = targetSurah;
            guildState.player.stop();
            await new Promise((r) => setTimeout(r, 100));
            const res = await global.createSurahResource(guildState, targetSurah - 1, 0, 0, false);
            guildState.player.play(res);
            guildState.isPaused = false;
            guildState.pauseReason = null;
            break;
        }

        case 'prev': {
            if (guildState.playbackMode !== 'surah') throw new Error('Previous unavailable in radio mode');
            let targetSurah = guildState.currentSurah > 1 ? guildState.currentSurah - 1 : global.surahNames.length;
            guildState.currentSurah = targetSurah;
            guildState.player.stop();
            await new Promise((r) => setTimeout(r, 100));
            const res = await global.createSurahResource(guildState, targetSurah - 1, 0, 0, false);
            guildState.player.play(res);
            guildState.isPaused = false;
            guildState.pauseReason = null;
            break;
        }
        case 'pause': {
            if (guildState.player.state.status === 'playing') {
                guildState.player.pause();
                guildState.isPaused = true;
                guildState.pauseReason = 'manual';
            }
            break;
        }

        case 'resume': {
            if (guildState.player.state.status === 'paused' || guildState.player.state.status === 'idle') {
                let resource;
                if (guildState.playbackMode === 'surah') {
                    resource = await global.createSurahResource(guildState, guildState.currentSurah - 1, 0, 0, false);
                } else if (guildState.currentRadioUrl) {
                    const validatedUrl =
                        global.radioHealthChecker?.getActiveRadioUrl(guildState.currentRadioUrl) || guildState.currentRadioUrl;
                    resource = await global.createRadioResource(validatedUrl, 0);
                }
                if (resource) {
                    guildState.player.play(resource);
                    guildState.isPaused = false;
                    guildState.pauseReason = null;
                }
            }
            break;
        }

        case 'toggle_radio': {
            if (guildState.playbackMode === 'surah') {
                guildState.playbackMode = 'radio';
                guildState.currentRadioIndex = guildState.currentRadioIndex ?? 0;
                guildState.currentRadioUrl = global.quranRadios[guildState.currentRadioIndex]?.url ?? global.quranRadios[0]?.url;
                guildState.currentRadioPage = Math.floor(guildState.currentRadioIndex / 25);

                const validatedUrl = global.radioHealthChecker?.getActiveRadioUrl(guildState.currentRadioUrl);
                if (!validatedUrl) {
                    guildState.playbackMode = 'surah';
                    const surahRes = await global.createSurahResource(guildState, guildState.currentSurah - 1, 0, 0, false);
                    guildState.player.play(surahRes);
                } else {
                    guildState.player.stop();
                    const radioRes = await global.createRadioResource(validatedUrl, 0);
                    guildState.player.play(radioRes);
                }
            } else {
                guildState.playbackMode = 'surah';
                guildState.currentRadioUrl = null;
                guildState.player.stop();
                const surahRes = await global.createSurahResource(guildState, guildState.currentSurah - 1, 0, 0, false);
                guildState.player.play(surahRes);
            }
            guildState.isPaused = false;
            guildState.pauseReason = null;
            break;
        }

        default:
            throw new Error('Unknown playback action');
    }

    guildState.lastActivity = Date.now();
    if (typeof global.saveRuntimeStates === 'function') await global.saveRuntimeStates();
}

module.exports.handleJoin = handleJoin;
module.exports.handleLeave = handleLeave;
module.exports.handlePlaybackControl = handlePlaybackControl;
