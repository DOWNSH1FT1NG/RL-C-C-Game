// ‘‡ÈÎ: sky.js (‘»Õ¿À‹Õ¿ﬂ ¬≈–—»ﬂ)
import * as THREE from 'three';
import { createSunSprite, createMoonSprite } from './daySprite.js';
function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}
function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const circles = [{ x: 70, y: 60, r: 40 }, { x: 120, y: 55, r: 55 }, { x: 170, y: 65, r: 45 }, { x: 130, y: 80, r: 40 },];
    circles.forEach(circle => { ctx.beginPath(); ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2); ctx.fill(); });
    return new THREE.CanvasTexture(canvas);
}

export class Sky {
    constructor(scene, camera, options = {}) {
        if (!scene || !camera) {
            throw new Error("Sky class requires a scene and a camera!");
        }

        this.scene = scene;
        this.camera = camera;
        this.timeOfDay = options.timeOfDay ?? 0.25;
        this.cycleSpeed = options.cycleSpeed ?? 0.01;
        this.sunDistance = 10000;
        this.transitionDuration = options.transitionDuration ?? 0.2;
        this.transitionOffset = options.transitionOffset ?? 0.15;

        this.celestialPivot = new THREE.Object3D();
        this.celestialPivot.name = "Celestial Direction Helper";
        this.celestialPivot.rotation.x = THREE.MathUtils.degToRad(35);
        this.lightPositionHelper = new THREE.Object3D();
        this.lightPositionHelper.position.set(0, this.sunDistance, 0);
        this.celestialPivot.add(this.lightPositionHelper);
        this.scene.add(this.celestialPivot);

        this.ambientLight = new THREE.HemisphereLight(0xB1E1FF, 0xB97A20, 1.0);
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        this.scene.add(this.ambientLight);
        this.scene.add(this.directionalLight);
        this.scene.add(this.directionalLight.target);

        this._setupLightingAndShadows();

        this.sunSprite = createSunSprite();
        this.moonSprite = createMoonSprite();
        this.sunSprite.frustumCulled = false;
        this.moonSprite.frustumCulled = false;

        this.cloudsContainer = this._createClouds();

        this.scene.add(this.sunSprite);
        this.scene.add(this.moonSprite);
        this.scene.add(this.cloudsContainer);
    }

    getTimeOfDay() {
        return this.timeOfDay;
    }

    update(delta, playerBody) {
        if (!playerBody) return;

        const MINUTES_PER_DAY = 24 * 60;
        const timeIncrement = (delta * this.cycleSpeed) / MINUTES_PER_DAY;
        this.timeOfDay = (this.timeOfDay + timeIncrement) % 1.0;

        this.celestialPivot.rotation.z = this.timeOfDay * Math.PI * 2;

        const idealLightWorldPos = new THREE.Vector3();
        this.lightPositionHelper.getWorldPosition(idealLightWorldPos);

        this.directionalLight.target.position.copy(playerBody.position);

        const lightDirection = idealLightWorldPos.clone().sub(playerBody.position).normalize();

        if (idealLightWorldPos.y < playerBody.position.y) {
            lightDirection.negate();
        }

        const lightDistance = 500;
        const finalLightPosition = playerBody.position.clone().add(lightDirection.multiplyScalar(lightDistance));
        this.directionalLight.position.copy(finalLightPosition);

        this._updateEnvironmentColors(playerBody);
        this._updateCelestialSprites();
    }

    _setupLightingAndShadows() {
        const light = this.directionalLight; light.castShadow = true;
        const shadowMapSize = 4; light.shadow.mapSize.width = shadowMapSize; light.shadow.mapSize.height = shadowMapSize;
        light.shadow.bias = -5; light.shadow.normalBias = 0.05;
        const shadowCameraHorizontalSize = 250; const shadowCameraVerticalSize = 400;
        light.shadow.camera.left = -shadowCameraHorizontalSize; light.shadow.camera.right = shadowCameraHorizontalSize;
        light.shadow.camera.top = shadowCameraVerticalSize; light.shadow.camera.bottom = -shadowCameraVerticalSize;
        light.shadow.camera.near = 0.5; light.shadow.camera.far = 1500;
    }

