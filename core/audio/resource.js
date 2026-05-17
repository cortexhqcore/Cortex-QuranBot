require('pathlra-aliaser')();

const { createAudioResource, StreamType } = require('@discordjs/voice');
const fetch = require('node-fetch').default;
const ytdl = require('ytdl-core');
const { AbortController } = require('abort-controller');
const { getAudioStreamHeaders, TimeoutRequest } = require('@http');
const logger = require('@logger');
const voiceLogger = require('@voiceLogger');
const max_retry_attempts = 7;
const STREAM_TIMEOUT_MS = TimeoutRequest('stream');
const default_volume = 0.5;

// Semaphore to limit concurrent ffmpeg spawns and prevent EAGAIN resource exhaustion
const ffmpegSemaphore = {
    count: 0,
    maxConcurrent: 3,
    queue: [],
    acquire: async function () {
        if (this.count < this.maxConcurrent) {
            this.count++;
            return;
        }
        await new Promise((resolve) => {
            this.queue.push(resolve);
        });
    },
    release: function () {
        this.count = Math.max(0, this.count - 1);
        const next = this.queue.shift();
        if (next) {
            this.count++;
            next();
        }
    },
};

// Retry helper with exponential backoff specifically for EAGAIN and transient errors
async function retryWithBackoff(fn, maxAttempts = max_retry_attempts, baseDelay = 2000) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            // EAGAIN means resource temporarily unavailable - retry with backoff
            if (error.code === 'EAGAIN' || error.errno === -11) {
                voiceLogger.stream(null, `EAGAIN encountered, retry ${attempt}/${maxAttempts}`, {
                    error: error.message,
                });
                const delay = baseDelay * attempt + Math.random() * 500;
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
            // For other errors, break immediately
            break;
        }
    }
    throw lastError || new Error('All retry attempts failed');
}

function isHlsResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('mpegurl') || contentType.includes('m3u8');
}

function isHlsUrl(url) {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.m3u8');
}

async function fetchWithRetry(url, options = {}, maxRetries = max_retry_attempts) {
    voiceLogger.stream(null, 'Starting fetchWithRetry', {
        url,
        maxRetries,
        timeout: options.timeout || STREAM_TIMEOUT_MS,
    });
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let timeoutId = null;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), options.timeout || STREAM_TIMEOUT_MS);
            const headers = options.headers || getAudioStreamHeaders();
            voiceLogger.stream(null, `Fetch attempt ${attempt}/${maxRetries}`, {
                url,
                headers: Object.keys(headers),
            });
            const response = await fetch(url, { ...options, signal: controller.signal, headers });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            voiceLogger.stream(null, 'Fetch succeeded', {
                status: response.status,
                contentType: response.headers.get('content-type'),
            });
            return response;
        } catch (error) {
            lastError = error;
            voiceLogger.stream(null, `Retry ${attempt} failed`, { url, error: error.message });
            logger.warn(`Retry ${attempt} for ${url} - ${error.message}`);
            const baseDelay = 2000 * attempt;
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, baseDelay + Math.random() * 500));
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }
    voiceLogger.error(null, 'All fetch retries exhausted', lastError, { url });
    throw lastError || new Error('All retry attempts failed');
}

async function calculateByteRange(url, startSeconds, headers) {
    voiceLogger.stream(null, 'Calculating byte range for seek', { url, startSeconds });
    if (startSeconds <= 0) {
        voiceLogger.stream(null, 'Seek at 0 - returning 0 byte offset');
        return 0;
    }
    // HLS and live streams do not support byte range seeking
    if (isHlsUrl(url)) {
        voiceLogger.stream(null, 'HLS URL detected skipping byte range calculation');
        throw new Error('Seeking not supported for HLS streams');
    }
    try {
        const headResponse = await fetch(url, {
            method: 'HEAD',
            signal: new AbortController().signal,
            headers: { ...headers, Range: 'bytes=0-1' },
        });
        const contentRange = headResponse.headers.get('content-range');
        const contentLength = headResponse.headers.get('content-length');
        const totalBytes = contentRange ? parseInt(contentRange.match(/\/(\d+)$/)?.[1] || '0', 10) : parseInt(contentLength || '0', 10);
        const durationMs = await getAudioDuration(url, headResponse);
        const bytesPerSecond = totalBytes / (durationMs / 1000);
        const byteOffset = Math.floor(startSeconds * bytesPerSecond);
        voiceLogger.stream(null, 'Byte range calculated', {
            totalBytes,
            durationMs,
            bytesPerSecond,
            byteOffset,
        });
        return byteOffset;
    } catch (err) {
        // Fallback estimate when HEAD request fails
        const fallbackOffset = Math.floor(startSeconds * 16384);
        voiceLogger.stream(null, 'Byte range fallback used', {
            startSeconds,
            fallbackOffset,
            reason: err.message,
        });
        return fallbackOffset;
    }
}

