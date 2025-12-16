
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
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
import { ShopManager } from './ShopManager.js';
import { getCoinBalance, addCoins, spendCoins } from './coinCounter.js';
import { initCoinUI, updateCoinUI } from './coinUI.js';
import { Sky } from './sky.js';
import { BonusManager } from './BonusManager.js';
import { seededRandom, lerp } from './utils.js';
import { patterns as coinPatternsData } from './CoinPatterns.js';

function getCoinId(x, y, z) {
    return `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
}

const WORLD_SEED = Math.floor(Math.random() * 100000);
window.WORLD_SEED = WORLD_SEED;
console.log(`Мир генерируется с сидом: ${WORLD_SEED}`);

const scene = new THREE.Scene();
const roadAngle = seededRandom(WORLD_SEED, WORLD_SEED * 2, WORLD_SEED) * Math.PI * 2;
const roadAngleCos = Math.cos(roadAngle);
const roadAngleSin = Math.sin(roadAngle);
const ROAD_GRID_SIZE = 4096; // Например, 8 чанков (8 * 512)
const HIGHWAY_INTERVAL = 8192;
const TRUNK_ROAD_INTERVAL = 2048;
const TRUNK_ROAD_MAX_LENGTH = 4096;
const TRUNK_ROAD_SPAWN_CHANCE = 0.6;
const MIN_Y_LEVEL = -1000; // Уровень, ниже которого игрок телепортируется наверх
const LOD_LEVELS = [
    { distance: 8, segments: 32 },
    { distance: 15, segments: 16 }, 
    { distance: 32, segments: 8 }, 
    { distance: 128, segments: 4 },  
    { distance: 256, segments: 1 },
];

const UPDATE_DISTANCE = 10; // Обновлять логику только для чанков в радиусе 4 от игрока
const CHAT_SCALE = 0.85; 
const NORMAL_LAYER = 0; // Слой для обычных объектов
const GLOW_LAYER = 1;   // Слой для объектов, которые должны светиться

let isTerrainHighlighted = false;
const originalEmissiveColors = new Map(); // Хранит исходные emissive цвета материалов
const _highlightEmissiveColor = new THREE.Color(0x2b2b2b); // Целевой цвет подсветки
const _defaultEmissiveColor = new THREE.Color(0x111111);   // Стандартный цвет из вашего кода
const DAY_NIGHT_THRESHOLD = 1;
let wasDayPreviously;
let autoHighlightMode = true; // Подсветка в автоматическом режиме по умолчанию

const highlightState = {
    isActive: false,         // Желаемое конечное состояние (вкл/выкл)
    isTransitioning: false,  // Флаг, что анимация сейчас идет
    transitionSpeed: 1.5     // Скорость перехода (больше = быстрее)
};

let animatedScore = 0;
let animatedHighScore = 0;
let isHighScoreBeaten = false; // Флаг, что мы только что побили рекорд
let highScoreFlashTime = 0;    // Таймер для анимации празднования


// --- Инициализация ---
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x657789, 0, 1000);
const ambientLight = new THREE.AmbientLight(0xafdafc, 0.1);
scene.add(ambientLight);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    timeOfDay: 0.01,
    cycleSpeed: 6,
    transitionDuration: 0.7,  // <-- Делает сам переход долгим
    transitionOffset: 0.08 // <-- Заставляет этот долгий переход начаться, когда солнце еще высоко
});
wasDayPreviously = Math.sin(sky.getTimeOfDay() * Math.PI * 2) >= DAY_NIGHT_THRESHOLD;

initAudio(camera);
preloadFootsteps(); 

// --- Управление от первого лица ---
const controls = new PointerLockControls(camera, renderer.domElement);
// создаём postprocess composer после того как camera/controls существуют
psx = createPSXComposer({
    renderer, scene, camera, opts: {
        //lowResScale: 0.33,
        lowResScale: 0.33,
        intensity: 545.111,
        posterizeLevels: 10,
        bayerStrength: 0.15,
        scanlineIntensity: 0.01,
        chromaAmount: 0.0018,
        vignetteStrength: 0.18,
        blackLift: 0.001,
        contrast: 1.3
    }
});

psx.psxPass.uniforms.u_psx_intensity.value = 0.9; // <-- Например, 70% интенсивности

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

let comboHudState = {
    isVisible: false,      // Флаг, должен ли HUD быть видимым
    targetOpacity: 0,      // Целевая непрозрачность (0 или 1)
    targetScale: 0.8,      // Целевой масштаб
    animationSpeed: 5.0    // Скорость анимации
};
// Сразу скрываем оверлей при загрузке.
// Текст инструкций, скорее всего, находится внутри, поэтому он тоже скроется.
blocker.style.display = 'none';

// Теперь для запуска игры нужно кликнуть не по тексту, а по самому игровому полю.
renderer.domElement.addEventListener('click', () => {
    // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
    // Игнорируем клик, если чат находится в режиме ввода текста.
    if (chat && chat.isInInputMode) {
        return; // Ничего не делаем
    }

    // Также игнорируем клик, если открыт магазин или выбор аугментов.
    if ((augmentsManager && augmentsManager.isVisible) || (shopManager && shopManager.isVisible)) {
        return; // Ничего не делаем
    }

    // Если никакие меню не открыты, захватываем курсор.
    controls.lock();
});

// ВНУТРИ controls.addEventListener('lock', ...)

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
    blocker.style.display = 'none';
    isGamePaused = false;

    // ДОБАВЬТЕ ЭТУ СТРОКУ:
    // Сбрасываем флаг-защиту, т.к. мы успешно заблокировали управление.
    isLockingAfterChat = false;
});

// ЗАМЕНИТЕ НА ЭТОТ БЛОК
controls.addEventListener('unlock', () => {
    // 1. Сначала проверяем флаги-защиты для чата.
    if (isLockingAfterChat || isUnlockingForChat) {
        isUnlockingForChat = false; // Сбрасываем флаг, если он был
        return; // Это не пауза, а открытие/закрытие чата
    }

    // 2. Проверяем, является ли эта "пауза" открытием меню
    if (isPausedForAugment || isPausedForShop) {
        // Да, это открытие меню аугментов или магазина.
        // Игровой мир остается видимым, игра НЕ ставится на паузу.
        isGamePaused = false;
    } else {
        // 3. Если это не чат и не меню, значит, это настоящая пауза.
        // Показываем стандартный черный экран паузы с инструкциями.
        blocker.style.display = 'block';
        instructions.style.display = '';
        isGamePaused = true; // Ставим игру на паузу
    }
});

const keyboard = {};
// ЗАМЕНИТЕ ВЕСЬ ВАШ 'keydown' ОБРАБОТЧИК НА ЭТОТ КОД

document.addEventListener('keydown', (event) => {
    // --- Логика, когда чат УЖЕ ОТКРЫТ для ввода ---
    if (chat && chat.isInInputMode) {
        event.preventDefault();
        event.stopPropagation();

        // Функция для чистого закрытия чата и возврата управления
        const closeChatAndLock = () => {
            isLockingAfterChat = true;
            chat.hideInput();
            controls.lock();
        };

        // Escape всегда должен закрывать чат
        if (event.key === 'Escape') {
            closeChatAndLock();
            return;
        }

        // Обработка Enter
        if (event.key === 'Enter') {
            const inputText = chat.currentInput.trim();

            // ПЕРВЫМ ДЕЛОМ проверяем на команды
            if (inputText.toLowerCase() === '/shop') {
                chat.hideImmediately(); // <-- ИЗМЕНЕНИЕ ЗДЕСЬ
                toggleShop();           // ПОТОМ открываем магазин
                return;                 // Завершаем обработку
            }

            // Если это не команда, используем стандартную логику
            if (inputText === '') {
                // Пустая строка - закрываем чат
                closeChatAndLock();
            } else {
                // Есть текст - отправляем сообщение (чат закроется сам через callback)
                chat.sendMessage();
            }
            return;
        }

        // Обработка Backspace на пустой строке как еще один способ закрыть чат
        if (event.key === 'Backspace' && chat.currentInput === '') {
            closeChatAndLock();
            return;
        }

        // Все остальные клавиши - просто печать текста
        chat.handleKeydown(event);
        return;
    }

    // --- Логика, когда чат ЗАКРЫТ (игрок в игре) ---

    // Логика закрытия магазина по Escape или Enter
    if (shopManager && shopManager.isVisible && (event.code === 'Escape' || event.code === 'Enter')) {
        event.preventDefault();
        toggleShop(); // Закрываем магазин
        return;
    }

    // Логика ОТКРЫТИЯ чата по клавише T
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

    // --- Стандартная игровая логика для других клавиш ---
    const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ControlLeft', 'KeyB', 'KeyV', 'KeyN', 'KeyH']; // <-- ДОБАВЛЕНО 'KeyH'

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

    // БЛОК ДЛЯ 'Enter' ЗДЕСЬ ПОЛНОСТЬЮ УДАЛЕН
});
// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---

// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ СИСТЕМЫ УРОВНЕЙ ---
let bonusManager = null;
let currentLevelScore = 0;
let currentLevel = 1;
let levelScoreForNextLevel = 0; // Будет рассчитано при инициализации
let levelScoreFillEl = null;
let levelScoreTextEl = null;
let pendingAugmentChoices = 0; 

let scorePopTimer = 0;                // время для "поп" анимации при получении очков
const SCORE_POP_DURATION = 0.35;      // сек
let levelScorePopTimer = 0;           // Таймер для "поп" анимации шкалы уровня
const LEVEL_SCORE_POP_DURATION = 0.35; // Длительность этой анимации

let previousScoreForPop = 0;          // отслеживаем изменение счёта

let scoreEdgeShimmerTime = 0;         // для легкого шиммера
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
const collectedCoins = new Set();
let isGamePaused = true; // Игра начинается на паузе.

let isWorkerReady = false;
let chunkWorker = null;

let isPausedForAugment = false;
//let coinSpeedBonus = 0;
let chunksSinceLastCoin = 0;
let isFovTransitioning = false;
let fovTransition = { start: 0, end: 0, startTime: 0, duration: 0 };

const augmentRaycaster = new THREE.Raycaster();
const hoverRaycaster = new THREE.Raycaster(); 

const chunksToLoad = []; // Очередь чанков, ожидающих создания
const CHUNKS_PER_FRAME = 64; // Сколько чанков мы создаем за один кадр. Можете настроить это значение.
let isBhopEnabled = true; // Баннихоп по умолчанию выключен

let overdriveTimer = 0; // Таймер, который считает время удержания высокой скорости
let overdriveMessageEndTime = 0; // Время, до которого будет отображаться сообщение "OVERDRIVE!"
let isOverdriveActive = false;    // Флаг, активен ли бонус в данный момент
let preOverdriveMaxSpeed = 0;     // Хранит скорость ПЕРЕД активацией бонуса

let canPerformJump = true; // Флаг для одиночного прыжка
let comboScore = 0;
let comboMultiplier = 1;
let isComboActive = false;
let statsDisplay = null;
// Новые переменные для HUD в 3D
let comboHudContext = null; // 2D-контекст для рисования текста
let comboHudTexture = null; // Текстура, созданная из холста
let comboHudMesh = null;    // 3D-плоскость, на которую накладывается текстура
let trickDisplay = null;
// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ АНИМАЦИИ СЧЁТА ---
let isScoreAnimating = false;      // Флаг, идет ли сейчас анимация
let scoreAnimationStartTime = 0;   // Время начала анимации
let previousComboScore = 0;        // Предыдущее значение счета для анимации
let previousComboMultiplier = 1;   // Предыдущее значение множителя
const SCORE_ANIMATION_DURATION = 0.3; // Длительность анимации в секундах
let comboAnimationState = {
    score: {
        isAnimating: false,
        startTime: 0,
        previousValue: 0
    },
    multiplier: {
        isAnimating: false,
        startTime: 0,
        previousValue: 1
    }
};

// --- УБЕДИТЕСЬ, ЧТО ЭТОТ БЛОК ЗДЕСЬ ЕСТЬ ---
let levelScoreAnimationState = {
    score: {
        isAnimating: false,
        startTime: 0,
        previousValue: 0
    },
    cap: { // 'cap' - это порог для следующего уровня
        isAnimating: false,
        startTime: 0,
        previousValue: 0
    }
};
let settingsUI = null; // <-- Добавьте эту строку
// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ СЧЕТЧИКА FPS ---
let lastFrameTime = performance.now();
let frameCounter = 0;
let fpsCounterEl = null;
let fpsInterval = 1000 / settings.TARGET_FPS;
let then = performance.now();
// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ФИКСИРОВАННОГО ЦИКЛА ФИЗИКИ ---
const PHYSICS_TICK_RATE = 120; // Обновляем физику 120 раз в секунду
const PHYSICS_DELTA = 1 / PHYSICS_TICK_RATE; // Время одного тика физики
let lastPhysicsTime = performance.now();
let physicsAccumulator = 0;
let lastFpsValue = 0;
// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ СЧЁТА ---
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
let xrayParticles;
let isSuperJumpActive = false;
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
let canAttemptSlide = true;
let sunMesh;
let sunSprite = null;
let moonSprite = null;
let timeOfDay = 0;
//let timeOfDay = 0.25;
let timeSinceLastStep = 0;
// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ УПРАВЛЕНИЯ ВИДИМОСТЬЮ ПРИ ВЫБОРЕ АУГМЕНТОВ ---
let originalRenderDistance = settings.RENDER_DISTANCE;
let originalFogDistance = settings.FOG_DISTANCE;
let isRenderTransitioning = false; // Флаг, что идет анимация возврата видимости
let renderTransitionStartTime = 0;
let renderTransitionStartRender = 0; // Начальное значение RENDER_DISTANCE для анимации
let renderTransitionStartFog = 0;   // Начальное значение FOG_DISTANCE для анимации

let comboTimerRemainingTime = 0;
let superJumpRemainingTime = 0;
let speedBoostRemainingTime = 0;
let daylightEffectRemainingTime = 0;

instructions.addEventListener('click', () => { controls.lock(); });
const superJumpTimerEl = document.getElementById('super-jump-timer');
const superJumpTimeVal = document.getElementById('super-jump-time');
const speedBoostTimerEl = document.getElementById('speed-boost-timer');
const speedBoostTimeVal = document.getElementById('speed-boost-time');
// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ЭФФЕКТА ДНЯ ---
let isDaylightEffectActive = false;
let daylightEffectEndTime = 0;
let originalTimeOfDayBeforeEffect = 0.8; // Значение по умолчанию на всякий случай
let originalFogDistanceBeforeEffect = 2;  // Значение по умолчанию
let originalRenderDistanceBeforeEffect = settings.RENDER_DISTANCE; // <-- ДОБАВЬТЕ ЭТУ СТРОКУ

let isDayTransitioning = false; // Флаг, что сейчас идет переход
let dayTransitionStartTime = 0;   // Время начала перехода
let dayTransitionStartValue = 0;  // Начальное значение timeOfDay
let dayTransitionStartFog = 0;    // <-- ДОБАВЬТЕ ЭТУ СТРОКУ: Начальное значение тумана
let dayTransitionStartRender = 0;     // <-- ДОБАВЬТЕ ЭТУ СТРОКУ

let isNightTransitioning = false; // Флаг для обратного перехода
let nightTransitionStartTime = 0;
let nightTransitionStartValue = 0;
let nightTransitionStartFog = 0;
let nightTransitionStartRender = 0;

const DAY_TRANSITION_TARGET_FOG = 25;  // <-- ДОБАВЬТЕ ЭТУ СТРОКУ: Целевая дистанция тумана

const DAY_TRANSITION_TARGET = 0.25; // Целевое время суток (полдень)

const coinRadius = 1.5;    // Внешний радиус монеты
const coinThickness = 0.2; // Сделаем ее чуть толще для "мультяшности"
const coinSides = 8;       // 8 = восьмиугольник, 6 = шестиугольник

// Создаем плоский цилиндр с 8 гранями
const objectGeometry = new THREE.CylinderGeometry(
    coinRadius,     // radiusTop
    coinRadius,     // radiusBottom
    coinThickness,  // height
    coinSides       // radialSegments
);

const objectMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe666,      // Более насыщенный золотой цвет
    metalness: 0.3,       // 0.0 - не металл, 1.0 - чистый металл. 0.9 - очень похоже на металл.
    roughness: 0.85,      // 0.0 - идеальное зеркало, 1.0 - матовый. 0.2 - блестящий, но не зеркальный.
    //side: THREE.DoubleSide,
    emissive: 0xffe666,         // Темно-золотой цвет для свечения
    emissiveIntensity: 0.4     // Умеренная сила свечения

    // Для еще большего реализма можно добавить карту окружения (envMap),

});
const highlightMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, depthTest: false, transparent: true, opacity: settings.XRAY_OPACITY, fog: false, side: THREE.DoubleSide });
const coinWorldPosition = new THREE.Vector3();
const playerXZ = new THREE.Vector2();
const coinXZ = new THREE.Vector2();
const shadowTexture = new THREE.CanvasTexture(createBlobShadowTexture());

function groundMove(delta, wishdir, maxPlayerSpeed) { // <--- ИЗМЕНЕНИЕ 1
    // 1. Применяем трение, если нет намерения двигаться
    const speed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();
    if (speed > 0) {
        const drop = speed * settings.GROUND_FRICTION * delta;

        // Уменьшаем скорость, но не до отрицательных значений
        const newSpeed = Math.max(speed - drop, 0) / speed;
        playerVelocity.x *= newSpeed;
        playerVelocity.z *= newSpeed;
    }

    // 2. Применяем ускорение в желаемом направлении
    const wishSpeed = maxPlayerSpeed; // <--- ИЗМЕНЕНИЕ 2
    const currentSpeed = playerVelocity.dot(wishdir); // Проекция скорости на желаемое направление
    const addSpeed = wishSpeed - currentSpeed;

    if (addSpeed <= 0) {
        return; // Уже движемся достаточно быстро в этом направлении
    }

    // Рассчитываем ускорение, ограниченное максимальной скоростью
    let accelSpeed = settings.GROUND_ACCELERATE * wishSpeed * delta;
    if (accelSpeed > addSpeed) {
        accelSpeed = addSpeed;
    }

    playerVelocity.x += wishdir.x * accelSpeed;
    playerVelocity.z += wishdir.z * accelSpeed;
}

function capSpeed(maxSpeed) {
    const horizontalSpeed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();

    // ЗАЩИТА: если скорость 0, выходим, чтобы избежать деления на ноль.
    if (horizontalSpeed === 0) {
        return;
    }

    if (horizontalSpeed > maxSpeed) {
        const scale = maxSpeed / horizontalSpeed;
        playerVelocity.x *= scale;
        playerVelocity.z *= scale;
    }
}

// +++ НОВАЯ ФУНКЦИЯ ДЛЯ ДВИЖЕНИЯ В ВОЗДУХЕ +++
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
    // 1. Определяем наклон поверхности
    let dot = 0;
    if (groundNormal) {
        dot = forward.dot(groundNormal);
    }

    // 2. Рассчитываем и применяем динамическое трение
    let dynamicFriction = settings.SLIDE_FRICTION;
    if (dot < 0) { // Если движемся вверх по склону, используем множитель
        dynamicFriction *= settings.SLIDE_FRICTION_UPHILL_MULTIPLIER;
    }
    const speed = playerVelocity.length();
    if (speed > 0) {
        const drop = speed * dynamicFriction * delta;
        const scale = Math.max(speed - drop, 0) / speed;
        playerVelocity.multiplyScalar(scale);
    }

    // 3. Применяем силы от уклона
    if (groundNormal) {
        if (dot > 0) { // Движение вниз по склону: ускоряем в направлении взгляда (позволяет "рулить")
            const accel = forward.clone().multiplyScalar(dot * settings.SLIDE_DOWNHILL_FORCE * settings.SLIDE_SLOPE_INFLUENCE * delta);
            playerVelocity.add(accel);
            bhopStatusMessage = 'СКОЛЬЖЕНИЕ ВНИЗ';
        } else if (dot < 0) { // Движение вверх по склону: тормозим ВДОЛЬ вектора скорости
            const brakeMagnitude = Math.abs(dot) * settings.SLIDE_UPHILL_DAMPEN * settings.SLIDE_SLOPE_INFLUENCE * delta;
            const currentSpeed = playerVelocity.length();

            // Уменьшаем скорость, но не до отрицательных значений
            if (currentSpeed > brakeMagnitude) {
                const scale = (currentSpeed - brakeMagnitude) / currentSpeed;
                playerVelocity.multiplyScalar(scale);
            } else {
                playerVelocity.set(0, 0, 0); // Полностью останавливаем, если торможение сильнее скорости
            }
            bhopStatusMessage = 'СКОЛЬЖЕНИЕ ВВЕРХ';
        } else {
            bhopStatusMessage = 'СКОЛЬЖЕНИЕ';
        }
    }
}

const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false // Важно для правильного рендеринга на других прозрачных объектах
});
const shadowGeometry = new THREE.PlaneGeometry(settings.COIN_SCALE * 2, settings.COIN_SCALE * 2);

const powerupMaterial = new THREE.SpriteMaterial({
    map: createPowerupTexture(),
    fog: true,       // Включаем туман для спрайта
    depthTest: true  // Включаем проверку глубины
});

const speedupMaterial = new THREE.SpriteMaterial({
    map: createSpeedupTexture(),
    fog: true,
    depthTest: true
});

const sunriseMaterial = new THREE.SpriteMaterial({
    map: createSunriseTexture(), // Используем вашу новую функцию
    fog: true,
    depthTest: true
});

const xrayMaterial = new THREE.SpriteMaterial({
    map: createXRayTexture(),
    fog: true,
    depthTest: true
});

// --- АРХИТЕКТУРА БИОМОВ ---
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

            // НОВЫЕ ЦВЕТА С ВЫСОКИМ КОНТРАСТОМ ЯРКОСТИ
            // Один цвет - очень светлый, почти "мятный"
            // Второй - насыщенный, но заметно более темный зеленый
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
            context.fillStyle = isEven ? '#FFFFFF' : '#E0E0E0'; // Белый и светло-серый
            context.fillRect(x, y, squareSize, squareSize);
        }
    } return canvas;
}


// ЗАМЕНИТЕ ВСЮ ФУНКЦИЮ getRoadData НА ЭТОТ КОД



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
    { name: 'Mountain', material: new THREE.MeshStandardMaterial({ map: snowTexture, flatShading: true }), noiseScale: 0.008, noiseAmplitude: 150 } // Высокие и частые пики
];

// --- ЗАМЕНИТЕ ВЕСЬ КЛАСС CHUNK В game.js НА ЭТОТ КОД ---

// ЗАМЕНИТЕ ВЕСЬ КЛАСС CHUNK В game.js НА ЭТОТ КОД

class Chunk {
    constructor(scene, chunkX, chunkZ) {
        this.scene = scene;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.mesh = null;
        this.isWaitingForData = false;
        this.requestedLODSegments = -1; // Добавим это свойство для оптимизации
        this.objectsToSpawn = [];

        this.coins = [];
        this.shadows = [];
        this.coinData = [];
        this.powerup = null; this.powerupShadow = null; this.initialPowerupY = 0;
        this.speedup = null; this.speedupShadow = null; this.initialSpeedupY = 0;
        this.sunrise = null; this.sunriseShadow = null; this.initialSunriseY = 0;
        this.xray = null; this.xrayShadow = null; this.initialXrayY = 0;
    }

    buildMeshFromData(data) {
        const { positions, colors, segments, objectsData } = data; // <--- Получаем objectsData
        this.isWaitingForData = false;

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

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 1,
            color: 0xffffff,
            emissive: 0x111111
        });
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

        // ---> НОВЫЙ КОД: Сохраняем данные для спавна
        this.objectsToSpawn = objectsData || [];
    }

    destroyMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
    }

    requestRebuild(segments) {
        if (this.requestedLODSegments === segments) {
            return;
        }
        this.requestedLODSegments = segments;
        this.isWaitingForData = true; // Устанавливаем флаг ожидания
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
        // Очищаем старые объекты
        this.coins.forEach(c => this.mesh.remove(c));
        this.shadows.forEach(s => this.mesh.remove(s));
        this.coins = []; this.shadows = []; this.coinData = [];
        this.collectPowerup(); this.collectSpeedup(); this.collectSunrise(); this.collectXRay();

        // Создаем объекты по готовым данным от воркера
        for (const data of (this.objectsToSpawn || [])) {
            // Спавн МОНЕТ
            if (data.type === 'coin') {
                const worldX = this.chunkX * settings.CHUNK_SIZE + data.position.x;
                const worldZ = this.chunkZ * settings.CHUNK_SIZE + data.position.z;
                const coinId = getCoinId(worldX, data.position.y, worldZ);

                if (collectedCoins.has(coinId)) continue;

                const coin = new THREE.Mesh(objectGeometry, bonusManager.isXRayActive ? highlightMaterial : objectMaterial);
                coin.rotation.x = Math.PI / 2;
                coin.scale.set(settings.COIN_SCALE, settings.COIN_SCALE, settings.COIN_SCALE);
                coin.userData.coinId = coinId;
                coin.position.set(data.position.x, data.position.y, data.position.z);

                const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
                shadow.rotation.x = -Math.PI / 2;
                shadow.position.set(data.position.x, data.groundY + 0.1, data.position.z);

                this.mesh.add(coin);
                this.mesh.add(shadow);
                this.coins.push(coin);
                this.shadows.push(shadow);
                this.coinData.push({
                    initialY: data.position.y,
                    hoverOffset: seededRandom(data.position.x, data.position.z, WORLD_SEED) * Math.PI * 2
                });
            }
            // ---> НОВЫЙ КОД: Спавн БОНУСОВ
            else { // Если это не монета, значит это бонус
                let material, scale, storageKey;
                switch (data.type) {
                    case 'powerup':
                        material = powerupMaterial;
                        scale = settings.POWERUP_SCALE;
                        storageKey = 'powerup';
                        break;
                    case 'speedup':
                        material = speedupMaterial;
                        scale = settings.SPEEDUP_SCALE;
                        storageKey = 'speedup';
                        break;
                    case 'sunrise':
                        material = sunriseMaterial;
                        scale = settings.SUNRISE_SCALE;
                        storageKey = 'sunrise';
                        break;
                    case 'xray':
                        material = xrayMaterial;
                        scale = settings.XRAY_SCALE;
                        storageKey = 'xray';
                        break;
                    default:
                        continue; // Пропускаем неизвестный тип
                }

                const sprite = new THREE.Sprite(material);
                sprite.scale.set(scale, scale, 1);
                sprite.position.set(data.position.x, data.position.y, data.position.z);

                const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
                shadow.rotation.x = -Math.PI / 2;
                shadow.scale.set(0.7, 0.7, 0.7);
                shadow.position.set(data.position.x, data.groundY + 0.1, data.position.z);

                this.mesh.add(sprite);
                this.mesh.add(shadow);

                this[storageKey] = sprite;
                this[storageKey + 'Shadow'] = shadow;
                this['initial' + storageKey.charAt(0).toUpperCase() + storageKey.slice(1) + 'Y'] = data.position.y;
            }
        }

        this.objectsToSpawn = []; // Очищаем очередь
    }

    /*_getGroundY(localX, localZ) {
        const ray = new THREE.Raycaster(
            new THREE.Vector3(localX, 500, localZ), // Начало луча высоко над чанком
            new THREE.Vector3(0, -1, 0)             // Направление вниз
        );
        const intersects = ray.intersectObject(this.mesh);
        if (intersects.length > 0) {
            return intersects[0].point.y; // Возвращаем Y координату пересечения
        }
        return 0; // Если ничего не найдено, возвращаем 0
    }*/

    
    collectCoin(coin) {
        const index = this.coins.indexOf(coin);
        if (index > -1) {
            const shadow = this.shadows[index];
            this.mesh.remove(coin);
            if (shadow) this.mesh.remove(shadow);

            this.coins.splice(index, 1);
            this.shadows.splice(index, 1);
            this.coinData.splice(index, 1);
        }
    }

    collectPowerup() {
        if (this.powerup) {
            this.mesh.remove(this.powerup);
            this.powerup = null;
        }
        if (this.powerupShadow) {
            this.mesh.remove(this.powerupShadow);
            this.powerupShadow = null;
        }
    }

    collectSpeedup() {
        if (this.speedup) {
            this.mesh.remove(this.speedup);
            this.speedup = null;
        }
        if (this.speedupShadow) {
            this.mesh.remove(this.speedupShadow);
            this.speedupShadow = null;
        }
    }

    collectSunrise() {
        if (this.sunrise) {
            this.mesh.remove(this.sunrise);
            this.sunrise = null;
        }
        if (this.sunriseShadow) {
            this.mesh.remove(this.sunriseShadow);
            this.sunriseShadow = null;
        }
    }

    collectXRay() {
        if (this.xray) {
            this.mesh.remove(this.xray);
            this.xray = null;
        }
        if (this.xrayShadow) {
            this.mesh.remove(this.xrayShadow);
            this.xrayShadow = null;
        }
    }
    // Методы update и destroy остаются почти такими же, но без генерации
    update(delta) {
        const elapsedTime = clock.getElapsedTime();

        // Анимация монет
        for (let i = 0; i < this.coins.length; i++) {
            const coin = this.coins[i];
            const data = this.coinData[i];
            coin.rotation.z += 2 * delta; // Вращение
            // Парение (hover)
            const hoverY = data.initialY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED + data.hoverOffset) * settings.COIN_HOVER_RANGE;
            coin.position.y = hoverY;
        }

        // Анимация бонусов (если они существуют на этом чанке)
        if (this.powerup) {
            this.powerup.position.y = this.initialPowerupY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED) * settings.COIN_HOVER_RANGE;
        }
        if (this.speedup) {
            this.speedup.position.y = this.initialSpeedupY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED) * settings.COIN_HOVER_RANGE;
        }
        if (this.sunrise) {
            this.sunrise.position.y = this.initialSunriseY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED) * settings.COIN_HOVER_RANGE;
        }
        if (this.xray) {
            this.xray.position.y = this.initialXrayY + Math.sin(elapsedTime * settings.COIN_HOVER_SPEED) * settings.COIN_HOVER_RANGE;
        }
    }

    destroy() {
        // --- НАЧАЛО ИЗМЕНЕНИЯ ---
        // Сообщаем воркеру, что этот чанк выгружен, чтобы он мог снова спавнить там паттерны
        if (chunkWorker) {
            chunkWorker.postMessage({
                type: 'unregisterChunk',
                payload: {
                    chunkX: this.chunkX,
                    chunkZ: this.chunkZ
                }
            });
        }
        // --- КОНЕЦ ИЗМЕНЕНИЯ ---

        // Удаляем все дочерние объекты (монеты, бонусы, тени)
        if (this.mesh) {
            while (this.mesh.children.length > 0) {
                const child = this.mesh.children[0];
                this.mesh.remove(child);
                if (child.geometry) {
                    child.geometry.dispose();
                }
            }

            // Теперь удаляем сам меш чанка
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (this.mesh.material) {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }

        // Очищаем массивы для сборщика мусора
        this.coins = [];
        this.shadows = [];
        this.coinData = [];
        this.powerup = null;
        this.powerupShadow = null;
        this.speedup = null;
        this.speedupShadow = null;
        this.sunrise = null;
        this.sunriseShadow = null;
        this.xray = null;
        this.xrayShadow = null;
    }
}

const raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 50);
raycaster.camera = camera;
const clock = new THREE.Clock();

const sunGeometry = new THREE.SphereGeometry(20, 16, 16);
// 1. Создаем загрузчик для текстуры Луны
const textureLoader = new THREE.TextureLoader();
const moonTexture = textureLoader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg');

// 2. Создаем специальный материал для СОЛНЦА
// Ему не нужна текстура, только яркое, чистое свечение
const sunMaterial = new THREE.MeshStandardMaterial({
    emissive: 0xffef8f,       // Цвет самосвечения
    emissiveIntensity: 2.0,   // Сила свечения
    color: 0xffef8f,          // Базовый цвет (на случай, если свечение будет слабым)
    metalness: 0,             // Не металлический
    roughness: 1              // Абсолютно матовый
});

// 3. Создаем материал для ЛУНЫ, используя MeshStandardMaterial
const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonTexture,         // Текстура поверхности
    emissiveMap: moonTexture, // Эта же текстура заставляет светиться светлые участки
    emissive: 0xeeeeff,       // Цвет свечения (бледно-голубой)
    emissiveIntensity: 0.1,   // Очень слабое свечение, чтобы не перебивать текстуру
    color: 0xcccccc,          // Базовый серый цвет
    metalness: 0,
    roughness: 0.8             // Почти матовая
});
sunMesh = new THREE.Mesh(sunGeometry, sunMaterial); // По умолчанию это Солнце
sunMesh.frustumCulled = false; // Важно для объектов неба, чтобы они не исчезали
scene.add(sunMesh);
sunMesh.visible = false; // Делаем 3D-шар невидимым


// --- game.js: ЗАМЕНИТЕ ВСЮ ФУНКЦИЮ ---




function reloadVisibleChunks() {
    const playerChunkX = currentPlayerChunk.x;
    const playerChunkZ = currentPlayerChunk.z;

    // --- ШАГ 1: УДАЛЕНИЕ СТАРЫХ ЧАНКОВ ---
    // Собираем ID чанков, которые нужно удалить, в отдельный массив
    const chunksToRemove = [];
    for (const [chunkId, chunk] of chunks.entries()) {
        const distance = Math.hypot(chunk.chunkX - playerChunkX, chunk.chunkZ - playerChunkZ);
        if (distance > settings.UNLOAD_DISTANCE) {
            chunksToRemove.push(chunkId);
        }
    }
    // Удаляем их после цикла, чтобы не изменять коллекцию во время итерации
    for (const chunkId of chunksToRemove) {
        chunks.get(chunkId).destroy();
        chunks.delete(chunkId);
    }

    // --- ШАГ 2: ДОБАВЛЕНИЕ НОВЫХ И ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ---
    for (let x = playerChunkX - settings.RENDER_DISTANCE; x <= playerChunkX + settings.RENDER_DISTANCE; x++) {
        for (let z = playerChunkZ - settings.RENDER_DISTANCE; z <= playerChunkZ + settings.RENDER_DISTANCE; z++) {
            const chunkId = `${x},${z}`;
            let chunk = chunks.get(chunkId);

            if (!chunk) {
                // Если чанка нет, создаем его "пустышку" и ставим в очередь на генерацию
                const newChunk = new Chunk(scene, x, z);
                chunks.set(chunkId, newChunk);
                chunksToLoad.push(newChunk); // Добавляем сам объект чанка в очередь
            } else {
                // Чанк уже существует. Проверяем его LOD.
                const distance = Math.hypot(x - playerChunkX, z - playerChunkZ);
                let requiredSegments = LOD_LEVELS[LOD_LEVELS.length - 1].segments;
                for (const level of LOD_LEVELS) {
                    if (distance <= level.distance) {
                        requiredSegments = level.segments;
                        break;
                    }
                }
                // Запрашиваем перестройку, только если LOD изменился
                if (chunk.requestedLODSegments !== requiredSegments) {
                    chunk.requestRebuild(requiredSegments);
                }
            }
        }
    }

    // Сортируем очередь, чтобы ближайшие чанки генерировались первыми
    chunksToLoad.sort((a, b) => {
        const distA = Math.hypot(a.chunkX - playerChunkX, a.chunkZ - playerChunkZ);
        const distB = Math.hypot(b.chunkX - playerChunkX, b.chunkZ - playerChunkZ);
        return distA - distB;
    });
}

const checkedChunksForBonuses = new Set();

function updateChunks() {
    const playerPos = playerBody.position;
    const currentChunkX = Math.floor((playerPos.x + settings.CHUNK_SIZE / 2) / settings.CHUNK_SIZE);
    const currentChunkZ = Math.floor((playerPos.z + settings.CHUNK_SIZE / 2) / settings.CHUNK_SIZE);

    if (currentChunkX !== currentPlayerChunk.x || currentChunkZ !== currentPlayerChunk.z) {
        currentPlayerChunk.x = currentChunkX;
        currentPlayerChunk.z = currentChunkZ;

        if (bonusManager) {
            bonusManager.tickForPlayerTraversal(currentChunkX, currentChunkZ);
        }

        debug.update(currentChunkX, currentChunkZ);
        reloadVisibleChunks(); // Просто вызываем основную функцию
    }
}
function processChunkLoadQueue() {
    if (!isWorkerReady) {
        return;
    }
    // Запускаем цикл, который будет обрабатывать несколько чанков за кадр
    for (let i = 0; i < CHUNKS_PER_FRAME; i++) {
        if (chunksToLoad.length === 0) {
            break; // Если очередь пуста, выходим из цикла
        }

        const chunkToLoad = chunksToLoad.shift();

        // Проверяем, не был ли чанк уже удален из основной карты
        if (!chunks.has(`${chunkToLoad.chunkX},${chunkToLoad.chunkZ}`)) {
            continue; // Пропускаем этот чанк, если он больше не нужен
        }

        // Проверяем, не ждем ли мы уже данные для этого чанка
        if (chunkToLoad.isWaitingForData) {
            chunksToLoad.push(chunkToLoad); // Возвращаем в конец очереди, чтобы попробовать позже
            continue;
        }

        const distance = Math.hypot(chunkToLoad.chunkX - currentPlayerChunk.x, chunkToLoad.chunkZ - currentPlayerChunk.z);
        let segments = LOD_LEVELS[LOD_LEVELS.length - 1].segments;
        for (const level of LOD_LEVELS) {
            if (distance <= level.distance) {
                segments = level.segments;
                break;
            }
        }

        chunkToLoad.isWaitingForData = true;

        // Отправляем задание в Web Worker
        chunkWorker.postMessage({
            type: 'generateChunk',
            payload: {
                chunkX: chunkToLoad.chunkX,
                chunkZ: chunkToLoad.chunkZ,
                segments: segments
            }
        });
    }
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
}

function updateFog() {
    // 1. Дальность отсечения камеры (camera.far) по-прежнему зависит от RENDER_DISTANCE,
    // чтобы гарантировать, что все загруженные чанки видны.
    const maxDiagonalDistance = settings.RENDER_DISTANCE * settings.CHUNK_SIZE * Math.sqrt(2);
    camera.far = maxDiagonalDistance * 1.1; // Небольшой буфер
    camera.updateProjectionMatrix();

    // 2. Дальность тумана (fog.far) теперь берется из отдельной настройки FOG_DISTANCE.
    // Эта настройка указывает, на скольких чанках вдаль начинается туман.
    // Используем `settings.RENDER_DISTANCE - 1.5` как значение по умолчанию, если FOG_DISTANCE не задана.
    const fogDistanceInChunks = settings.FOG_DISTANCE ?? (settings.RENDER_DISTANCE - 1.5);
    const fogDistance = fogDistanceInChunks * settings.CHUNK_SIZE;

    // Устанавливаем дальность тумана, но не ближе одного чанка
    scene.fog.far = Math.max(fogDistance, settings.CHUNK_SIZE);
    // Начало тумана - на половине его конечной дальности для плавного перехода
    scene.fog.near = scene.fog.far * 0.5;
}


function forceChunkUpdate() {
    // Эта функция больше не уничтожает мир.
    // Она просто запускает ту же логику, что и при переходе в новый чанк,
    // чтобы пересчитать видимые/невидимые чанки с новым значением RENDER_DISTANCE.
    reloadVisibleChunks();
}
function createBlobShadowTexture() {
    const size = 64; // Размер текстуры, чем меньше - тем более пиксельной будет тень
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 * 0.8;

    // Создаем радиальный градиент: в центре тень непрозрачная, по краям - полностью прозрачная
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)'); // <-- Непрозрачность и цвет тени в центре
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)'); // <-- Полная прозрачность по краям

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    return canvas;
}

// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ СТОЛКНОВЕНИЙ ---
const collisionRaycaster = new THREE.Raycaster();
const PLAYER_RADIUS = 0.5; // Условный радиус игрока для проверки столкновений

/**
 * Устанавливает видимость всех бонусов и их теней внутри чанка.
 * @param {Chunk} chunk - Объект чанка.
 * @param {boolean} isVisible - Должны ли бонусы быть видимыми.
 */
function setBonusesVisibility(chunk, isVisible) {
    const bonusNames = ['powerup', 'speedup', 'sunrise', 'xray'];

    for (const name of bonusNames) {
        const bonusSprite = chunk[name];
        if (bonusSprite) {
            bonusSprite.visible = isVisible;
        }

        const shadowMesh = chunk[name + 'Shadow'];
        if (shadowMesh) {
            shadowMesh.visible = isVisible;
        }
    }
}

function animate(now) {
    //if (frameCounter % 300 === 0) { // Логируем каждые 300 кадров (примерно раз в 5 секунд)
    //    console.log(`[STATUS] Collected coins count: ${collectedCoins.size}`);
    //}
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    const elapsed = now - then;
    if (elapsed < fpsInterval && settings.TARGET_FPS !== 999) {
        return;
    }
    then = now - (elapsed % fpsInterval);

    const currentTime = clock.getElapsedTime();
    const easeOutQuad = t => t * (2 - t);

    // --- БЛОК 1: ЛОГИКА, РАБОТАЮЩАЯ ВСЕГДА (ДАЖЕ НА ПАУЗЕ) ---
    if (isFovTransitioning) {
        const elapsedTime = currentTime - fovTransition.startTime; // Используйте здесь currentTime или elapsedTime
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

        // 1. Сохраняем ТЕКУЩУЮ дальность прорисовки, чтобы к ней вернуться
        originalRenderDistance = settings.RENDER_DISTANCE;
        originalFogDistance = settings.FOG_DISTANCE;

        // 2. Устанавливаем НОВУЮ, увеличенную дальность из настроек
        settings.RENDER_DISTANCE = settings.AUGMENT_RENDER_DISTANCE;
        settings.FOG_DISTANCE = settings.AUGMENT_FOG_DISTANCE;

        // 3. Применяем изменения
        updateFog();
        forceChunkUpdate(); // Эта команда заставит игру прогрузить новые, дальние чанки

        isFovTransitioning = true;
        fovTransition = {
            start: camera.fov,
            end: settings.NORMAL_FOV,
            startTime: currentTime,
            duration: settings.AUGMENT_FOV_TRANSITION_DURATION
        };
    }

    // --- БЛОК 2: ОСНОВНАЯ ИГРОВАЯ ЛОГИКА ---
    if (!isGamePaused) {
        sky.update(delta, playerBody);

        if (bonusManager) {
            bonusManager.update(delta, sky);
        }

        if (levelScorePopTimer > 0) {
            levelScorePopTimer -= delta;
        }


        if (autoHighlightMode) {
            // Получаем АКТУАЛЬНОЕ время суток напрямую из объекта sky
            const currentTime = sky.getTimeOfDay();
            // --- ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ---
            // Теперь "день" считается, пока солнце находится ВЫШЕ нашего порога.
            const isDay = Math.sin(currentTime * Math.PI * 2) >= DAY_NIGHT_THRESHOLD;

            // Проверяем, изменилось ли состояние (день -> ночь или ночь -> день)
            if (isDay !== wasDayPreviously) {
                // Если наступила ночь (isDay стало false), и подсветка еще не активна
                if (!isDay && !highlightState.isActive) {
                    if (!highlightState.isTransitioning) {
                        console.log("Наступил вечер. Автоматическое включение подсветки...");
                    }
                    highlightState.isActive = true;
                    highlightState.isTransitioning = true;
                }
                // Если наступил день (isDay стало true), и подсветка активна
                else if (isDay && highlightState.isActive) {
                    if (!highlightState.isTransitioning) {
                        console.log("Наступил рассвет. Автоматическое выключение подсветки...");
                    }
                    highlightState.isActive = false;
                    highlightState.isTransitioning = true;
                }
            }

            // Обновляем состояние для следующего кадра
            wasDayPreviously = isDay;
        }
        if (highlightState.isTransitioning) {
            let stillAnimating = false; // Флаг, чтобы определить, когда остановить анимацию

            // Проходим по всем видимым чанкам
            for (const chunk of chunks.values()) {
                if (!chunk.mesh || !chunk.mesh.material) {
                    continue; // Если нет, пропускаем этот чанк и переходим к следующему
                }
                const material = chunk.mesh.material;

                // Определяем целевой цвет для этого чанка
                let targetColor;
                if (highlightState.isActive) {
                    targetColor = _highlightEmissiveColor;
                } else {
                    // При выключении возвращаемся к его личному исходному цвету
                    targetColor = originalEmissiveColors.get(chunk.mesh.uuid) || _defaultEmissiveColor;
                }


                // Проверяем, достаточно ли близок текущий цвет к целевому
                // Если разница все еще заметна, значит, анимация продолжается
                material.emissive.lerp(targetColor, highlightState.transitionSpeed * delta);

                // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
                // Вычисляем квадрат "дистанции" между цветами, сравнивая их R, G, B компоненты.
                // Это гораздо быстрее, чем извлекать квадратный корень.
                const colorDistanceSq =
                    Math.pow(material.emissive.r - targetColor.r, 2) +
                    Math.pow(material.emissive.g - targetColor.g, 2) +
                    Math.pow(material.emissive.b - targetColor.b, 2);

                // Если квадрат дистанции больше крошечного порога, считаем, что анимация еще идет.
                if (colorDistanceSq > 0.00001) {
                    stillAnimating = true;
                }
            }

            // Если ни один из чанков больше не анимируется, выключаем переход
            if (!stillAnimating) {
                highlightState.isTransitioning = false;
                console.log("Анимация подсветки завершена.");
            }
        }

        const originalBunnyhopMaxSpeed = settings.BUNNYHOP_MAX_SPEED;
        const originalMaxPlayerSpeed = settings.MAX_PLAYER_SPEED;
        let effectiveMaxSpeed = originalBunnyhopMaxSpeed;
        let effectivePlayerMaxSpeed = originalMaxPlayerSpeed;

        if (bonusManager) {
            const { speedupBonusValue, playerSpeedupBonusValue } = bonusManager.getSpeedBonuses();
            effectiveMaxSpeed += speedupBonusValue;
            effectivePlayerMaxSpeed += playerSpeedupBonusValue;
        }


/*        if (isOverdriveActive) {
            effectiveMaxSpeed *= settings.OVERDRIVE_BONUS_MULTIPLIER;
            effectivePlayerMaxSpeed *= settings.OVERDRIVE_BONUS_MULTIPLIER; // <--- ДОБАВЛЕНА ЭТА СТРОКА

        }*/
        const horizontalSpeed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();

        if (isOverdriveActive) {
            // 1. ПРИМЕНЯЕМ БОНУС к обоим типам скорости
            effectiveMaxSpeed *= settings.OVERDRIVE_BONUS_MULTIPLIER;
            effectivePlayerMaxSpeed *= settings.OVERDRIVE_BONUS_MULTIPLIER;

            // 2. ПРОВЕРЯЕМ ОТКЛЮЧЕНИЕ
            // Overdrive отключается, если скорость падает НИЖЕ БАЗОВОЙ максимальной скорости бега.
            // Это дает игроку возможность бежать с бонусом, не теряя его сразу.
            const deactivationThreshold = originalMaxPlayerSpeed;
            if (horizontalSpeed < deactivationThreshold) {
                isOverdriveActive = false;
                overdriveTimer = 0;
            }
        } else {
            // 3. ПРОВЕРЯЕМ ВКЛЮЧЕНИЕ
            // Для активации все еще нужна высокая скорость (от баннихопа).
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
            console.log(`Игрок упал ниже ${MIN_Y_LEVEL}. Телепортация на поверхность...`);
            const fallRaycaster = new THREE.Raycaster(
                new THREE.Vector3(playerBody.position.x, 500, playerBody.position.z),
                new THREE.Vector3(0, -1, 0)
            );

            // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
            // Добавляем камеру в рейкастер, чтобы он мог работать со спрайтами
            fallRaycaster.camera = camera;
            // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

            const fallIntersects = fallRaycaster.intersectObjects(Array.from(chunks.values()).filter(c => c.mesh).map(c => c.mesh));
            const surfaceHeight = fallIntersects.length > 0 ? fallIntersects[0].point.y : 30; // Если земли нет, телепортируем на высоту 30
            playerBody.position.y = surfaceHeight + 5;
            playerVelocity.set(0, 0, 0);
        }
        updateFog();
        updateChunks();
        processChunkLoadQueue();
        for (const chunk of chunks.values()) {
            // 1. Рассчитываем расстояние до чанка в единицах чанков.
            // Убедитесь, что эта строка здесь есть!
            const distanceToPlayerChunks = Math.hypot(chunk.chunkX - currentPlayerChunk.x, chunk.chunkZ - currentPlayerChunk.z);

            // 2. Обновляем анимацию (вращение и т.д.) только для близких чанков
            if (distanceToPlayerChunks <= UPDATE_DISTANCE) {
                chunk.update(delta);
            }

            const playerPosition = playerBody.position;

            // 3. Проверяем, должен ли бонус быть видимым, на основе РАДИУСА в чанках
            if (distanceToPlayerChunks <= settings.BONUS_VISIBILITY_RADIUS) {
                // Если чанк внутри радиуса видимости, делаем бонусы видимыми
                setBonusesVisibility(chunk, true);
            } else {
                // Если чанк за пределами радиуса, скрываем бонусы
                setBonusesVisibility(chunk, false);
            }

            if (chunk.coins.length > 0) {
                for (let i = chunk.coins.length - 1; i >= 0; i--) {
                    const coin = chunk.coins[i];
                    coin.getWorldPosition(coinWorldPosition);
                    const playerPosition = playerBody.position;

                    // --- ЗАМЕНИТЕ ВЕСЬ БЛОК ПРОВЕРКИ ПОДБОРА НА ЭТОТ ---
                    if (playerPosition.distanceTo(coinWorldPosition) < settings.COIN_PICKUP_RADIUS) {

                        // console.log("[COLLECT] Игрок рядом с монетой. Пытаемся собрать...");
                        const coinId = coin.userData.coinId;

                        if (coinId) {
                            // console.log(`[COLLECT] У монеты есть ID: ${coinId}. Добавляем в Set.`);
                            collectedCoins.add(coinId);
                            // console.log(`%c[COLLECT] УСПЕХ: ID ${coinId} добавлен. Новый размер Set: ${collectedCoins.size}`, 'color: cyan; font-weight: bold;');
                        } else {
                            console.error("[COLLECT] ОШИБКА: У собираемой монеты нет userData.coinId!", coin);
                        }

                        triggerParticles(coinParticles, coinWorldPosition);
                        chunk.collectCoin(coin);
                        playCoinSound();
                        addCoins(1);
                        triggerComboUpdate({ score: comboScore + settings.POINTS_PER_COIN });
                    }

                    // Логика X-Ray (остается почти такой же)
                    const distanceToCoin = playerPosition.distanceTo(coinWorldPosition);
                    if (bonusManager.isXRayActive && distanceToCoin <= settings.XRAY_RADIUS) {
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
            if (chunk.powerup && chunk.powerup.visible) {
                const powerupWorldPosition = new THREE.Vector3();
                chunk.powerup.getWorldPosition(powerupWorldPosition);
                if (playerPosition.distanceTo(powerupWorldPosition) < settings.POWERUP_PICKUP_RADIUS) {
                    chunk.collectPowerup();
                    bonusManager.activateSuperJump(powerupWorldPosition);
                }
            }
            if (chunk.speedup && chunk.speedup.visible) {
                const speedupWorldPosition = new THREE.Vector3();
                chunk.speedup.getWorldPosition(speedupWorldPosition);
                if (playerPosition.distanceTo(speedupWorldPosition) < settings.SPEEDUP_PICKUP_RADIUS) {
                    chunk.collectSpeedup();
                    bonusManager.activateSpeedBoost(speedupWorldPosition);
                }
            }
            if (chunk.sunrise && chunk.sunrise.visible) {
                const sunriseWorldPosition = new THREE.Vector3();
                chunk.sunrise.getWorldPosition(sunriseWorldPosition);
                if (playerPosition.distanceTo(sunriseWorldPosition) < settings.SUNRISE_PICKUP_RADIUS) {
                    chunk.collectSunrise();
                    bonusManager.activateDaylight(sunriseWorldPosition, sky.getTimeOfDay());
                }
            }
            if (chunk.xray && chunk.xray.visible) {
                const xrayWorldPosition = new THREE.Vector3();
                chunk.xray.getWorldPosition(xrayWorldPosition);
                if (playerPosition.distanceTo(xrayWorldPosition) < settings.XRAY_PICKUP_RADIUS) {
                    chunk.collectXRay();
                    bonusManager.activateXRay(xrayWorldPosition);
                }
            }
        }
        const activationThreshold = effectiveMaxSpeed * settings.OVERDRIVE_SPEED_THRESHOLD;

       
        if (isComboActive) {
            comboTimerRemainingTime -= delta;
            if (comboTimerRemainingTime > 0) {
                updateComboHud(comboTimerRemainingTime);
            } else {
                // Комбо закончилось
                if (comboScore > 0) {
                    const pointsEarned = comboScore * comboMultiplier;
                    const animState = levelScoreAnimationState.score;
                    animState.previousValue = currentLevelScore;
                    animState.isAnimating = true;
                    animState.startTime = clock.getElapsedTime();
                    addScore(pointsEarned);
                    addLevelScore(pointsEarned);
                    updateLevelScoreHud();
                }
                comboScore = 0;
                comboMultiplier = 1;
                isComboActive = false;

                // ---> ИЗМЕНЕНИЕ: Запускаем анимацию исчезновения
                comboHudState.isVisible = false;
                comboHudState.targetOpacity = 0.0;
                comboHudState.targetScale = 0.8;
            }
        }

        if (isDaylightEffectActive) {
            daylightEffectRemainingTime -= delta;
            if (daylightEffectRemainingTime <= 0 && !isNightTransitioning) {
                isDaylightEffectActive = false;
                isNightTransitioning = true;
                nightTransitionStartTime = clock.getElapsedTime();
                nightTransitionStartValue = timeOfDay;
                nightTransitionStartFog = scene.fog.far / settings.CHUNK_SIZE;
                nightTransitionStartRender = settings.RENDER_DISTANCE;
            }
        }
        if (isNightTransitioning) {
            const elapsedTime = clock.getElapsedTime() - nightTransitionStartTime;
            let progress = elapsedTime / settings.DAY_TRANSITION_DURATION;
            if (progress >= 1.0) {
                progress = 1.0;
                isNightTransitioning = false;
                timeOfDay = originalTimeOfDayBeforeEffect;
                settings.FOG_DISTANCE = originalFogDistanceBeforeEffect;
                settings.RENDER_DISTANCE = originalRenderDistanceBeforeEffect;
            } else {
                timeOfDay = lerp(nightTransitionStartValue, originalTimeOfDayBeforeEffect, progress);
                settings.FOG_DISTANCE = lerp(nightTransitionStartFog, originalFogDistanceBeforeEffect, progress);
                settings.RENDER_DISTANCE = Math.round(lerp(nightTransitionStartRender, originalRenderDistanceBeforeEffect, progress));
            }
            updateFog();
            forceChunkUpdate();
        }
        if (isSuperJumpActive) {
            superJumpRemainingTime -= delta;
            if (superJumpRemainingTime <= 0) isSuperJumpActive = false;
        }

        if (isDayTransitioning) {
            const elapsedTime = currentTime - dayTransitionStartTime;
            let progress = elapsedTime / settings.DAY_TRANSITION_DURATION;
            if (progress >= 1.0) { progress = 1.0; isDayTransitioning = false; }
            timeOfDay = lerp(dayTransitionStartValue, DAY_TRANSITION_TARGET, progress);
            settings.FOG_DISTANCE = lerp(dayTransitionStartFog, DAY_TRANSITION_TARGET_FOG, progress);
            settings.RENDER_DISTANCE = Math.round(lerp(dayTransitionStartRender, settings.SUNRISE_RENDER_DISTANCE, progress));
            updateFog();
            updateChunks();
        }
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
            const horizontalSpeed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();
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
        // Обновляем таймер для всех систем частиц, чтобы анимация работала
        if (coinParticles) coinParticles.material.uniforms.u_time.value = currentTime;
        if (powerupParticles) powerupParticles.material.uniforms.u_time.value = currentTime;
        if (speedupParticles) speedupParticles.material.uniforms.u_time.value = currentTime;
        if (sunriseParticles) sunriseParticles.material.uniforms.u_time.value = currentTime;
        if (shopParticles) shopParticles.material.uniforms.u_time.value = currentTime;
        if (augmentParticles) augmentParticles.material.uniforms.u_time.value = currentTime; 
        if (xrayParticles) xrayParticles.material.uniforms.u_time.value = currentTime;

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

        // Плавное изменение непрозрачности
        comboHudMesh.material.opacity = lerp(comboHudMesh.material.opacity, state.targetOpacity, state.animationSpeed * delta);

        // Плавное изменение размера
        const currentScale = comboHudMesh.scale.x;
        let newScale = lerp(currentScale, state.targetScale, state.animationSpeed * delta);

        // Эффект "дыхания", когда HUD полностью видим
        if (state.isVisible && Math.abs(currentScale - 1.0) < 0.01) {
            const breath = Math.sin(clock.getElapsedTime() * 1) * 0.001;
            newScale += breath;
        }

        comboHudMesh.scale.set(newScale, newScale, newScale);

        // Если HUD стал полностью прозрачным, окончательно скрываем его для оптимизации
        if (comboHudMesh.material.opacity < 0.01 && !state.isVisible) {
            comboHudMesh.visible = false;
        }
    }

    if (scoreHudMesh) {
        // Плавное "догоняние" текущего счета анимированным
        const scoreLerpSpeed = 15; // Чем выше, тем быстрее "тикают" цифры
        animatedScore = lerp(animatedScore, currentScore, scoreLerpSpeed * delta);
        if (Math.abs(currentScore - animatedScore) < 1) {
            animatedScore = currentScore; // Принудительно выравниваем в конце
        }

        // То же самое для рекорда
        animatedHighScore = lerp(animatedHighScore, highScore, scoreLerpSpeed * delta);
        if (Math.abs(highScore - animatedHighScore) < 1) {
            animatedHighScore = highScore;
        }

        // Обновляем таймер вспышки
        if (highScoreFlashTime > 0) {
            highScoreFlashTime -= delta;
        }

        // Перерисовываем HUD каждый кадр
        updateScoreHud();
    }

    if (psx && typeof psx.render === 'function') {
        psx.render(delta);
    } else {
        renderer.render(scene, camera);
    }

    frameCounter++;
    if (now >= lastFrameTime + 1000) {
        lastFpsValue = frameCounter;
        frameCounter = 0;
        lastFrameTime = now;
    }
}


function initializeGame() {
    console.log("Шрифт загружен, запускаем игру!");

    // ---> ШАГ 1: СНАЧАЛА создаем воркер
    try {
        chunkWorker = new Worker('worker.js', { type: 'module' });

        // --- ВОТ ПРАВИЛЬНЫЙ ОБРАБОТЧИК ДЛЯ game.js ---
        chunkWorker.onmessage = function (event) {
            const { type, payload } = event.data;

            if (type === 'worker_ready') {
                // Этот тип сообщения больше не используется, но оставим на всякий случай
                console.log('[Main Thread] 1. Получено `worker_ready`. Отправка `init`...');
                chunkWorker.postMessage({
                    type: 'init',
                    payload: {
                        seed: WORLD_SEED,
                        patterns: coinPatternsData // Убедитесь, что coinPatternsData импортирован вверху файла
                    }
                });
            }
            else if (type === 'ready') {
                console.log('%c[Main Thread] 4. Получено `ready`. Воркер полностью готов к работе!', 'color: green; font-weight: bold;');
                isWorkerReady = true;
                forceChunkUpdate();
            }
            else if (type === 'chunkDataReady') {
                console.log(`[Main Thread] 7. Получены готовые данные для чанка ${payload.chunkX},${payload.chunkZ}`);
                const chunkId = `${payload.chunkX},${payload.chunkZ}`;
                const chunk = chunks.get(chunkId);
                if (chunk) {
                    chunk.buildMeshFromData(payload);
                    chunk.spawnObjects();
                }
            }
        };
        // --- КОНЕЦ ПРАВИЛЬНОГО ОБРАБОТЧИКА ---

        chunkWorker.onerror = function (error) {
            console.error('[Main Thread] Произошла ошибка в воркере:', error.message, error);
        };

    } catch (e) {
        console.error("Не удалось создать Web Worker.", e);
    }


    // --- ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРА БОНУСОВ ---
    const gameContext = {
        scene, clock, playCoinSound, triggerComboUpdate, triggerParticles,
        particles: {}, // Заполним после создания
        updateFog, forceChunkUpdate,
        seededRandom // <-- ДОБАВЬТЕ ЭТУ СТРОКУ
    };
    bonusManager = new BonusManager(gameContext);

    calculateNextLevelScoreRequirement();
    //settings.UNLOAD_DISTANCE = settings.RENDER_DISTANCE + 3;
    settings.FOG_DISTANCE = 125;
    updateFog();
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
        // Данные от BonusManager
        getEffectiveJumpStrength: () => bonusManager.getEffectiveJumpStrength(),
        getRemainingSuperJumpTime: () => bonusManager.getRemainingTimes().superJump,
        getRemainingSpeedBoostTime: () => bonusManager.getRemainingTimes().speedBoost,
        getRemainingDaylightTime: () => bonusManager.getRemainingTimes().daylight,
        getRemainingXRayTime: () => bonusManager.getRemainingTimes().xray,

        // Эта функция пересчитывает эффективную скорость по запросу от StatsDisplay
        getEffectiveBunnyhopMaxSpeed: () => {
            let speed = settings.BUNNYHOP_MAX_SPEED;
            if (bonusManager) {
                // Мы берем только бонус к скорости б-хопа
                speed += bonusManager.getSpeedBonuses().speedupBonusValue;
            }
            return speed;
        },
        getOriginalMaxSpeed: () => settings.BUNNYHOP_MAX_SPEED,
        getOriginalBunnyhopBonus: () => bonusManager.originalBunnyhopSpeedBonus,
        getOriginalMaxPlayerSpeed: () => settings.MAX_PLAYER_SPEED
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
    xrayParticles = createParticleSystem(new THREE.Color(0x00BCD4));

    // Обновляем контекст для bonusManager после создания частиц
    bonusManager.particles = { powerup: powerupParticles, speedup: speedupParticles, sunrise: sunriseParticles, xray: xrayParticles };

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

// Используем Font Loading API, чтобы дождаться готовности шрифтов
document.fonts.ready.then(() => {
    // Этот код выполнится только ПОСЛЕ того, как шрифт 'Press Start 2P' будет загружен
    initializeGame();
}).catch(error => {
    // Если шрифт не удалось загрузить, все равно запускаем игру со стандартным шрифтом
    console.error("Не удалось загрузить кастомный шрифт, игра будет использовать стандартный:", error);
    initializeGame();
});


let _stepSide = -1;
function handleFootsteps(delta, horizontalSpeed) { // Принимает horizontalSpeed
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
        // groundIntersection нужно будет передавать в эту функцию или получать его глобально
        // Пока что будем считать, что он доступен глобально
        const surfaceType = getSurfaceType(window.lastGroundIntersection); // Используем глобальную переменную
        _stepSide = -_stepSide;
        try {
            playFootstepSound(surfaceType, { speed: horizontalSpeed, side: _stepSide });
        } catch (e) {
            try { playFootstepSound(surfaceType); } catch (err) { /* noop */ }
        }
        distanceSinceLastStep = Math.max(0, distanceSinceLastStep - stepThreshold);
    }
}
// Сделаем lastGroundIntersection глобальной, чтобы handleFootsteps имел к ней доступ
let lastGroundIntersection = null;


// --- Определение типа поверхности (вставить перед handleFootsteps) ---

// --- Улучшённое определение типа поверхности ---
function getSurfaceType(groundIntersection) {
    if (!groundIntersection || !groundIntersection.object) {
        console.log('surface: unknown (no intersection)');
        return 'unknown';
    }

    const obj = groundIntersection.object;

    // 0) Если это явно помеченный объект (не-чанк) — используем его пометку
    if (obj.userData && obj.userData.surfaceType && obj.userData.surfaceType !== 'default') {
        console.log('surface (userData non-default):', obj.userData.surfaceType);
        return obj.userData.surfaceType;
    }

    // 1) Проверяем логически дорогу (павемент / обочина)
    if (groundIntersection.point) {
        const wx = groundIntersection.point.x;
        const wz = groundIntersection.point.z;
        try {
            const rd = getRoadData(wx, wz);
            if (rd && rd.onPavement) {
                console.log('surface (roadData): road');
                return 'road';
            }
            if (rd && rd.onShoulder) {
                // Только если сильное смешение, считаем это дорогой; иначе игнорируем
                if (typeof rd.shoulderBlendFactor === 'number' && rd.shoulderBlendFactor > 0.6) {
                    console.log('surface (roadData - shoulder, strong blend): road');
                    return 'road';
                }
            }
        } catch (e) {
            // noop
        }
    }

    // 2) Сначала — если есть face/vertex colors, используем их (самый локальный и точный источник)
    if (groundIntersection.face && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.color) {
        const colors = obj.geometry.attributes.color;
        const face = groundIntersection.face;
        const ia = face.a, ib = face.b, ic = face.c;
        function getV(idx) { return new THREE.Color(colors.getX(idx), colors.getY(idx), colors.getZ(idx)); }
        const ca = getV(ia), cb = getV(ib), cc = getV(ic);
        const avg = new THREE.Color((ca.r + cb.r + cc.r) / 3, (ca.g + cb.g + cc.g) / 3, (ca.b + cb.b + cc.b) / 3);

        // Сравниваем с эталонами
        const ref = {
            grass: new THREE.Color(0x51c74f),
            desert: new THREE.Color(0xf0e68c),
            snow: new THREE.Color(0xffffff),
            mountain: new THREE.Color(settings.BIOMES[2].color || 0xAAAAAA),
            road: new THREE.Color(0x808080)
        };
        function dist(a, b) { return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2); }
        const ds = Object.fromEntries(Object.keys(ref).map(k => [k, dist(avg, ref[k])]));
        // Найдём ближайшую метку и применим порог
        const entries = Object.entries(ds).sort((a, b) => a[1] - b[1]);
        const best = entries[0][0];
        const bestDist = entries[0][1];

        // Порог: если расстояние мало — уверенно возвращаем best, иначе fallback к userData/avgY
        const CONFIDENCE_THRESHOLD = 0.18; // можно подправить (меньше = строже)
        if (bestDist <= CONFIDENCE_THRESHOLD) {
            console.log('surface (vertexColor):', best, 'avgColor:#' + avg.getHexString());
            return best;
        } else {
            console.log('surface (vertexColor low confidence): best=', best, 'dist=', bestDist.toFixed(3), 'avg:#' + avg.getHexString());
            // fallthrough -> попробуем userData/height/material
        }
    }

    // 3) Если у меша есть пометка (в т.ч. та, что мы проставили в Chunk), используем её (если не default)
    if (obj.userData && obj.userData.surfaceType && obj.userData.surfaceType !== 'default') {
        console.log('surface (mesh.userData fallback):', obj.userData.surfaceType);
        return obj.userData.surfaceType;
    }

    // 4) По высоте точки — снег / mountain (если есть point)
    if (groundIntersection.point) {
        const y = groundIntersection.point.y;
        const snowThreshold = (typeof settings.MOUNTAIN_SNOW_HEIGHT !== 'undefined') ? settings.MOUNTAIN_SNOW_HEIGHT - 6 : 100;
        if (y >= snowThreshold) {
            console.log('surface (height): snow (y=', y.toFixed(1), ')');
            return 'snow';
        }
    }

    // 5) По material.color (последняя попытка)
    if (obj.material && obj.material.color) {
        const matCol = obj.material.color.clone();
        const refs = {
            grass: new THREE.Color(0x51c74f),
            desert: new THREE.Color(0xf0e68c),
            snow: new THREE.Color(0xffffff),
            mountain: new THREE.Color(settings.BIOMES[2].color || 0xAAAAAA),
            road: new THREE.Color(0x808080)
        };
        function d(a, b) { return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2); }
        const ds = Object.fromEntries(Object.keys(refs).map(k => [k, d(matCol, refs[k])]));
        const entries = Object.entries(ds).sort((a, b) => a[1] - b[1]);
        const best = entries[0][0];
        console.log('surface (material.color fallback):', best, 'mat:#' + matCol.getHexString());
        return best;
    }

    // 6) Финальный fallback
    console.log('surface: unknown (fallback)');
    return 'unknown';
}


// --- Инициализация всех ползунков ---
setupSlider('MIN_PLAYER_SPEED');
setupSlider('MAX_PLAYER_SPEED');
setupSlider('BUNNYHOP_MAX_SPEED');
setupSlider('JUMP_STRENGTH');
setupSlider('GRAVITY');
setupSlider('RENDER_DISTANCE', false, 1, (value) => { // Добавляем (value)
    // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
    // Устанавливаем буферную зону в 2-3 чанка. Можете настроить.
    settings.UNLOAD_DISTANCE = value + 3;
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
    updateFog();
    forceChunkUpdate();
});
// --- НОВЫЙ СЛАЙДЕР ДЛЯ ТУМАНА ---
setupSlider('FOG_DISTANCE', false, 1, () => {
    updateFog();
});
setupSlider('SUNRISE_RENDER_DISTANCE', false);
setupSlider('TARGET_FPS', false);


// ------------------------------------
setupSlider('BIOME_TRANSITION_DISTANCE', false);
setupSlider('NORMAL_FOV');
setupSlider('RUNNING_FOV');
setupSlider('HEAD_BOB_DEPTH');
setupSlider('STRAFE_ROLL_ANGLE');
setupSlider('HEAD_BOB_SMOOTH_SPEED', false);
setupSlider('COIN_HOVER_SPEED');
setupSlider('OBJECT_SPAWN_CHANCE', true, 0.01);

// --- НАСТРОЙКИ ЗВУКА ---
setupSlider('MASTER_VOLUME');
setupSlider('FOOTSTEP_VOLUME');
setupSlider('SLIDE_VOLUME');
setupSlider('STEP_INTERVAL_BASE');
setupSlider('COIN_VOLUME');
// ----------------------
setupSlider('DAYLIGHT_EFFECT_DURATION');
setupSlider('XRAY_RADIUS');
setupSlider('BUNNYHOP_SPEED_BONUS');
setupSlider('AIR_ACCELERATE');
setupSlider('AIR_CONTROL_SPEED');



setupSlider('TIME_OF_DAY', true, 1, (value) => {
    timeOfDay = value;
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
    // Устанавливаем начальные значения
    particleOpacitySlider.value = settings.PARTICLE_OPACITY;
    if (particleOpacityValue) particleOpacityValue.textContent = settings.PARTICLE_OPACITY;

    particleOpacitySlider.addEventListener('input', (event) => {
        const value = parseFloat(event.target.value);
        settings.PARTICLE_OPACITY = value;
        if (particleOpacityValue) particleOpacityValue.textContent = value;

        // Обновляем uniform в шейдере в реальном времени
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
instructions.addEventListener('click', () => {
    controls.lock();
    // --- ДОБАВЛЕНО ИСПРАВЛЕНИЕ ---
    const listener = getListener();
    if (listener && listener.context.state === 'suspended') {
        listener.context.resume();
    }
});

function setupSlider(settingKey, isFloat = true, multiplier = 1, onUpdate = null) {
    const slider = document.getElementById(settingKey);
    if (!slider) return;
    const valueSpan = document.getElementById(`${settingKey}_Value`);

    let initialValue = settings[settingKey] ?? parseFloat(slider.value);
    if (settingKey === 'TARGET_FPS' && initialValue > 999) initialValue = 999; // Начальное ограничение

    settings[settingKey] = initialValue;

    slider.value = initialValue / multiplier;
    if (valueSpan) valueSpan.textContent = slider.value;

    slider.addEventListener('input', (event) => {
        let value = isFloat ? parseFloat(event.target.value) : parseInt(event.target.value, 10);

        // Специальная логика для TARGET_FPS
        if (settingKey === 'TARGET_FPS') {
            if (value >= 999) {
                value = 999; // Устанавливаем "бесконечность"
                valueSpan.textContent = "UL"; // UL = UnLimited
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
function createParticleSystem(color) {
    const particleCount = 2000;
    const positions = new Float32Array(particleCount * 3);
    const lifetimes = new Float32Array(particleCount);
    const startTimes = new Float32Array(particleCount);
    const initialVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
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
            // *** ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ***
            u_color: { value: color }, // Используем переданный цвет
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
// --- ФУНКЦИЯ ДЛЯ ЗАПУСКА ВЗРЫВА ---
function triggerParticles(particleSystem, position) {
    if (!particleSystem) return;

    particleSystem.position.copy(position); // Перемещаем систему в точку взрыва

    const startTimeAttribute = particleSystem.geometry.getAttribute('a_startTime');
    const currentTime = clock.getElapsedTime();

    for (let i = 0; i < startTimeAttribute.count; i++) {
        startTimeAttribute.setX(i, currentTime);
    }

    startTimeAttribute.needsUpdate = true; // Очень важная строка!
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

// --- ЗАМЕНИТЬ ФУНКЦИЮ triggerComboUpdate ---

function triggerComboUpdate(values, getState = false) {
    if (getState) {
        return { score: comboScore, multiplier: comboMultiplier };
    }
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
        comboAnimationState.score.previousValue = comboScore;
        comboScore = values.score;
        comboAnimationState.score.isAnimating = true;
        comboAnimationState.score.startTime = currentTime;
    }
    if (values.multiplier !== undefined) {
        comboAnimationState.multiplier.previousValue = comboMultiplier;
        comboMultiplier = parseFloat(values.multiplier.toFixed(1));
        comboAnimationState.multiplier.isAnimating = true;
        comboAnimationState.multiplier.startTime = currentTime;
    }
    updateLevelScoreHud();
}

function createComboHud() {
    // 1. Создаем 2D-холст
    const canvas = document.createElement('canvas');
    const canvasWidth = 512;
    const canvasHeight = 128;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    comboHudContext = canvas.getContext('2d');

    // 2. Создаем текстуру
    comboHudTexture = new THREE.CanvasTexture(canvas);
    comboHudTexture.minFilter = THREE.NearestFilter;
    comboHudTexture.magFilter = THREE.NearestFilter;

    // 3. Создаем материал с начальной непрозрачностью 0
    const material = new THREE.MeshBasicMaterial({
        map: comboHudTexture,
        transparent: true,
        depthTest: false,
        opacity: 0 // <-- ИЗМЕНЕНИЕ: Начинаем с нулевой непрозрачности
    });

    // 4. Создаем геометрию и меш
    const aspectRatio = canvasWidth / canvasHeight;
    const planeHeight = 0.15;
    const planeWidth = planeHeight * aspectRatio;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    comboHudMesh = new THREE.Mesh(geometry, material);

    // 5. Позиционируем
    comboHudMesh.position.set(0, 0.45, -0.5);
    // <-- ИЗМЕНЕНИЕ: Устанавливаем начальный "сжатый" масштаб
    comboHudMesh.scale.set(comboHudState.targetScale, comboHudState.targetScale, comboHudState.targetScale);

    // Изначально скрываем, чтобы не рендерить лишнего
    comboHudMesh.visible = false;

    // 6. Добавляем к камере
    camera.add(comboHudMesh);
}




function drawAnimatedPart(ctx, state, currentValue, previousValue, options) {
    const { x, y, font, align, prefix = '', suffix = '' } = options;
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
    const lineHeight = 30;

    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    let oldText = `${prefix}${Math.floor(previousValue)}${suffix}`;
    let newText = `${prefix}${Math.floor(currentValue)}${suffix}`;

    // --- ИСПРАВЛЕНИЕ ЗДЕСЬ: Округляем все координаты до целых чисел ---
    const finalX = Math.floor(x);

    if (state.isAnimating) {
        const elapsedTime = clock.getElapsedTime() - state.startTime;
        const progress = Math.min(elapsedTime / SCORE_ANIMATION_DURATION, 1.0);

        if (progress >= 1.0) {
            state.isAnimating = false;
        }

        const easedProgress = easeOutQuart(progress);
        const offsetY = easedProgress * lineHeight;

        // Округляем Y-координаты для старого и нового текста
        const finalOldY = Math.floor(y - offsetY);
        const finalNewY = Math.floor(y + lineHeight - offsetY);

        // Рисуем СТАРОЕ значение (уезжает наверх)
        ctx.save();
        ctx.globalAlpha = 1.0 - easedProgress;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(oldText, finalX + 2, finalOldY + 2); // Тень
        ctx.fillStyle = 'white';
        ctx.fillText(oldText, finalX, finalOldY); // Текст
        ctx.restore();

        // Рисуем НОВОЕ значение (выезжает снизу)
        ctx.save();
        ctx.globalAlpha = easedProgress;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(newText, finalX + 2, finalNewY + 2); // Тень
        ctx.fillStyle = 'white';
        ctx.fillText(newText, finalX, finalNewY); // Текст
        ctx.restore();
    } else {
        // Рисуем статичное значение с округленными координатами
        const finalY = Math.floor(y);
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(newText, finalX + 2, finalY + 2);
        ctx.fillStyle = 'white';
        ctx.fillText(newText, finalX, finalY);
    }
}



function initScoreSystem() {
    const savedHighScore = localStorage.getItem('highScore');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore, 10);
    }
    updateScoreHud(); // Обновляем HUD при старте
}

// ЗАМЕНИТЕ ВАШУ ФУНКЦИЮ updateComboHud
function updateComboHud(timer) {
    if (!comboHudContext || !comboHudTexture) return;

    const ctx = comboHudContext;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    ctx.clearRect(0, 0, width, height);

    const baseY = height / 2 + 15;
    const font = "36px 'Press Start 2P'";

    ctx.font = font;
    let totalWidth;
    let scoreText = `${comboScore}`;
    let multiplierText = `${comboMultiplier}`;
    let xSeparatorText = ' x ';
    let scoreWidth = ctx.measureText(scoreText).width;
    let multiplierWidth = ctx.measureText(multiplierText).width;

    if (comboScore > 0) {
        let xSeparatorWidth = ctx.measureText(xSeparatorText).width;
        totalWidth = scoreWidth + xSeparatorWidth + multiplierWidth;
    } else {
        let prefixText = 'x ';
        let prefixWidth = ctx.measureText(prefixText).width;
        totalWidth = prefixWidth + multiplierWidth;
    }

    let currentX = (width - totalWidth) / 2;

    if (comboScore > 0) {
        drawAnimatedPart(ctx, comboAnimationState.score, comboScore, comboAnimationState.score.previousValue, {
            x: currentX, y: baseY, font: font, align: 'left'
        });
        currentX += scoreWidth;

        // Отрисовка статичного "x" с округлением
        ctx.font = font;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(xSeparatorText, Math.floor(currentX) + 4, Math.floor(baseY) + 4); // <-- ИСПРАВЛЕНО
        ctx.fillStyle = 'white';
        ctx.fillText(xSeparatorText, Math.floor(currentX), Math.floor(baseY)); // <-- ИСПРАВЛЕНО
        currentX += ctx.measureText(xSeparatorText).width;

        drawAnimatedPart(ctx, comboAnimationState.multiplier, comboMultiplier, comboAnimationState.multiplier.previousValue, {
            x: currentX, y: baseY, font: font, align: 'left'
        });
    } else {
        drawAnimatedPart(ctx, comboAnimationState.multiplier, comboMultiplier, comboAnimationState.multiplier.previousValue, {
            x: currentX, y: baseY, font: font, align: 'left', prefix: 'x '
        });
    }

    // Рисуем таймер с округлением
    const timerText = timer.toFixed(1) + 's';
    const timerX = Math.floor(width / 2);
    const timerY = Math.floor(height / 2 + 50);
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(timerText, timerX + 2, timerY + 2); // <-- ИСПРАВЛЕНО
    ctx.fillStyle = '#ffc107';
    ctx.fillText(timerText, timerX, timerY); // <-- ИСПРАВЛЕНО

    comboHudTexture.needsUpdate = true;
}
function addScore(points) {
    const old = currentScore;
    currentScore += points;

    // запуск pop-анимации если увеличился
    if (currentScore > old) {
        scorePopTimer = SCORE_POP_DURATION;
        previousScoreForPop = old;
    }

    if (currentScore > highScore) {
        if (!isHighScoreBeaten) {
            isHighScoreBeaten = true;
            highScoreFlashTime = settings.HIGH_SCORE_FLASH_DURATION;
            console.log("%cNEW HIGH SCORE!", "color: gold; font-size: 20px;");
        }
        highScore = currentScore;
        localStorage.setItem('highScore', highScore);
    }
    // анимация в update() сама обновит HUD
}

/**
 * Сбрасывает текущий счет (например, при перезапуске игры).
 */
function resetScore() {
    currentScore = 0;
    updateScoreHud();
}

function createScoreHud() {
    const canvasWidth = 512;
    const canvasHeight = 160;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    scoreHudContext = canvas.getContext('2d');

    scoreHudTexture = new THREE.CanvasTexture(canvas);
    scoreHudTexture.minFilter = THREE.LinearFilter;
    scoreHudTexture.magFilter = THREE.NearestFilter;

    const material = new THREE.MeshBasicMaterial({
        map: scoreHudTexture,
        transparent: true,
        depthTest: false
    });

    const aspectRatio = canvasWidth / canvasHeight;
    const planeHeight = 0.14;
    const planeWidth = planeHeight * aspectRatio;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

    scoreHudMesh = new THREE.Mesh(geometry, material);

    // --- ИЗМЕНЕНИЕ: Сдвигаем весь блок левее ---
    // Уменьшаем значение X, чтобы сдвинуть объект влево по экрану.
    // Вы можете сделать его еще меньше (например, -0.9), если хотите сдвинуть еще дальше.
    scoreHudMesh.position.set(-0.80, 0.46, -0.5); // Было (-0.72, 0.46, -0.5)
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    camera.add(scoreHudMesh);
}

function updateScoreHud() {
    if (!scoreHudContext || !scoreHudTexture) return;
    const ctx = scoreHudContext;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    // --- ИЗМЕНЕНИЕ: Уменьшаем ширину панели, чтобы сдвинуть правую сторону левее ---
    const panelW = 350; // Было 400. Правый край теперь будет левее.
    const panelH = 120;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;
    const borderRadius = 18;

    // эффект pop: увеличиваем внутренний scale при pop
    const popProgress = Math.max(0, Math.min(1, scorePopTimer / SCORE_POP_DURATION));
    const popScale = 1 + 0.08 * (Math.sin((1 - popProgress) * Math.PI));

    // шимер по краю (легкая полоска, бегущая)
    scoreEdgeShimmerTime += 0.016;
    const shimmerOffset = (Math.sin(scoreEdgeShimmerTime * 2.2) + 1) / 2;

    // фон с градиентом
    const grad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    grad.addColorStop(0, 'rgba(18,20,30,0.95)');
    grad.addColorStop(1, 'rgba(28,30,48,0.95)');
    ctx.save();
    ctx.translate(panelX + panelW / 2, panelY + panelH / 2);
    ctx.scale(popScale, popScale);
    ctx.translate(-(panelX + panelW / 2), -(panelY + panelH / 2));

    // основной фон (закруглённый)
    ctx.fillStyle = grad;
    _drawRoundRect(ctx, panelX, panelY, panelW, panelH, borderRadius);
    ctx.fill();

    // внутренняя тонкая тень/блик (overlap)
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    _drawRoundRect(ctx, panelX + 1, panelY + 1, panelW - 2, panelH - 2, borderRadius - 2);
    ctx.fill();

    // внешний обвод (четкая) + шимер (тонкая линия)
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(120,130,200,0.9)';
    _drawRoundRect(ctx, panelX + 1.5, panelY + 1.5, panelW - 3, panelH - 3, borderRadius - 2);
    ctx.stroke();

    // шимерная полоска вдоль верхней кромки
    const shimmerW = Math.max(40, panelW * 0.18);
    const shimmerX = panelX + (panelW - shimmerW) * shimmerOffset;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(180,200,255,0.06)';
    _drawRoundRect(ctx, shimmerX, panelY + 4, shimmerW, 6, 6);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // если новый рекорд — мягкое свечение
    if (highScoreFlashTime > 0) {
        const recProgress = Math.max(0, Math.min(1, highScoreFlashTime / settings.HIGH_SCORE_FLASH_DURATION));
        ctx.shadowBlur = 18 * recProgress;
        ctx.shadowColor = `rgba(255, 223, 0, ${0.6 * recProgress})`;
        ctx.lineWidth = 4 + 6 * recProgress;
        ctx.strokeStyle = `rgba(255,223,0,${0.9 * recProgress})`;
        _drawRoundRect(ctx, panelX + 2, panelY + 2, panelW - 4, panelH - 4, borderRadius - 3);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // ТЕКСТ: Score и High
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const textPaddingLeft = 15;

    // "Score" title
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillStyle = 'rgba(220,220,220,0.98)';
    ctx.fillText('Score', panelX + textPaddingLeft, panelY + 14);

    // big animated score
    ctx.font = "38px 'Press Start 2P'";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(formatLargeNumber(animatedScore), panelX + textPaddingLeft, panelY + 40);

    // high score
    ctx.font = "18px 'Press Start 2P'";
    ctx.fillStyle = '#FFC107';
    ctx.fillText(`High: ${formatLargeNumber(animatedHighScore)}`, panelX + textPaddingLeft, panelY + panelH - 34);


    // Иконка Солнца / Полной Луны. Её позиция (iconX) автоматически пересчитается, так как она зависит от panelW
    const isDay = Math.sin(timeOfDay * Math.PI * 2) >= 0;

    const iconX = panelX + panelW - 65; // Скорректировали отступ от нового правого края
    const iconY = panelY + 18;
    const iconRadius = 14;
    const iconCenterX = iconX + iconRadius;
    const iconCenterY = iconY + iconRadius;

    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (isDay) {
        // --- РИСУЕМ СОЛНЦЕ ---
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const startRadius = iconRadius * 0.9;
            const endRadius = iconRadius * 1.6;
            ctx.moveTo(iconCenterX + Math.cos(angle) * startRadius, iconCenterY + Math.sin(angle) * startRadius);
            ctx.lineTo(iconCenterX + Math.cos(angle) * endRadius, iconCenterY + Math.sin(angle) * endRadius);
        }
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = 'rgba(255, 165, 0, 0.6)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(iconCenterX, iconCenterY, iconRadius, 0, 2 * Math.PI);
        ctx.fill();

    } else {
        // --- РИСУЕМ ПОЛНУЮ ЛУНУ ---
        ctx.fillStyle = '#FFF59D';
        ctx.shadowColor = 'rgba(220, 240, 255, 0.5)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(iconCenterX, iconCenterY, iconRadius, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // restore transform
    ctx.restore();
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // уменьшаем таймеры
    if (scorePopTimer > 0) {
        scorePopTimer -= 1 / 60;
        if (scorePopTimer < 0) scorePopTimer = 0;
    }

    // обновляем текстуру
    scoreHudTexture.needsUpdate = true;
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (psx && psx.onResize) psx.onResize();
});

function handleAugmentSelection(event) {
    // Игнорируем клики, если менеджер не готов или выбор уже сделан
    if (!augmentsManager || augmentsManager.isChoiceMade) {
        return;
    }

    // 1. Создаем Raycaster для определения пересечений
    const mouse = new THREE.Vector2();
    // Нормализуем координаты клика (от -1 до +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // 2. Получаем массив 3D-объектов (слотов) от менеджера
    const hudMeshes = augmentsManager.getHudMeshes();
    const intersects = raycaster.intersectObjects(hudMeshes);

    // 3. Если луч пересек какой-либо из слотов...
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        const selectedIndex = hudMeshes.indexOf(clickedObject);

        if (selectedIndex !== -1) {

            const cardWorldPosition = new THREE.Vector3();
            clickedObject.getWorldPosition(cardWorldPosition);
            triggerParticles(augmentParticles, cardWorldPosition);

            augmentsManager.selectAugment(selectedIndex);
            isPausedForAugment = false; // Сообщаем игре, что выбор сделан

            // ---> НОВАЯ СТРОКА: Возвращаем управление после выбора
            controls.lock();

            // --- НОВЫЙ КОД: Запускаем анимацию возврата к нормальной видимости ---
            isRenderTransitioning = true;
            renderTransitionStartTime = clock.getElapsedTime();
            // Начинаем анимацию с текущих (уменьшенных) значений
            renderTransitionStartRender = settings.RENDER_DISTANCE;
            renderTransitionStartFog = settings.FOG_DISTANCE;
        }
    }
}

// --- ЗАМЕНИТЕ ВСЮ ФУНКЦИЮ updatePhysics ---

function updatePhysics(delta, currentMaxSpeedCap, currentMaxPlayerSpeed) {
    if (augmentsManager && augmentsManager.isVisible) {
        return;
    }

    const playerPosition = playerBody.position;
    lastGroundIntersection = null;

    const lastVelocityY = playerVelocity.y;
    let groundNormal = null;

    if (!isPlayerOnGround) {
        playerVelocity.y -= settings.GRAVITY * delta;
        if (playerVelocity.y < -settings.MAX_FALL_SPEED) {
            playerVelocity.y = -settings.MAX_FALL_SPEED;
        }
        raycaster.ray.origin.copy(playerPosition).y += settings.PLAYER_HEIGHT / 2;
        const intersections = raycaster.intersectObjects(Array.from(chunks.values()).filter(c => c.mesh).map(c => c.mesh), false);

        if (intersections.length > 0) {
            lastGroundIntersection = intersections[0];
            const groundY = lastGroundIntersection.point.y;
            if (playerPosition.y + playerVelocity.y * delta < groundY) {
                playerPosition.y = groundY;
                playerVelocity.y = 0;
                isPlayerOnGround = true;
                timeSinceLanding = 0;
                groundNormal = lastGroundIntersection.face.normal;
                bhopStatusMessage = 'ПРЫГАЙ!';
                if (lastVelocityY < settings.MIN_FALL_SPEED_FOR_ANIMATION) {
                    isLandingAnimationPlaying = true;
                    landingAnimationTime = 0;
                }
            }
        }
    }

    if (isPlayerOnGround) {
        raycaster.ray.origin.copy(playerPosition).y += settings.PLAYER_HEIGHT / 2;
        const intersections = raycaster.intersectObjects(Array.from(chunks.values()).filter(c => c.mesh).map(c => c.mesh), false);
        if (intersections.length > 0) {
            lastGroundIntersection = intersections[0];
            playerPosition.y = lastGroundIntersection.point.y;
            playerVelocity.y = 0;
            groundNormal = lastGroundIntersection.face.normal;
        } else {
            isPlayerOnGround = false;
        }
    }

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

    const wishdir = new THREE.Vector3();
    if (keyboard['KeyW']) wishdir.add(forward);
    if (keyboard['KeyS']) wishdir.sub(forward);
    if (!isSliding && keyboard['KeyA']) wishdir.sub(right);
    if (!isSliding && keyboard['KeyD']) wishdir.add(right);
    if (wishdir.lengthSq() > 0) wishdir.normalize();

    if (keyboard['ControlLeft'] && !isSliding && isPlayerOnGround && !keyboard['Space']) {
        const horizontalSpeed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();
        if (horizontalSpeed >= settings.MIN_SLIDE_SPEED) {
            isSliding = true;
            const newSpeed = horizontalSpeed + settings.SLIDE_BOOST;
            playerVelocity.x = forward.x * newSpeed;
            playerVelocity.z = forward.z * newSpeed;
        }
    }

    if (keyboard['Space'] && isPlayerOnGround) {
        if (isBhopEnabled || canPerformJump) {
            const jumpStrength = bonusManager.getEffectiveJumpStrength();
            const horizontalSpeed = new THREE.Vector2(playerVelocity.x, playerVelocity.z).length();
            const isMovingUpSteepSlope = isSliding && groundNormal && groundNormal.y < settings.RAMP_JUMP_MIN_SLOPE_Y && forward.dot(groundNormal) < 0;

            if (isMovingUpSteepSlope && horizontalSpeed >= settings.RAMP_JUMP_MIN_SPEED) {
                bhopStatusMessage = 'RAMP JUMP!';
                trickDisplay.show("RAMP JUMP!", 2.0);
                triggerComboUpdate({ score: comboScore + settings.POINTS_PER_RAMPJUMP });
                isSliding = false;
                const newHorizontalSpeed = horizontalSpeed * settings.RAMP_JUMP_FORWARD_MULTIPLIER;
                const scale = newHorizontalSpeed / horizontalSpeed;
                playerVelocity.x *= scale;
                playerVelocity.z *= scale;
                playerVelocity.y = settings.RAMP_JUMP_VERTICAL_BOOST;
            } else if (isSliding) {
                bhopStatusMessage = 'SLIDE JUMP!';
                isSliding = false;
                if (horizontalSpeed > 0) {
                    const newSpeed = horizontalSpeed + settings.SLIDE_JUMP_SPEED_BONUS;
                    const scale = newSpeed / horizontalSpeed;
                    playerVelocity.x *= scale;
                    playerVelocity.z *= scale;
                }
                playerVelocity.y = jumpStrength;
            } else {
                // --- ВОТ ВОССТАНОВЛЕННЫЙ БЛОК ---
                const isPerfectJump = timeSinceLanding <= settings.BUNNYHOP_TIMING_WINDOW;
                if (isPerfectJump) {
                    bhopStatusMessage = 'УСПЕХ!';
                    if (horizontalSpeed > 0) {
                        // Эта строка применяет бонус к скорости!
                        const newSpeed = horizontalSpeed + settings.BUNNYHOP_SPEED_BONUS;
                        const scale = newSpeed / horizontalSpeed;
                        playerVelocity.x *= scale;
                        playerVelocity.z *= scale;
                    }
                } else {
                    bhopStatusMessage = 'ПОЗДНО';
                }
                playerVelocity.y = jumpStrength;
                // --- КОНЕЦ ВОССТАНОВЛЕННОГО БЛОКА ---
            }
            isPlayerOnGround = false;
            isLandingAnimationPlaying = false;
            if (!isBhopEnabled) canPerformJump = false;
        }
    }

    if (isPlayerOnGround) {
        timeSinceLanding += delta;
        if (isSliding) {
            slideMove(delta, forward, groundNormal);
            if (new THREE.Vector2(playerVelocity.x, playerVelocity.z).length() < settings.MIN_SLIDE_SPEED) {
                isSliding = false;
            }
        } else {
            groundMove(delta, wishdir, currentMaxPlayerSpeed);
        }
    } else {
        if (isSliding) isSliding = false;
        airMove(delta, wishdir);
    }

    capSpeed(currentMaxSpeedCap);

    const displacement = playerVelocity.clone().multiplyScalar(delta);

    const collisionObjects = Array.from(chunks.values())
        .filter(c => c.mesh) // Добавляем фильтр, чтобы убрать чанки без меша
        .map(c => c.mesh);
    for (let i = 0; i < 5; i++) {
        const movementDistance = displacement.length();
        if (movementDistance < 1e-4) break;
        const movementDirection = displacement.clone().normalize();
        const sideVector = new THREE.Vector3().crossVectors(movementDirection, camera.up).normalize();
        const rayOriginBase = playerPosition.clone().add(new THREE.Vector3(0, settings.PLAYER_HEIGHT / 2, 0));
        const rayOrigins = [rayOriginBase, rayOriginBase.clone().add(sideVector.multiplyScalar(PLAYER_RADIUS)), rayOriginBase.clone().sub(sideVector.multiplyScalar(PLAYER_RADIUS))];
        let nearestCollision = null;
        for (const origin of rayOrigins) {
            collisionRaycaster.set(origin, movementDirection);
            collisionRaycaster.far = movementDistance + PLAYER_RADIUS + 10.0;
            const collisions = collisionRaycaster.intersectObjects(collisionObjects, false);
            const wallCollision = collisions.find(c => Math.abs(c.face.normal.y) < 0.7);
            if (wallCollision && (!nearestCollision || wallCollision.distance < nearestCollision.distance)) {
                nearestCollision = wallCollision;
            }
        }
        if (nearestCollision) {
            const wallNormal = nearestCollision.face.normal;
            const penetrationVector = wallNormal.clone().multiplyScalar(displacement.dot(wallNormal));
            const pushOut = wallNormal.clone().multiplyScalar(0.001);
            displacement.sub(penetrationVector).sub(pushOut);
        } else {
            break;
        }
    }
    playerBody.position.add(displacement);
}
const cameraWorldPosition = new THREE.Vector3(); // Этот вспомогательный вектор все еще нужен для масштаба

const wheelRaycaster = new THREE.Raycaster();
function masterWheelHandler(event) {
    // Сначала проверяем аугменты, так как они в приоритете в начале игры
    if (augmentsManager && augmentsManager.isVisible && !augmentsManager.isChoiceMade) {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        wheelRaycaster.setFromCamera(mouse, camera);
        const hudMeshes = augmentsManager.getHudMeshes();
        const intersects = wheelRaycaster.intersectObjects(hudMeshes);

        if (intersects.length > 0) {
            event.preventDefault();
            const slotIndex = hudMeshes.indexOf(intersects[0].object);
            if (slotIndex !== -1) {
                augmentsManager.handleMouseWheel(slotIndex, event.deltaY);
            }
            return; // Важно: выходим, чтобы не передать скролл статистике
        }
    }

    // Если скролл не был обработан аугментами, передаем его статистике
    if (statsDisplay && statsDisplay.isVisible) {
        event.preventDefault();
        statsDisplay.handleMouseWheel(event);
    }
}

window.addEventListener('wheel', masterWheelHandler, { passive: false });
function calculateNextLevelScoreRequirement() {
    // Используем степенную функцию для увеличения требуемого опыта
    levelScoreForNextLevel = Math.floor(
        settings.LEVEL_SCORE_FOR_NEW_AUGMENTS * Math.pow(settings.LEVEL_SCORE_INCREASE_PER_LEVEL, currentLevel - 1)
    );
}

function updateLevelScoreHud() {
    if (!levelScoreHudContext || !levelScoreHudTexture || typeof levelScoreAnimationState === 'undefined') {
        return;
    }

    const ctx = levelScoreHudContext;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    // --- Настройки дизайна ---
    const barHeight = 45;
    const barWidth = 900;
    const barX = (width - barWidth) / 2;
    const barY = height - barHeight - 25;
    const borderRadius = 22;

    // --- 1. Анимация "POP" ---
    const popProgress = Math.max(0, Math.min(1, levelScorePopTimer / LEVEL_SCORE_POP_DURATION));
    const popScale = 1 + 0.06 * (Math.sin((1 - popProgress) * Math.PI));
    ctx.save();
    ctx.translate(width / 2, barY + barHeight / 2);
    ctx.scale(popScale, popScale);
    ctx.translate(-width / 2, -(barY + barHeight / 2));

    // --- 2. Расчеты прогресса ---
    const totalScoreCap = levelScoreForNextLevel || 1;
    const currScore = currentLevelScore || 0;
    const isCombo = isComboActive && comboScore > 0;
    const comboPts = isCombo ? (comboScore * comboMultiplier) : 0;
    const targetPending = currScore + comboPts;
    const pendingAnimated = animatedPendingLevelScore || targetPending;
    const greenAnimated = animatedLevelScore || currScore;
    const pendingPercentage = Math.max(0, Math.min(1, pendingAnimated / totalScoreCap));
    const greenPercentage = Math.max(0, Math.min(1, greenAnimated / totalScoreCap));
    const pendingFill = barWidth * pendingPercentage;
    const greenFill = barWidth * greenPercentage;

    // --- 3. Определение цвета рамки ---
    let borderColor;
    let shadowColor;
    let useGlow = false;

    if (pendingFill > greenFill) {
        borderColor = '#FFF59D';
        shadowColor = '#FF8F00';
        useGlow = true;
    } else {
        borderColor = 'rgba(120,130,200,0.9)';
        shadowColor = 'transparent';
        useGlow = false;
    }

    // --- 4. Отрисовка фона и полос прогресса ---
    const grad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    grad.addColorStop(0, 'rgba(28,30,48,0.95)');
    grad.addColorStop(1, 'rgba(18,20,30,0.95)');
    ctx.fillStyle = grad;
    _drawRoundRect(ctx, barX, barY, barWidth, barHeight, borderRadius);
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    _drawRoundRect(ctx, barX + 1, barY + 1, barWidth - 2, barHeight - 2, borderRadius - 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Отрисовка полосы очков комбо (Оранжевая)
    if (pendingFill > 0) {
        ctx.save();
        _drawRoundRect(ctx, barX, barY, pendingFill, barHeight, borderRadius); ctx.clip();
        const pGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
        // --- ЦВЕТА ИЗМЕНЕНЫ ЗДЕСЬ ---
        pGradient.addColorStop(0, '#FFEE58'); // Яркий, лимонно-желтый
        pGradient.addColorStop(1, '#FFAB00'); // Насыщенный, энергичный оранжевый
        ctx.fillStyle = pGradient; ctx.fillRect(barX, barY, pendingFill, barHeight); ctx.restore();
    }
    // Отрисовка основной полосы опыта (Зеленая -> Циан)
    if (greenFill > 0) {
        ctx.save();
        _drawRoundRect(ctx, barX, barY, greenFill, barHeight, borderRadius); ctx.clip();
        const gGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
        // --- ЦВЕТА ИЗМЕНЕНЫ ЗДЕСЬ ---
        gGradient.addColorStop(0, '#00F2FF'); // Яркий, электрический циан
        gGradient.addColorStop(1, '#00B8D4'); // Более глубокий, насыщенный циан
        ctx.fillStyle = gGradient; ctx.fillRect(barX, barY, greenFill, barHeight); ctx.restore();
    }

    // --- 5. Внешняя рамка и свечение для ОСНОВНОЙ ПОЛОСЫ ---
    ctx.lineWidth = 4;
    if (useGlow) {
        const glowPulse = (Math.sin(clock.getElapsedTime() * 5) + 1) / 2;
        ctx.shadowBlur = 10 + glowPulse * 15;
        ctx.shadowColor = shadowColor;
    }
    ctx.strokeStyle = borderColor;
    _drawRoundRect(ctx, barX + 2, barY + 2, barWidth - 4, barHeight - 4, borderRadius - 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // --- 6. Отрисовка текста (без изменений) ---
    const lvl = currentLevel || 1;
    const displayScore = Math.floor(currScore);
    const cap = totalScoreCap;
    const font = "28px 'Press Start 2P'";
    ctx.font = font;
    const textY = barY + barHeight / 2;
    const separatorStr = ' / ';
    const separatorWidth = ctx.measureText(separatorStr).width;
    const SEPARATOR_SPACING = 25;
    const centerX = barX + barWidth / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(separatorStr, Math.floor(centerX) + 2, Math.floor(textY) + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(separatorStr, Math.floor(centerX), Math.floor(textY));
    const scoreX = centerX - (separatorWidth / 2) - SEPARATOR_SPACING;
    drawAnimatedPart(ctx, levelScoreAnimationState.score, displayScore, levelScoreAnimationState.score.previousValue, {
        x: scoreX, y: textY, font: font, align: 'right'
    });
    const capX = centerX + (separatorWidth / 2) + SEPARATOR_SPACING;
    drawAnimatedPart(ctx, levelScoreAnimationState.cap, cap, levelScoreAnimationState.cap.previousValue, {
        x: capX, y: textY, font: font, align: 'left'
    });

    // --- 7. ИНДИКАТОР "LVL" (Синхронизированный цвет) ---
    const lvlText = `LVL ${lvl}`;
    const lvlFont = "24px 'Press Start 2P'";
    ctx.font = lvlFont;
    const lvlBoxWidth = ctx.measureText(lvlText).width + 40;
    const lvlBoxHeight = 50;
    const lvlBoxX = barX - lvlBoxWidth / 2 + 30;
    const lvlBoxY = barY - lvlBoxHeight / 2 - 5;
    if (useGlow) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 15;
    }
    ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
    _drawRoundRect(ctx, lvlBoxX, lvlBoxY, lvlBoxWidth, lvlBoxHeight, 18);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    _drawRoundRect(ctx, lvlBoxX + 2, lvlBoxY + 2, lvlBoxWidth - 4, lvlBoxHeight - 4, 16);
    ctx.stroke();
    ctx.font = lvlFont;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(lvlText, lvlBoxX + lvlBoxWidth / 2, lvlBoxY + lvlBoxHeight / 2 + 2);
    ctx.shadowColor = 'transparent';

    // --- Финальные шаги ---
    ctx.restore();
    levelScoreHudTexture.needsUpdate = true;
}

function levelUp() {
    console.log(`%cLEVEL UP! Достигнут уровень ${currentLevel + 1}`, 'color: cyan; font-size: 16px;');

    const oldRequirement = levelScoreForNextLevel;
    const overflowScore = currentLevelScore - oldRequirement;

    currentLevel++;

    if (settings.LEVEL_SCORE_RESETS_ON_LEVEL_UP) {
        // --- ЗАПУСК АНИМАЦИИ СБРОСА СЧЕТА ---
        const scoreState = levelScoreAnimationState.score;
        scoreState.previousValue = currentLevelScore; // Старое значение до сброса
        scoreState.isAnimating = true;
        scoreState.startTime = clock.getElapsedTime();
        // ---------------------------------
        currentLevelScore = overflowScore;
        animatedLevelScore = Math.max(0, animatedLevelScore - oldRequirement);
    }

    calculateNextLevelScoreRequirement();

    // --- ЗАПУСК АНИМАЦИИ НОВОГО ПОРОГА ---
    const capState = levelScoreAnimationState.cap;
    capState.previousValue = oldRequirement; // Старый порог
    capState.isAnimating = true;
    capState.startTime = clock.getElapsedTime();
    // ---------------------------------

    pendingAugmentChoices++;
    console.log(`Выбор аугмента добавлен в очередь. Всего в очереди: ${pendingAugmentChoices}`);
}


/**
 * Добавляет очки к счету уровня и проверяет, не пора ли повышать уровень.
 * @param {number} points - Количество добавляемых очков.
 */
function addLevelScore(points) {
    currentLevelScore += points;
    levelScorePopTimer = LEVEL_SCORE_POP_DURATION; // <--- ДОБАВЬ ЭТУ СТРОКУ

    console.log(`Level Score: ${Math.floor(currentLevelScore)} / ${levelScoreForNextLevel} (Уровень ${currentLevel})`);

    while (currentLevelScore >= levelScoreForNextLevel) {
        levelUp();

        // --- ДОБАВЬТЕ ЭТУ СТРОКУ ---
        // После levelUp текст "LVL" и порог меняются.
        // Обновляем HUD немедленно, чтобы это отразить.
        updateLevelScoreHud();
        // ---------------------------
    }
}

function createLevelScoreHud() {
    const canvas = document.createElement('canvas');
    const canvasWidth = 2048; // Оставляем высокое разрешение для четкости
    const canvasHeight = 128;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    levelScoreHudContext = canvas.getContext('2d');

    const scoreHudTexture = new THREE.CanvasTexture(canvas);
    scoreHudTexture.minFilter = THREE.NearestFilter;
    scoreHudTexture.magFilter = THREE.NearestFilter;

    const material = new THREE.MeshBasicMaterial({
        map: scoreHudTexture,
        transparent: true,
        depthTest: false
    });

    const aspectRatio = canvasWidth / canvasHeight;
    const planeHeight = 0.1;
    const planeWidth = planeHeight * aspectRatio;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

    levelScoreHudMesh = new THREE.Mesh(geometry, material);

    // Немного опускаем HUD, чтобы он не мешал центру экрана
    levelScoreHudMesh.position.set(0, -0.5, -0.5);

    camera.add(levelScoreHudMesh);

    levelScoreHudTexture = scoreHudTexture;
    levelScoreHudContext = canvas.getContext('2d');
}


//levelScoreHudMesh.position.set(0, -0.50, -0.5);

/*function createChatHud() {
    const canvas = document.createElement('canvas');
    const canvasWidth = 1024;
    const canvasHeight = 512;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    chatHudContext = canvas.getContext('2d');

    chatHudTexture = new THREE.CanvasTexture(canvas);
    chatHudTexture.minFilter = THREE.NearestFilter;
    chatHudTexture.magFilter = THREE.NearestFilter;

    const material = new THREE.MeshBasicMaterial({
        map: chatHudTexture,
        transparent: true,
        depthTest: false
    });

    const aspectRatio = canvasWidth / canvasHeight;

    // --- ИЗМЕНЕНИЯ ЗДЕСЬ ---
    const planeHeight = 0.4 * CHAT_SCALE; // Масштабируем высоту
    const planeWidth = 1.0 * CHAT_SCALE;  // Масштабируем ширину
    // --- КОНЕЦ ИЗМЕНЕНИЙ ---

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    chatHudMesh = new THREE.Mesh(geometry, material);

    // Позицию тоже можно сделать зависимой от масштаба, чтобы чат не "уползал"
    chatHudMesh.position.set(-0.55, 0, -0.5);

    chatHudMesh.visible = false;
    camera.add(chatHudMesh);
}

*/
function createChatHud() {
    const canvas = document.createElement('canvas');

    // Мы делаем и холст (текстуру), и 3D-плоскость шире, чтобы текст не растягивался.
    const canvasWidth = 1330; // Было 1024. Увеличили на ~30%
    const canvasHeight = 512;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    chatHudContext = canvas.getContext('2d');

    chatHudTexture = new THREE.CanvasTexture(canvas);
    chatHudTexture.minFilter = THREE.NearestFilter;
    chatHudTexture.magFilter = THREE.NearestFilter;

    const material = new THREE.MeshBasicMaterial({
        map: chatHudTexture,
        transparent: true,
        depthTest: false
    });

    const aspectRatio = canvasWidth / canvasHeight;
    const planeHeight = 0.4 * CHAT_SCALE;

    // ШАГ 1: Увеличиваем ширину 3D-плоскости чата на те же ~30%
    const planeWidth = 1.3 * CHAT_SCALE; // Было 1.0 * CHAT_SCALE

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    chatHudMesh = new THREE.Mesh(geometry, material);

    // ШАГ 2: Сдвигаем позицию чата немного правее, чтобы левый край остался на месте.
    // Так как ширина увеличилась, центр нужно сместить.
    chatHudMesh.position.set(-0.42, 0, -0.5); // Было -0.55

    chatHudMesh.visible = false;
    camera.add(chatHudMesh);
}
//setScore(currentScore, 1000000)
function setScore(score, high) {
    // 1. Проверяем и устанавливаем текущий счет
    if (typeof score === 'number' && !isNaN(score)) {
        currentScore = score;
        console.log(`%c[DEBUG] Текущий счет установлен на: ${currentScore}`, 'color: lime;');
    } else {
        console.error('[DEBUG] Ошибка: первое значение (счет) должно быть числом.');
        return;
    }

    // 2. Проверяем и устанавливаем рекорд, если он был передан
    if (typeof high === 'number' && !isNaN(high)) {
        highScore = high;
        console.log(`%c[DEBUG] Рекорд установлен на: ${highScore}`, 'color: cyan;');
    }

    // 3. Дополнительная проверка: если текущий счет стал выше рекорда,
    //    то рекорд тоже нужно обновить.
    if (currentScore > highScore) {
        highScore = currentScore;
        console.log(`%c[DEBUG] Рекорд обновлен до ${highScore}, так как текущий счет выше.`, 'color: yellow;');
    }

    // 4. Сохраняем рекорд в памяти браузера
    localStorage.setItem('highScore', highScore.toString());

    // 5. Обновляем отображение счета в игре
    updateScoreHud();
}

// Делаем функцию доступной глобально из консоли
window.setScore = setScore;

//setLevel(currentLevel, 4990)

function setLevel(level, score = 0) {
    // ... (проверки level и score)
    currentLevel = Math.floor(Math.max(1, level));
    currentLevelScore = Math.max(0, score);

    // --- ДОБАВЬТЕ ЭТУ СТРОКУ ---
    animatedLevelScore = currentLevelScore; // Мгновенно синхронизируем анимированный счет
    // ----------------------------

    calculateNextLevelScoreRequirement();
    updateLevelScoreHud();

    while (currentLevelScore >= levelScoreForNextLevel) {
        levelUp();
        updateLevelScoreHud();
    }
}


// Делаем функцию доступной глобально из консоли
window.setLevel = setLevel;


function toggleShop() {
    if (shopManager.isVisible) {
        shopManager.hide();
        isPausedForShop = false;
        controls.lock();
    } else {
        shopManager.show();
        isPausedForShop = true;
        controls.unlock();
    }
}

function handleShopPurchase(event) {
    // 1. Игнорируем клики, если магазин не виден
    if (!shopManager || !shopManager.isVisible) {
        return;
    }

    // 2. Используем Raycaster для определения, на какую карточку кликнули
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const hudMeshes = shopManager.getHudMeshes();
    const intersects = raycaster.intersectObjects(hudMeshes);

    // 3. Если клик попал по карточке...
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        const selectedIndex = hudMeshes.indexOf(clickedObject);

        if (selectedIndex !== -1) {
            const item = shopManager.slotItems[selectedIndex];
            if (!item) return;

            // --- ИЗМЕНЕНИЯ ЗДЕСЬ ---
            // Проверяем, достаточно ли монет для покупки
            if (spendCoins(item.cost)) {
                // Монет достаточно, покупка совершена

                if (typeof settings[item.key] !== 'number') {
                    console.error(`[Магазин] ОШИБКА: Попытка купить улучшение для несуществующего или нечислового параметра "${item.key}".`);
                    return;
                }

                if (item.isPercentage) {
                    settings[item.key] *= (1 + item.upgradeValue);
                } else {
                    settings[item.key] += item.upgradeValue;
                }

                console.log(`Применено улучшение: "${item.name}". Новое значение: ${settings[item.key].toFixed(2)}`);
                const cardWorldPosition = new THREE.Vector3();
                clickedObject.getWorldPosition(cardWorldPosition);
                triggerParticles(shopParticles, cardWorldPosition);
                playCoinSound();
                shopManager.refreshAndRedraw();
            } else {
                // Монет недостаточно
                console.log("Покупка не удалась. Недостаточно средств.");
                // Здесь можно добавить визуальный эффект, например, покачивание карточки
            }
        }
    }
}

function handleShopHover(event) {
    // 1. Игнорируем, если магазин не виден
    if (!shopManager || !shopManager.isVisible) {
        // Если магазин скрыт, но состояние "наведения" осталось, сбрасываем его
        if (shopManager && shopManager.hoveredSlotIndex !== null) {
            shopManager.updateHover(null);
        }
        return;
    }

    // 2. Используем Raycaster для поиска карточки под курсором
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    hoverRaycaster.setFromCamera(mouse, camera);

    const hudMeshes = shopManager.getHudMeshes();
    const intersects = hoverRaycaster.intersectObjects(hudMeshes);

    // 3. Обновляем состояние в ShopManager
    if (intersects.length > 0) {
        const hoveredObject = intersects[0].object;
        const selectedIndex = hudMeshes.indexOf(hoveredObject);
        shopManager.updateHover(selectedIndex);
    } else {
        // Если пересечений нет, значит курсор не над карточкой
        shopManager.updateHover(null);
    }
}
function handleAugmentHover(event) {
    if (!augmentsManager || !augmentsManager.isVisible || augmentsManager.isChoiceMade) {
        if (augmentsManager && augmentsManager.hoveredSlotIndex !== null) {
            augmentsManager.updateHover(null);
        }
        return;
    }

    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    hoverRaycaster.setFromCamera(mouse, camera);

    const hudMeshes = augmentsManager.getHudMeshes();
    const intersects = hoverRaycaster.intersectObjects(hudMeshes);

    if (intersects.length > 0) {
        const hoveredObject = intersects[0].object;
        const selectedIndex = hudMeshes.indexOf(hoveredObject);
        augmentsManager.updateHover(selectedIndex);
    } else {
        augmentsManager.updateHover(null);
    }
}
function _drawRoundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function formatLargeNumber(num) {
    // Если число меньше 1000, просто возвращаем его без изменений
    if (num < 1000) {
        return Math.floor(num).toString();
    }

    // Суффиксы для степеней тысячи
    const suffixes = ["", "K", "M", "B", "T", "P", "E"]; // K, M, B, T, Quadrillion, Quintillion

    // Определяем, какой суффикс использовать, на основе логарифма
    const tier = Math.floor(Math.log10(Math.abs(num)) / 3);

    // Если число слишком большое, возвращаем его в экспоненциальной форме
    if (tier >= suffixes.length) {
        return num.toExponential(1);
    }

    // Получаем суффикс и вычисляем отмасштабированное значение
    const suffix = suffixes[tier];
    const scale = Math.pow(1000, tier);
    const scaled = num / scale;

    // Возвращаем число с одним знаком после запятой и суффиксом
    // .replace(/\.0$/, '') убирает ".0" для целых чисел (например, "1.0M" станет "1M")
    return scaled.toFixed(1).replace(/\.0$/, '') + suffix;
}
//setTimeout(() => { debug.giveAll(); }, 3000);
function activateAllBonusesForDebug() {
    if (isGamePaused) {
        return "Нельзя использовать на паузе.";
    }
    if (!bonusManager) {
        return "BonusManager еще не инициализирован.";
    }
    console.log('%c[DEBUG] Активация всех бонусов...', 'color: lime; font-weight: bold;');

    addCoins(1);
    playCoinSound();

    // Активируем ВСЕ бонусы через менеджер
    const dummyPosition = playerBody.position.clone();
    bonusManager.activateSuperJump(dummyPosition);
    bonusManager.activateSpeedBoost(dummyPosition);
    bonusManager.activateDaylight(dummyPosition, sky.getTimeOfDay());
    bonusManager.activateXRay(dummyPosition); // <-- ИСПРАВЛЕНИЕ ЗДЕСЬ

    if (chat) {
        chat.addMessage("Все бонусы активированы!");
    }

    return "Все бонусы и 1 монета выданы.";
}
// 2. Создаем объект-API для передачи в конструктор Debug
const gameDebugAPI = {
    activateAllBonuses: activateAllBonusesForDebug
};

// 3. Создаем экземпляр Debug ОДИН РАЗ, передавая ему сцену и наш API
const debug = new Debug(scene, gameDebugAPI);

// 4. Делаем debug глобальным для доступа из консоли
window.debug = debug;

function toggleTerrainHighlight() {
    // 1. При первом ручном переключении отключаем автоматический режим
    if (autoHighlightMode) {
        autoHighlightMode = false;
        console.log("Автоматическая подсветка отключена. Управление теперь ручное.");
    }

    // 2. Остальная логика остается прежней: запускаем анимацию
    highlightState.isActive = !highlightState.isActive;
    highlightState.isTransitioning = true;
    console.log(`Ручное ${highlightState.isActive ? 'включение' : 'выключение'} подсветки...`);
}

// --- ДОБАВИТЬ В game.js ---

function createXRayTexture() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Палитра
    const fillColor = '#00BCD4';      // Яркий циан
    const highlightColor = '#B2EBF2'; // Светлый циан
    const strokeColor = '#006064';    // Темный циан

    const centerX = size / 2;
    const centerY = size / 2;

    // Рисуем обводку
    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Рисуем основную часть
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Рисуем зрачок
    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 5, 0, Math.PI * 2);
    ctx.fill();

    // Блик
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.arc(centerX + 3, centerY - 3, size / 10, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
}