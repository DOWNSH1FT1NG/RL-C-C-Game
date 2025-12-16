// Файл: Augments.js

import * as THREE from 'three';

const AUGMENT_PRESETS = [
    // --- ПРЕСЕТ 1 ---
    {
        name: 'Адреналин',
        tags: '+СКОРОСТЬ, -ШАНСЫ',
        icon: 'speed',
        positiveCount: 7,
        positivePool: [
            { key: 'BUNNYHOP_SPEED_BONUS', name: 'Бонус Бхопа', precision: 1, direction: 1 },
            { key: 'SLIDE_BOOST', name: 'Буст слайда', precision: 0, direction: 1 },
            { key: 'MAX_PLAYER_SPEED', name: 'Скорость бега', precision: 0, direction: 1 },
            { key: 'BUNNYHOP_MAX_SPEED', name: 'Потолок скорости', precision: 0, direction: 1 },
            { key: 'SLIDE_JUMP_SPEED_BONUS', name: 'Бонус прыжка-слайда', precision: 0, direction: 1 },
            { key: 'RAMP_JUMP_FORWARD_BOOST', name: 'Рывок с рампы', precision: 0, direction: 1 },
            { key: 'AIR_ACCELERATE', name: 'Контроль в воздухе', precision: 1, direction: 1, absoluteDecrement: 1 },
            { key: 'AIR_CONTROL_SPEED', name: 'Скорость в воздухе', precision: 1, direction: 1, absoluteDecrement: 0.5 },
            { key: 'SPEEDUP_SPAWN_CHANCE', name: 'Шанс появ. ускорений', precision: 3, direction: 1, power: { min: 0.3, max: 0.35 } },
        ],
        negativeCount: 2,
        negativePool: [
            { key: 'POWERUP_SPAWN_CHANCE', name: 'Шанс появ. супер-прыжка', precision: 3, absoluteDecrement: 0.004 },
            { key: 'SUNRISE_SPAWN_CHANCE', name: 'Шанс появ. рассвета', precision: 3, absoluteDecrement: 0.004 },
            { key: 'OBJECT_SPAWN_CHANCE', name: 'Шанс появ. монет', precision: 3, absoluteDecrement: 0.004 },
        ]
    },
    // --- ПРЕСЕТ 2 ---
    {
        name: 'Слайд-мастер',
        tags: '+СЛАЙД, -БХОП',
        icon: 'slide',
        positiveCount: 5,
        positivePool: [
            { key: 'SLIDE_BOOST', name: 'Буст слайда', precision: 1, direction: 1 },
            { key: 'SLIDE_FRICTION', name: 'Трение при слайде', precision: 2, direction: -1 },
            { key: 'SLIDE_DOWNHILL_FORCE', name: 'Сила спуска', precision: 0, direction: 1 },
            { key: 'SLIDE_JUMP_SPEED_BONUS', name: 'Бонус прыжка-слайда', precision: 0, direction: 1 },
            { key: 'SLIDE_SLOPE_INFLUENCE', name: 'Влияние склонов', precision: 3, direction: -1, power: { min: 0.05, max: 0.07 } },
            { key: 'MIN_SLIDE_SPEED', name: 'Мин. скорость слайда', precision: 0, direction: -1 },
        ],
        negativeCount: 1,
        negativePool: [
            { key: 'MAX_PLAYER_SPEED', name: 'Скорость бега', precision: 0, direction: -1, power: { min: 0.05, max: 0.07 } },
            { key: 'BUNNYHOP_MAX_SPEED', name: 'Потолок бхопа', precision: 0, direction: -1, power: { min: 0.05, max: 0.07 } },
        ]
    },
    // --- ПРЕСЕТ 3 ---
    {
        name: 'Катапульта',
        tags: '+ПОЛЕТ, -ЗЕМЛЯ',
        icon: 'jump',
        positiveCount: 2,
        positivePool: [
            { key: 'RAMP_JUMP_VERTICAL_BOOST', name: 'Вертикаль с рампы', precision: 0, direction: 1, power: { min: 0.50, max: 0.75 } },
            { key: 'RAMP_JUMP_FORWARD_BOOST', name: 'Горизонталь с рампы', precision: 0, direction: 1, power: { min: 0.50, max: 0.75 } },
        ],
        negativeCount: 2,
        negativePool: [
            { key: 'BUNNYHOP_SPEED_BONUS', name: 'Бонус Бхопа', precision: 1, direction: -1, power: { min: 0.05, max: 0.05 } },
            { key: 'BUNNYHOP_MAX_SPEED', name: 'Потолок бхопа', precision: 0, direction: -1, power: { min: 0.05, max: 0.05 } },
            { key: 'GROUND_ACCELERATE', name: 'Ускорение на земле', precision: 1, direction: -1, power: { min: 0.05, max: 0.05 } },
        ]
    },
    // --- ПРЕСЕТ 4 ---
    {
        name: 'Спринтер',
        tags: '+БХОП, -КОМБО',
        icon: 'speed',
        positiveCount: 3,
        positivePool: [
            { key: 'BUNNYHOP_MAX_SPEED', name: 'Потолок скорости', precision: 0, direction: 1, power: { min: 0.20, max: 0.35 } },
            { key: 'BUNNYHOP_SPEED_BONUS', name: 'Бонус Бхопа', precision: 1, direction: 1, power: { min: 0.20, max: 0.35 } },
            { key: 'AIR_ACCELERATE', name: 'Контроль в воздухе', precision: 1, direction: 1, power: { min: 0.60, max: 0.80 } },
            { key: 'AIR_CONTROL_SPEED', name: 'Скорость в воздухе', precision: 1, direction: 1, power: { min: 0.50, max: 0.70 } },
            { key: 'GROUND_FRICTION', name: 'Трение на земле', precision: 1, direction: -1 },
        ],
        negativeCount: 1,
        negativePool: [
            { key: 'COMBO_DURATION', name: 'Время на комбо', precision: 1, direction: -1, power: { min: 0.05, max: 0.07 } },
        ]
    },
    // --- ПРЕСЕТ 5 ---
    {
        name: 'Комбо-Монстр',
        tags: '+КОМБО, -СКОРОСТЬ',
        icon: 'jump',
        positiveCount: 3,
        positivePool: [
            { key: 'COMBO_DURATION', name: 'Время на комбо', precision: 1, direction: 1, power: { min: 0.25, max: 0.40 } },
            { key: 'POINTS_PER_COIN', name: 'Очки за монету', precision: 0, direction: 1, power: { min: 0.40, max: 0.60 } },
            { key: 'XRAY_RADIUS', name: 'Радиус рентгена', precision: 0, direction: 1, power: { min: 0.20, max: 0.30 } },
            { key: 'POWERUP_SPAWN_CHANCE', name: 'Шанс появ. супер-прыжка', precision: 3, absoluteDecrement: 0.004 },
            { key: 'SUNRISE_SPAWN_CHANCE', name: 'Шанс появ. рассвета', precision: 3, absoluteDecrement: 0.004 },
        ],
        negativeCount: 2,
        negativePool: [
            { key: 'MAX_PLAYER_SPEED', name: 'Скорость бега', precision: 0, direction: -1, power: { min: 0.05, max: 0.07 } },
            { key: 'BUNNYHOP_MAX_SPEED', name: 'Потолок скорости', precision: 0, direction: -1, power: { min: 0.05, max: 0.07 } },
        ]
    },
    // --- ПРЕСЕТ 6 ---
    {
        name: 'За бонусами',
        tags: '+БОНУСЫ, -ШАНСЫ',
        icon: 'jump',
        positiveCount: 3,
        positivePool: [
            { key: 'POWERUP_SCORE_MULTIPLIER', name: 'Множитель прыжка', precision: 1, direction: 1 },
            { key: 'SPEEDUP_SCORE_MULTIPLIER', name: 'Множитель ускорения', precision: 1, direction: 1 },
            { key: 'POWERUP_SUPER_JUMP_DURATION', name: 'Время супер-прыжка', precision: 0, direction: 1 },
            { key: 'SPEEDUP_DURATION', name: 'Время ускорения', precision: 0, direction: 1 },
            { key: 'DAYLIGHT_EFFECT_DURATION', name: 'Время рассвета', precision: 0, direction: 1 },
        ],
        negativeCount: 1,
        negativePool: [
            { key: 'POWERUP_SPAWN_CHANCE', name: 'Шанс появ. супер-прыжка', precision: 3, absoluteDecrement: 0.007 },
            { key: 'SPEEDUP_SPAWN_CHANCE', name: 'Шанс появ. ускорения', precision: 3, absoluteDecrement: 0.007 },
            { key: 'COMBO_DURATION', name: 'Время на комбо', precision: 1, direction: -1, power: { min: 0.05, max: 0.07 } },
        ]
    },
    // --- ПРЕСЕТ 7 ---
    {
        name: 'Магнит',
        tags: '+МОНЕТЫ, -ОЧКИ',
        icon: 'slide',
        positiveCount: 3,
        positivePool: [
            { key: 'OBJECT_SPAWN_CHANCE', name: 'Шанс появ. монет', precision: 2, direction: 1, power: { min: 0.20, max: 0.35 } },
            { key: 'XRAY_DURATION', name: 'Время рентгена', precision: 0, direction: 1, power: { min: 0.30, max: 0.50 } },
            { key: 'XRAY_RADIUS', name: 'Радиус рентгена', precision: 0, direction: 1 },
        ],
        negativeCount: 1,
        negativePool: [
            { key: 'POINTS_PER_COIN', name: 'Очки за монету', precision: 0, direction: -1, power: { min: 0.05, max: 0.07 } },
        ]
    }
]

