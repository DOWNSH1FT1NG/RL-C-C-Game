// Файл: StatsDisplay.js

export class StatsDisplay {
    constructor(THREE, camera, statsSource, settings, baseSettings) { // Добавлен baseSettings
        this.THREE = THREE;
        this.camera = camera;
        this.statsSource = statsSource; // Источник "живых" данных (скорость, позиция)
        this.settings = settings;       // Текущие, изменяемые настройки
        this.baseSettings = baseSettings; // Снимок оригинальных настроек
        this.isVisible = false;

        this.scrollY = 0;
        this.totalContentHeight = 0;
        this.maxScrollY = 0;
        this.canvasHeight = 2048;
        this.visibleAreaHeight = 1000;
        this.padding = 30;
        this._initCanvasAndMesh();
    }

    _initCanvasAndMesh() {
        // ... (этот метод остается без изменений)
        const canvas = document.createElement('canvas');
        canvas.width = 950;
        canvas.height = 1024;
        this.context = canvas.getContext('2d');
        this.texture = new this.THREE.CanvasTexture(canvas);
        this.texture.minFilter = this.THREE.NearestFilter;
        this.texture.magFilter = this.THREE.NearestFilter;
        const material = new this.THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false });
        const aspect = canvas.width / canvas.height;
        const planeHeight = 1;
        const geometry = new this.THREE.PlaneGeometry(planeHeight * aspect, planeHeight);
        this.mesh = new this.THREE.Mesh(geometry, material);
        this.mesh.position.set(-0.05, -0.01, -0.5);
        this.mesh.visible = this.isVisible;
        this.camera.add(this.mesh);
    }

    toggleVisibility() {
        this.isVisible = !this.isVisible;
        this.mesh.visible = this.isVisible;
        if (this.isVisible) {
            this.update();
        } else {
            this.scrollY = 0;
        }
    }

    handleMouseWheel(event) {
        if (!this.isVisible) return;
        event.preventDefault();
        this.scrollY += event.deltaY * 0.5;
        this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
    }

    update() {
        if (!this.isVisible) return;

        const ctx = this.context;
        const { width } = ctx.canvas;
        const height = this.visibleAreaHeight;

        ctx.clearRect(0, 0, width, this.canvasHeight);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();
        ctx.translate(0, -this.scrollY);

        const liveColor = '#66ff66';
        const baseColor = '#FFFFFF';

        // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
        // Новая функция форматирования с повышенной точностью для малых чисел
        const formatNumber = num => {
            if (typeof num !== 'number') return String(num);
            if (Number.isInteger(num)) return String(num);
            // Для шансов спавна и других малых дробей используем 3 знака
            if (Math.abs(num) > 0 && Math.abs(num) < 1) {
                return num.toFixed(3);
            }
            // Для остальных чисел - 2 знака
            return num.toFixed(2);
        };
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

        const formatValue = (base, live, unit = '') => {
            if (base === undefined || live === undefined) {
                return { text: 'N/A', color: '#ff6666' };
            }

            // Используем новую, более точную функцию
            const baseStr = formatNumber(base) + unit;
            const liveStr = formatNumber(live) + unit;

            if (baseStr !== liveStr) {
                return { text: `${baseStr} → ${liveStr}`, color: liveColor };
            }
            return { text: liveStr, color: baseColor };
        };

        const statsToShow = [
            { label: '--- Player (Live) ---' },
            { label: 'Position', value: `X:${this.statsSource.getPlayerPosition().x.toFixed(1)} Y:${this.statsSource.getPlayerPosition().y.toFixed(1)} Z:${this.statsSource.getPlayerPosition().z.toFixed(1)}` },
            { label: 'Speed (XY)', value: new this.THREE.Vector2(this.statsSource.getPlayerVelocity().x, this.statsSource.getPlayerVelocity().z).length().toFixed(2) },
            { label: '', value: '' },

            { label: '--- Timers & Effective Stats ---' },
            { label: 'JUMP_STRENGTH', formatted: formatValue(this.baseSettings.JUMP_STRENGTH, this.statsSource.getEffectiveJumpStrength()) },
            { label: 'XRAY_DURATION', formatted: formatValue(this.baseSettings.XRAY_DURATION, this.statsSource.getRemainingXRayTime(), 's') },
            { label: 'SUPER_JUMP_DURATION', formatted: formatValue(this.baseSettings.POWERUP_SUPER_JUMP_DURATION, this.statsSource.getRemainingSuperJumpTime(), 's') },
            { label: 'SPEEDUP_DURATION', formatted: formatValue(this.baseSettings.SPEEDUP_DURATION, this.statsSource.getRemainingSpeedBoostTime(), 's') },
            { label: 'DAYLIGHT_DURATION', formatted: formatValue(this.baseSettings.DAYLIGHT_EFFECT_DURATION, this.statsSource.getRemainingDaylightTime(), 's') },
            { label: 'XRAY_DURATION', formatted: formatValue(this.baseSettings.XRAY_DURATION, this.statsSource.getRemainingXRayTime(), 's') },
            { label: '', value: '' },

            { label: '--- Base Settings ---' },
            { label: 'GROUND_FRICTION', formatted: formatValue(this.baseSettings.GROUND_FRICTION, this.settings.GROUND_FRICTION) },
            { label: 'GROUND_ACCELERATE', formatted: formatValue(this.baseSettings.GROUND_ACCELERATE, this.settings.GROUND_ACCELERATE) },
            { label: 'AIR_ACCELERATE', formatted: formatValue(this.baseSettings.AIR_ACCELERATE, this.settings.AIR_ACCELERATE) },
            { label: 'AIR_CONTROL_SPEED', formatted: formatValue(this.baseSettings.AIR_CONTROL_SPEED, this.settings.AIR_CONTROL_SPEED) },
            { label: 'MIN_PLAYER_SPEED', formatted: formatValue(this.baseSettings.MIN_PLAYER_SPEED, this.settings.MIN_PLAYER_SPEED) },
            { label: 'MAX_PLAYER_SPEED', formatted: formatValue(this.baseSettings.MAX_PLAYER_SPEED, this.settings.MAX_PLAYER_SPEED) },
            { label: 'GRAVITY', formatted: formatValue(this.baseSettings.GRAVITY, this.settings.GRAVITY) },
            { label: 'BUNNYHOP_SPEED_BONUS', formatted: formatValue(this.baseSettings.BUNNYHOP_SPEED_BONUS, this.settings.BUNNYHOP_SPEED_BONUS) },
            { label: 'BUNNYHOP_MAX_SPEED', formatted: formatValue(this.baseSettings.BUNNYHOP_MAX_SPEED, this.statsSource.getEffectiveBunnyhopMaxSpeed()) },
            { label: '', value: '' },

            { label: '--- Sliding ---' },
            { label: 'MIN_SLIDE_SPEED', formatted: formatValue(this.baseSettings.MIN_SLIDE_SPEED, this.settings.MIN_SLIDE_SPEED) },
            { label: 'SLIDE_BOOST', formatted: formatValue(this.baseSettings.SLIDE_BOOST, this.settings.SLIDE_BOOST) },
            { label: 'SLIDE_FRICTION', formatted: formatValue(this.baseSettings.SLIDE_FRICTION, this.settings.SLIDE_FRICTION) },
            { label: 'SLIDE_FRICTION_UPHILL', formatted: formatValue(this.baseSettings.SLIDE_FRICTION_UPHILL_MULTIPLIER, this.settings.SLIDE_FRICTION_UPHILL_MULTIPLIER) },
            { label: 'SLIDE_DOWNHILL_FORCE', formatted: formatValue(this.baseSettings.SLIDE_DOWNHILL_FORCE, this.settings.SLIDE_DOWNHILL_FORCE) },
            { label: 'SLIDE_UPHILL_DAMPEN', formatted: formatValue(this.baseSettings.SLIDE_UPHILL_DAMPEN, this.settings.SLIDE_UPHILL_DAMPEN) },
            { label: 'SLIDE_JUMP_SPEED_BONUS', formatted: formatValue(this.baseSettings.SLIDE_JUMP_SPEED_BONUS, this.settings.SLIDE_JUMP_SPEED_BONUS) },
            { label: 'SLIDE_SLOPE_INFLUENCE', formatted: formatValue(this.baseSettings.SLIDE_SLOPE_INFLUENCE, this.settings.SLIDE_SLOPE_INFLUENCE) },
            { label: '', value: '' },

            { label: '--- Ramp Jumps ---' },
            { label: 'RAMP_JUMP_MIN_SPEED', formatted: formatValue(this.baseSettings.RAMP_JUMP_MIN_SPEED, this.settings.RAMP_JUMP_MIN_SPEED) },
            { label: 'RAMP_JUMP_MIN_SLOPE_Y', formatted: formatValue(this.baseSettings.RAMP_JUMP_MIN_SLOPE_Y, this.settings.RAMP_JUMP_MIN_SLOPE_Y) },
            { label: 'RAMP_JUMP_VERTICAL_BOOST', formatted: formatValue(this.baseSettings.RAMP_JUMP_VERTICAL_BOOST, this.settings.RAMP_JUMP_VERTICAL_BOOST) },
            { label: 'RAMP_JUMP_FORWARD_BOOST', formatted: formatValue(this.baseSettings.RAMP_JUMP_FORWARD_BOOST, this.settings.RAMP_JUMP_FORWARD_BOOST) },
            { label: '', value: '' },

            { label: '--- Items & Spawning ---' },
            { label: 'OBJECT_SPAWN_CHANCE', formatted: formatValue(this.baseSettings.OBJECT_SPAWN_CHANCE, this.settings.OBJECT_SPAWN_CHANCE) },
            { label: 'POWERUP_SPAWN_CHANCE', formatted: formatValue(this.baseSettings.POWERUP_SPAWN_CHANCE, this.settings.POWERUP_SPAWN_CHANCE) },
            { label: 'SPEEDUP_SPAWN_CHANCE', formatted: formatValue(this.baseSettings.SPEEDUP_SPAWN_CHANCE, this.settings.SPEEDUP_SPAWN_CHANCE) },
            { label: 'SUNRISE_SPAWN_CHANCE', formatted: formatValue(this.baseSettings.SUNRISE_SPAWN_CHANCE, this.settings.SUNRISE_SPAWN_CHANCE) },
            { label: 'XRAY_RADIUS', formatted: formatValue(this.baseSettings.XRAY_RADIUS, this.settings.XRAY_RADIUS) },
            { label: 'XRAY_OPACITY', formatted: formatValue(this.baseSettings.XRAY_OPACITY, this.settings.XRAY_OPACITY) },
            { label: '', value: '' },

            { label: '--- Scoring & Timers ---' },
            { label: 'POINTS_PER_COIN', formatted: formatValue(this.baseSettings.POINTS_PER_COIN, this.settings.POINTS_PER_COIN) },
            { label: 'POWERUP_SCORE_MULT', formatted: formatValue(this.baseSettings.POWERUP_SCORE_MULTIPLIER, this.settings.POWERUP_SCORE_MULTIPLIER) },
            { label: 'SPEEDUP_SCORE_MULT', formatted: formatValue(this.baseSettings.SPEEDUP_SCORE_MULTIPLIER, this.settings.SPEEDUP_SCORE_MULTIPLIER) },
            { label: 'SUNRISE_SCORE_MULT', formatted: formatValue(this.baseSettings.SUNRISE_SCORE_MULTIPLIER, this.settings.SUNRISE_SCORE_MULTIPLIER) },

            { label: 'COMBO_DURATION', formatted: formatValue(this.baseSettings.COMBO_DURATION, this.settings.COMBO_DURATION) },
        ];

        ctx.font = "24px 'Press Start 2P'";
        let y = this.padding;
        const lineHeight = 28;
        const valueX = width - this.padding; // Правый край для значений

        statsToShow.forEach(stat => {
            ctx.textAlign = 'left';
            if (stat.label.startsWith('---')) {
                ctx.fillStyle = '#ffc107';
                ctx.fillText(stat.label, 20, y);
            } else if (stat.label) {
                ctx.fillStyle = '#CCCCCC';
                ctx.fillText(stat.label, 20, y);

                ctx.textAlign = 'right';
                if (stat.formatted) {
                    ctx.fillStyle = stat.formatted.color;
                    ctx.fillText(stat.formatted.text, valueX, y);
                } else if (stat.value !== undefined) {
                    ctx.fillStyle = baseColor;
                    ctx.fillText(stat.value.toString(), valueX, y);
                }
            }
            y += lineHeight;
        });

        this.totalContentHeight = y + this.padding;
        this.maxScrollY = Math.max(0, this.totalContentHeight - height);
        ctx.restore();

        if (this.maxScrollY > 0) {
            const scrollbarWidth = 10;
            const scrollbarX = width - scrollbarWidth - 5;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(scrollbarX, 0, scrollbarWidth, height);
            const thumbHeight = Math.max(30, height * (height / this.totalContentHeight));
            const thumbY = (this.scrollY / this.maxScrollY) * (height - thumbHeight);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(scrollbarX, thumbY, scrollbarWidth, thumbHeight);
        }

        this.texture.needsUpdate = true;
    }
}