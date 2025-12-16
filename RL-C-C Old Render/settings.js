export let settings = {
    TARGET_FPS: 9999,

    GROUND_FRICTION: 8.0,      // Трение на земле. 4-10 - хорошие значения.
    GROUND_ACCELERATE: 9.0,   // Ускорение на земле.
    AIR_ACCELERATE: 3.0,      // Стандартное значение для CS.
    AIR_CONTROL_SPEED: 3.0,
    BUNNYHOP_TIMING_WINDOW: 5, // "Окно" для успешного прыжка в секундах
    BUNNYHOP_SPEED_BONUS: 0.5, // Бонус к скорости за успешный прыжок
    BUNNYHOP_MAX_SPEED: 150.0,

    OVERDRIVE_SPEED_THRESHOLD: 0.94, // % от макс. скорости для активации таймера (0.95 = 95%)
    OVERDRIVE_DURATION: 9.0,         // Сколько секунд нужно держать скорость для получения бонуса
    OVERDRIVE_BONUS_MULTIPLIER: 1.25,  // Множитель бонуса к макс. скорости (1.15 = +15%)```

    MIN_SLIDE_SPEED: 99.0,        // Минимальная скорость для начала слайда.
    SLIDE_BOOST: 12.0,             // Мгновенный бонус к скорости при нач   але слайда.
    SLIDE_FRICTION: 0.519,          // Небольшое трение во время слайда. Поставьте 0 для "ледяного" скольжения. Облегчение в минус на шаг 0.01
    SLIDE_FRICTION_UPHILL_MULTIPLIER: 0.1, // Почти убираем трение при подъеме, чтобы работала инерция. Облегчение в минус на шаг 0.1
    SLIDE_DOWNHILL_FORCE: 350.0,   // Сила, с которой склон ускоряет вас вниз.
    SLIDE_UPHILL_DAMPEN: 550.0,    // Сила, с которой склон замедляет вас вверх.
    SLIDE_JUMP_SPEED_BONUS: 10.0,  // Адекватный бонус к скорости за прыжок из слайда.
    SLIDE_SLOPE_INFLUENCE: 1.56,    // Глобальный множитель влияния уклонов. РЕАЛИЗМ в ПЛЮС на шаг 0.01 ИЛИ 0.1
                                    //SLIDE_SLOPE_INFLUENCE = 1.0: Поведение по умолчанию (как сейчас).
                                    //SLIDE_SLOPE_INFLUENCE > 1.0: Усиливает эффект от склонов.Скольжение вниз будет давать больше скорости, а скольжение вверх — сильнее тормозить.
                                    //SLIDE_SLOPE_INFLUENCE < 1.0: Ослабляет эффект.Скольжение станет более "плоским", меньше зависящим от рельефа.
                                    //SLIDE_SLOPE_INFLUENCE = 0.0: Полностью отключает влияние рельефа.Скольжение будет просто медленно затухать под действием трения.

    // --- RAMP JUMP SETTINGS ---
    RAMP_JUMP_MIN_SPEED: 155,       // Минимальная скорость для выполнения прыжка с трамплина
    RAMP_JUMP_MIN_SLOPE_Y: 0.96,    // Максимальное значение Y для нормали склона (1.0 = плоскость, 0.8 = ~36 градусов). Чем меньше, тем круче должен быть склон.
    RAMP_JUMP_VERTICAL_BOOST: 85,  // Базовый вертикальный импульс при прыжке с трамплина
    RAMP_JUMP_FORWARD_BOOST: 40,   // Дополнительный горизонтальный импульс
    //RAMP_JUMP_FORWARD_MULTIPLIER: 1.3,
    RAMP_JUMP_FORWARD_MULTIPLIER: 1.3,

    // --- VOLUME
    MASTER_VOLUME: 0.5,
    SLIDE_VOLUME: 0.8,
    FOOTSTEP_VOLUME: 0.01,
    COIN_VOLUME: 0.05,

    // --- ПАРАМЕТРЫ ИГРОКА И МИРА ---
    PLAYER_HEIGHT: 16,
    MIN_PLAYER_SPEED: 85.0,
    MAX_PLAYER_SPEED: 115.0,
    GRAVITY: 280.0,
    JUMP_STRENGTH: 110.0,
    MAX_FALL_SPEED: 250, // new
    STEP_INTERVAL_BASE: 31,

    SLIDE_HEIGHT: 6.0,
    SLIDE_FOV: 115.0,
    SLIDE_SMOOTH_SPEED: 15.0,


    // --- ПАРАМЕТРЫ МИРА ---
    CHUNK_SIZE: 128, //CHUNK_SIZE: 210,
    CHUNK_SEGMENTS: 16,
    RENDER_DISTANCE: 14,
    FOG_DISTANCE: 6,
    AUGMENT_RENDER_DISTANCE: 7,
    AUGMENT_FOG_DISTANCE: 6,
    SUNRISE_RENDER_DISTANCE: 20,
    BONUS_VISIBILITY_RADIUS: 20,

    // --- ПАРАМЕТРЫ АНИМАЦИЙ ---
    LANDING_ANIMATION_DURATION: 0.5,
    LANDING_ANIMATION_DEPTH: 1,
    MIN_FALL_SPEED_FOR_ANIMATION: -50,
    HEAD_BOB_SPEED: 7,
    HEAD_BOB_DEPTH: 1,
    FOV_NORMAL: 95,
    FOV_RUNNING: 97,
    FOV_BUNNYHOP_MID: 99,
    FOV_BUNNYHOP_MAX: 101,
    FOV_SLIDING: 110,
    FOV_SMOOTH_SPEED: 6,
    FOV_BOOST: 2,
    AUGMENT_FOV_TRANSITION_DURATION: 0, // <--- ДОБАВЬТЕ ЭТУ СТРОКУ (чуть увеличим для плавности)
    STRAFE_ROLL_ANGLE: 1,
    STRAFE_ROLL_SPEED: 8,

    PARTICLE_OPACITY: 0.55,
    PARTICLE_APPEAR_DELAY: 0.08, // Задержка появления частиц в секундах
    POWERUP_SPAWN_CHANCE: 0.020,

    // --- ПАРАМЕТРЫ МОНЕТ ---
    COIN_PATTERN_SPAWN_CHANCE: 1.0, // Шанс, что вместо одиночной монеты заспавнится паттерн (0.4 = 40%)
    OBJECT_SPAWN_CHANCE: 0.020,
    COIN_SCALE: 6,
    COIN_HOVER_HEIGHT: 6,
    COIN_HOVER_SPEED: 3.0,
    COIN_HOVER_RANGE: 2.0,
    COIN_PICKUP_RADIUS: 40,
    // 0.002 = +0.2% шанса за чанк.
    COIN_LUCK_PROTECTION_BONUS: 0.1,
    // Максимальный шанс спавна монеты, чтобы избежать 100% гарантии.    // 0.50 = 50% максимальный шанс.
    COIN_MAX_SPAWN_CHANCE: 0.95,    
    // Минимальное расстояние между паттернами, выраженное в количестве чанков.// 4.5 означает, что между центрами двух паттернов будет минимум 4.5 размера чанка.
    COIN_PATTERN_MIN_DISTANCE_IN_CHUNKS: 4.0,

    POWERUP_SPAWN_CHANCE: 0.05, // Шанс появления 8%
    POWERUP_SUPER_JUMP_STRENGTH: 200.0, // Сила супер-прыжка
    POWERUP_SUPER_JUMP_DURATION: 3.0, // Длительность эффекта в секундах
    POWERUP_SCALE: 20.0, // Размер спрайта
    POWERUP_PICKUP_RADIUS: 40.0,
    POWERUP_SCORE_MULTIPLIER: 2,

    SPEEDUP_SPAWN_CHANCE: 0.05,
    SPEEDUP_BOOST_AMOUNT: 150.0, // На сколько увеличится макс. скорость
    SPEEDUP_DURATION: 4.5,     // Длительность эффекта
    SPEEDUP_SCALE: 20.0,         // Размер спрайта (такой же, как у звезды)
    SPEEDUP_PICKUP_RADIUS: 40.0,
    SPEEDUP_SCORE_MULTIPLIER: 2,
    SPEEDUP_BUNNYHOP_BONUS_ADD: 55.0,     // На сколько увеличится BUNNYHOP_SPEED_BONUS
    SPEEDUP_MAX_SPEED_ADD: 65.0,       // На сколько увеличится BUNNYHOP_MAX_SPEED
    SPEEDUP_FADEOUT_DURATION: 3.0,

    SUNRISE_SPAWN_CHANCE: 0.005,
    SUNRISE_SCALE: 20,           // Размер спрайта
    SUNRISE_PICKUP_RADIUS: 40.0, // Дистанция для подбора
    SUNRISE_SCORE_MULTIPLIER: 5,

    XRAY_SPAWN_CHANCE: 0.05,
    XRAY_SCALE: 20.0,                   // Размер иконки X-Ray в мире
    XRAY_PICKUP_RADIUS: 40.0,            // Дистанция, с которой можно подобрать бонус
    XRAY_SCORE_MULTIPLIER: 1.0,         // Множитель очков при подборе
    XRAY_RADIUS: 1500.0,    
    XRAY_DURATION: 2.5, // Длительность эффекта в секундах
    XRAY_OPACITY: 0.7,  // Прозрачность в режиме "X-Ray"

    GLOBAL_BONUS_SPAWN_COOLDOWN: 1,
    BONUS_SPAWN_COOLDOWN: 3,
    MAX_SPAWN_CHANCE: 0.95, // Снизим, чтобы добавить немного случайности
    BAD_LUCK_PROTECTION_BONUS: 0.05, // Ускорим накопление шанса

    DAYLIGHT_EFFECT_DURATION: 8, // Длительность "дневного эффекта" в секундах
    DAY_TRANSITION_DURATION: 3,
    AUGMENT_TRANSITION_DURATION: 1,

    COMBO_DURATION: 3, // Сколько секунд длится таймер комбо
    POINTS_PER_COIN: 1000,        // Сколько очков дается за одну монету в комбо
    POINTS_PER_OVERDRIVE: 500, // <--- ДОБАВЬТЕ ЭТУ СТРОКУ
    POINTS_PER_RAMPJUMP: 1000,  // <--- И ЭТУ СТРОКУ

    // --- НАСТРОЙКИ СИСТЕМЫ УРОВНЕЙ (LEVEL SCORE) ---
    // Сколько очков нужно для первого "левел-апа"
    LEVEL_SCORE_FOR_NEW_AUGMENTS: 50000,

    // Множитель, на который увеличивается требуемое количество очков с каждым новым уровнем.
    // 1.0 = не увеличивается, 1.5 = +50% за уровень.
    LEVEL_SCORE_INCREASE_PER_LEVEL: 1.6, //3.5

    // Сбрасывать ли счетчик уровня до 0 после получения нового слота?
    // true = да, сбрасывать (с сохранением "излишка" очков)
    // false = нет, счетчик продолжает накапливаться
    LEVEL_SCORE_RESETS_ON_LEVEL_UP: true,
    HIGH_SCORE_FLASH_DURATION: 2.0,

    // --- ПАРАМЕТРЫ БИОМОВ ---
    BIOME_BLEND_RANGE: 2, // Ширина зоны смешивания между биомами
    // Границы биомов (расстояние в чанках от центра)
    BIOME_GRASSLAND_END: 7,
    BIOME_DESERT_END: 23,
    // Порог высоты для появления снега на горах
    MOUNTAIN_SNOW_HEIGHT: 435,
    MOUNTAIN_BASE_HEIGHT: 350,

    BIOMES: [
        {
            name: 'Grassland',
            noiseScale: 0.003,      // Масштаб шума (чем меньше, тем более гладкие холмы)
            noiseAmplitude: 17,     // Высота холмов (амплитуда)
            color: 0x3C7F4C         // Базовый цвет (зеленый)
        },
        {
            name: 'Desert',
            noiseScale: 0.002,      // Очень маленький масштаб для широких, пологих дюн
            noiseAmplitude: 75,     // Дюны выше, чем холмы на равнинах
            color: 0xC2B280         // Песочный цвет
        },
        {
            name: 'Mountain',
            noiseScale: 0.003,      // Большой масштаб для частых, острых пиков
            noiseAmplitude: 350,    // Очень высокая амплитуда для гор
            color: 0x708090         // Базовый цвет скал (грифельный)
        }
    ],

};