async function getAudioDuration(url, headResponse = null) {
    const cacheKey = `duration_${url}`;
    if (global.durationCache && global.durationCache.has(cacheKey)) {
        voiceLogger.stream(null, 'Duration retrieved from cache', {
            cacheKey,
            duration: global.durationCache.get(cacheKey),
        });
        return global.durationCache.get(cacheKey);
    }
    try {
        const response =
            headResponse ||
            (await fetch(url, {
                method: 'HEAD',
                signal: new AbortController().signal,
                headers: getAudioStreamHeaders(),
            }));
        const durationHeader =
            response.headers.get('x-duration-ms') || response.headers.get('x-content-duration') || response.headers.get('content-duration');
        if (durationHeader) {
            const duration = parseInt(durationHeader, 10);
            if (duration > 0 && duration < 7200000) {
                if (global.durationCache) global.durationCache.set(cacheKey, duration);
                voiceLogger.stream(null, 'Duration from header', { duration });
                return duration;
            }
        }
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const estimated = ((parseInt(contentLength, 10) * 8) / (128 * 1024)) * 1000;
            if (estimated > 0 && estimated < 7200000) {
                voiceLogger.stream(null, 'Duration estimated from content-length', {
                    contentLength,
                    estimated,
                });
                return estimated;
            }
        }
        voiceLogger.stream(null, 'Using default duration', { default: 180000 });
        return 180000;
    } catch {
        voiceLogger.stream(null, 'Duration fetch failed using default', { default: 180000 });
        return 180000;
    }
}

async function createAudioStreamResource(url, startSeconds = 0) {
    voiceLogger.resource(null, 'Creating audio stream resource', { url, startSeconds });
    if (!url?.startsWith('http')) {
        voiceLogger.error(null, 'Invalid URL for stream resource', null, { url });
        throw new Error(`Invalid URL: ${url}`);
    }

    const isYouTube = ytdl.validateURL(url);
    if (isYouTube) {
        // ytdl-core handles retries, format selection, and buffering internally
        // highWaterMark prevents stuttering by preloading audio chunks
        // dlChunkSize: 0 disables chunk splitting for continuous live stream compatibility
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25, // 32MB buffer
            dlChunkSize: 0,
            liveBuffer: 5000,
        });
        return createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
            volume: default_volume,
        });
    }

    const headers = getAudioStreamHeaders();
    if (startSeconds > 0) {
        // HLS streams do not support seeking via byte ranges
        if (isHlsUrl(url)) {
            voiceLogger.resource(null, 'Seeking requested on HLS stream ignoring seek offset');
            startSeconds = 0;
        } else {
            const byteOffset = await calculateByteRange(url, startSeconds, headers);
            headers['Range'] = `bytes=${byteOffset}-`;
            voiceLogger.resource(null, 'Seek range applied', { range: headers['Range'] });
        }
    }

    const response = await fetchWithRetry(url, { headers });
    if (!response.headers.get('content-type')?.includes('audio') && !isHlsResponse(response)) {
        voiceLogger.error(null, 'Unexpected content type for audio stream', null, {
            url,
            contentType: response.headers.get('content-type'),
        });
        throw new Error(`Unexpected content type`);
    }

    // HLS streams require URL input for ffmpeg to handle playlist negotiation
    // Passing body stream causes ffmpeg to receive playlist text, resulting in silence/cutting
    const isHls = isHlsResponse(response) || isHlsUrl(url);
    if (isHls) {
        voiceLogger.resource(null, 'HLS stream detected - using URL input for stability');
        return createAudioResource(url, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
            volume: default_volume,
        });
    }

    // Acquire semaphore before spawning ffmpeg to prevent EAGAIN
    await ffmpegSemaphore.acquire();
    try {
        voiceLogger.resource(null, 'Creating AudioResource', {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
            volume: default_volume,
        });
        return createAudioResource(response.body, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
            volume: default_volume,
        });
    } catch (error) {
        // Log ffmpeg spawn failures without crashing the bot
        if (error.code === 'EAGAIN' || error.errno === -11) {
            voiceLogger.error(null, 'FFmpeg spawn failed due to resource exhaustion', error, { url });
            logger.warn(`FFmpeg EAGAIN for ${url} - consider reducing concurrent voice connections`);
        }
        throw error;
    } finally {
        // Always release semaphore to prevent deadlock
        ffmpegSemaphore.release();
    }
}

