// --- ФАЙЛ: game.js (ОБНОВЛЕННЫЙ) ---

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createNoise2D } from 'simplex-noise';
import { settings } from './settings.js';
import { Debug } from './debug.js';
import { createPSXComposer } from './psxPostprocess.js';
import { initAudio, playCoinSound, playFootstepSound, preloadFootsteps, getListener, manageSlideSound } from './audio.js';
import { StatsDisplay } from './StatsDisplay.js';
import { AugmentsManager } from './Augments.js';
import { createSunSprite, createMoonSprite } from './daySprite.js';
import { IndicatorsUI } from './IndicatorsUI.js';
import { Chat } from './chat.js';
import { TrickDisplay } from './TrickDisplay.js';
import { coinPatternManager } from './CoinPatterns.js';
import { ShopManager } from './ShopManager.js';
import { getCoinBalance, addCoins, spendCoins } from './coinCounter.js';
import { initCoinUI, updateCoinUI } from './coinUI.js';
import { Sky } from './sky.js';
import { BonusManager } from './BonusManager.js'; // --- НОВЫЙ ИМПОРТ ---

const scene = new THREE.Scene();
const roadAngle = Math.random() * Math.PI * 2;
const roadAngleCos = Math.cos(roadAngle);
const roadAngleSin = Math.sin(roadAngle);
const ROAD_GRID_SIZE = 4096;
const HIGHWAY_INTERVAL = 8192;
const TRUNK_ROAD_INTERVAL = 2048;
const TRUNK_ROAD_MAX_LENGTH = 4096;
const TRUNK_ROAD_SPAWN_CHANCE = 0.6;
const MIN_Y_LEVEL = -200;
const LOD_LEVELS = [
    { distance: 3, segments: 16 },
    { distance: 8, segments: 7 },
    { distance: 16, segments: 2 },
    { distance: 19, segments: 1 }
];

const UPDATE_DISTANCE = 8;
const CHAT_SCALE = 0.85;
const NORMAL_LAYER = 0;
const GLOW_LAYER = 1;

// --- ЛОГИКА ПОДСВЕТКИ ОСТАЕТСЯ ЗДЕСЬ, ТАК КАК ОНА НЕ ЯВЛЯЕТСЯ "БОНУСОМ" ---
const originalEmissiveColors = new Map();
const _highlightEmissiveColor = new THREE.Color(0x777777);
const _defaultEmissiveColor = new THREE.Color(0x111111);
const DAY_NIGHT_THRESHOLD = -0.1;
let wasDayPreviously;
let autoHighlightMode = true;
const highlightState = {
    isActive: false,
    isTransitioning: false,
    transitionSpeed: 1.5
};

let animatedScore = 0;
let animatedHighScore = 0;
let isHighScoreBeaten = false;
let highScoreFlashTime = 0;

// --- ПЕРЕМЕННЫЕ БОНУСОВ УДАЛЕНЫ. ОНИ ТЕПЕРЬ В BonusManager.js ---

function seededRandom(seed1, seed2) {
    let x = Math.sin(seed1 * 12.9898 + seed2 * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

// --- Инициализация ---
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 0, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
let psx = null;
let indicatorsUI = null;
const debugMenu = document.getElementById('debug-menu');
debugMenu.style.display = 'none';
const speedGaugeFill = document.getElementById('speed-gauge-fill');
const speedGaugeText = document.getElementById('speed-gauge-text');
const bhopTimerEl = document.getElementById('bhop-timer');
const bhopStatusEl = document.getElementById('bhop-status');
const daylightEffectTimerEl = document.getElementById('daylight-effect-timer');
const daylightEffectTimeVal = document.getElementById('daylight-effect-time');

// --- Камера и Тело Игрока ---
const playerBody = new THREE.Object3D();
playerBody.position.y = 30;
scene.add(playerBody);
const camera = new THREE.PerspectiveCamera(settings.NORMAL_FOV, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';
camera.position.y = settings.PLAYER_HEIGHT;
playerBody.add(camera);

const sky = new Sky(scene, camera, {
    timeOfDay: 0.25,
    cycleSpeed: 6,
    transitionDuration: 0.7,
    transitionOffset: 0.08
});
wasDayPreviously = Math.sin(sky.getTimeOfDay() * Math.PI * 2) >= DAY_NIGHT_THRESHOLD;

initAudio(camera);
preloadFootsteps();

// --- Управление от первого лица ---
const controls = new PointerLockControls(camera, renderer.domElement);
psx = createPSXComposer({
    renderer, scene, camera, opts: {
        lowResScale: 0.33,
        intensity: 0.5,
        posterizeLevels: 17,
        bayerStrength: 0.15,
        scanlineIntensity: 0.01,
        chromaAmount: 0.0018,
        vignetteStrength: 0.18,
        blackLift: 0.01,
        contrast: 1.03
    }
});
psx.psxPass.uniforms.u_psx_intensity.value = 0.9;

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
let comboHudState = {
    isVisible: false,
    targetOpacity: 0,
    targetScale: 0.8,
    animationSpeed: 5.0
};
blocker.style.display = 'none';

renderer.domElement.addEventListener('click', () => {
    if (chat && chat.isInInputMode) {
        return;
    }
    if ((augmentsManager && augmentsManager.isVisible) || (shopManager && shopManager.isVisible)) {
        return;
    }
    controls.lock();
});

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
    blocker.style.display = 'none';
    isGamePaused = false;
    isLockingAfterChat = false;
});

controls.addEventListener('unlock', () => {
    if (isLockingAfterChat || isUnlockingForChat) {
        isUnlockingForChat = false;
        return;
    }
    if (isPausedForAugment || isPausedForShop) {
        isGamePaused = false;
    } else {
        blocker.style.display = 'block';
        instructions.style.display = '';
        isGamePaused = true;
    }
});

const keyboard = {};
document.addEventListener('keydown', (event) => {
    if (chat && chat.isInInputMode) {
        event.preventDefault();
        event.stopPropagation();
        const closeChatAndLock = () => {
            isLockingAfterChat = true;
            chat.hideInput();
            controls.lock();
        };
        if (event.key === 'Escape') {
            closeChatAndLock();
            return;
        }
        if (event.key === 'Enter') {
            const inputText = chat.currentInput.trim();
            if (inputText.toLowerCase() === '/shop') {
                chat.hideImmediately();
                toggleShop();
                return;
            }
            if (inputText === '') {
                closeChatAndLock();
            } else {
                chat.sendMessage();
            }
            return;
        }
        if (event.key === 'Backspace' && chat.currentInput === '') {
            closeChatAndLock();
            return;
        }
        chat.handleKeydown(event);
        return;
    }
    if (shopManager && shopManager.isVisible && (event.code === 'Escape' || event.code === 'Enter')) {
        event.preventDefault();
        toggleShop();
        return;
    }
    if (event.code === 'KeyT' && controls.isLocked) {
        isUnlockingForChat = true;
        chat.showForInput();
        controls.unlock();
        keyboard['KeyW'] = false;
        keyboard['KeyA'] = false;
        keyboard['KeyS'] = false;
        keyboard['KeyD'] = false;
        return;
    }
    const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ControlLeft', 'KeyB', 'KeyV', 'KeyN', 'KeyH'];
    if (gameKeys.includes(event.code) && controls.isLocked) {
        event.preventDefault();
    }
    if (event.code === 'KeyH' && controls.isLocked) {
        toggleTerrainHighlight();
    }
    keyboard[event.code] = true;
});

document.addEventListener('keyup', (event) => {
    if (chat && chat.isVisible) {
        return;
    }
    keyboard[event.code] = false;
    if (event.code === 'Space') {
        canPerformJump = true;
    }
    if (event.code === 'ControlLeft') {
        isSliding = false;
        canAttemptSlide = true;
    }
    if (event.code === 'KeyV') {
        debug.toggleVisibility();
        debugMenu.style.display = debug.isVisible ? 'block' : 'none';
    }
    if (event.code === 'KeyB') {
        isBhopEnabled = !isBhopEnabled;
        bhopStatusMessage = `BHOP ${isBhopEnabled ? 'ON' : 'OFF'}`;
        console.log(`Bunnyhop mode: ${isBhopEnabled ? 'ENABLED' : 'DISABLED'}`);
    }
    if (event.code === 'KeyN') {
        statsDisplay.toggleVisibility();
    }
});

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let bonusManager = null; // --- НОВАЯ ПЕРЕМЕННАЯ ДЛЯ МЕНЕДЖЕРА ---
let currentLevelScore = 0;
let currentLevel = 1;
let levelScoreForNextLevel = 0;
let pendingAugmentChoices = 0;
let scorePopTimer = 0;
const SCORE_POP_DURATION = 0.35;
let levelScorePopTimer = 0;
const LEVEL_SCORE_POP_DURATION = 0.35;
let previousScoreForPop = 0;
let scoreEdgeShimmerTime = 0;
let levelScoreHudMesh = null;
let levelScoreHudContext = null;
let levelScoreHudTexture = null;
let animatedLevelScore = 0;
let animatedPendingLevelScore = 0;
const PENDING_LERP_SPEED = 2.0;
let chat = null;
let chatHudMesh = null;
let chatHudContext = null;
let chatHudTexture = null;
let augmentsManager = null;
let shopManager = null;
let isPausedForShop = false;
let isUnlockingForChat = false;
let isLockingAfterChat = false;
const chunks = new Map();
let isGamePaused = true;
let isPausedForAugment = false;
let isFovTransitioning = false;
let fovTransition = { start: 0, end: 0, startTime: 0, duration: 0 };
const augmentRaycaster = new THREE.Raycaster();
const hoverRaycaster = new THREE.Raycaster();
const chunksToLoad = [];
const CHUNKS_PER_FRAME = 2;
let isBhopEnabled = true;
let overdriveTimer = 0;
let overdriveMessageEndTime = 0;
let isOverdriveActive = false;
let canPerformJump = true;
let comboScore = 0;
let comboMultiplier = 1;
let isComboActive = false;
let statsDisplay = null;
let comboHudContext = null;
let comboHudTexture = null;
let comboHudMesh = null;
let trickDisplay = null;
let scoreAnimationStartTime = 0;
let previousComboScore = 0;
let previousComboMultiplier = 1;
const SCORE_ANIMATION_DURATION = 0.3;
let comboAnimationState = {
    score: { isAnimating: false, startTime: 0, previousValue: 0 },
    multiplier: { isAnimating: false, startTime: 0, previousValue: 1 }
};
let levelScoreAnimationState = {
    score: { isAnimating: false, startTime: 0, previousValue: 0 },
    cap: { isAnimating: false, startTime: 0, previousValue: 0 }
};
let lastFrameTime = performance.now();
let frameCounter = 0;
let lastFpsValue = 0;
const PHYSICS_TICK_RATE = 120;
const PHYSICS_DELTA = 1 / PHYSICS_TICK_RATE;
let physicsAccumulator = 0;
let scoreHudMesh = null;
let scoreHudContext = null;
let scoreHudTexture = null;
let currentScore = 0;
let highScore = 0;
let coinParticles;
let powerupParticles;
let speedupParticles;
let sunriseParticles;
let shopParticles;
let augmentParticles;
let distanceSinceLastStep = 0;
let currentPlayerChunk = { x: null, z: null };
let playerVelocity = new THREE.Vector3(0, 0, 0);
let isPlayerOnGround = true;
let isLandingAnimationPlaying = false;
let landingAnimationTime = 0;
let headBobTime = 0;
let timeSinceLanding = 0;
let bhopStatusMessage = '-';
let isSliding = false;
let isXRayEffectActive = false; // XRay оставим здесь, так как он связан с монетами
let canAttemptSlide = true;
let sunMesh;
let sunSprite = null;
let moonSprite = null;
let timeSinceLastStep = 0;
let originalRenderDistance = settings.RENDER_DISTANCE;
let originalFogDistance = settings.FOG_DISTANCE;
let isRenderTransitioning = false;
let renderTransitionStartTime = 0;
let renderTransitionStartRender = 0;
let renderTransitionStartFog = 0;
let comboTimerRemainingTime = 0;
let xRayEffectRemainingTime = 0; // XRay таймер тоже оставляем

instructions.addEventListener('click', () => { controls.lock(); });
const superJumpTimerEl = document.getElementById('super-jump-timer');
const superJumpTimeVal = document.getElementById('super-jump-time');
const speedBoostTimerEl = document.getElementById('speed-boost-timer');
const speedBoostTimeVal = document.getElementById('speed-boost-time');

// --- ВСЕ ПЕРЕМЕННЫЕ ЭФФЕКТА ДНЯ УДАЛЕНЫ ---

const coinRadius = 1.5;
const coinThickness = 0.2;
const coinSides = 8;
const objectGeometry = new THREE.CylinderGeometry(coinRadius, coinRadius, coinThickness, coinSides);
const objectMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe666,
    metalness: 0.3,
    roughness: 0.85,
    emissive: 0xffe666,
    emissiveIntensity: 0.4
});
const highlightMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, depthTest: false, transparent: true, opacity: settings.XRAY_OPACITY, fog: false, side: THREE.DoubleSide });
const coinWorldPosition = new THREE.Vector3();
const playerXZ = new THREE.Vector2();
const coinXZ = new THREE.Vector2();
const shadowTexture = new THREE.CanvasTexture(createBlobShadowTexture());

