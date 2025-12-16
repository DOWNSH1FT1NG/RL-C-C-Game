// --- START OF FILE utils.js ---

// Мы не можем импортировать WORLD_SEED сюда, так как это создаст цикл.
// Вместо этого мы передадим его как аргумент.

export function seededRandom(seed1, seed2, worldSeed) {
    let x = Math.sin(seed1 * 12.9898 + seed2 * 78.233 + worldSeed) * 43758.5453;
    return x - Math.floor(x);
}