async function validateStreamUrl(url) {
    voiceLogger.stream(null, 'Validating stream URL', { url });
    if (!url?.startsWith('http')) {
        voiceLogger.stream(null, 'URL validation failed - invalid format', { url });
        return { valid: false, reason: 'Invalid URL' };
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: getAudioStreamHeaders(),
        });
        clearTimeout(timeoutId);
        const result = {
            valid: response.ok,
            reason: response.ok ? 'OK' : `HTTP ${response.status}`,
        };
        voiceLogger.stream(null, 'URL validation result', { ...result, url });
        return result;
    } catch (error) {
        voiceLogger.stream(null, 'URL validation error', { url, error: error.message });
        return { valid: false, reason: error.message };
    }
}

function getReciterLinks(state) {
    const reciterData = global.reciters?.[state.currentReciter];
    if (!reciterData?.links) {
        voiceLogger.resource(state.guildId, 'No reciter links found', {
            reciter: state.currentReciter,
        });
        return Array(114).fill('');
    }
    const links =
        reciterData.links.length > 114
            ? reciterData.links.slice(0, 114)
            : reciterData.links.length < 114
              ? [...reciterData.links, ...Array(114 - reciterData.links.length).fill('')]
              : reciterData.links;
    voiceLogger.resource(state.guildId, 'Reciter links retrieved', {
        reciter: state.currentReciter,
        totalLinks: links.length,
        validLinks: links.filter((l) => l?.startsWith('http')).length,
    });
    return links;
}

function findAvailableSurahForReciter(state, excludeIndex = -1) {
    voiceLogger.resource(state.guildId, 'Finding available surah for reciter', {
        reciter: state.currentReciter,
        excludeIndex,
    });
    const reciterData = global.reciters?.[state.currentReciter];
    if (!reciterData?.links) {
        voiceLogger.resource(state.guildId, 'No links data for reciter');
        return -1;
    }
    const available = [];
    for (let i = 0; i < Math.min(reciterData.links.length, 114); i++) {
        if (i !== excludeIndex && reciterData.links[i]?.startsWith('http')) available.push(i);
    }
    voiceLogger.resource(state.guildId, 'Available surahs found', {
        count: available.length,
        available: available.slice(0, 10),
    });
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : -1;
}

function findWorkingReciter(excludeReciter = null) {
    voiceLogger.resource(null, 'Finding working reciter', { excludeReciter });
    const available = [];
    for (const [key, data] of Object.entries(global.reciters || {})) {
        if (key === excludeReciter || !data?.links) continue;
        if (data.links.some((l) => l?.startsWith('http'))) available.push(key);
    }
    voiceLogger.resource(null, 'Working reciters found', {
        count: available.length,
        available: available.slice(0, 5),
    });
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
}