// ... (функции groundMove, capSpeed, airMove, slideMove остаются без изменений)
function groundMove(delta, wishdir, maxPlayerSpeed) { 
    const speed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();
    if (speed > 0) {
        const drop = speed * settings.GROUND_FRICTION * delta;
        const newSpeed = Math.max(speed - drop, 0) / speed;
        playerVelocity.x *= newSpeed;
        playerVelocity.z *= newSpeed;
    }
    const wishSpeed = maxPlayerSpeed; 
    const currentSpeed = playerVelocity.dot(wishdir); 
    const addSpeed = wishSpeed - currentSpeed;
    if (addSpeed <= 0) {
        return;
    }
    let accelSpeed = settings.GROUND_ACCELERATE * wishSpeed * delta;
    if (accelSpeed > addSpeed) {
        accelSpeed = addSpeed;
    }
    playerVelocity.x += wishdir.x * accelSpeed;
    playerVelocity.z += wishdir.z * accelSpeed;
}
function capSpeed(maxSpeed) {
    const horizontalSpeed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();
    if (horizontalSpeed === 0) {
        return;
    }
    if (horizontalSpeed > maxSpeed) {
        const scale = maxSpeed / horizontalSpeed;
        playerVelocity.x *= scale;
        playerVelocity.z *= scale;
    }
}
function airMove(delta, wishdir) {
    const wishSpeed = settings.AIR_CONTROL_SPEED;
    const currentSpeed = playerVelocity.dot(wishdir);
    const addSpeed = wishSpeed - currentSpeed;
    if (addSpeed <= 0) {
        return;
    }
    let accelSpeed = settings.AIR_ACCELERATE * settings.MAX_PLAYER_SPEED * delta;
    if (accelSpeed > addSpeed) {
        accelSpeed = addSpeed;
    }
    playerVelocity.x += wishdir.x * accelSpeed;
    playerVelocity.z += wishdir.z * accelSpeed;
}
function slideMove(delta, forward, groundNormal) {
    let dot = 0;
    if (groundNormal) {
        dot = forward.dot(groundNormal);
    }
    let dynamicFriction = settings.SLIDE_FRICTION;
    if (dot < 0) { 
        dynamicFriction *= settings.SLIDE_FRICTION_UPHILL_MULTIPLIER;
    }
    const speed = playerVelocity.length();
    if (speed > 0) {
        const drop = speed * dynamicFriction * delta;
        const scale = Math.max(speed - drop, 0) / speed;
        playerVelocity.multiplyScalar(scale);
    }
    if (groundNormal) {
        if (dot > 0) { 
            const accel = forward.clone().multiplyScalar(dot * settings.SLIDE_DOWNHILL_FORCE * settings.SLIDE_SLOPE_INFLUENCE * delta);
            playerVelocity.add(accel);
            bhopStatusMessage = 'СКОЛЬЖЕНИЕ ВНИЗ';
        } else if (dot < 0) { 
            const brakeMagnitude = Math.abs(dot) * settings.SLIDE_UPHILL_DAMPEN * settings.SLIDE_SLOPE_INFLUENCE * delta;
            const currentSpeed = playerVelocity.length();
            if (currentSpeed > brakeMagnitude) {
                const scale = (currentSpeed - brakeMagnitude) / currentSpeed;
                playerVelocity.multiplyScalar(scale);
            } else {
                playerVelocity.set(0, 0, 0);
            }
            bhopStatusMessage = 'СКОЛЬЖЕНИЕ ВВЕРХ';
        } else {
            bhopStatusMessage = 'СКОЛЬЖЕНИЕ';
        }
    }
}
// ...

const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false
});
const shadowGeometry = new THREE.PlaneGeometry(settings.COIN_SCALE * 2, settings.COIN_SCALE * 2);

const powerupMaterial = new THREE.SpriteMaterial({
    map: createPowerupTexture(),
    fog: true,
    depthTest: true
});
const speedupMaterial = new THREE.SpriteMaterial({
    map: createSpeedupTexture(),
    fog: true,
    depthTest: true
});
const sunriseMaterial = new THREE.SpriteMaterial({
    map: createSunriseTexture(),
    fog: true,
    depthTest: true
});

// ... (остальной код до класса Chunk)
function lerp(a, b, t) { return a * (1 - t) + b * t; }
const terrainNoise = createNoise2D();
const colorGrass = new THREE.Color(0x93ed85);
const colorDesert = new THREE.Color(0xffdf84);
const colorMountain = new THREE.Color(settings.BIOMES[2].color);
const colorSnow = new THREE.Color(0xFFFFFF);
function createGrasslandTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d'); const squareSize = 64;
    for (let x = 0; x < canvas.width; x += squareSize) {
        for (let y = 0; y < canvas.height; y += squareSize) {
            const isEven = ((x / squareSize) + (y / squareSize)) % 2 === 0;
            context.fillStyle = isEven ? '#32e364' : '#94c971';
            context.fillRect(x, y, squareSize, squareSize);
        }
    } return canvas;
}
function createDesertTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d'); const squareSize = 64;
    for (let x = 0; x < canvas.width; x += squareSize) {
        for (let y = 0; y < canvas.height; y += squareSize) {
            const isEven = ((x / squareSize) + (y / squareSize)) % 2 === 0;
            context.fillStyle = isEven ? '#c2b280' : '#bdb078';
            context.fillRect(x, y, squareSize, squareSize);
        }
    } return canvas;
}
function createSnowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d'); const squareSize = 64;
    for (let x = 0; x < canvas.width; x += squareSize) {
        for (let y = 0; y < canvas.height; y += squareSize) {
            const isEven = ((x / squareSize) + (y / squareSize)) % 2 === 0;
            context.fillStyle = isEven ? '#FFFFFF' : '#E0E0E0'; 
            context.fillRect(x, y, squareSize, squareSize);
        }
    } return canvas;
}
function getRoadData(worldX, worldZ) {
    const ROAD_SHAPE_SCALE = 0.00019;
    const ROAD_HEIGHT_SCALE = 0.0008; 
    const ROAD_HEIGHT_AMPLITUDE = 40;
    const ROAD_BASE_HEIGHT = 15;
    const pavementWidth = 135;
    const shoulderWidth = 130;
    const epsilon = 1.0;
    const roadValue = terrainNoise(worldX * ROAD_SHAPE_SCALE, worldZ * ROAD_SHAPE_SCALE);
    const nx1 = terrainNoise((worldX + epsilon) * ROAD_SHAPE_SCALE, worldZ * ROAD_SHAPE_SCALE);
    const nx2 = terrainNoise((worldX - epsilon) * ROAD_SHAPE_SCALE, worldZ * ROAD_SHAPE_SCALE);
    const nz1 = terrainNoise(worldX * ROAD_SHAPE_SCALE, (worldZ + epsilon) * ROAD_SHAPE_SCALE);
    const nz2 = terrainNoise(worldX * ROAD_SHAPE_SCALE, (worldZ - epsilon) * ROAD_SHAPE_SCALE);
    const dx = (nx1 - nx2) / (2 * epsilon);
    const dz = (nz1 - nz2) / (2 * epsilon);
    const gradientMagnitude = Math.sqrt(dx * dx + dz * dz);
    let distanceToCenter;
    if (gradientMagnitude < 1e-9) {
        distanceToCenter = Infinity;
    } else {
        distanceToCenter = Math.abs(roadValue) / gradientMagnitude;
    }
    const onPavement = distanceToCenter <= pavementWidth / 2;
    const totalHalfWidth = pavementWidth / 2 + shoulderWidth;
    const onShoulder = (distanceToCenter > pavementWidth / 2) && (distanceToCenter <= totalHalfWidth);
    if (!onPavement && !onShoulder) {
        return { onPavement: false, onShoulder: false, roadHeight: 0, shoulderBlendFactor: 0 };
    }
    const roadHeight = terrainNoise(worldX * ROAD_HEIGHT_SCALE, 5000 + worldZ * ROAD_HEIGHT_SCALE) * ROAD_HEIGHT_AMPLITUDE + ROAD_BASE_HEIGHT;
    let shoulderBlendFactor = 1.0;
    if (onShoulder) {
        let blend = (totalHalfWidth - distanceToCenter) / shoulderWidth;
        shoulderBlendFactor = Math.max(0, Math.min(1, blend)) ** 2;
    }
    return { onPavement, onShoulder, roadHeight, shoulderBlendFactor };
}
const textureRepeats = settings.CHUNK_SIZE / 10;
const grasslandTexture = new THREE.CanvasTexture(createGrasslandTexture());
grasslandTexture.wrapS = THREE.RepeatWrapping; grasslandTexture.wrapT = THREE.RepeatWrapping; grasslandTexture.repeat.set(textureRepeats, textureRepeats);
const desertTexture = new THREE.CanvasTexture(createDesertTexture());
desertTexture.wrapS = THREE.RepeatWrapping; desertTexture.wrapT = THREE.RepeatWrapping; desertTexture.repeat.set(textureRepeats, textureRepeats);
const snowTexture = new THREE.CanvasTexture(createSnowTexture());
snowTexture.wrapS = THREE.RepeatWrapping; snowTexture.wrapT = THREE.RepeatWrapping; snowTexture.repeat.set(textureRepeats, textureRepeats);
const BIOMES = [
    { name: 'Grassland', material: new THREE.MeshStandardMaterial({ map: grasslandTexture, flatShading: true }), noiseScale: 0.004, noiseAmplitude: 15 },
    { name: 'Desert', material: new THREE.MeshStandardMaterial({ map: desertTexture, flatShading: true }), noiseScale: 0.002, noiseAmplitude: 75 },
    { name: 'Mountain', material: new THREE.MeshStandardMaterial({ map: snowTexture, flatShading: true }), noiseScale: 0.008, noiseAmplitude: 150 }
];


