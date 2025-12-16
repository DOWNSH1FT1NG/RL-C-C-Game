// ShopManager.js

import * as THREE from 'three';

const SHOP_ITEMS = [
    {
        key: 'BUNNYHOP_SPEED_BONUS',
        name: 'Бонус Бхопа',
        upgradeValue: 0.05, // +5%
        cost: 100,
        isPercentage: true,
    },
    {
        key: 'COMBO_DURATION',
        name: 'Время на Комбо',
        upgradeValue: 5,
        cost: 150,
        isPercentage: false,
    },
    {
        key: 'POINTS_PER_COIN',
        name: 'Очки за монету',
        upgradeValue: 5,
        cost: 200,
        isPercentage: false,
    },
    {
        key: 'MAX_PLAYER_SPEED',
        name: 'Скорость Бега',
        upgradeValue: 5,
        cost: 120,
        isPercentage: false,
    },
    {
        key: 'XRAY_RADIUS',
        name: 'Радиус Рентгена',
        upgradeValue: 5,
        cost: 250,
        isPercentage: false,
    },
    {
        key: 'SLIDE_BOOST',
        name: 'Буст Слайда',
        upgradeValue: 5,
        cost: 80,
        isPercentage: false,
    },
    {
        key: 'JUMP_STRENGTH',
        name: 'Сила Прыжка',
        upgradeValue: 5,
        cost: 180,
        isPercentage: false,
    },
    {
        key: 'POINTS_PER_OVERDRIVE',
        name: 'Очки за Overdrive',
        upgradeValue: 5,
        cost: 300,
        isPercentage: false,
    }
];


export class ShopManager {
    constructor(camera, settings) {
        this.camera = camera;
        this.settings = settings;
        this.isVisible = false;

        this.hudMeshes = [];
        this.contexts = [];
        this.textures = [];
        this.slotItems = [];

        this.hoveredSlotIndex = null;

        // --- НОВЫЕ СВОЙСТВА ДЛЯ АНИМАЦИИ ---
        this.isTransitioningIn = false;
        this.isTransitioningOut = false;
        this.transitionProgress = 0;
        this.TRANSITION_SPEED = 4.0;
        this.cardPositions = []; // Хранит начальные, конечные и текущие позиции/масштабы

        this.SLOT_COUNT = 3;
        this.SLOT_WIDTH = 0.42;
        this.SLOT_HEIGHT = 0.57;
        this.SLOT_SPACING = 0.08;
    }