async function createSurahResource(state, index, startSeconds = 0) {
    const guildId = state.guildId;
    voiceLogger.resource(guildId, 'Creating surah resource', {
        index,
        startSeconds,
        reciter: state.currentReciter,
        surahNum: index + 1,
    });
    const MAX_FALLBACK_ATTEMPTS = 5;
    let currentAttempt = 0;
    let currentIndex = index;
    let skipValidation = false;
    while (currentAttempt < MAX_FALLBACK_ATTEMPTS) {
        try {
            const url = getReciterLinks(state)[currentIndex];
            if (!url) {
                voiceLogger.resource(guildId, 'Surah link unavailable', { index: currentIndex });
                throw new Error('Surah link unavailable');
            }
            if (!skipValidation) {
                const validation = await validateStreamUrl(url);
                if (!validation.valid) {
                    voiceLogger.resource(guildId, 'Stream validation failed', {
                        url,
                        reason: validation.reason,
                    });
                    throw new Error(`Stream invalid: ${validation.reason}`);
                }
            }
            voiceLogger.resource(guildId, 'Creating stream resource', { url, startSeconds });
            // Wrap ffmpeg spawn in retry logic for EAGAIN resilience
            const resource = await retryWithBackoff(() => createAudioStreamResource(url, startSeconds), 3, 1500);
            voiceLogger.resource(guildId, 'Surah resource created successfully', { url });
            return resource;
        } catch (error) {
            currentAttempt++;
            voiceLogger.resource(guildId, `Surah resource attempt ${currentAttempt} failed`, {
                error: error.message,
                attempt: currentAttempt,
                maxAttempts: MAX_FALLBACK_ATTEMPTS,
            });
            if (currentAttempt >= MAX_FALLBACK_ATTEMPTS) {
                voiceLogger.error(guildId, 'Max fallback attempts reached for surah resource', error);
                throw error;
            }
            // Skip validation on retry to avoid repeated HEAD requests during fallback
            skipValidation = true;
            const working = findWorkingReciter(state.currentReciter);
            if (working) {
                voiceLogger.resource(guildId, 'Fallback: switching reciter', {
                    from: state.currentReciter,
                    to: working,
                });
                state.currentReciter = working;
                state.currentSurah = 1;
                currentIndex = 0;
                await new Promise((r) => setTimeout(r, 2000));
                continue;
            }
            const alt = findAvailableSurahForReciter(state, currentIndex);
            if (alt !== -1 && alt !== currentIndex) {
                voiceLogger.resource(guildId, 'Fallback: switching surah', {
                    from: currentIndex + 1,
                    to: alt + 1,
                });
                state.currentSurah = alt + 1;
                currentIndex = alt;
                await new Promise((r) => setTimeout(r, 2000));
                continue;
            }
            voiceLogger.resource(guildId, 'No fallback options available');
            throw error;
        }
    }
    throw new Error('Max fallback attempts reached');
}

async function createRadioResource(url, startSeconds = 0) {
    voiceLogger.resource(null, 'Creating radio resource', { url, startSeconds });
    if (!url?.startsWith('http')) {
        voiceLogger.error(null, 'Invalid radio URL', null, { url });
        throw new Error(`Invalid Radio URL`);
    }
    const validation = await validateStreamUrl(url);
    if (!validation.valid) {
        voiceLogger.resource(null, 'Radio stream validation failed', {
            url,
            reason: validation.reason,
        });
        throw new Error('Radio stream invalid');
    }
    voiceLogger.resource(null, 'Creating radio stream resource', { url, startSeconds });
    // Wrap ffmpeg spawn in retry logic for EAGAIN resilience
    return await retryWithBackoff(() => createAudioStreamResource(url, startSeconds), 3, 1500);
}

function isSurahAvailable(state, index) {
    const reciterData = global.reciters?.[state.currentReciter];
    if (!reciterData?.links || !reciterData.links[index]) {
        voiceLogger.resource(state.guildId, 'Surah not available no link data', {
            reciter: state.currentReciter,
            index,
        });
        return false;
    }
    const link = reciterData.links[index];
    const available = typeof link === 'string' && link.trim() !== '' && link.startsWith('http');
    voiceLogger.resource(state.guildId, 'Surah availability check', {
        index,
        available,
        linkPreview: link?.substring(0, 50),
    });
    return available;
}

function getAvailableSurahCount(state) {
    const reciterData = global.reciters?.[state.currentReciter];
    if (!reciterData?.links) {
        voiceLogger.resource(state.guildId, 'No reciter data for count', {
            reciter: state.currentReciter,
        });
        return 114;
    }
    const count = reciterData.links.filter((link) => typeof link === 'string' && link.trim() !== '' && link.startsWith('http')).length;
    voiceLogger.resource(state.guildId, 'Available surah count', {
        reciter: state.currentReciter,
        count,
    });
    return count;
}

module.exports.createAudioStreamResource = createAudioStreamResource;
module.exports.fetchWithRetry = fetchWithRetry;
module.exports.calculateByteRange = calculateByteRange;
module.exports.getAudioDuration = getAudioDuration;
module.exports.validateStreamUrl = validateStreamUrl;
module.exports.getReciterLinks = getReciterLinks;
module.exports.findAvailableSurahForReciter = findAvailableSurahForReciter;
module.exports.findWorkingReciter = findWorkingReciter;
module.exports.createSurahResource = createSurahResource;
module.exports.createRadioResource = createRadioResource;
module.exports.isSurahAvailable = isSurahAvailable;
module.exports.getAvailableSurahCount = getAvailableSurahCount;
