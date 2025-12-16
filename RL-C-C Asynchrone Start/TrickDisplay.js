// --- Файл: TrickDisplay.js ---

import * as THREE from 'three';

export class TrickDisplay {
    constructor(camera) {
        this.camera = camera;
        this.mesh = null;
        this.context = null;
        this.texture = null;
        this.message = '';
        this.endTime = 0;
        this.clock = new THREE.Clock();

        this._createHud();
    }

    /**
     * Внутренний метод для создания 3D-объекта (HUD).
     * @private
     */
    _createHud() {
        const canvas = document.createElement('canvas');
        const canvasWidth = 512;
        const canvasHeight = 128;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        this.context = canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(canvas);
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.magFilter = THREE.NearestFilter;

        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            depthTest: false
        });

        const aspectRatio = canvasWidth / canvasHeight;
        const planeHeight = 0.1;
        const planeWidth = planeHeight * aspectRatio;
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, 0.35, -0.5); // Располагаем под комбо-счетчиком
        this.mesh.visible = false;

        this.camera.add(this.mesh);
    }

    /**
     * Показывает сообщение на экране на определенное время.
     * @param {string} text - Текст сообщения.
     * @param {number} duration - Длительность в секундах.
     */
    show(text, duration) {
        this.message = text;
        this.endTime = this.clock.getElapsedTime() + duration;
    }

    /**
     * Метод, который нужно вызывать в главном игровом цикле (animate).
     * Он отвечает за отрисовку и скрытие сообщения по таймеру.
     */
    update() {
        if (this.clock.getElapsedTime() < this.endTime) {
            if (!this.mesh.visible) {
                this.mesh.visible = true;
            }

            const ctx = this.context;
            const width = ctx.canvas.width;
            const height = ctx.canvas.height;

            ctx.clearRect(0, 0, width, height);

            ctx.font = "48px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Плавное исчезание в последние 0.5 секунды
            const timeRemaining = this.endTime - this.clock.getElapsedTime();
            let alpha = 1.0;
            if (timeRemaining < 0.5) {
                alpha = Math.max(0, timeRemaining / 0.5);
            }
            ctx.globalAlpha = alpha;

            // Тень
            ctx.fillStyle = `rgba(0, 0, 0, 0.75)`;
            ctx.fillText(this.message, width / 2 + 4, height / 2 + 4);

            // Основной текст с градиентом
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0.3, '#ffff00');
            gradient.addColorStop(0.7, '#ff8c00');
            ctx.fillStyle = gradient;
            ctx.fillText(this.message, width / 2, height / 2);

            ctx.globalAlpha = 1.0; // Сброс прозрачности
            this.texture.needsUpdate = true;
        } else {
            if (this.mesh.visible) {
                this.mesh.visible = false;
            }
        }
    }
}