    _drawRoundRect(ctx, x, y, w, h, r) {
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

    _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        const lines = [];

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        const totalHeight = lines.length * lineHeight;
        let currentY = Math.round(y - (totalHeight / 2) + (lineHeight / 2));

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i].trim(), Math.round(x), currentY);
            currentY += lineHeight;
        }
    }

    _shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    initialize() {
        const totalWidth = this.SLOT_COUNT * this.SLOT_WIDTH + (this.SLOT_COUNT - 1) * this.SLOT_SPACING;
        const startX = -totalWidth / 2;

        for (let i = 0; i < this.SLOT_COUNT; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = Math.round(512 * (this.SLOT_HEIGHT / this.SLOT_WIDTH));
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = false;
            this.contexts.push(context);

            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
            this.textures.push(texture);

            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false });
            const geometry = new THREE.PlaneGeometry(this.SLOT_WIDTH, this.SLOT_HEIGHT);
            const mesh = new THREE.Mesh(geometry, material);

            const xPos = startX + i * (this.SLOT_WIDTH + this.SLOT_SPACING) + this.SLOT_WIDTH / 2;

            // --- НОВОЕ: Сохраняем позиции для анимации ---
            const targetY = 0; // Целевая позиция по Y в центре экрана
            const startY = -1.0; // Начальная позиция за пределами экрана (внизу)

            this.cardPositions[i] = {
                start: new THREE.Vector3(xPos, startY, -0.6),
                target: new THREE.Vector3(xPos, targetY, -0.6)
            };
            mesh.position.copy(this.cardPositions[i].start); // Начинаем за экраном
            // --- КОНЕЦ НОВОГО ---

            mesh.visible = false;
            this.hudMeshes.push(mesh);
            this.camera.add(mesh);
        }
    }

    drawSlot(index) {
        const ctx = this.contexts[index];
        const item = this.slotItems[index];
        if (!ctx || !item) return;

        const isHovered = (index === this.hoveredSlotIndex);
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const borderRadius = 40;

        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(20, 20, 40, 0.85)';
        this._drawRoundRect(ctx, 0, 0, width, height, borderRadius);
        ctx.fill();

        if (isHovered) {
            ctx.shadowColor = '#FFF59D';
            ctx.shadowBlur = 30;
            ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
            ctx.lineWidth = 12;
        } else {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(100, 100, 200, 0.9)';
            ctx.lineWidth = 10;
        }
        this._drawRoundRect(ctx, 0, 0, width, height, borderRadius);
        ctx.stroke();
        ctx.shadowColor = 'transparent';

        // ... (остальной код отрисовки текста остаётся без изменений) ...
        ctx.textAlign = 'center';
        const shadowOffset = 3;
        ctx.font = "40px 'Press Start 2P'";
        ctx.fillStyle = 'white';
        const maxWidth = width - 80;
        ctx.shadowColor = "black";
        ctx.shadowOffsetX = shadowOffset;
        ctx.shadowOffsetY = shadowOffset;
        this._drawWrappedText(ctx, item.name, width / 2, 80, maxWidth, 50);
        const currentValue = this.settings[item.key];
        let newValue;
        let upgradeAmountText;
        let displayPrecision = item.isPercentage ? 2 : 0;
        if (item.isPercentage) {
            newValue = currentValue * (1 + item.upgradeValue);
            upgradeAmountText = `+${(item.upgradeValue * 100).toFixed(0)}%`;
        } else {
            newValue = currentValue + item.upgradeValue;
            upgradeAmountText = `+${item.upgradeValue.toFixed(0)}`;
        }
        const currentValueText = currentValue.toFixed(displayPrecision);
        const newValueText = newValue.toFixed(displayPrecision);
        const centerY = Math.round(height / 2);
        ctx.font = "36px 'Press Start 2P'";
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(currentValueText, Math.round(width / 2), centerY - 80);
        ctx.font = "72px 'Press Start 2P'";
        ctx.fillStyle = '#64DD17';
        ctx.fillText(upgradeAmountText, Math.round(width / 2), centerY + 10);
        ctx.font = "42px 'Press Start 2P'";
        ctx.fillStyle = 'white';
        ctx.fillText(newValueText, Math.round(width / 2), centerY + 85);
        ctx.font = "36px 'Press Start 2P'";
        ctx.fillStyle = '#ffc107';
        ctx.fillText(`Цена: ${item.cost}`, Math.round(width / 2), height - 90);
        ctx.shadowColor = 'transparent';

        this.textures[index].needsUpdate = true;
    }

    show() {
        if (this.isVisible) return;
        this.isVisible = true;
        this.isTransitioningIn = true;
        this.isTransitioningOut = false;
        this.transitionProgress = 0;

        const shuffledItems = this._shuffleArray(SHOP_ITEMS);
        this.slotItems = shuffledItems.slice(0, this.SLOT_COUNT);

        for (let i = 0; i < this.SLOT_COUNT; i++) {
            this.drawSlot(i);
            this.hudMeshes[i].visible = true;
        }
    }

    hide() {
        if (!this.isVisible || this.isTransitioningOut) return;
        this.isTransitioningOut = true;
        this.isTransitioningIn = false;
        this.transitionProgress = 0;
        this.updateHover(null);
    }

    updateHover(newIndex) {
        if (this.hoveredSlotIndex !== newIndex) {
            this.hoveredSlotIndex = newIndex;
            this.redrawAllSlots();
        }
    }

    // --- НОВАЯ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ АНИМАЦИЙ ---
    update(delta) {
        if (!this.isVisible && !this.isTransitioningOut) return;

        const easeOutQuint = t => 1 - Math.pow(1 - t, 5);

        // Анимация появления/скрытия
        if (this.isTransitioningIn || this.isTransitioningOut) {
            this.transitionProgress = Math.min(1.0, this.transitionProgress + delta * this.TRANSITION_SPEED);
            const easedProgress = easeOutQuint(this.transitionProgress);

            this.hudMeshes.forEach((mesh, i) => {
                const startPos = this.cardPositions[i].start;
                const targetPos = this.cardPositions[i].target;

                if (this.isTransitioningIn) {
                    mesh.position.lerpVectors(startPos, targetPos, easedProgress);
                } else { // isTransitioningOut
                    mesh.position.lerpVectors(targetPos, startPos, easedProgress);
                }
            });

            if (this.transitionProgress >= 1.0) {
                if (this.isTransitioningOut) {
                    this.isVisible = false;
                    this.hudMeshes.forEach(mesh => { mesh.visible = false; });
                }
                this.isTransitioningIn = false;
                this.isTransitioningOut = false;
            }
        }

        // Анимация наведения
        this.hudMeshes.forEach((mesh, i) => {
            const isHovered = (i === this.hoveredSlotIndex);

            // Целевой масштаб и позиция Y
            const targetScale = isHovered ? 1.08 : 1.0;
            const targetY = this.cardPositions[i].target.y + (isHovered ? 0.05 : 0);

            // Плавная интерполяция
            mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), delta * 10);
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, targetY, delta * 10);
        });
    }

    getHudMeshes() {
        return this.hudMeshes;
    }

    redrawAllSlots() {
        if (!this.isVisible) return;
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            this.drawSlot(i);
        }
    }

    refreshAndRedraw() {
        if (!this.isVisible) return;
        const shuffledItems = this._shuffleArray(SHOP_ITEMS);
        this.slotItems = shuffledItems.slice(0, this.SLOT_COUNT);
        this.redrawAllSlots();
    }
}