// ЗАМЕНИТЕ ВЕСЬ КЛАСС CHUNK В game.js НА ЭТОТ КОД

class Chunk {
    constructor(scene, chunkX, chunkZ) {
        this.scene = scene;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.mesh = null;
        this.isWaitingForData = false;
        this.requestedLODSegments = -1;
        this.currentLODSegments = -1;

        this.coins = [];
        this.shadows = [];
        this.coinData = [];
        this.powerup = null; this.powerupShadow = null; this.initialPowerupY = 0;
        this.speedup = null; this.speedupShadow = null; this.initialSpeedupY = 0;
        this.sunrise = null; this.sunriseShadow = null; this.initialSunriseY = 0;
        this.xray = null; this.xrayShadow = null; this.initialXrayY = 0;
    }

    buildMeshFromData(data) {
        const { positions, colors, segments } = data;
        this.isWaitingForData = false;

        console.log(`[Chunk (${this.chunkX}, ${this.chunkZ})] Начало сборки меша. Получено ${positions.length / 3} вершин.`);

        if (this.mesh) {
            this.destroyMesh();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const indices = [];
        const widthSegments = segments;
        const heightSegments = segments;
        for (let y = 0; y < heightSegments; y++) {
            for (let x = 0; x < widthSegments; x++) {
                const a = x + (widthSegments + 1) * y;
                const b = x + (widthSegments + 1) * (y + 1);
                const c = (x + 1) + (widthSegments + 1) * (y + 1);
                const d = (x + 1) + (widthSegments + 1) * y;
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, color: 0xfcfafa, emissive: 0x111111 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.userData.chunk = this;

        if (!originalEmissiveColors.has(this.mesh.uuid)) {
            originalEmissiveColors.set(this.mesh.uuid, material.emissive.clone());
        }
        if (highlightState.isActive) {
            material.emissive.copy(_highlightEmissiveColor);
        }

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(this.chunkX * settings.CHUNK_SIZE, 0, this.chunkZ * settings.CHUNK_SIZE);
        this.scene.add(this.mesh);

        this.currentLODSegments = segments;
        this.requestedLODSegments = segments;
    }

    requestRebuild(segments) {
        if (this.requestedLODSegments === segments && this.mesh) {
            return;
        }
        this.requestedLODSegments = segments;
        this.isWaitingForData = true;
        chunkWorker.postMessage({
            type: 'generateChunk',
            payload: {
                chunkX: this.chunkX,
                chunkZ: this.chunkZ,
                segments: segments
            }
        });
    }

    spawnObjects() {
        if (!this.mesh) return; // Защита, если меш еще не создан

        this.coins.forEach(c => this.mesh.remove(c));
        this.shadows.forEach(s => this.mesh.remove(s));
        this.coins = []; this.shadows = []; this.coinData = [];
        this.collectPowerup(); this.collectSpeedup(); this.collectSunrise(); this.collectXRay();

        const objectSpawnRoll = seededRandom(this.chunkX * 7, this.chunkZ * 13, WORLD_SEED);
        if (objectSpawnRoll < settings.OBJECT_SPAWN_CHANCE) {
            if (coinPatternManager.shouldSpawnPattern(this.chunkX, this.chunkZ)) {
                this.spawnCoinPattern();
            }
        }

        if (bonusManager) {
            const spawnableBonuses = [
                { type: 'powerup', chance: settings.POWERUP_SPAWN_CHANCE, spawnFunc: 'spawnPowerup' },
                { type: 'speedup', chance: settings.SPEEDUP_SPAWN_CHANCE, spawnFunc: 'spawnSpeedup' },
                { type: 'sunrise', chance: settings.SUNRISE_SPAWN_CHANCE, spawnFunc: 'spawnSunrise' },
                { type: 'xray', chance: settings.XRAY_SPAWN_CHANCE, spawnFunc: 'spawnXRay' },
            ];
            for (const bonus of spawnableBonuses) {
                if (bonusManager.shouldSpawnBonus(bonus.type, bonus.chance, this.chunkX, this.chunkZ)) {
                    this[bonus.spawnFunc]();
                    break;
                }
            }
        }
    }

    _getGroundY(localX, localZ) {
        if (!this.mesh) return 0;
        const ray = new THREE.Raycaster(
            new THREE.Vector3(this.mesh.position.x + localX, 500, this.mesh.position.z + localZ),
            new THREE.Vector3(0, -1, 0)
        );
        const intersects = ray.intersectObject(this.mesh);
        return intersects.length > 0 ? intersects[0].point.y : 0;
    }

    _spawnBonus(type, material, scale, storageKey) {
        const localX = (seededRandom(this.chunkX * (storageKey.length * 3), this.chunkZ * (storageKey.length * 5), WORLD_SEED) - 0.5) * settings.CHUNK_SIZE;
        const localZ = (seededRandom(this.chunkX * (storageKey.length * 7), this.chunkZ * (storageKey.length * 11), WORLD_SEED) - 0.5) * settings.CHUNK_SIZE;
        const groundY = this._getGroundY(localX, localZ);
        if (groundY === 0) return;

        const initialY = groundY + scale / 2 + settings.COIN_HOVER_HEIGHT * 2;
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(scale, scale, 1);
        sprite.position.set(localX, initialY - this.mesh.position.y, localZ);

        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.scale.set(0.7, 0.7, 0.7);
        shadow.position.set(localX, groundY - this.mesh.position.y + 0.1, localZ);

        this.mesh.add(sprite);
        this.mesh.add(shadow);

        this[storageKey] = sprite;
        this[storageKey + 'Shadow'] = shadow;
        this['initial' + storageKey.charAt(0).toUpperCase() + storageKey.slice(1) + 'Y'] = initialY - this.mesh.position.y;
    }

    spawnPowerup() { this._spawnBonus('powerup', powerupMaterial, settings.POWERUP_SCALE, 'powerup'); }
    spawnSpeedup() { this._spawnBonus('speedup', speedupMaterial, settings.SPEEDUP_SCALE, 'speedup'); }
    spawnSunrise() { this._spawnBonus('sunrise', sunriseMaterial, settings.SUNRISE_SCALE, 'sunrise'); }
    spawnXRay() { this._spawnBonus('xray', xrayMaterial, settings.XRAY_SCALE, 'xray'); }

    spawnCoinPattern() {
        const worldX = this.chunkX * settings.CHUNK_SIZE;
        const worldZ = this.chunkZ * settings.CHUNK_SIZE;
        coinPatternManager.registerPatternSpawn(worldX, worldZ);
        const pattern = coinPatternManager.getRandomPattern(this.chunkX, this.chunkZ);
        for (const point of pattern.shape) {
            this.createCoinAt(point.x, point.z, point.y || 0);
        }
    }

    createCoinAt(localX, localZ, yOffset = 0) {
        const groundY = this._getGroundY(localX, localZ);
        if (groundY === 0) return;

        const initialCoinY = groundY + (1.5 * settings.COIN_SCALE) + settings.COIN_HOVER_HEIGHT + yOffset;
        const worldX = this.chunkX * settings.CHUNK_SIZE + localX;
        const worldZ = this.chunkZ * settings.CHUNK_SIZE + localZ;
        const coinId = getCoinId(worldX, initialCoinY, worldZ);

        if (collectedCoins.has(coinId)) return;

        const coin = new THREE.Mesh(objectGeometry, bonusManager.isXRayActive ? highlightMaterial : objectMaterial);
        coin.rotation.x = Math.PI / 2;
        coin.scale.set(settings.COIN_SCALE, settings.COIN_SCALE, settings.COIN_SCALE);
        coin.userData.coinId = coinId;
        coin.position.set(localX, initialCoinY - this.mesh.position.y, localZ);

        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(localX, groundY - this.mesh.position.y + 0.1, localZ);

        this.mesh.add(coin);
        this.mesh.add(shadow);
        this.coins.push(coin);
        this.shadows.push(shadow);
        this.coinData.push({
            initialY: initialCoinY - this.mesh.position.y,
            hoverOffset: seededRandom(localX, localZ, WORLD_SEED) * Math.PI * 2
        });
    }

    collectCoin(coinToCollect) {
        const index = this.coins.indexOf(coinToCollect);
        if (index !== -1) {
            if (coinToCollect.parent) coinToCollect.parent.remove(coinToCollect);
            coinToCollect.geometry.dispose();
            const shadowToCollect = this.shadows[index];
            if (shadowToCollect && shadowToCollect.parent) {
                shadowToCollect.parent.remove(shadowToCollect);
                shadowToCollect.geometry.dispose();
            }
            this.coins.splice(index, 1);
            this.shadows.splice(index, 1);
            this.coinData.splice(index, 1);
        }
    }

    collectPowerup() { if (this.powerup && this.powerup.parent) { this.powerup.parent.remove(this.powerup); } if (this.powerupShadow && this.powerupShadow.parent) { this.powerupShadow.parent.remove(this.powerupShadow); } this.powerup = null; this.powerupShadow = null; }
    collectSpeedup() { if (this.speedup && this.speedup.parent) { this.speedup.parent.remove(this.speedup); } if (this.speedupShadow && this.speedupShadow.parent) { this.speedupShadow.parent.remove(this.speedupShadow); } this.speedup = null; this.speedupShadow = null; }
    collectSunrise() { if (this.sunrise && this.sunrise.parent) { this.sunrise.parent.remove(this.sunrise); } if (this.sunriseShadow && this.sunriseShadow.parent) { this.sunriseShadow.parent.remove(this.sunriseShadow); } this.sunrise = null; this.sunriseShadow = null; }
    collectXRay() { if (this.xray && this.xray.parent) { this.xray.parent.remove(this.xray); } if (this.xrayShadow && this.xrayShadow.parent) { this.xrayShadow.parent.remove(this.xrayShadow); } this.xray = null; this.xrayShadow = null; }

    update(delta) {
        const elapsedTime = clock.getElapsedTime();
        for (let i = 0; i < this.coins.length; i++) {
            const coin = this.coins[i];
            const data = this.coinData[i];
            coin.rotation.z += 2 * delta;
            coin.position.y = data.initialY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED + data.hoverOffset) * settings.COIN_HOVER_RANGE;
        }
        if (this.powerup) { this.powerup.position.y = this.initialPowerupY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED) * settings.COIN_HOVER_RANGE; }
        if (this.speedup) { this.speedup.position.y = this.initialSpeedupY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED) * settings.COIN_HOVER_RANGE; }
        if (this.sunrise) { this.sunrise.position.y = this.initialSunriseY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED) * settings.COIN_HOVER_RANGE; }
        if (this.xray) { this.xray.position.y = this.initialXrayY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED) * settings.COIN_HOVER_RANGE; }
    }

    destroy() {
        coinPatternManager.unregisterPatternSpawn(this.chunkX * settings.CHUNK_SIZE, this.chunkZ * settings.CHUNK_SIZE);
        this.destroyMesh();
        this.coins = [];
        this.shadows = [];
        this.coinData = [];
    }
}


const raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 50);
const clock = new THREE.Clock();
const sunGeometry = new THREE.SphereGeometry(20, 16, 16);
const textureLoader = new THREE.TextureLoader();
const moonTexture = textureLoader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg');
const sunMaterial = new THREE.MeshStandardMaterial({
    emissive: 0xffef8f,
    emissiveIntensity: 2.0,
    color: 0xffef8f,
    metalness: 0,
    roughness: 1
});
const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonTexture,
    emissiveMap: moonTexture,
    emissive: 0xeeeeff,
    emissiveIntensity: 0.1,
    color: 0xcccccc,
    metalness: 0,
    roughness: 0.8
});
sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
sunMesh.frustumCulled = false;
scene.add(sunMesh);
sunMesh.visible = false;


function reloadVisibleChunks() {
    const playerPos = playerBody.position;
    const currentChunkX = Math.floor((playerPos.x + settings.CHUNK_SIZE / 2) / settings.CHUNK_SIZE);
    const currentChunkZ = Math.floor((playerPos.z + settings.CHUNK_SIZE / 2) / settings.CHUNK_SIZE);
    const visibleChunks = new Set();
    for (let x = currentChunkX - settings.RENDER_DISTANCE; x <= currentChunkX + settings.RENDER_DISTANCE; x++) {
        for (let z = currentChunkZ - settings.RENDER_DISTANCE; z <= currentChunkZ + settings.RENDER_DISTANCE; z++) {
            const chunkId = `${ x },${ z } `;
            visibleChunks.add(chunkId);
            if (!chunks.has(chunkId) && !chunksToLoad.some(c => c.x === x && c.z === z)) {
                chunksToLoad.push({ x, z });
            }
        }
    }
    chunksToLoad.sort((a, b) => {
        const distA = Math.sqrt((a.x - currentChunkX) ** 2 + (a.z - currentChunkZ) ** 2);
        const distB = Math.sqrt((b.x - currentChunkX) ** 2 + (b.z - currentChunkZ) ** 2);
        return distA - distB;
    });
    for (const [chunkId, chunk] of chunks.entries()) {
        if (!visibleChunks.has(chunkId)) {
            chunk.destroy();
            chunks.delete(chunkId);
        }
    }
}
function updateChunks() {
    const playerPos = playerBody.position;
    const currentChunkX = Math.floor((playerPos.x + settings.CHUNK_SIZE / 2) / settings.CHUNK_SIZE);
    const currentChunkZ = Math.floor((playerPos.z + settings.CHUNK_SIZE / 2) / settings.CHUNK_SIZE);
    if (currentChunkX !== currentPlayerChunk.x || currentChunkZ !== currentPlayerChunk.z) {
        currentPlayerChunk.x = currentChunkX;
        currentPlayerChunk.z = currentChunkZ;
        debug.update(currentChunkX, currentChunkZ);
        reloadVisibleChunks();
    }
}
function processChunkLoadQueue() {
    for (let i = 0; i < CHUNKS_PER_FRAME; i++) {
        if (chunksToLoad.length === 0) break;
        const chunkData = chunksToLoad.shift();
        const chunkId = `${ chunkData.x },${ chunkData.z } `;
        if (!chunks.has(chunkId)) {
            chunks.set(chunkId, new Chunk(scene, chunkData.x, chunkData.z, currentPlayerChunk.x, currentPlayerChunk.z));
        }
    }
}
function updateFog() {
    const maxDiagonalDistance = settings.RENDER_DISTANCE * settings.CHUNK_SIZE * Math.sqrt(2);
    camera.far = maxDiagonalDistance * 1.1;
    camera.updateProjectionMatrix();
    const fogDistanceInChunks = settings.FOG_DISTANCE ?? (settings.RENDER_DISTANCE - 1.5);
    const fogDistance = fogDistanceInChunks * settings.CHUNK_SIZE;
    scene.fog.far = Math.max(fogDistance, settings.CHUNK_SIZE);
    scene.fog.near = scene.fog.far * 0.5;
}
function forceChunkUpdate() {
    reloadVisibleChunks();
}
function createBlobShadowTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 * 0.8;
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return canvas;
}
const collisionRaycaster = new THREE.Raycaster();
const PLAYER_RADIUS = 0.5;

