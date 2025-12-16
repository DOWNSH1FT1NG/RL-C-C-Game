// worker.js - ФИНАЛЬНАЯ ВЕРСИЯ С СЕТКОЙ ДЛЯ ПАТТЕРНОВ

import { createNoise2D } from './simplex-noise.js';
import { settings } from './settings.js';
import { createAlea, seededRandom, lerp } from './utils.js';

let WORLD_SEED = 0;
let terrainNoise = null;
let coinPatterns = [];

// --- НОВЫЙ МЕНЕДЖЕР ПАТТЕРНОВ С ИСПОЛЬЗОВАНИЕМ СЕТКИ ---
const worldPatternManager = {
    getPatternsForChunk(chunkX, chunkZ, seed, getPreciseHeight) {
        if (coinPatterns.length === 0) return [];

        const objectsData = [];
        const CHUNK_SIZE = settings.CHUNK_SIZE;
        const HALF_CHUNK = CHUNK_SIZE / 2;
        const GRID_SIZE = settings.PATTERN_GRID_SIZE || 3;

        // 1. Определяем, в какую "ячейку сетки" попадает наш чанк.
        const gridX = Math.floor(chunkX / GRID_SIZE);
        const gridZ = Math.floor(chunkZ / GRID_SIZE);

        // 2. Принимаем решение о спавне паттерна ОДИН РАЗ для всей ячейки.
        //    Это решение детерминировано и зависит только от координат ячейки.
        const spawnRoll = seededRandom(gridX * 7, gridZ * 13, seed);
        if (spawnRoll > (settings.COIN_PATTERN_SPAWN_CHANCE || 0.5)) {
            return []; // В этой большой ячейке паттерна нет. Выходим.
        }

        // 3. Если паттерн должен быть, генерируем его в МИРОВЫХ координатах.
        //    Центр паттерна будет в случайной точке ВНУТРИ этой ячейки сетки.
        const patternIndex = Math.floor(seededRandom(gridX * 17, gridZ * 19, seed) * coinPatterns.length);
        const pattern = coinPatterns[patternIndex];

        // Случайное смещение внутри ячейки
        const offsetX = (seededRandom(gridX * 23, gridZ * 29, seed) - 0.5) * CHUNK_SIZE * GRID_SIZE;
        const offsetZ = (seededRandom(gridX * 31, gridZ * 37, seed) - 0.5) * CHUNK_SIZE * GRID_SIZE;

        const baseWorldX = (gridX + 0.5) * CHUNK_SIZE * GRID_SIZE + offsetX;
        const baseWorldZ = (gridZ + 0.5) * CHUNK_SIZE * GRID_SIZE + offsetZ;

        const angle = seededRandom(gridX, gridZ, seed) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // 4. Проходим по всем монетам паттерна
        for (const offset of pattern.shape) {
            // Поворачиваем и смещаем, получая МИРОВЫЕ координаты монеты
            const rotatedX = offset.x * cos - offset.z * sin;
            const rotatedZ = offset.x * sin + offset.z * cos;
            const finalWorldX = baseWorldX + rotatedX;
            const finalWorldZ = baseWorldZ + rotatedZ;

            // 5. Конвертируем мировые координаты в ЛОКАЛЬНЫЕ для ТЕКУЩЕГО чанка
            const finalLocalX = finalWorldX - (chunkX * CHUNK_SIZE);
            const finalLocalZ = finalWorldZ - (chunkZ * CHUNK_SIZE);

            // 6. Проверяем, попадает ли монета в границы ТЕКУЩЕГО чанка.
            if (Math.abs(finalLocalX) > HALF_CHUNK || Math.abs(finalLocalZ) > HALF_CHUNK) {
                continue; // Эта монета для другого чанка.
            }

            // Если монета наша, рассчитываем ее высоту и добавляем в результат
            const groundY = getPreciseHeight(finalLocalX, finalLocalZ);
            if (groundY < -500 || groundY > 200) continue;

            const yOffset = offset.y || 0;
            const initialCoinY = groundY + yOffset + (1.5 * settings.COIN_SCALE) + settings.COIN_HOVER_HEIGHT;

            objectsData.push({
                type: 'coin',
                position: { x: finalLocalX, y: initialCoinY, z: finalLocalZ },
                groundY: groundY
            });
        }

        return objectsData;
    }
};

