// audio.js (НОВАЯ ВЕРСИЯ С РАНДОМНЫМИ ЗВУКАМИ ИЗ МАССИВА)
import * as THREE from 'three';
import { settings } from './settings.js';

let listener = null;
let audioLoader = null;

const footstepBuffers = new Map();
const slideBuffers = new Map();
const activeFootstepSounds = new Set();

// --- Новый флаг: есть ли сейчас активное скольжение (используется чтобы блокировать шаги) ---
let isSlidingActive = false;

const footstepMap = {
    default: ['sounds/footstep_default.wav'],
    grass: ['sounds/footstep_grass.wav'],
    road: [
        'sounds/footstep_stone1.wav',
        'sounds/footstep_stone2.wav',
        'sounds/footstep_stone3.wav',
        'sounds/footstep_stone4.wav',
        'sounds/footstep_stone5.wav',
        'sounds/footstep_stone6.wav',
        'sounds/footstep_stone7.wav'
    ],
    mountain: [
        'sounds/footstep_stone1.wav',
        'sounds/footstep_stone2.wav',
        'sounds/footstep_stone3.wav'
    ],
    desert: ['sounds/footstep_sand.wav'],
    snow: ['sounds/footstep_snow1.wav',
           'sounds/footstep_snow2.wav',
           'sounds/footstep_snow3.wav'
    ]
};

const slideSoundMap = {
    default: ['sounds/slide_stone.wav'],
    grass: ['sounds/slide_stone.wav'],
    road: ['sounds/slide_stone.wav'],
    mountain: ['sounds/slide_stone.wav'],
    desert: ['sounds/slide_stone.wav'],
    snow: ['sounds/slide_stone.wav']
};

let currentSlideSound = null;

export function initAudio(camera) {
    if (listener) return;
    listener = new THREE.AudioListener();
    camera.add(listener);
    audioLoader = new THREE.AudioLoader();
    console.log('Audio: listener initialized.');
}

export function getListener() {
    return listener;
}

/**
 * Вспомогательная функция для загрузки группы звуков
 * @param {Map<string, string[]>} soundMap - Карта "поверхность -> массив путей"
 * @param {Map<string, THREE.AudioBuffer[]>} bufferMap - Карта для сохранения загруженных буферов
 */
function loadSoundGroup(soundMap, bufferMap) {
    Object.entries(soundMap).forEach(([key, paths]) => {
        bufferMap.set(key, []);
        paths.forEach(path => {
            audioLoader.load(path, (buffer) => {
                bufferMap.get(key).push(buffer);
            }, undefined, () => {
                console.warn(`Audio: failed to load sound from "${path}"`);
            });
        });
    });
}

export function preloadFootsteps() {
    if (!audioLoader) {
        console.warn('preloadFootsteps: audioLoader not initialized.');
        return;
    }
    console.log('Audio: Preloading sound groups...');
    loadSoundGroup(footstepMap, footstepBuffers);
    loadSoundGroup(slideSoundMap, slideBuffers);
}

function resolveSoundKey(requested, bufferMap) {
    if (!requested || !bufferMap.has(requested) || bufferMap.get(requested).length === 0) {
        const aliases = {
            mountain: 'stone',
            road: 'stone',
            desert: 'default',
            unknown: 'default'
        };
        const key = aliases[requested] || 'default';
        if (bufferMap.has(key) && bufferMap.get(key).length > 0) {
            return key;
        }
        return 'default';
    }
    return requested;
}

export function playCoinSound() {
    if (!listener) return;
    const sound = new THREE.Audio(listener);
    audioLoader.load('sounds/coin.mp3', buffer => {
        const masterVolume = settings.MASTER_VOLUME ?? 1.0;
        // Используем новую настройку COIN_VOLUME. Добавим ?? 0.3 на случай, если она не определена.
        const coinVolume = settings.COIN_VOLUME ?? 0.3;

        sound.setBuffer(buffer);
        // Вычисляем итоговую громкость
        sound.setVolume(coinVolume * masterVolume);
        sound.play();
    });
}
// --- ИСПРАВЛЕННАЯ ВЕРСИЯ ФУНКЦИИ ---
// audio.js -> ЗАМЕНИТЕ ЭТУ ФУНКЦИЮ