function animate(now) {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const then = performance.now();
    const elapsed = now - then;
    if (elapsed < (1000 / settings.TARGET_FPS) && settings.TARGET_FPS !== 999) {
        return;
    }
    
    const currentTime = clock.getElapsedTime();
    const easeOutQuad = t => t * (2 - t);
    if (isFovTransitioning) {
        const elapsedTime = currentTime - fovTransition.startTime;
        const progress = Math.min(elapsedTime / fovTransition.duration, 1.0);
        camera.fov = lerp(fovTransition.start, fovTransition.end, easeOutQuad(progress));
        camera.updateProjectionMatrix();
        if (progress >= 1.0) {
            isFovTransitioning = false;
        }
    }
    if (augmentsManager && augmentsManager.isVisible) {
        augmentsManager.update(delta);
        if (!isFovTransitioning && camera.fov !== settings.NORMAL_FOV) {
            camera.fov = settings.NORMAL_FOV;
            camera.updateProjectionMatrix();
        }
    }
    if (isRenderTransitioning) {
        const elapsedTime = currentTime - renderTransitionStartTime;
        let progress = elapsedTime / settings.AUGMENT_TRANSITION_DURATION;
        if (progress >= 1.0) {
            progress = 1.0;
            isRenderTransitioning = false;
            settings.RENDER_DISTANCE = originalRenderDistance;
            settings.FOG_DISTANCE = originalFogDistance;
            forceChunkUpdate();
        }
        settings.FOG_DISTANCE = lerp(renderTransitionStartFog, originalFogDistance, easeOutQuad(progress));
        updateFog();
    }
    if (pendingAugmentChoices > 0 && !augmentsManager.isVisible && !isPausedForAugment) {
        isPausedForAugment = true;
        controls.unlock();
        pendingAugmentChoices--;
        augmentsManager.presentNewChoice();
        originalRenderDistance = settings.RENDER_DISTANCE;
        originalFogDistance = settings.FOG_DISTANCE;
        settings.RENDER_DISTANCE = settings.AUGMENT_RENDER_DISTANCE;
        settings.FOG_DISTANCE = settings.AUGMENT_FOG_DISTANCE;
        updateFog();
        forceChunkUpdate();
        isFovTransitioning = true;
        fovTransition = {
            start: camera.fov,
            end: settings.NORMAL_FOV,
            startTime: currentTime,
            duration: settings.AUGMENT_FOV_TRANSITION_DURATION
        };
    }

    if (!isGamePaused) {
        sky.update(delta, playerBody);
        
        // --- ОБНОВЛЕНИЕ МЕНЕДЖЕРА БОНУСОВ ---
        if (bonusManager) {
            bonusManager.update(delta, sky);
        }
        
        if (levelScorePopTimer > 0) {
            levelScorePopTimer -= delta;
        }

        if (autoHighlightMode) {
            const currentTimeOfDay = sky.getTimeOfDay();
            const isDay = Math.sin(currentTimeOfDay * Math.PI * 2) >= DAY_NIGHT_THRESHOLD;
            if (isDay !== wasDayPreviously) {
                if (!isDay && !highlightState.isActive) {
                    if (!highlightState.isTransitioning) {
                        console.log("Наступил вечер. Автоматическое включение подсветки...");
                    }
                    highlightState.isActive = true;
                    highlightState.isTransitioning = true;
                } else if (isDay && highlightState.isActive) {
                    if (!highlightState.isTransitioning) {
                        console.log("Наступил рассвет. Автоматическое выключение подсветки...");
                    }
                    highlightState.isActive = false;
                    highlightState.isTransitioning = true;
                }
            }
            wasDayPreviously = isDay;
        }

        if (highlightState.isTransitioning) {
            let stillAnimating = false;
            for (const chunk of chunks.values()) {
                const material = chunk.mesh.material;
                let targetColor = highlightState.isActive ? _highlightEmissiveColor : (originalEmissiveColors.get(chunk.mesh.uuid) || _defaultEmissiveColor);
                material.emissive.lerp(targetColor, highlightState.transitionSpeed * delta);
                const colorDistanceSq = Math.pow(material.emissive.r - targetColor.r, 2) + Math.pow(material.emissive.g - targetColor.g, 2) + Math.pow(material.emissive.b - targetColor.b, 2);
                if (colorDistanceSq > 0.00001) {
                    stillAnimating = true;
                }
            }
            if (!stillAnimating) {
                highlightState.isTransitioning = false;
                console.log("Анимация подсветки завершена.");
            }
        }
        
        // --- РАСЧЕТ СКОРОСТИ С УЧЕТОМ БОНУСОВ ---
        const originalBunnyhopMaxSpeed = settings.BUNNYHOP_MAX_SPEED;
        const originalMaxPlayerSpeed = settings.MAX_PLAYER_SPEED;
        let effectiveMaxSpeed = originalBunnyhopMaxSpeed;
        let effectivePlayerMaxSpeed = originalMaxPlayerSpeed;

        if (bonusManager) {
            const { speedupBonusValue, playerSpeedupBonusValue } = bonusManager.getSpeedBonuses();
            effectiveMaxSpeed += speedupBonusValue;
            effectivePlayerMaxSpeed += playerSpeedupBonusValue;
        }
        
        const horizontalSpeed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();
        if (isOverdriveActive) {
            effectiveMaxSpeed *= settings.OVERDRIVE_BONUS_MULTIPLIER;
            effectivePlayerMaxSpeed *= settings.OVERDRIVE_BONUS_MULTIPLIER;
            const deactivationThreshold = originalMaxPlayerSpeed;
            if (horizontalSpeed < deactivationThreshold) {
                isOverdriveActive = false;
                overdriveTimer = 0;
            }
        } else {
            const activationThreshold = effectiveMaxSpeed * settings.OVERDRIVE_SPEED_THRESHOLD;
            if (horizontalSpeed >= activationThreshold) {
                overdriveTimer += delta;
            } else {
                overdriveTimer = 0;
            }
            if (overdriveTimer >= settings.OVERDRIVE_DURATION) {
                isOverdriveActive = true;
                trickDisplay.show("OVERDRIVE", 2.0);
                triggerComboUpdate({ score: comboScore + settings.POINTS_PER_OVERDRIVE });
                overdriveTimer = 0;
            }
        }

        physicsAccumulator += delta;
        while (physicsAccumulator >= PHYSICS_DELTA) {
            updatePhysics(PHYSICS_DELTA, effectiveMaxSpeed, effectivePlayerMaxSpeed);
            physicsAccumulator -= PHYSICS_DELTA;
        }

        if (playerBody.position.y < MIN_Y_LEVEL) {
            const surfaceHeight = getTerrainHeightAt(playerBody.position.x, playerBody.position.z);
            playerBody.position.y = surfaceHeight + 5;
            playerVelocity.set(0, 0, 0);
        }
        updateFog();
        updateChunks();
        processChunkLoadQueue();

        for (const chunk of chunks.values()) {
            const distanceToPlayer = Math.sqrt(Math.pow(chunk.chunkX - currentPlayerChunk.x, 2) + Math.pow(chunk.chunkZ - currentPlayerChunk.z, 2));
            if (distanceToPlayer <= UPDATE_DISTANCE) {
                chunk.update(delta);
            }

            // --- ЛОГИКА ПОДБОРА ПЕРЕДАНА МЕНЕДЖЕРУ ---
            if (chunk.powerup) {
                const powerupWorldPosition = new THREE.Vector3();
                chunk.powerup.getWorldPosition(powerupWorldPosition);
                if (playerBody.position.distanceTo(powerupWorldPosition) < settings.POWERUP_PICKUP_RADIUS) {
                    chunk.collectPowerup();
                    bonusManager.activateSuperJump(powerupWorldPosition);
                }
            }
            if (chunk.speedup) {
                const speedupWorldPosition = new THREE.Vector3();
                chunk.speedup.getWorldPosition(speedupWorldPosition);
                if (playerBody.position.distanceTo(speedupWorldPosition) < settings.SPEEDUP_PICKUP_RADIUS) {
                    chunk.collectSpeedup();
                    bonusManager.activateSpeedBoost(speedupWorldPosition);
                }
            }
            if (chunk.sunrise) {
                const sunriseWorldPosition = new THREE.Vector3();
                chunk.sunrise.getWorldPosition(sunriseWorldPosition);
                if (playerBody.position.distanceTo(sunriseWorldPosition) < settings.SUNRISE_PICKUP_RADIUS) {
                    chunk.collectSunrise();
                    bonusManager.activateDaylight(sunriseWorldPosition, sky.getTimeOfDay());
                }
            }
            
            // Логика монет (остается здесь)
            if (chunk.coins.length > 0) {
                for (let i = chunk.coins.length - 1; i >= 0; i--) {
                    const coin = chunk.coins[i];
                    coin.getWorldPosition(coinWorldPosition);
                    const playerPosition = playerBody.position;
                    if (playerPosition.distanceTo(coinWorldPosition) < settings.COIN_PICKUP_RADIUS) {
                        triggerParticles(coinParticles, coinWorldPosition);
                        chunk.collectCoin(coin);
                        playCoinSound();
                        addCoins(1);
                        triggerComboUpdate({ score: comboScore + settings.POINTS_PER_COIN });
                        isXRayEffectActive = true;
                        xRayEffectRemainingTime = settings.XRAY_DURATION;
                    }
                    const distanceToCoin = playerPosition.distanceTo(coinWorldPosition);
                    if (isXRayEffectActive && distanceToCoin <= settings.XRAY_RADIUS) {
                        if (coin.material !== highlightMaterial) {
                            coin.material = highlightMaterial;
                            coin.layers.set(GLOW_LAYER);
                        }
                    } else {
                        if (coin.material !== objectMaterial) {
                            coin.material = objectMaterial;
                            coin.layers.set(NORMAL_LAYER);
                        }
                    }
                }
            }
        }

        if (isComboActive) {
            comboTimerRemainingTime -= delta;
            if (comboTimerRemainingTime > 0) {
                updateComboHud(comboTimerRemainingTime);
            } else {
                if (comboScore > 0) {
                    const pointsEarned = comboScore * comboMultiplier;
                    addScore(pointsEarned);
                    addLevelScore(pointsEarned);
                }
                comboScore = 0;
                comboMultiplier = 1;
                isComboActive = false;
                comboHudState.isVisible = false;
                comboHudState.targetOpacity = 0.0;
                comboHudState.targetScale = 0.8;
            }
        }
        if (isXRayEffectActive) {
            xRayEffectRemainingTime -= delta;
            if (xRayEffectRemainingTime <= 0) isXRayEffectActive = false;
        }
        
        // --- ЛОГИКА ТАЙМЕРОВ БОНУСОВ ПЕРЕНЕСЕНА В bonusManager.update() ---

        if (controls.isLocked === true) {
            handleFootsteps(delta, horizontalSpeed);
            let targetCameraY = isSliding ? settings.SLIDE_HEIGHT : settings.PLAYER_HEIGHT;
            if (isLandingAnimationPlaying) {
                landingAnimationTime += delta;
                const progress = landingAnimationTime / settings.LANDING_ANIMATION_DURATION;
                if (progress >= 1) isLandingAnimationPlaying = false;
                else targetCameraY -= Math.sin(progress * Math.PI) * settings.LANDING_ANIMATION_DEPTH;
            }
            if (isPlayerOnGround && keyboard['KeyW'] && !isSliding) {
                headBobTime += delta * settings.HEAD_BOB_SPEED;
                targetCameraY += Math.sin(headBobTime) * settings.HEAD_BOB_DEPTH;
            } else {
                headBobTime = 0;
            }
            camera.position.y = lerp(camera.position.y, targetCameraY, 20 * delta);
            let targetCameraRoll = 0;
            const rollAngleRad = settings.STRAFE_ROLL_ANGLE * (Math.PI / 180);
            if (keyboard['KeyD'] && !isSliding) targetCameraRoll = -rollAngleRad;
            else if (keyboard['KeyA'] && !isSliding) targetCameraRoll = rollAngleRad;
            camera.rotation.z = lerp(camera.rotation.z, targetCameraRoll, settings.STRAFE_ROLL_SPEED * delta);
            if (!isFovTransitioning) {
                (() => {
                    const FOV_NORMAL = Number(settings.FOV_NORMAL) || 75;
                    const FOV_RUNNING = Number(settings.FOV_RUNNING) || 85;
                    const FOV_SLIDING = Number(settings.FOV_SLIDING) || 125;
                    const FOV_BUNNYHOP_MAX = Number(settings.FOV_BUNNYHOP_MAX) || 110;
                    const FOV_BOOST = Number(settings.FOV_BOOST) || 15;
                    const FOV_SMOOTH_SPEED = Number(settings.FOV_SMOOTH_SPEED) || 4.0;
                    const minPlayerSpeed = Number(settings.MIN_PLAYER_SPEED) || 1;
                    const bunnyhopMaxSpeed = effectiveMaxSpeed;
                    const maxPlayerSpeed = effectivePlayerMaxSpeed;
                    const clamp01 = (x) => Math.max(0, Math.min(1, x));
                    let targetFov;
                    if (isSliding) {
                        targetFov = FOV_SLIDING;
                    } else if (horizontalSpeed < minPlayerSpeed) {
                        targetFov = FOV_NORMAL;
                    } else if (horizontalSpeed <= maxPlayerSpeed) {
                        targetFov = FOV_RUNNING;
                    } else {
                        const maxBoostedFov = FOV_BUNNYHOP_MAX + FOV_BOOST;
                        const bunnyhopSpeedRange = bunnyhopMaxSpeed - maxPlayerSpeed;
                        const speedIntoBunnyhop = horizontalSpeed - maxPlayerSpeed;
                        const progress = clamp01(speedIntoBunnyhop / (bunnyhopSpeedRange || 1e-6));
                        targetFov = lerp(FOV_RUNNING, maxBoostedFov, progress);
                    }
                    if (Number.isFinite(targetFov)) {
                        const smoothFactor = Math.min(FOV_SMOOTH_SPEED * delta, 1.0);
                        camera.fov = lerp(camera.fov, targetFov, smoothFactor);
                        camera.updateProjectionMatrix();
                    }
                })();
            }
        }
        if (trickDisplay) {
            trickDisplay.update();
        }
        if (indicatorsUI) {
            const remainingTimes = bonusManager.getRemainingTimes();
            indicatorsUI.update({
                speed: horizontalSpeed,
                maxSpeed: effectiveMaxSpeed,
                normalMaxSpeed: effectivePlayerMaxSpeed,
                baseMaxSpeed: originalBunnyhopMaxSpeed,
                daylightTime: remainingTimes.daylight,
                fps: lastFpsValue,
                isSpeedupActive: bonusManager.isSpeedBoostActive
            });
        }
        if (statsDisplay) {
            statsDisplay.update({
                effectiveBunnyhopMaxSpeed: effectiveMaxSpeed
            });
        }
        if (shopManager) {
            shopManager.update(delta);
        }
        if (coinParticles) coinParticles.material.uniforms.u_time.value = currentTime;
        if (powerupParticles) powerupParticles.material.uniforms.u_time.value = currentTime;
        if (speedupParticles) speedupParticles.material.uniforms.u_time.value = currentTime;
        if (sunriseParticles) sunriseParticles.material.uniforms.u_time.value = currentTime;
        if (shopParticles) shopParticles.material.uniforms.u_time.value = currentTime;
        if (augmentParticles) augmentParticles.material.uniforms.u_time.value = currentTime;
    }

    // --- БЛОК 3: ОБНОВЛЕНИЕ HUD И РЕНДЕРИНГ ---
    animatedLevelScore = lerp(animatedLevelScore, currentLevelScore, 4 * delta);
    if (Math.abs(currentLevelScore - animatedLevelScore) < 0.1) {
        animatedLevelScore = currentLevelScore;
    }
    const pendingComboPoints = (isComboActive && comboScore > 0) ? (comboScore * comboMultiplier) : 0;
    const targetPending = currentLevelScore + pendingComboPoints;
    animatedPendingLevelScore = lerp(animatedPendingLevelScore, targetPending, PENDING_LERP_SPEED * delta);
    updateLevelScoreHud();
    updateCoinUI();
    if (chat) {
        chat.update(delta);
        chat.draw();
        chatHudMesh.visible = chat.currentOpacity > 0;
    }
    if (comboHudMesh && comboHudMesh.visible) {
        const state = comboHudState;
        comboHudMesh.material.opacity = lerp(comboHudMesh.material.opacity, state.targetOpacity, state.animationSpeed * delta);
        const currentScale = comboHudMesh.scale.x;
        let newScale = lerp(currentScale, state.targetScale, state.animationSpeed * delta);
        if (state.isVisible && Math.abs(currentScale - 1.0) < 0.01) {
            const breath = Math.sin(clock.getElapsedTime() * 1) * 0.001;
            newScale += breath;
        }
        comboHudMesh.scale.set(newScale, newScale, newScale);
        if (comboHudMesh.material.opacity < 0.01 && !state.isVisible) {
            comboHudMesh.visible = false;
        }
    }
    if (scoreHudMesh) {
        const scoreLerpSpeed = 15;
        animatedScore = lerp(animatedScore, currentScore, scoreLerpSpeed * delta);
        if (Math.abs(currentScore - animatedScore) < 1) {
            animatedScore = currentScore;
        }
        animatedHighScore = lerp(animatedHighScore, highScore, scoreLerpSpeed * delta);
        if (Math.abs(highScore - animatedHighScore) < 1) {
            animatedHighScore = highScore;
        }
        if (highScoreFlashTime > 0) {
            highScoreFlashTime -= delta;
        }
        updateScoreHud();
    }
    if (psx && typeof psx.render === 'function') {
        psx.render(delta);
    } else {
        renderer.render(scene, camera);
    }
    frameCounter++;
    const nowForFps = performance.now();
    if (nowForFps >= lastFrameTime + 1000) {
        lastFpsValue = frameCounter;
        frameCounter = 0;
        lastFrameTime = nowForFps;
    }
}

