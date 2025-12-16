// --- ФАЙЛ: debug.js (НОВАЯ ВЕРСИЯ) ---

import * as THREE from 'three';
import { settings } from './settings.js';

export class Debug {
    /**
     * @param {THREE.Scene} scene - Сцена, куда добавлять объекты.
     * @param {object} gameAPI - Объект с функциями для управления состоянием игры.
     */
    constructor(scene, gameAPI) {
        this.scene = scene;
        this.gameAPI = gameAPI; // Сохраняем API для доступа к функциям игры

        this.boundaryPillars = this.createBoundaryPillars();
        this.scene.add(this.boundaryPillars);

        this.isVisible = false;
        this.boundaryPillars.visible = this.isVisible;
    }

    toggleVisibility() {
        this.isVisible = !this.isVisible;
        this.boundaryPillars.visible = this.isVisible;
    }

    update(currentChunkX, currentChunkZ) {
        if (this.isVisible) {
            const pillarX = currentChunkX * settings.CHUNK_SIZE;
            const pillarZ = currentChunkZ * settings.CHUNK_SIZE;
            this.boundaryPillars.position.set(pillarX, 0, pillarZ);
        }
    }

    /**
     * Новая функция для выдачи всех бонусов.
     * Она вызывает функцию, переданную из game.js.
     */
    giveAll() {
        // Проверяем, что API и нужная функция были переданы при создании
        if (this.gameAPI && typeof this.gameAPI.activateAllBonuses === 'function') {
            // Вызываем функцию из game.js, которая имеет доступ ко всем переменным
            return this.gameAPI.activateAllBonuses();
        } else {
            const errorMsg = "[Debug] Ошибка: функция 'activateAllBonuses' не была передана из game.js!";
            console.error(errorMsg);
            return errorMsg;
        }
    }

    createBoundaryPillars() {
        const pillarHeight = 100;
        const halfChunk = settings.CHUNK_SIZE / 2;
        const hC = halfChunk; const pH = pillarHeight;
        const vertices = [-hC, -pH, -hC, -hC, pH, -hC, hC, -pH, -hC, hC, pH, -hC, -hC, -pH, hC, -hC, pH, hC, hC, -pH, hC, hC, pH, hC, -hC, -pH, -hC, hC, -pH, -hC, hC, -pH, -hC, hC, -pH, hC, hC, -pH, hC, -hC, -pH, hC, -hC, -pH, hC, -hC, -pH, -hC, -hC, pH, -hC, hC, pH, -hC, hC, pH, -hC, hC, pH, hC, hC, pH, hC, -hC, pH, hC, -hC, pH, hC, -hC, pH, -hC, -hC, -pH, -hC, hC, -pH, hC, -hC, -pH, hC, hC, -pH, -hC, -hC, -pH, -hC, hC, pH, -hC, hC, -pH, -hC, -hC, pH, -hC, -hC, -pH, hC, hC, pH, hC, hC, -pH, hC, -hC, pH, hC, -hC, -pH, -hC, -hC, pH, hC, -hC, -pH, hC, -hC, pH, -hC, hC, -pH, -hC, hC, pH, hC, hC, -pH, hC, hC, pH, -hC];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
        const lines = new THREE.LineSegments(geometry, material);
        return lines;
    }
}