    _createClouds() {
        const container = new THREE.Object3D(); container.name = "Clouds Container"; this.cloudDriftArea = 4000;
        const cloudTexture = createCloudTexture();
        for (let i = 0; i < 25; i++) {
            const cloudMaterial = new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: 0.9, fog: false, blending: THREE.NormalBlending });
            const cloud = new THREE.Sprite(cloudMaterial);
            cloud.position.set(Math.random() * this.cloudDriftArea - this.cloudDriftArea / 2, Math.random() * 200 + 600, Math.random() * 1500 - 1000);
            const scale = Math.random() * 150 + 100; cloud.scale.set(scale * 2, scale, 1);
            container.add(cloud);
        }
        return container;
    }

    // ¬ Ù‡ÈÎÂ sky.js

    _updateEnvironmentColors(playerBody) {
        const lightWorldPosition = new THREE.Vector3();
        this.lightPositionHelper.getWorldPosition(lightWorldPosition);
        const sunY = lightWorldPosition.y;
        const sunDistance = this.sunDistance;
        const sunY_norm = sunY / sunDistance;

        // --- ¬¿ÿ» ¿ “”¿À‹Õ€≈ «Õ¿◊≈Õ»ﬂ ---
        const DAY_INTENSITY = 2.7;
        const DAY_LIGHT_COLOR = new THREE.Color(0xFFF2D6);
        const DAY_SKY_COLOR_AMBIENT = new THREE.Color(0xbdcfff);
        const DAY_GROUND_COLOR_AMBIENT = new THREE.Color(0xB97A20);
        const DAY_AMBIENT_INTENSITY = 0.7;

        const DUSK_INTENSITY = 1.2;
        const DUSK_AMBIENT_INTENSITY = 0.9;
        const DUSK_LIGHT_COLOR = new THREE.Color(0xFFB74D);
        const DUSK_SKY_COLOR_AMBIENT = new THREE.Color(0xFFDAB9);
        const DUSK_GROUND_COLOR_AMBIENT = new THREE.Color(0x997554);

        const NIGHT_INTENSITY = 1.6;
        const NIGHT_LIGHT_COLOR = new THREE.Color(0xA0B0FF);
        const NIGHT_SKY_COLOR_AMBIENT = new THREE.Color(0x445588);
        const NIGHT_GROUND_COLOR_AMBIENT = new THREE.Color(0x445588);
        const NIGHT_AMBIENT_INTENSITY = 1.0; // —ÍÓÂÍÚËÓ‚‡ÌÓ Ò 2.5

        const daySkyColor = new THREE.Color(0xA4DDFC);
        const duskSkyColor = new THREE.Color(0xFFB347);
        const nightSkyColor = new THREE.Color(0x283593);
        // ---  ŒÕ≈÷ ¬¿ÿ»’ «Õ¿◊≈Õ»… ---

        const halfDuration = this.transitionDuration / 2;
        const DAY_THRESHOLD = this.transitionOffset + halfDuration;
        const NIGHT_THRESHOLD = this.transitionOffset - halfDuration;

        let skyColor = new THREE.Color();

        // --- √À¿¬ÕŒ≈ »«Ã≈Õ≈Õ»≈: œ–»Ã≈Õﬂ≈Ã SMOOTHSTEP ---
        // 1. –‡ÒÒ˜ËÚ˚‚‡ÂÏ Ó·˘ËÈ ÔÓ„ÂÒÒ ÓÚ ÌÓ˜Ë ÍÓ ‰Ì˛ (ÓÚ 0 ‰Ó 1)
        let totalProgress = (sunY_norm - NIGHT_THRESHOLD) / (DAY_THRESHOLD - NIGHT_THRESHOLD);
        totalProgress = Math.max(0, Math.min(1, totalProgress)); // Œ„‡ÌË˜Ë‚‡ÂÏ ÓÚ 0 ‰Ó 1

        // 2. œËÏÂÌˇÂÏ Ò„Î‡ÊË‚‡ÌËÂ! ¬ÏÂÒÚÓ ÎËÌÂÈÌÓ„Ó ÓÒÚ‡ ÔÓÎÛ˜‡ÂÏ S-Ó·‡ÁÌÛ˛ ÍË‚Û˛.
        const smoothedProgress = smoothstep(0, 1, totalProgress);
        // ----------------------------------------------------

        // “ÂÔÂ¸ ‚Òˇ ÎÓ„ËÍ‡ ÔÂÂıÓ‰‡ ËÒÔÓÎ¸ÁÛÂÚ `smoothedProgress`
        if (smoothedProgress >= 1.0) {
            // --- —Œ—“ŒﬂÕ»≈: ƒ≈Õ‹ ---
            this.directionalLight.color.copy(DAY_LIGHT_COLOR);
            this.directionalLight.intensity = DAY_INTENSITY;
            this.ambientLight.color.copy(DAY_SKY_COLOR_AMBIENT);
            this.ambientLight.groundColor.copy(DAY_GROUND_COLOR_AMBIENT);
            this.ambientLight.intensity = DAY_AMBIENT_INTENSITY;
            skyColor.copy(daySkyColor);
        } else if (smoothedProgress <= 0.0) {
            // --- —Œ—“ŒﬂÕ»≈: ÕŒ◊‹ ---
            this.directionalLight.color.copy(NIGHT_LIGHT_COLOR);
            this.directionalLight.intensity = NIGHT_INTENSITY;
            this.ambientLight.color.copy(NIGHT_SKY_COLOR_AMBIENT);
            this.ambientLight.groundColor.copy(NIGHT_GROUND_COLOR_AMBIENT);
            this.ambientLight.intensity = NIGHT_AMBIENT_INTENSITY;
            skyColor.copy(nightSkyColor);
        } else {
            // --- —Œ—“ŒﬂÕ»≈: œ≈–≈’Œƒ (ËÒÔÓÎ¸ÁÛÂÏ smoothedProgress) ---
            if (smoothedProgress > 0.5) {
                const upperProgress = (smoothedProgress - 0.5) * 2;
                this.directionalLight.intensity = DUSK_INTENSITY + (DAY_INTENSITY - DUSK_INTENSITY) * upperProgress;
                this.ambientLight.intensity = DUSK_AMBIENT_INTENSITY + (DAY_AMBIENT_INTENSITY - DUSK_AMBIENT_INTENSITY) * upperProgress;
                this.directionalLight.color.copy(DUSK_LIGHT_COLOR).lerp(DAY_LIGHT_COLOR, upperProgress);
                this.ambientLight.color.copy(DUSK_SKY_COLOR_AMBIENT).lerp(DAY_SKY_COLOR_AMBIENT, upperProgress);
                this.ambientLight.groundColor.copy(DUSK_GROUND_COLOR_AMBIENT).lerp(DAY_GROUND_COLOR_AMBIENT, upperProgress);
                skyColor.copy(duskSkyColor).lerp(daySkyColor, upperProgress);
            } else {
                const lowerProgress = smoothedProgress * 2;
                this.directionalLight.intensity = NIGHT_INTENSITY + (DUSK_INTENSITY - NIGHT_INTENSITY) * lowerProgress;
                this.ambientLight.intensity = NIGHT_AMBIENT_INTENSITY + (DUSK_AMBIENT_INTENSITY - NIGHT_AMBIENT_INTENSITY) * lowerProgress;
                this.directionalLight.color.copy(NIGHT_LIGHT_COLOR).lerp(DUSK_LIGHT_COLOR, lowerProgress);
                this.ambientLight.color.copy(NIGHT_SKY_COLOR_AMBIENT).lerp(DUSK_SKY_COLOR_AMBIENT, lowerProgress);
                this.ambientLight.groundColor.copy(NIGHT_GROUND_COLOR_AMBIENT).lerp(DUSK_GROUND_COLOR_AMBIENT, lowerProgress);
                skyColor.copy(nightSkyColor).lerp(duskSkyColor, lowerProgress);
            }
        }

        this.scene.background.copy(skyColor);
        this.scene.fog.color.copy(skyColor);
    }

    _updateCelestialSprites() {
        const cameraWorldPosition = new THREE.Vector3();
        this.camera.getWorldPosition(cameraWorldPosition);

        const lightWorldPosition = new THREE.Vector3();
        this.lightPositionHelper.getWorldPosition(lightWorldPosition);

        const lightDir = lightWorldPosition.clone().normalize();

        const distance = this.camera.far * 0.95;

        const sunPosition = cameraWorldPosition.clone().add(lightDir.clone().multiplyScalar(distance));
        this.sunSprite.position.copy(sunPosition);

        const moonPosition = cameraWorldPosition.clone().add(lightDir.clone().negate().multiplyScalar(distance));
        this.moonSprite.position.copy(moonPosition);

        const scaleFactor = distance * 0.25;
        this.sunSprite.scale.set(scaleFactor, scaleFactor, 1);
        this.moonSprite.scale.set(scaleFactor * 0.6, scaleFactor * 0.6, 1);

        const isDayTime = lightWorldPosition.y > 0;
        this.sunSprite.visible = isDayTime;
        this.moonSprite.visible = !isDayTime;
    }

    _updateClouds(delta) {
        const cloudDriftSpeed = 5;
        for (const cloud of this.cloudsContainer.children) {
            cloud.position.x += cloudDriftSpeed * delta;
            if (cloud.position.x > this.cloudDriftArea / 2) { cloud.position.x = -this.cloudDriftArea / 2; }
        }
    }
}