function initializeGame() {
    console.log("Шрифт загружен, запускаем игру!");
    
    // --- ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРА БОНУСОВ ---
    const gameContext = {
        scene,
        clock,
        playCoinSound,
        triggerComboUpdate,
        triggerParticles,
        particles: {
            powerup: powerupParticles,
            speedup: speedupParticles,
            sunrise: sunriseParticles,
        },
        updateFog,
        forceChunkUpdate,
    };
    bonusManager = new BonusManager(gameContext);
    
    calculateNextLevelScoreRequirement();
    settings.RENDER_DISTANCE = 9;
    settings.FOG_DISTANCE = 9;
    updateFog();
    forceChunkUpdate();
    augmentsManager = new AugmentsManager(THREE, camera, settings);
    augmentsManager.initialize();
    shopManager = new ShopManager(camera, settings);
    shopManager.initialize();
    pendingAugmentChoices = 1;
    
    const statsSource = {
        getPlayerPosition: () => playerBody.position,
        getPlayerVelocity: () => playerVelocity,
        isPlayerOnGround: () => isPlayerOnGround,
        isSliding: () => isSliding,
        getCamera: () => camera,
        getEffectiveJumpStrength: () => bonusManager.getEffectiveJumpStrength(),
        getRemainingXRayTime: () => isXRayEffectActive ? Math.max(0, xRayEffectRemainingTime) : 0,
        getRemainingSuperJumpTime: () => bonusManager.getRemainingTimes().superJump,
        getRemainingSpeedBoostTime: () => bonusManager.getRemainingTimes().speedBoost,
        getRemainingDaylightTime: () => bonusManager.getRemainingTimes().daylight,
    };
    statsDisplay = new StatsDisplay(THREE, camera, statsSource, settings, { ...settings });

    const savedHighScore = localStorage.getItem('highScore');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore, 10);
    }
    animatedScore = currentScore;
    animatedHighScore = highScore;
    createScoreHud();
    createComboHud();
    createLevelScoreHud();
    trickDisplay = new TrickDisplay(camera);
    indicatorsUI = new IndicatorsUI(camera);
    
    coinParticles = createParticleSystem(new THREE.Color(0xffe666));
    powerupParticles = createParticleSystem(new THREE.Color(0x7CFC00));
    speedupParticles = createParticleSystem(new THREE.Color(0xF44336));
    sunriseParticles = createParticleSystem(new THREE.Color(0xFFFF00));
    shopParticles = createParticleSystem(new THREE.Color(0x64DD17));
    augmentParticles = createParticleSystem(new THREE.Color(0xffe666));

    // Обновляем контекст для bonusManager после создания частиц
    bonusManager.particles = { powerup: powerupParticles, speedup: speedupParticles, sunrise: sunriseParticles };

    createChatHud();
    chat = new Chat(chatHudContext, chatHudTexture, CHAT_SCALE);
    initCoinUI();
    chat.onSendMessage = () => {
        chat.hide();
        controls.lock();
    };

    setTimeout(() => {
        updateScoreHud();
        updateLevelScoreHud();
        updateCoinUI();
        if (augmentsManager) {
            augmentsManager.forceInitialDraw();
        }
    }, 200);

    animate();
    window.addEventListener('mousedown', handleAugmentSelection, false);
    window.addEventListener('mousedown', handleShopPurchase, false);
    window.addEventListener('mousemove', (event) => {
        handleShopHover(event);
        handleAugmentHover(event);
    }, false);
}

document.fonts.ready.then(initializeGame).catch(error => {
    console.error("Не удалось загрузить кастомный шрифт, игра будет использовать стандартный:", error);
    initializeGame();
});

