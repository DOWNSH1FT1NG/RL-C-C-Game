// --- КОНСТАНТЫ ИГРОКА И МИРА ---
export const PLAYER_HEIGHT = 16;
export const MIN_PLAYER_SPEED = 80.0;
export const MAX_PLAYER_SPEED = 140.0;
export const ACCELERATION_TIME = 3.0;
export const DECELERATION_TIME = 1;
export const GRAVITY = 280.0;
export const JUMP_STRENGTH = 110.0;

// --- КОНСТАНТЫ МИРА ---
export const CHUNK_SIZE = 210;
export const CHUNK_SEGMENTS = 16;
export const RENDER_DISTANCE = 20;

// --- КОНСТАНТЫ АНИМАЦИЙ ---
export const LANDING_ANIMATION_DURATION = 0.5;
export const LANDING_ANIMATION_DEPTH = 1;
export const MIN_FALL_SPEED_FOR_ANIMATION = -50;
export const HEAD_BOB_SPEED = 7;
export const HEAD_BOB_DEPTH = 1;
export const NORMAL_FOV = 85;
export const RUNNING_FOV = 110;
export const STRAFE_ROLL_ANGLE = 2;
export const STRAFE_ROLL_SPEED = 10;
export const HEAD_BOB_SMOOTH_SPEED = 20;

// --- КОНСТАНТЫ МОНЕТ ---
export const OBJECT_SPAWN_CHANCE = 0.1;
export const COIN_SCALE = 7;
export const COIN_HOVER_HEIGHT = 6;
export const COIN_HOVER_SPEED = 3.0;
export const COIN_HOVER_RANGE = 2.0;
export const XRAY_DURATION = 5.0; // Длительность эффекта в секундах
export const XRAY_OPACITY = 0.7;

// --- КОНСТАНТЫ БИОМОВ ---
export const BIOME_TRANSITION_DISTANCE = 15;
export const BIOME_BLEND_RANGE = 5;