// --- ОБРАБОТЧИК СООБЩЕНИЙ (без изменений) ---
self.onmessage = function (event) {
    const { type, payload } = event.data;
    if (type === 'init') {
        WORLD_SEED = payload.seed;
        coinPatterns = payload.patterns;
        const prng = createAlea(payload.seed);
        terrainNoise = createNoise2D(prng);
        self.postMessage({ type: 'ready' });
    }
    else if (type === 'generateChunk') {
        payload.seed = WORLD_SEED;
        const geometryData = generateChunkGeometry(payload);
        self.postMessage({
            type: 'chunkDataReady',
            payload: {
                chunkX: payload.chunkX,
                chunkZ: payload.chunkZ,
                segments: payload.segments,
                positions: geometryData.positions,
                colors: geometryData.colors,
                objectsData: geometryData.objectsData
            }
        }, [geometryData.positions.buffer, geometryData.colors.buffer]);
    }
};

// --- ФУНКЦИИ-ХЕЛПЕРЫ (без изменений) ---
function getRoadData(worldX, worldZ) { /* ... код без изменений ... */
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
function getTerrainHeightAt(worldX, worldZ) { /* ... код без изменений ... */
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
    if (cyclicDist < GRASSLAND_END) { biomeHeight = hGrass; }
    else if (cyclicDist < GRASS_TO_DESERT_END) { const t = (cyclicDist - GRASSLAND_END) / settings.BIOME_BLEND_RANGE; biomeHeight = lerp(hGrass, hDesert, t); }
    else if (cyclicDist < DESERT_END) { biomeHeight = hDesert; }
    else if (cyclicDist < DESERT_TO_MOUNTAIN_END) { const t = (cyclicDist - DESERT_END) / settings.BIOME_BLEND_RANGE; biomeHeight = lerp(hDesert, hMountain + settings.MOUNTAIN_BASE_HEIGHT, t); }
    else if (cyclicDist < MOUNTAIN_END) { biomeHeight = hMountain + settings.MOUNTAIN_BASE_HEIGHT; }
    else { const t = (cyclicDist - MOUNTAIN_END) / settings.BIOME_BLEND_RANGE; biomeHeight = lerp(hMountain + settings.MOUNTAIN_BASE_HEIGHT, hGrass, t); }
    let finalHeight = biomeHeight;
    const roadData = getRoadData(worldX, worldZ);
    if (roadData.onPavement) { finalHeight = roadData.roadHeight; }
    else if (roadData.onShoulder) { finalHeight = lerp(biomeHeight, roadData.roadHeight, roadData.shoulderBlendFactor); }
    return finalHeight;
}

// --- ОСНОВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ ---
function generateChunkGeometry(chunkData) {
    const { chunkX, chunkZ, segments, seed } = chunkData;
    const vertexCount = (segments + 1) * (segments + 1);
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const objectsData = [];

    const width = settings.CHUNK_SIZE;
    const height = settings.CHUNK_SIZE;
    const widthSegments = segments;
    const heightSegments = segments;
    const width_half = width / 2;
    const height_half = height / 2;
    const gridX1 = widthSegments + 1;
    const gridY1 = heightSegments + 1;
    const segment_width = width / widthSegments;
    const segment_height = height / heightSegments;
    let vertexIndex = 0;

    for (let iy = 0; iy < gridY1; iy++) {
        const localZ = (iy * segment_height) - height_half;
        for (let ix = 0; ix < gridX1; ix++) {
            const localX = (ix * segment_width) - width_half;
            const worldX = chunkX * settings.CHUNK_SIZE + localX;
            const worldZ = chunkZ * settings.CHUNK_SIZE + localZ;
            const colorGrass = { r: 0.576, g: 0.929, b: 0.521 };
            const colorDesert = { r: 1.0, g: 0.874, b: 0.517 };
            const colorMountain = { r: 0.666, g: 0.666, b: 0.666 };
            const colorSnow = { r: 1.0, g: 1.0, b: 1.0 };
            const GRASSLAND_END = settings.BIOME_GRASSLAND_END;
            const GRASS_TO_DESERT_END = GRASSLAND_END + settings.BIOME_BLEND_RANGE;
            const DESERT_END = settings.BIOME_DESERT_END;
            const DESERT_TO_MOUNTAIN_END = DESERT_END + settings.BIOME_BLEND_RANGE;
            const MOUNTAIN_END = DESERT_TO_MOUNTAIN_END + (DESERT_END - GRASS_TO_DESERT_END);
            const MOUNTAIN_TO_GRASS_END = MOUNTAIN_END + settings.BIOME_BLEND_RANGE;
            const totalBiomeCycleLength = MOUNTAIN_TO_GRASS_END;
            const distFromOrigin = Math.sqrt(worldX * worldX + worldZ * worldZ) / settings.CHUNK_SIZE;
            const cyclicDist = distFromOrigin % totalBiomeCycleLength;
            const hGrass = terrainNoise(worldX * settings.BIOMES[0].noiseScale, worldZ * settings.BIOMES[0].noiseScale) * settings.BIOMES[0].noiseAmplitude;
            const hDesert = terrainNoise(worldX * settings.BIOMES[1].noiseScale, worldZ * settings.BIOMES[1].noiseScale) * settings.BIOMES[1].noiseAmplitude;
            const hMountain = terrainNoise(worldX * settings.BIOMES[2].noiseScale, worldZ * settings.BIOMES[2].noiseScale) * settings.BIOMES[2].noiseAmplitude;
            let biomeHeight = 0;
            let biomeColor = { r: 0, g: 0, b: 0 };
            if (cyclicDist < GRASSLAND_END) { biomeHeight = hGrass; Object.assign(biomeColor, colorGrass); }
            else if (cyclicDist < GRASS_TO_DESERT_END) { const t = (cyclicDist - GRASSLAND_END) / settings.BIOME_BLEND_RANGE; biomeHeight = lerp(hGrass, hDesert, t); biomeColor = { r: lerp(colorGrass.r, colorDesert.r, t), g: lerp(colorGrass.g, colorDesert.g, t), b: lerp(colorGrass.b, colorDesert.b, t) }; }
            else if (cyclicDist < DESERT_END) { biomeHeight = hDesert; Object.assign(biomeColor, colorDesert); }
            else if (cyclicDist < DESERT_TO_MOUNTAIN_END) { const t = (cyclicDist - DESERT_END) / settings.BIOME_BLEND_RANGE; biomeHeight = lerp(hDesert, hMountain + settings.MOUNTAIN_BASE_HEIGHT, t); biomeColor = { r: lerp(colorDesert.r, colorMountain.r, t), g: lerp(colorDesert.g, colorMountain.g, t), b: lerp(colorDesert.b, colorMountain.b, t) }; }
            else if (cyclicDist < MOUNTAIN_END) { biomeHeight = hMountain + settings.MOUNTAIN_BASE_HEIGHT; Object.assign(biomeColor, colorMountain); }
            else { const t = (cyclicDist - MOUNTAIN_END) / settings.BIOME_BLEND_RANGE; biomeHeight = lerp(hMountain + settings.MOUNTAIN_BASE_HEIGHT, hGrass, t); biomeColor = { r: lerp(colorMountain.r, colorGrass.r, t), g: lerp(colorMountain.g, colorGrass.g, t), b: lerp(colorMountain.b, colorGrass.b, t) }; }
            let finalHeight = biomeHeight;
            let finalColor = { ...biomeColor };
            const roadData = getRoadData(worldX, worldZ);
            if (roadData.onPavement) { finalHeight = roadData.roadHeight; finalColor = { r: 0.5, g: 0.5, b: 0.5 }; }
            else if (roadData.onShoulder) { finalHeight = lerp(biomeHeight, roadData.roadHeight, roadData.shoulderBlendFactor); const t = roadData.shoulderBlendFactor; finalColor = { r: lerp(biomeColor.r, 0.5, t), g: lerp(biomeColor.g, 0.5, t), b: lerp(biomeColor.b, 0.5, t) }; }
            const cx = Math.floor(worldX / 25), cz = Math.floor(worldZ / 25);
            if (!roadData.onPavement && (cx + cz) % 2 !== 0) { finalColor.r *= 0.9; finalColor.g *= 0.9; finalColor.b *= 0.9; }
            if (finalHeight > settings.MOUNTAIN_SNOW_HEIGHT) { const snowT = Math.min((finalHeight - settings.MOUNTAIN_SNOW_HEIGHT) / (settings.BIOME_BLEND_RANGE * 5), 1.0); finalColor = { r: lerp(finalColor.r, colorSnow.r, snowT), g: lerp(finalColor.g, colorSnow.g, snowT), b: lerp(finalColor.b, colorSnow.b, snowT) }; }
            positions[vertexIndex * 3] = localX;
            positions[vertexIndex * 3 + 1] = finalHeight;
            positions[vertexIndex * 3 + 2] = localZ;
            colors[vertexIndex * 3] = finalColor.r;
            colors[vertexIndex * 3 + 1] = finalColor.g;
            colors[vertexIndex * 3 + 2] = finalColor.b;
            vertexIndex++;
        }
    }

    const getPreciseHeight = (localX, localZ) => {
        const gridX = (localX + width_half) / segment_width;
        const gridZ = (localZ + height_half) / segment_height;
        const x1 = Math.floor(gridX);
        const z1 = Math.floor(gridZ);
        if (x1 < 0 || z1 < 0 || x1 >= widthSegments || z1 >= heightSegments) return 0;
        const q11_idx = (z1 * gridX1 + x1) * 3 + 1;
        const q12_idx = ((z1 + 1) * gridX1 + x1) * 3 + 1;
        const q21_idx = (z1 * gridX1 + (x1 + 1)) * 3 + 1;
        const q22_idx = ((z1 + 1) * gridX1 + (x1 + 1)) * 3 + 1;
        if (q22_idx >= positions.length) return 0;
        const y11 = positions[q11_idx], y12 = positions[q12_idx], y21 = positions[q21_idx], y22 = positions[q22_idx];
        const tx = gridX - x1, tz = gridZ - z1;
        return lerp(lerp(y11, y21, tx), lerp(y12, y22, tx), tz);
    };

    // --- ИСПОЛЬЗУЕМ НОВЫЙ МЕНЕДЖЕР ---
    const coinDataFromPattern = worldPatternManager.getPatternsForChunk(chunkX, chunkZ, seed, getPreciseHeight);
    if (coinDataFromPattern.length > 0) {
        objectsData.push(...coinDataFromPattern);
    }

    // Спавн бонусов (без изменений)
    const bonusTypes = [
        { type: 'powerup', chance: settings.POWERUP_SPAWN_CHANCE, scale: settings.POWERUP_SCALE, seedModX: 11, seedModZ: 12 },
        { type: 'speedup', chance: settings.SPEEDUP_SPAWN_CHANCE, scale: settings.SPEEDUP_SCALE, seedModX: 21, seedModZ: 22 },
        { type: 'sunrise', chance: settings.SUNRISE_SPAWN_CHANCE, scale: settings.SUNRISE_SCALE, seedModX: 31, seedModZ: 32 },
        { type: 'xray', chance: settings.XRAY_SPAWN_CHANCE, scale: settings.XRAY_SCALE, seedModX: 41, seedModZ: 42 },
    ];
    for (const bonus of bonusTypes) {
        const bonusSpawnRoll = seededRandom(chunkX * bonus.seedModX, chunkZ * bonus.seedModZ, seed);
        if (bonusSpawnRoll < bonus.chance) {
            const localX = (seededRandom(chunkX * bonus.seedModX, chunkZ * bonus.seedModX, seed) - 0.5) * settings.CHUNK_SIZE;
            const localZ = (seededRandom(chunkX * bonus.seedModZ, chunkZ * bonus.seedModZ, seed) - 0.5) * settings.CHUNK_SIZE;
            const groundY = getPreciseHeight(localX, localZ);
            if (groundY > -500) {
                const initialY = groundY + bonus.scale / 2 + settings.COIN_HOVER_HEIGHT * 2;
                objectsData.push({ type: bonus.type, position: { x: localX, y: initialY, z: localZ }, groundY: groundY });
                break;
            }
        }
    }

    return { positions, colors, objectsData };
}

self.postMessage({ type: 'worker_ready' });