// ... (остальные функции: handleFootsteps, getSurfaceType, setupSlider, createParticleSystem, и т.д. остаются без изменений)
let _stepSide = -1;
function handleFootsteps(delta, horizontalSpeed) {
    const isMoving = keyboard['KeyW'] || keyboard['KeyS'] || keyboard['KeyA'] || keyboard['KeyD'];
    if (!isPlayerOnGround || !isMoving) {
        distanceSinceLastStep = 0;
        return;
    }
    const distanceThisFrame = horizontalSpeed * delta;
    distanceSinceLastStep += distanceThisFrame;
    const speedNorm = Math.max(0.0, Math.min(1.0, (horizontalSpeed - settings.MIN_PLAYER_SPEED) / Math.max(1e-6, (settings.MAX_PLAYER_SPEED - settings.MIN_PLAYER_SPEED))));
    const stepLengthMultiplier = 0.75 + speedNorm * 1.5;
    const stepThreshold = (settings.STEP_INTERVAL_BASE || 1.0) * stepLengthMultiplier;
    if (distanceSinceLastStep >= stepThreshold) {
        const surfaceType = getSurfaceType(window.lastGroundIntersection);
        _stepSide = -_stepSide;
        try {
            playFootstepSound(surfaceType, { speed: horizontalSpeed, side: _stepSide });
        } catch (e) {
            try { playFootstepSound(surfaceType); } catch (err) { /* noop */ }
        }
        distanceSinceLastStep = Math.max(0, distanceSinceLastStep - stepThreshold);
    }
}
let lastGroundIntersection = null;
function getSurfaceType(groundIntersection) {
    if (!groundIntersection || !groundIntersection.object) {
        return 'unknown';
    }
    const obj = groundIntersection.object;
    if (obj.userData && obj.userData.surfaceType && obj.userData.surfaceType !== 'default') {
        return obj.userData.surfaceType;
    }
    if (groundIntersection.point) {
        const wx = groundIntersection.point.x;
        const wz = groundIntersection.point.z;
        try {
            const rd = getRoadData(wx, wz);
            if (rd && rd.onPavement) {
                return 'road';
            }
            if (rd && rd.onShoulder) {
                if (typeof rd.shoulderBlendFactor === 'number' && rd.shoulderBlendFactor > 0.6) {
                    return 'road';
                }
            }
        } catch (e) { }
    }
    if (groundIntersection.face && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.color) {
        const colors = obj.geometry.attributes.color;
        const face = groundIntersection.face;
        const ia = face.a, ib = face.b, ic = face.c;
        function getV(idx) { return new THREE.Color(colors.getX(idx), colors.getY(idx), colors.getZ(idx)); }
        const ca = getV(ia), cb = getV(ib), cc = getV(ic);
        const avg = new THREE.Color((ca.r + cb.r + cc.r) / 3, (ca.g + cb.g + cc.g) / 3, (ca.b + cb.b + cc.b) / 3);
        const ref = {
            grass: new THREE.Color(0x51c74f),
            desert: new THREE.Color(0xf0e68c),
            snow: new THREE.Color(0xffffff),
            mountain: new THREE.Color(settings.BIOMES[2].color || 0xAAAAAA),
            road: new THREE.Color(0x808080)
        };
        function dist(a, b) { return Math.sqrt(Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2)); }
        const ds = Object.fromEntries(Object.keys(ref).map(k => [k, dist(avg, ref[k])]));
        const entries = Object.entries(ds).sort((a, b) => a[1] - b[1]);
        const best = entries[0][0];
        const bestDist = entries[0][1];
        const CONFIDENCE_THRESHOLD = 0.18;
        if (bestDist <= CONFIDENCE_THRESHOLD) {
            return best;
        }
    }
    if (obj.userData && obj.userData.surfaceType && obj.userData.surfaceType !== 'default') {
        return obj.userData.surfaceType;
    }
    if (groundIntersection.point) {
        const y = groundIntersection.point.y;
        const snowThreshold = (typeof settings.MOUNTAIN_SNOW_HEIGHT !== 'undefined') ? settings.MOUNTAIN_SNOW_HEIGHT - 6 : 100;
        if (y >= snowThreshold) {
            return 'snow';
        }
    }
    if (obj.material && obj.material.color) {
        const matCol = obj.material.color.clone();
        const refs = {
            grass: new THREE.Color(0x51c74f),
            desert: new THREE.Color(0xf0e68c),
            snow: new THREE.Color(0xffffff),
            mountain: new THREE.Color(settings.BIOMES[2].color || 0xAAAAAA),
            road: new THREE.Color(0x808080)
        };
        function d(a, b) { return Math.sqrt(Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2)); }
        const ds = Object.fromEntries(Object.keys(refs).map(k => [k, d(matCol, refs[k])]));
        const entries = Object.entries(ds).sort((a, b) => a[1] - b[1]);
        const best = entries[0][0];
        return best;
    }
    return 'unknown';
}
function setupSlider(settingKey, isFloat = true, multiplier = 1, onUpdate = null) {
    const slider = document.getElementById(settingKey);
    if (!slider) return;
    const valueSpan = document.getElementById(`${settingKey}_Value`);
    let initialValue = settings[settingKey] ?? parseFloat(slider.value);
    if (settingKey === 'TARGET_FPS' && initialValue > 999) initialValue = 999;
    settings[settingKey] = initialValue;
    slider.value = initialValue / multiplier;
    if (valueSpan) valueSpan.textContent = slider.value;
    slider.addEventListener('input', (event) => {
        let value = isFloat ? parseFloat(event.target.value) : parseInt(event.target.value, 10);
        if (settingKey === 'TARGET_FPS') {
            if (value >= 999) {
                value = 999;
                if (valueSpan) valueSpan.textContent = "UL";
            } else {
                if (valueSpan) valueSpan.textContent = value;
            }
            settings.TARGET_FPS = value;
            fpsInterval = 1000 / settings.TARGET_FPS;
        } else {
            settings[settingKey] = value * multiplier;
            if (valueSpan) valueSpan.textContent = value;
        }
        if (onUpdate) {
            onUpdate(value);
        }
    });
}
setupSlider('MIN_PLAYER_SPEED');
setupSlider('MAX_PLAYER_SPEED');
setupSlider('BUNNYHOP_MAX_SPEED');
setupSlider('JUMP_STRENGTH');
setupSlider('GRAVITY');
setupSlider('RENDER_DISTANCE', false, 1, () => { updateFog(); forceChunkUpdate(); });
setupSlider('FOG_DISTANCE', false, 1, () => { updateFog(); });
setupSlider('SUNRISE_RENDER_DISTANCE', false);
setupSlider('TARGET_FPS', false);
setupSlider('BIOME_TRANSITION_DISTANCE', false);
setupSlider('NORMAL_FOV');
setupSlider('RUNNING_FOV');
setupSlider('HEAD_BOB_DEPTH');
setupSlider('STRAFE_ROLL_ANGLE');
setupSlider('HEAD_BOB_SMOOTH_SPEED', false);
setupSlider('COIN_HOVER_SPEED');
setupSlider('OBJECT_SPAWN_CHANCE', true, 0.01);
setupSlider('MASTER_VOLUME');
setupSlider('FOOTSTEP_VOLUME');
setupSlider('SLIDE_VOLUME');
setupSlider('STEP_INTERVAL_BASE');
setupSlider('COIN_VOLUME');
setupSlider('DAYLIGHT_EFFECT_DURATION');
setupSlider('XRAY_RADIUS');
setupSlider('BUNNYHOP_SPEED_BONUS');
setupSlider('AIR_ACCELERATE');
setupSlider('AIR_CONTROL_SPEED');
setupSlider('TIME_OF_DAY', true, 1, (value) => {
    sky.timeOfDay = value; // Управляем временем напрямую в sky
});
const xrayOpacitySlider = document.getElementById('XRAY_OPACITY');
if (xrayOpacitySlider) {
    const xrayOpacityValue = document.getElementById('XRAY_OPACITY_Value');
    xrayOpacitySlider.value = settings.XRAY_OPACITY;
    if (xrayOpacityValue) xrayOpacityValue.textContent = settings.XRAY_OPACITY;
    xrayOpacitySlider.addEventListener('input', (event) => {
        const value = parseFloat(event.target.value);
        settings.XRAY_OPACITY = value;
        if (xrayOpacityValue) xrayOpacityValue.textContent = value;
        highlightMaterial.opacity = value;
        highlightMaterial.needsUpdate = true;
    });
}
const particleOpacitySlider = document.getElementById('PARTICLE_OPACITY');
if (particleOpacitySlider) {
    const particleOpacityValue = document.getElementById('PARTICLE_OPACITY_Value');
    particleOpacitySlider.value = settings.PARTICLE_OPACITY;
    if (particleOpacityValue) particleOpacityValue.textContent = settings.PARTICLE_OPACITY;
    particleOpacitySlider.addEventListener('input', (event) => {
        const value = parseFloat(event.target.value);
        settings.PARTICLE_OPACITY = value;
        if (particleOpacityValue) particleOpacityValue.textContent = value;
        if (coinParticles) {
            coinParticles.material.uniforms.u_opacity.value = value;
        }
    });
}
const particleDelaySlider = document.getElementById('PARTICLE_APPEAR_DELAY');
if (particleDelaySlider) {
    const particleDelayValue = document.getElementById('PARTICLE_APPEAR_DELAY_Value');
    particleDelaySlider.value = settings.PARTICLE_APPEAR_DELAY;
    if (particleDelayValue) particleDelayValue.textContent = settings.PARTICLE_APPEAR_DELAY.toFixed(2);
    particleDelaySlider.addEventListener('input', (event) => {
        const value = parseFloat(event.target.value);
        settings.PARTICLE_APPEAR_DELAY = value;
        if (particleDelayValue) particleDelayValue.textContent = value.toFixed(2);
        if (coinParticles) {
            coinParticles.material.uniforms.u_appearDelay.value = value;
        }
    });
}
function createParticleSystem(color) {
    const particleCount = 2000;
    const positions = new Float32Array(particleCount * 3);
    const lifetimes = new Float32Array(particleCount);
    const startTimes = new Float32Array(particleCount);
    const initialVelocities = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const speed = 600 + Math.random() * 70;
        initialVelocities[i * 3 + 0] = speed * Math.sin(phi) * Math.cos(theta);
        initialVelocities[i * 3 + 1] = (speed * Math.cos(phi)) + 40.0;
        initialVelocities[i * 3 + 2] = speed * Math.sin(phi) * Math.sin(theta);
        lifetimes[i] = 1.5 + Math.random() * 1.0;
        startTimes[i] = -999;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('a_lifetime', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('a_startTime', new THREE.BufferAttribute(startTimes, 1));
    geometry.setAttribute('a_initialVelocity', new THREE.BufferAttribute(initialVelocities, 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Infinity);
    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_time: { value: 0.0 },
            u_color: { value: color },
            u_gravity: { value: 40.0 },
            u_opacity: { value: settings.PARTICLE_OPACITY },
            u_appearDelay: { value: settings.PARTICLE_APPEAR_DELAY }
        },
        vertexShader: `
            attribute float a_lifetime;
            attribute float a_startTime;
            attribute vec3 a_initialVelocity;
            uniform float u_time;
            uniform float u_gravity;
            uniform float u_appearDelay;
            varying float v_progress;

            void main() {
                float elapsedTime = u_time - a_startTime;
                if (elapsedTime >= u_appearDelay && elapsedTime < a_lifetime) {
                    float visibleDuration = a_lifetime - u_appearDelay;
                    float timeIntoAnimation = elapsedTime - u_appearDelay;
                    v_progress = timeIntoAnimation / visibleDuration;
                    vec3 newPosition = position + a_initialVelocity * elapsedTime;
                    newPosition.y -= 0.5 * u_gravity * elapsedTime * elapsedTime;
                    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    gl_Position = projectionMatrix * viewPosition;
                    float size = 3.0 * (1.0 - v_progress);
                    gl_PointSize = size * (100.0 / -viewPosition.z);
                } else {
                    gl_PointSize = 0.0;
                }
            }
        `,
        fragmentShader: `
            varying float v_progress;
            uniform vec3 u_color;
            uniform float u_opacity;

            void main() {
                float dist = distance(gl_PointCoord, vec2(0.5));
                if (dist > 0.5) {
                    discard;
                }
                float alpha = 1.0 - v_progress;
                gl_FragColor = vec4(u_color, alpha * alpha * u_opacity);
            }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
    });
    const particles = new THREE.Points(geometry, particleMaterial);
    particles.frustumCulled = false;
    scene.add(particles);
    return particles;
}
function triggerParticles(particleSystem, position) {
    if (!particleSystem) return;
    particleSystem.position.copy(position);
    const startTimeAttribute = particleSystem.geometry.getAttribute('a_startTime');
    const currentTime = clock.getElapsedTime();
    for (let i = 0; i < startTimeAttribute.count; i++) {
        startTimeAttribute.setX(i, currentTime);
    }
    startTimeAttribute.needsUpdate = true;
    particleSystem.visible = true;
}
function createSunriseTexture() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Палитра
    const fillColor = '#FFFF00';
    const highlightColor = '#FFF9C4';
    // ИЗМЕНЕНИЕ 1: Цвет обводки теперь в формате RGBA с 75% непрозрачности
    const strokeColor = 'rgba(230, 145, 56, 0.75)';

    ctx.lineJoin = 'round';

    const drawStarPath = () => {
        ctx.beginPath();
        const points = 4;
        const totalPoints = points * 2;
        for (let i = 0; i < totalPoints; i++) {
            const radius = i % 2 === 0 ? size / 2 : size / 4;
            const angle = (i * Math.PI) / points - (Math.PI / 2);
            const x = size / 2 + radius * Math.cos(angle);
            const y = size / 2 + radius * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
    };

    // ИЗМЕНЕНИЕ 2: Меняем порядок отрисовки

    // Сначала рисуем толстую, полупрозрачную обводку НА ЗАДНЕМ ПЛАНЕ
    ctx.lineWidth = 6; // Немного толще, т.к. заливка перекроет половину линии
    ctx.strokeStyle = strokeColor;
    drawStarPath();
    ctx.stroke();

    // Затем поверх нее рисуем непрозрачную основную заливку
    ctx.fillStyle = fillColor;
    drawStarPath();
    ctx.fill();

    // В самом конце рисуем тонкий блик поверх всего
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = highlightColor;
    ctx.translate(-0.5, -0.5);
    drawStarPath();
    ctx.stroke();
    ctx.translate(0.5, 0.5);

    return new THREE.CanvasTexture(canvas);
}
function createSpeedupTexture() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const strokeColor = '#B71C1C';    // Темно-бордовый для обводки
    const fillColor = '#F44336';      // Яркий, чистый красный
    const highlightColor = '#FFCDD2'; // Бледно-розовый для блика

    // --- РЕШЕНИЕ: 'BEVEL' ДЛЯ СБАЛАНСИРОВАННОЙ ОСТРОТЫ ---
    // Создает скошенные углы - не круглые и не шипастые.
    ctx.lineJoin = 'bevel';
    ctx.lineCap = 'butt';

    // --- Слегка скорректированная форма для лучшего баланса ---
    const drawBoltPath = () => {
        ctx.beginPath();
        ctx.moveTo(size * 0.65, size * 0.1);  // Начало
        ctx.lineTo(size * 0.35, size * 0.5);  // Вниз-влево
        ctx.lineTo(size * 0.55, size * 0.5);  // Короткий отступ вправо
        ctx.lineTo(size * 0.3, size * 0.9);   // Финальный рывок вниз
        ctx.stroke();
    };

    // --- Техника рисования остается прежней ---

    // 1. Рисуем толстую темную обводку
    ctx.lineWidth = 6;
    ctx.strokeStyle = strokeColor;
    drawBoltPath();

    // 2. Рисуем яркую основную линию
    ctx.lineWidth = 2;
    ctx.strokeStyle = fillColor;
    drawBoltPath();

    // 3. Рисуем тонкий блик
    ctx.lineWidth = 1;
    ctx.strokeStyle = highlightColor;
    drawBoltPath();

    return new THREE.CanvasTexture(canvas);
}

function createPowerupTexture() {
    const size = 32; // 1. Уменьшаем разрешение
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 2. Новая палитра
    const fillColor = '#7CFC00';      // Яркий зеленый
    const highlightColor = '#ADFF2F'; // Светлый для блика
    const strokeColor = '#228B22';    // Темно-зеленый для обводки

    ctx.lineWidth = 3; // 3. Толстая обводка
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';

    // 4. Рисуем три "шевронные" стрелки для классического вида
    const drawChevrons = (color) => {
        ctx.strokeStyle = color;
        const chevron = (yOffset) => {
            ctx.beginPath();
            ctx.moveTo(size * 0.25, size * yOffset);
            ctx.lineTo(size * 0.5, size * (yOffset - 0.2));
            ctx.lineTo(size * 0.75, size * yOffset);
            ctx.stroke();
        };
        chevron(0.45);
        chevron(0.70);
        chevron(0.95);
    };

    // Рисуем обводку
    ctx.lineWidth = 5; // Более толстая обводка для фона
    drawChevrons(strokeColor);

    // Рисуем основную фигуру
    ctx.lineWidth = 3;
    drawChevrons(fillColor);

    // Рисуем тонкий блик
    ctx.lineWidth = 1;
    ctx.translate(-1, -1);
    drawChevrons(highlightColor);
    ctx.translate(1, 1);

    return new THREE.CanvasTexture(canvas);
}
function getTerrainHeightAt(worldX, worldZ) {
    // Эта функция является точной копией логики генерации высоты из конструктора Chunk.
    // Она позволяет нам узнать высоту любой точки мира, не полагаясь на raycasting.

    const GRASSLAND_END = settings.BIOME_GRASSLAND_END;
    const GRASS_TO_DESERT_END = GRASSLAND_END + settings.BIOME_BLEND_RANGE;
    const DESERT_END = settings.BIOME_DESERT_END;
    const DESERT_TO_MOUNTAIN_END = DESERT_END + settings.BIOME_BLEND_RANGE;
    const MOUNTAIN_WIDTH = DESERT_END - GRASS_TO_DESERT_END;
    const MOUNTAIN_END = DESERT_TO_MOUNTAIN_END + MOUNTAIN_WIDTH;
    const MOUNTAIN_TO_GRASS_END = MOUNTAIN_END + settings.BIOME_BLEND_RANGE;
    const totalBiomeCycleLength = MOUNTAIN_TO_GRASS_END;

    const distFromOrigin = Math.sqrt(worldX * worldX + worldZ * worldZ) / settings.CHUNK_SIZE;
    const cyclicDist = distFromOrigin % totalBiomeCycleLength;

    const hGrass = terrainNoise(worldX * settings.BIOMES[0].noiseScale, worldZ * settings.BIOMES[0].noiseScale) * settings.BIOMES[0].noiseAmplitude;
    const hDesert = terrainNoise(worldX * settings.BIOMES[1].noiseScale, worldZ * settings.BIOMES[1].noiseScale) * settings.BIOMES[1].noiseAmplitude;
    const hMountain = terrainNoise(worldX * settings.BIOMES[2].noiseScale, worldZ * settings.BIOMES[2].noiseScale) * settings.BIOMES[2].noiseAmplitude;

    let biomeHeight = 0;

    if (cyclicDist < GRASSLAND_END) {
        biomeHeight = hGrass;
    } else if (cyclicDist < GRASS_TO_DESERT_END) {
        const t = (cyclicDist - GRASSLAND_END) / settings.BIOME_BLEND_RANGE;
        biomeHeight = lerp(hGrass, hDesert, t);
    } else if (cyclicDist < DESERT_END) {
        biomeHeight = hDesert;
    } else if (cyclicDist < DESERT_TO_MOUNTAIN_END) {
        const t = (cyclicDist - DESERT_END) / settings.BIOME_BLEND_RANGE;
        biomeHeight = lerp(hDesert, hMountain + settings.MOUNTAIN_BASE_HEIGHT, t);
    } else if (cyclicDist < MOUNTAIN_END) {
        biomeHeight = hMountain + settings.MOUNTAIN_BASE_HEIGHT;
    } else {
        const t = (cyclicDist - MOUNTAIN_END) / settings.BIOME_BLEND_RANGE;
        biomeHeight = lerp(hMountain + settings.MOUNTAIN_BASE_HEIGHT, hGrass, t);
    }

    let finalHeight = biomeHeight;
    const roadData = getRoadData(worldX, worldZ);

    if (roadData.onPavement) {
        finalHeight = roadData.roadHeight;
    } else if (roadData.onShoulder) {
        finalHeight = lerp(biomeHeight, roadData.roadHeight, roadData.shoulderBlendFactor);
    }

    return finalHeight;
}
function triggerComboUpdate(values, getState = false) {
    if (getState) {
        return { score: comboScore, multiplier: comboMultiplier };
    }
    // ... остальная логика
    const currentTime = clock.getElapsedTime();
    if (!isComboActive) {
        isComboActive = true;
        if (comboHudMesh) {
            comboHudMesh.visible = true;
            comboHudState.isVisible = true;
            comboHudState.targetOpacity = 1.0;
            comboHudState.targetScale = 1.0;
        }
    }
    comboTimerRemainingTime = settings.COMBO_DURATION;
    if (values.score !== undefined) {
        const state = comboAnimationState.score;
        state.previousValue = comboScore;
        comboScore = values.score;
        state.isAnimating = true;
        state.startTime = currentTime;
    }
    if (values.multiplier !== undefined) {
        const state = comboAnimationState.multiplier;
        state.previousValue = comboMultiplier;
        comboMultiplier = parseFloat(values.multiplier.toFixed(1));
        state.isAnimating = true;
        state.startTime = currentTime;
    }
    updateLevelScoreHud();
}
function createComboHud() { /*...*/ }
function drawAnimatedPart(ctx, state, currentValue, previousValue, options) { /*...*/ }
function updateComboHud(timer) { /*...*/ }
function addScore(points) { /*...*/ }
function resetScore() { /*...*/ }
function createScoreHud() { /*...*/ }
function updateScoreHud() { /*...*/ }
function handleAugmentSelection(event) { /*...*/ }
function updatePhysics(delta, currentMaxSpeedCap, currentMaxPlayerSpeed) {
    if (augmentsManager && augmentsManager.isVisible) {
        return;
    }
    // ...
    // --- ИЗМЕНЕНИЕ ЗДЕСЬ: используем bonusManager ---
    if (keyboard['Space'] && isPlayerOnGround) {
        if (isBhopEnabled || canPerformJump) {
            const jumpStrength = bonusManager.getEffectiveJumpStrength();
            // ... остальная логика прыжка, использующая jumpStrength ...
            // например: playerVelocity.y = jumpStrength;
        }
    }
    // ...
}

const gameDebugAPI = { activateAllBonuses: activateAllBonusesForDebug };
const debug = new Debug(scene, gameDebugAPI);
window.debug = debug;
function toggleTerrainHighlight() {
    if (autoHighlightMode) {
        autoHighlightMode = false;
        console.log("Автоматическая подсветка отключена. Управление теперь ручное.");
    }
    highlightState.isActive = !highlightState.isActive;
    highlightState.isTransitioning = true;
    console.log(`Ручное ${highlightState.isActive ? 'включение' : 'выключение'} подсветки...`);
}