export class AugmentsManager {
    constructor(THREE, camera, settings) {
        this.THREE = THREE;
        this.camera = camera;
        this.settings = settings;

        this.isChoiceMade = false;
        this.selectedIndex = -1;
        this.isVisible = false;
        this.hoveredSlotIndex = null;

        this.currentAugments = [];
        this.hudGroup = null;
        this.huds = [];

        this.cardStates = [];
        this.isTransitioningIn = false;
        this.isTransitioningOut = false;
        this.transitionProgress = 0;
        this.TRANSITION_SPEED = 3.5;
    }

    initialize() {
        this.createHud();
    }

    forceInitialDraw() { }

    getHudMeshes() {
        return this.huds.map(hud => hud.mesh);
    }

    handleMouseWheel(slotIndex, deltaY) {
        if (this.isChoiceMade || !this.huds[slotIndex]) return;
        const hud = this.huds[slotIndex];
        const scrollSpeed = 15;
        hud.scrollY += deltaY * scrollSpeed;
        hud.scrollY = Math.max(0, Math.min(hud.scrollY, hud.maxScrollY));
        this.updateHudUI();
    }

    update(delta) {
        if (!this.isVisible) return;

        const easeOutQuint = t => 1 - Math.pow(1 - t, 5);

        if (this.isTransitioningIn || this.isTransitioningOut) {
            this.transitionProgress = Math.min(1.0, this.transitionProgress + delta * this.TRANSITION_SPEED);
            const easedProgress = easeOutQuint(this.transitionProgress);

            this.huds.forEach((hud, i) => {
                const state = this.cardStates[i];
                if (this.isTransitioningIn) {
                    hud.mesh.position.lerpVectors(state.startPos, state.targetPos, easedProgress);
                } else {
                    if (i === this.selectedIndex) {
                        hud.mesh.position.lerpVectors(state.targetPos, state.finalSelectPos, easedProgress);
                        hud.mesh.scale.lerpVectors(new THREE.Vector3(1, 1, 1), state.finalSelectScale, easedProgress);
                    } else {
                        hud.mesh.position.lerpVectors(state.targetPos, state.startPos, easedProgress);
                        hud.mesh.scale.lerp(new THREE.Vector3(0, 0, 0), easedProgress);
                    }
                }
            });

            if (this.transitionProgress >= 1.0) {
                if (this.isTransitioningOut) {
                    this.hudGroup.visible = false;
                    this.isVisible = false;
                }
                this.isTransitioningIn = false;
                this.isTransitioningOut = false;
            }
        }

        if (!this.isTransitioningOut) {
            this.huds.forEach((hud, i) => {
                const isHovered = (i === this.hoveredSlotIndex);
                const targetScale = isHovered ? 1.05 : 1.0;
                const targetZ = this.cardStates[i].targetPos.z + (isHovered ? 0.05 : 0);

                hud.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), delta * 10);
                hud.mesh.position.z = THREE.MathUtils.lerp(hud.mesh.position.z, targetZ, delta * 10);
            });
        }
    }

    updateHover(newIndex) {
        if (this.isChoiceMade) return;
        if (this.hoveredSlotIndex !== newIndex) {
            this.hoveredSlotIndex = newIndex;
        }
    }

    createHud() {
        this.hudGroup = new THREE.Group();
        const canvasWidth = 812;
        const canvasHeight = 1250;
        const aspectRatio = canvasWidth / canvasHeight;
        const planeHeight = 1;
        const planeWidth = planeHeight * aspectRatio;
        const gap = 0.08;

        for (let i = 0; i < 3; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const context = canvas.getContext('2d');
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false });
            const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const mesh = new THREE.Mesh(geometry, material);

            this.hudGroup.add(mesh);

            this.huds.push({ mesh, context, texture, scrollY: 0, maxScrollY: 0 });

            const xPos = (i - 1) * (planeWidth + gap);
            this.cardStates[i] = {
                startPos: new THREE.Vector3(xPos, 1.2, -0.8),
                targetPos: new THREE.Vector3(xPos, 0, -0.8),
                finalSelectPos: new THREE.Vector3(xPos, 0, -0.7),
                finalSelectScale: new THREE.Vector3(1.1, 1.1, 1.1)
            };
            mesh.position.copy(this.cardStates[i].startPos);
        }

        this.camera.add(this.hudGroup);
    }

    generateCandidates() {
        const presetPool = [...AUGMENT_PRESETS];
        this.currentAugments = [];
        for (let i = presetPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [presetPool[i], presetPool[j]] = [presetPool[j], presetPool[i]];
        }
        const selectedPresets = presetPool.slice(0, 3);
        const defaultRange = { min: 0.05, max: 0.20 };
        const step = 0.01;
        for (const preset of selectedPresets) {
            const calculatedModifiers = [];
            if (preset.positivePool && preset.positiveCount > 0) {
                const positivePool = [...preset.positivePool];
                for (let i = positivePool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [positivePool[i], positivePool[j]] = [positivePool[j], positivePool[i]];
                }
                const chosenPositive = positivePool.slice(0, preset.positiveCount);
                for (const modifier of chosenPositive) {
                    const originalValue = this.settings[modifier.key];
                    if (originalValue === undefined) {
                        console.warn(`AugmentsManager: Key "${modifier.key}" not found in settings for preset "${preset.name}". Skipping modifier.`);
                        continue;
                    }
                    const currentRange = modifier.power ? modifier.power : defaultRange;
                    const range = currentRange.max - currentRange.min;
                    const numberOfSteps = Math.round(range / step);
                    const randomStep = Math.floor(Math.random() * (numberOfSteps + 1));
                    const percentageChange = currentRange.min + randomStep * step;
                    const finalValueMultiplier = 1 + (percentageChange * (modifier.direction || 1));
                    const finalValue = parseFloat((originalValue * finalValueMultiplier).toFixed(modifier.precision));
                    calculatedModifiers.push({ ...modifier, value: finalValue, originalValue: originalValue, isPositive: true });
                }
            }
            if (preset.negativePool && preset.negativeCount > 0) {
                const negativePool = [...preset.negativePool];
                for (let i = negativePool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [negativePool[i], negativePool[j]] = [negativePool[j], negativePool[i]];
                }
                const chosenNegative = negativePool.slice(0, preset.negativeCount);
                for (const modifier of chosenNegative) {
                    const originalValue = this.settings[modifier.key];
                    let finalValue;
                    if (originalValue === undefined && modifier.absoluteDecrement === undefined && modifier.forceAbsoluteValue === undefined) {
                        console.warn(`AugmentsManager: Key "${modifier.key}" not found in settings for preset "${preset.name}". Skipping modifier.`);
                        continue;
                    }
                    if (modifier.absoluteDecrement !== undefined) {
                        const decrementedValue = originalValue - modifier.absoluteDecrement;
                        finalValue = parseFloat(Math.max(0, decrementedValue).toFixed(modifier.precision));
                    } else if (modifier.forceAbsoluteValue !== undefined) {
                        finalValue = modifier.forceAbsoluteValue;
                    } else {
                        const currentRange = modifier.power ? modifier.power : defaultRange;
                        const range = currentRange.max - currentRange.min;
                        const numberOfSteps = Math.round(range / step);
                        const randomStep = Math.floor(Math.random() * (numberOfSteps + 1));
                        const percentageChange = currentRange.min + randomStep * step;
                        const finalValueMultiplier = 1 + (percentageChange * (modifier.direction || -1));
                        finalValue = parseFloat((originalValue * finalValueMultiplier).toFixed(modifier.precision));
                    }
                    calculatedModifiers.push({ ...modifier, value: finalValue, originalValue: originalValue, isPositive: false });
                }
            }
            this.currentAugments.push({ ...preset, calculatedModifiers });
        }
    }

    selectAugment(index) {
        if (this.isChoiceMade || !this.currentAugments[index]) return;
        this.isChoiceMade = true;
        this.selectedIndex = index;
        this.isTransitioningOut = true;
        this.isTransitioningIn = false;
        this.transitionProgress = 0;
        const chosenAugment = this.currentAugments[index];
        console.group(`%cAUGMENT CHOSEN: ${chosenAugment.name}`, 'color: #00ff00; font-weight: bold;');
        for (const mod of chosenAugment.calculatedModifiers) {
            let delta = 0;
            if (mod.absoluteDecrement !== undefined) {
                delta = -mod.absoluteDecrement;
            } else {
                delta = mod.value - mod.originalValue;
            }
            const oldValue = this.settings[mod.key];
            this.settings[mod.key] += delta;
            this.settings[mod.key] = parseFloat(this.settings[mod.key].toFixed(mod.precision || 2));
            console.log(`- ${mod.name} (${mod.key}): ${oldValue.toFixed(2)} -> ${this.settings[mod.key].toFixed(2)} (Change: ${delta.toFixed(2)})`);
        }
        console.groupEnd();
    }

    updateHudUI() {
        for (let i = 0; i < 3; i++) {
            const hud = this.huds[i];
            if (!hud) continue;
            const { context, texture, scrollY } = hud;
            const width = context.canvas.width;
            const height = context.canvas.height;
            context.clearRect(0, 0, width, height);
            const augment = this.currentAugments[i];
            if (!augment) continue;
            context.fillStyle = 'rgba(0, 0, 0, 1)';
            context.fillRect(10, 10, width - 20, height - 20);
            context.strokeStyle = '#ffc107';
            context.lineWidth = 8;
            context.strokeRect(10, 10, width - 20, height - 20);
            this.drawIconPlaceholder(context, augment.icon, width / 2, 120);
            context.font = "52px 'Press Start 2P'";
            context.textAlign = 'center';
            this.drawTextWithShadow(context, augment.name, width / 2, 280, '#ffffff');
            const listStartY = 360;
            const listHeight = height - listStartY - 20;
            context.save();
            context.beginPath();
            context.rect(0, listStartY, width, listHeight);
            context.clip();
            context.translate(0, -scrollY);
            let currentY = listStartY;
            const nameFontSize = 34;
            const valueFontSize = 34;
            const headerFontSize = 42;
            const blockSpacing = 120;
            const lineSpacing = 48;
            const headerSpacing = 60;
            context.textBaseline = 'top';
            const tags = augment.tags ? augment.tags.split(',').map(t => t.trim()) : [];
            const positiveTag = tags.find(t => t.startsWith('+')) || '+ УЛУЧШЕНИЯ';
            const negativeTag = tags.find(t => t.startsWith('-')) || '- ОСЛАБЛЕНИЯ';
            const positiveModifiers = augment.calculatedModifiers.filter(m => m.isPositive);
            const negativeModifiers = augment.calculatedModifiers.filter(m => !m.isPositive);
            if (positiveModifiers.length > 0) {
                context.font = `${headerFontSize}px 'Press Start 2P'`;
                context.textAlign = 'center';
                this.drawTextWithShadow(context, positiveTag, width / 2, currentY, '#00ff00');
                currentY += headerSpacing;
            }
            for (const mod of positiveModifiers) {
                this.drawModifierBlock(context, mod, currentY, nameFontSize, valueFontSize, lineSpacing);
                currentY += blockSpacing;
            }
            if (negativeModifiers.length > 0) {
                if (positiveModifiers.length > 0) currentY += blockSpacing / 3;
                context.font = `${headerFontSize}px 'Press Start 2P'`;
                context.textAlign = 'center';
                this.drawTextWithShadow(context, negativeTag, width / 2, currentY, '#ff6565');
                currentY += headerSpacing;
            }
            for (const mod of negativeModifiers) {
                this.drawModifierBlock(context, mod, currentY, nameFontSize, valueFontSize, lineSpacing);
                currentY += blockSpacing;
            }
            const contentHeight = currentY - listStartY;
            hud.maxScrollY = Math.max(0, contentHeight - listHeight);
            context.restore();
            if (hud.maxScrollY > 0) {
                const scrollbarWidth = 10;
                const scrollbarX = width - scrollbarWidth - 25;
                const trackHeight = listHeight;
                context.fillStyle = 'rgba(255, 255, 255, 0.1)';
                context.fillRect(scrollbarX, listStartY, scrollbarWidth, trackHeight);
                const thumbHeight = Math.max(30, trackHeight * (trackHeight / contentHeight));
                const thumbY = listStartY + (hud.scrollY / hud.maxScrollY) * (trackHeight - thumbHeight);
                context.fillStyle = 'rgba(255, 255, 255, 0.4)';
                context.fillRect(scrollbarX, thumbY, scrollbarWidth, thumbHeight);
            }
            texture.needsUpdate = true;
        }
    }

    drawModifierBlock(context, mod, y, nameSize, valueSize, lineSpacing) {
        const width = context.canvas.width;
        context.font = `38px 'Press Start 2P'`;
        context.textAlign = 'center';
        this.drawTextWithShadow(context, mod.name, width / 2, y, '#ababab');
        const valueY = y + lineSpacing;
        context.font = `34px 'Press Start 2P'`;
        const originalStr = (typeof mod.originalValue === 'number') ? mod.originalValue.toFixed(mod.precision) : 'N/A';
        const arrowStr = ' -> ';
        const finalStr = (typeof mod.value === 'number') ? mod.value.toFixed(mod.precision) : String(mod.value);
        const numberTransparency = 1;
        const valueColor = mod.isPositive ? `rgba(0, 255, 0, ${numberTransparency})` : `rgba(255, 101, 101, ${numberTransparency})`;
        const totalValueStr = originalStr + arrowStr + finalStr;
        const totalWidth = context.measureText(totalValueStr).width;
        let currentX = (width / 2) - (totalWidth / 2);
        context.textAlign = 'left';
        this.drawTextWithShadow(context, originalStr, currentX, valueY, '#ababab');
        currentX += context.measureText(originalStr).width;
        this.drawTextWithShadow(context, arrowStr, currentX, valueY, '#ababab');
        currentX += context.measureText(arrowStr).width;
        this.drawTextWithShadow(context, finalStr, currentX, valueY, valueColor);
    }

    drawTextWithShadow(context, text, x, y, color) {
        const shadowOffset = 3;
        const shadowColor = 'rgba(0,0,0,0.7)';
        context.fillStyle = shadowColor;
        context.fillText(text, x + shadowOffset, y + shadowOffset);
        context.fillStyle = color;
        context.fillText(text, x, y);
    }

    drawIconPlaceholder(ctx, iconType, x, y) {
        ctx.save();
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 12;
        ctx.scale(2, 2);
        ctx.translate(x / 2, y / 2);
        switch (iconType) {
            case 'speed':
                ctx.beginPath();
                ctx.moveTo(-30, -40); ctx.lineTo(10, 0); ctx.lineTo(-10, 0);
                ctx.lineTo(30, 40);
                ctx.stroke();
                break;
            case 'jump':
                ctx.beginPath();
                ctx.moveTo(0, -40); ctx.lineTo(0, 40);
                ctx.moveTo(-25, -10); ctx.lineTo(0, -40); ctx.lineTo(25, -10);
                ctx.stroke();
                break;
            case 'slide':
                ctx.beginPath();
                ctx.moveTo(-40, -15); ctx.lineTo(40, -15);
                ctx.moveTo(-30, 0); ctx.lineTo(30, 0);
                ctx.moveTo(-40, 15); ctx.lineTo(40, 15);
                ctx.stroke();
                break;
        }
        ctx.restore();
    }

    presentNewChoice() {
        console.log("AugmentsManager: Presenting a new choice of augments.");
        this.isChoiceMade = false;
        this.selectedIndex = -1;
        this.huds.forEach((hud, i) => {
            hud.scrollY = 0;
            hud.mesh.position.copy(this.cardStates[i].startPos);
            hud.mesh.scale.set(1, 1, 1);
        });

        this.generateCandidates();
        this.updateHudUI();

        this.hudGroup.visible = true;
        this.isVisible = true;
        this.isTransitioningIn = true;
        this.isTransitioningOut = false;
        this.transitionProgress = 0;
    }
}