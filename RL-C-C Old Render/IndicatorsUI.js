import * as THREE from 'three';

export class IndicatorsUI {
    constructor(camera) {
        const canvasWidth = 512;
        const canvasHeight = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        this.context = canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.NearestFilter;

        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            depthTest: false
        });

        const aspectRatio = canvasWidth / canvasHeight;
        const planeHeight = 0.25;
        const planeWidth = planeHeight * aspectRatio;
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(-0.73, -0.585, -0.5);
        camera.add(this.mesh);

        this.colorNormal = new THREE.Color('#00E5FF');
        this.colorHigh = new THREE.Color('#FFEE58');
        this.colorOverdrive = new THREE.Color('#FF4500');

        this.animationTime = 0;
        this.clock = new THREE.Clock();
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

    update(data) {
        if (!this.context) return;

        this.animationTime += this.clock.getDelta() * 5;

        const ctx = this.context;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        ctx.clearRect(0, 0, width, height);

        const barHeight = 50;
        const barWidth = 400;
        const barX = 30;
        const barY = 20;
        const borderRadius = 15;

        let finalBarColor;

        if (data.speed <= data.normalMaxSpeed) {
            finalBarColor = this.colorNormal.clone();
        } else {
            const bunnyhopSpeedRange = data.maxSpeed - data.normalMaxSpeed;
            const speedIntoBunnyhop = data.speed - data.normalMaxSpeed;
            let progress = bunnyhopSpeedRange > 0 ? (speedIntoBunnyhop / bunnyhopSpeedRange) : 0;
            progress = Math.max(0, Math.min(1, progress));

            if (progress < 0.5) {
                finalBarColor = this.colorNormal.clone().lerp(this.colorHigh, progress * 2);
            } else {
                finalBarColor = this.colorHigh.clone().lerp(this.colorOverdrive, (progress - 0.5) * 2);
            }
        }

        const speedPercentage = data.maxSpeed > 0 ? Math.min(data.speed / data.maxSpeed, 1.0) : 0;
        const maxPulse = 6;
        let pulseMagnitude = 0;
        let glowIntensity = 0;

        if (data.speed > data.normalMaxSpeed) {
            const bunnyhopSpeedRange = data.maxSpeed - data.normalMaxSpeed;
            const speedIntoBunnyhop = data.speed - data.normalMaxSpeed;
            const overdriveProgress = bunnyhopSpeedRange > 0 ? Math.min(speedIntoBunnyhop / bunnyhopSpeedRange, 1.0) : 0;

            pulseMagnitude = overdriveProgress * maxPulse;
            glowIntensity = overdriveProgress * 20;
        }

        const pulseOffset = Math.sin(this.animationTime) * pulseMagnitude;
        const dynamicBarHeight = barHeight + pulseOffset;
        const dynamicBarY = barY - pulseOffset / 2;

        const backgroundGradient = ctx.createLinearGradient(barX, dynamicBarY, barX, dynamicBarY + dynamicBarHeight);
        backgroundGradient.addColorStop(0, 'rgba(28,30,48,0.95)');
        backgroundGradient.addColorStop(1, 'rgba(18,20,30,0.95)');
        ctx.fillStyle = backgroundGradient;
        this._drawRoundRect(ctx, barX, dynamicBarY, barWidth, dynamicBarHeight, borderRadius);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        this._drawRoundRect(ctx, barX + 1, dynamicBarY + 1, barWidth - 2, dynamicBarHeight - 2, borderRadius - 2);
        ctx.fill();

        if (speedPercentage > 0) {
            ctx.save();
            this._drawRoundRect(ctx, barX, dynamicBarY, barWidth * speedPercentage, dynamicBarHeight, borderRadius);
            ctx.clip();
            ctx.fillStyle = finalBarColor.getStyle();
            ctx.fillRect(barX, dynamicBarY, barWidth * speedPercentage, dynamicBarHeight);
            ctx.restore();
        }

        const isSpeedupBonusActive = data.isSpeedupActive === true;
        let finalFrameColor;
        let hasGlow = false;

        if (isSpeedupBonusActive) {
            const lightnessPulse = (Math.sin(this.animationTime * 1.5) + 1) / 2;
            const dynamicLightness = 55 + lightnessPulse * 15;
            finalFrameColor = `hsl(8, 100%, ${dynamicLightness}%)`;
            const glowPulse = (Math.sin(this.animationTime) + 1) / 2;
            ctx.shadowBlur = 10 + glowPulse * 15;
            ctx.shadowColor = finalFrameColor;
            hasGlow = true;
        } else {
            finalFrameColor = finalBarColor.getStyle();
            if (glowIntensity > 0) {
                ctx.shadowBlur = glowIntensity;
                ctx.shadowColor = finalBarColor.getStyle();
                hasGlow = true;
            }
        }

        if (hasGlow) {
            ctx.strokeStyle = 'transparent';
            ctx.lineWidth = 4;
            this._drawRoundRect(ctx, barX, dynamicBarY, barWidth, dynamicBarHeight, borderRadius);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = finalFrameColor;
        ctx.lineWidth = 3;
        this._drawRoundRect(ctx, barX, dynamicBarY, barWidth, dynamicBarHeight, borderRadius);
        ctx.stroke();

        ctx.font = "26px 'Press Start 2P'"; // Было 28px
        ctx.fillStyle = 'white';
        ctx.shadowColor = "black";
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // --- ИЗМЕНЕНИЕ 2: Используем короткое и стильное сокращение "ups" ---
        ctx.fillText(`${data.speed.toFixed(0)} / ${data.maxSpeed.toFixed(0)} ups`, barX + barWidth / 2, dynamicBarY + dynamicBarHeight / 2);

        ctx.shadowColor = 'transparent';

        this.texture.needsUpdate = true;
    }
}