// --- НОВЫЙ КОД ФАЙЛА: daySprite.js ---
import * as THREE from 'three';

/**
 * Создает спрайт солнца, готовый для добавления в сцену.
 * @returns {THREE.Sprite} - Созданный объект спрайта.
 */
export function createSunSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);

    // --- ГЛАВНОЕ ИСПРАВЛЕНИЕ ЗДЕСЬ ---
    // Мы уменьшаем яркость центральной точки с 255 до 245.
    // Это дает bloom-эффекту "пространство для маневра" и предотвращает пересвет.
    gradient.addColorStop(0.4, 'rgba(245, 245, 220, 1)'); // Было: rgba(255, 255, 220, 1)
    // ------------------------------------

    gradient.addColorStop(1.0, 'rgba(255, 165, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,

        // --- РЕКОМЕНДАЦИЯ ---
        // Для источников света AdditiveBlending обычно выглядит лучше.
        // Он будет ярко "добавлять" свой цвет к фону, а не перекрывать его.
        blending: THREE.AdditiveBlending, // Было: THREE.NormalBlending
        // -----------------------

        depthWrite: false,
        transparent: true,
        fog: false
    });

    const sunSprite = new THREE.Sprite(material);
    sunSprite.scale.set(100, 100, 1);
    sunSprite.renderOrder = 0;

    return sunSprite;
}

/**
 * Создает стилизованный "низкополигональный" спрайт луны.
 * @returns {THREE.Sprite} - Созданный объект спрайта.
 */
export function createMoonSprite() {
    // Увеличиваем размер холста, чтобы разместить свечение
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const moonColor = '#E0E0E0';
    const craterColor = '#BDBDBD';

    // --- НОВОЕ: Слой свечения (рисуем его ПЕРВЫМ, чтобы он был сзади) ---
    const glowRadius = 60; // Внешний радиус свечения
    const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
    
    // Бледно-голубое, полупрозрачное свечение в центре
    glowGradient.addColorStop(0.4, 'rgba(220, 220, 255, 0.5)'); 
    // Полностью прозрачное по краям
    glowGradient.addColorStop(1.0, 'rgba(220, 220, 255, 0)');
    
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // --- КОНЕЦ НОВОГО КОДА ---


    // --- Слой самой луны (рисуется ПОВЕРХ свечения) ---
    // Рисуем "граненый" круг для основной формы луны
    const mainRadius = 28;
    const mainVertices = 12;
    ctx.beginPath();
    for (let i = 0; i <= mainVertices; i++) {
        const angle = (i / mainVertices) * Math.PI * 2;
        const radius = mainRadius + (Math.random() - 0.5) * 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.fillStyle = moonColor;
    ctx.fill();

    // Рисуем несколько граненых "кратеров"
    ctx.fillStyle = craterColor;
    drawJaggedPolygon(ctx, centerX - 10, centerY - 8, 7, 6);
    drawJaggedPolygon(ctx, centerX + 12, centerY + 5, 5, 5);
    drawJaggedPolygon(ctx, centerX + 5, centerY + 15, 3, 5);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    const material = new THREE.SpriteMaterial({
        map: texture,
        blending: THREE.NormalBlending,
        depthWrite: false,
        transparent: true,
        fog: false,
        // opacity: 0.9 // <-- Этот параметр больше не нужен, т.к. свечение добавляет прозрачности
    });

    const moonSprite = new THREE.Sprite(material);
    // Немного увеличиваем масштаб, так как текстура стала больше из-за свечения
    moonSprite.scale.set(100, 100, 1); 

    // Устанавливаем более высокий порядок рендеринга, чтобы луна рисовалась поверх солнца
    moonSprite.renderOrder = 1;

    return moonSprite;
}
// Вспомогательная функция для рисования граненых полигонов
function drawJaggedPolygon(ctx, x, y, baseRadius, vertices) {
    ctx.beginPath();
    for (let i = 0; i <= vertices; i++) {
        const angle = (i / vertices) * Math.PI * 2;
        const radius = baseRadius + (Math.random() - 0.5) * 2;
        const polyX = x + radius * Math.cos(angle);
        const polyY = y + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(polyX, polyY);
        } else {
            ctx.lineTo(polyX, polyY);
        }
    }
    ctx.closePath();
    ctx.fill();
}