export function playFootstepSound(surfaceType, opts = {}) {
    if (!listener || !audioLoader) return;

    // Блокируем шаги во время скольжения
    if (isSlidingActive) {
        return;
    }

    const master = settings.MASTER_VOLUME ?? 1.0;
    const footstepSetting = settings.FOOTSTEP_VOLUME ?? 0;

    // Если звук выключен, выходим
    if (master <= 0 || footstepSetting <= 0) {
        stopAllFootsteps();
        return;
    }

    const speed = typeof opts.speed === 'number' ? opts.speed : (settings.MIN_PLAYER_SPEED || 1);
    const side = typeof opts.side === 'number' ? opts.side : 0;

    const key = resolveSoundKey(surfaceType, footstepBuffers);
    const bufferArray = footstepBuffers.get(key) || [];
    if (!bufferArray || bufferArray.length === 0) return;

    const idx = Math.floor(Math.random() * bufferArray.length);
    const buffer = bufferArray[idx];
    if (!buffer) return;

    const sound = new THREE.Audio(listener);
    sound.setBuffer(buffer);

    // --- УПРОЩЕННАЯ И ИСПРАВЛЕННАЯ ЛОГИКА ГРОМКОСТИ ---
    const finalVol = footstepSetting * master;

    // --- ОТЛАДОЧНЫЙ ВЫВОД В КОНСОЛЬ ---
    // Эта строка - ключ к разгадке.
    console.log(`[Footstep Sound] Master: ${master.toFixed(4)}, Footstep: ${footstepSetting}, Final Volume: ${finalVol.toExponential(4)}`);
    // ------------------------------------

    sound.setVolume(finalVol);

    // Логика высоты тона (pitch) остается без изменений
    const baseRate = 0.98 + Math.random() * 0.08;
    const pitchSpeedFactor = 1 + (Math.max(0, speed - (settings.MIN_PLAYER_SPEED || 0)) / Math.max(1e-6, (settings.MAX_PLAYER_SPEED - (settings.MIN_PLAYER_SPEED || 0)))) * 0.08;
    const playbackRate = Math.max(0.8, Math.min(1.2, baseRate * pitchSpeedFactor));
    if (typeof sound.setPlaybackRate === 'function') sound.setPlaybackRate(playbackRate);

    // Остальная часть функции без изменений
    activeFootstepSounds.add(sound);
    try {
        const src = sound.source;
        if (src) {
            try {
                src.onended = () => _stopAndCleanupSound(sound);
            } catch (e) {
                setTimeout(() => _stopAndCleanupSound(sound), (buffer.duration || 1.0) * 1000 + 200);
            }
        } else {
            setTimeout(() => _stopAndCleanupSound(sound), (buffer.duration || 1.0) * 1000 + 200);
        }
    } catch (e) {
        setTimeout(() => _stopAndCleanupSound(sound), (buffer.duration || 1.0) * 1000 + 200);
    }
    try {
        const audioCtx = listener.context;
        if (audioCtx && typeof audioCtx.createStereoPanner === 'function') {
            const panNode = audioCtx.createStereoPanner();
            panNode.pan.value = (side === 0) ? (Math.random() * 0.2 - 0.1) : (side * 0.25 + (Math.random() * 0.08 - 0.04));
            const src = sound.source;
            if (src && src.disconnect && src.connect) {
                try {
                    src.disconnect();
                    src.connect(panNode);
                    panNode.connect(audioCtx.destination);
                } catch (e) { /* fallback */ }
            }
        }
    } catch (e) { }
    try {
        sound.play();
    } catch (e) {
        _stopAndCleanupSound(sound);
    }
}


export function manageSlideSound(isSliding, surfaceType) {
    if (!listener) return;

    const master = (settings.MASTER_VOLUME ?? 1.0);
    const slideVolSetting = (settings.SLIDE_VOLUME ?? 0.5);

    if (!isSliding || master <= 0 || slideVolSetting <= 0) {
        if (currentSlideSound && currentSlideSound.isPlaying) {
            try { currentSlideSound.stop(); } catch (e) { }
        }
        currentSlideSound = null;

        isSlidingActive = false;
        return;
    }

    if (!isSlidingActive) {
        isSlidingActive = true;
        stopAllFootsteps();
    }

    const key = resolveSoundKey(surfaceType, slideBuffers);
    const bufferArray = slideBuffers.get(key);

    if (!bufferArray || bufferArray.length === 0) {
        if (currentSlideSound && currentSlideSound.isPlaying) currentSlideSound.stop();
        return;
    }

    const isPlayingCorrectSoundGroup = currentSlideSound && currentSlideSound.isPlaying && bufferArray.includes(currentSlideSound.buffer);
    if (isPlayingCorrectSoundGroup) {
        return;
    }

    if (currentSlideSound && currentSlideSound.isPlaying) {
        currentSlideSound.stop();
    }

    const randomIndex = Math.floor(Math.random() * bufferArray.length);
    const randomBuffer = bufferArray[randomIndex];

    currentSlideSound = new THREE.Audio(listener);
    currentSlideSound.setBuffer(randomBuffer);
    currentSlideSound.setLoop(true);

    const masterVolume = settings.MASTER_VOLUME ?? 1.0;
    const slideVolume = settings.SLIDE_VOLUME ?? 0.5;

    currentSlideSound.setVolume(slideVolume * masterVolume);
    currentSlideSound.play();
}

function _stopAndCleanupSound(sound) {
    try {
        if (sound.isPlaying) sound.stop();
    } catch (e) { }
    try {
        if (typeof sound.disconnect === 'function') sound.disconnect();
    } catch (e) { }
    activeFootstepSounds.delete(sound);
}

export function stopAllFootsteps() {
    for (const s of Array.from(activeFootstepSounds)) {
        _stopAndCleanupSound(s);
    }
}