import { settings } from './settings.js';
import { seededRandom } from './utils.js';
const getSeed = () => window.WORLD_SEED || 0;

// Вспомогательная функция для линейной интерполяции
function lerp(a, b, t) { return a * (1 - t) + b * t; }

export class BonusManager {
    static lastTickedChunkId = null; // Флаг, чтобы "тикать" только один раз на чанк

    constructor(gameContext) {
        // --- Копируем свойства из gameContext ---
        Object.assign(this, gameContext);

        this.bonusSpawnState = {
            powerup: { chunksSinceLastSpawn: 0, cooldown: 0 },
            speedup: { chunksSinceLastSpawn: 0, cooldown: 0 },
            sunrise: { chunksSinceLastSpawn: 0, cooldown: 0 },
            xray: { chunksSinceLastSpawn: 0, cooldown: 0 }
        };
        this.globalBonusCooldown = 0;

        // --- Состояние бонусов (остается без изменений) ---
        this.isSuperJumpActive = false;
        this.superJumpRemainingTime = 0;
        this.isSpeedBoostActive = false;
        this.speedBoostRemainingTime = 0;
        this.isSpeedBoostFading = false;
        this.speedBoostFadeoutTimer = 0;
        this.isDaylightEffectActive = false;
        this.daylightEffectRemainingTime = 0;
        this.originalTimeOfDayBeforeEffect = 0.8;
        this.originalFogDistanceBeforeEffect = 2;
        this.originalRenderDistanceBeforeEffect = settings.RENDER_DISTANCE;
        this.isDayTransitioning = false;
        this.dayTransitionStartTime = 0;
        this.dayTransitionStartValue = 0;
        this.dayTransitionStartFog = 0;
        this.dayTransitionStartRender = 0;
        this.isNightTransitioning = false;
        this.nightTransitionStartTime = 0;
        this.nightTransitionStartValue = 0;
        this.nightTransitionStartFog = 0;
        this.nightTransitionStartRender = 0;
        this.DAY_TRANSITION_TARGET = 0.25;
        this.DAY_TRANSITION_TARGET_FOG = 25;
        this.isXRayActive = false;
        this.xRayRemainingTime = 0;
    }

    /**
     * Метод №1: "Тик" времени. Вызывается ОДИН РАЗ для каждого нового чанка.
     * Обновляет все кулдауны и счетчики "неудачи".
     */
    tickForPlayerTraversal(chunkX, chunkZ) {
        const chunkId = `${chunkX},${chunkZ}`;
        // Защита от повторной обработки того же чанка, где стоит игрок
        if (BonusManager.lastTickedChunkId === chunkId) return;
        BonusManager.lastTickedChunkId = chunkId;

        // --- ЛОГИРОВАНИЕ: Начало тика ---
        console.groupCollapsed(`[Bonus Tick TRAVERSAL] Игрок вошел в чанк [${chunkX}, ${chunkZ}]`);
        console.log('Состояние ДО тика:', JSON.parse(JSON.stringify(this.bonusSpawnState)));
        console.log(`Глобальный кулдаун ДО: ${this.globalBonusCooldown}`);


        if (this.globalBonusCooldown > 0) {
            this.globalBonusCooldown--;
        }

        for (const key in this.bonusSpawnState) {
            const state = this.bonusSpawnState[key];
            if (state.cooldown > 0) {
                state.cooldown--;
            } else {
                // Увеличиваем счетчик неудач, только если кулдауны НЕ активны
                if (this.globalBonusCooldown === 0) {
                    state.chunksSinceLastSpawn++;
                }
            }
        }

        // --- ЛОГИРОВАНИЕ: Конец тика ---
        console.log('Состояние ПОСЛЕ тика:', JSON.parse(JSON.stringify(this.bonusSpawnState)));
        console.log(`Глобальный кулдаун ПОСЛЕ: ${this.globalBonusCooldown}`);
        console.groupEnd();
    }

    /**
     * Метод №2: Проверка спавна. Вызывается для каждого бонуса ПОСЛЕ "тика".
     * Принимает решение о спавне, используя защиту от неудачи и лимиты.
     */
    shouldSpawnBonus(type, baseChance, chunkX, chunkZ) {
        const state = this.bonusSpawnState[type];

        // --- ЛОГИРОВАНИЕ: Начало проверки ---
        //console.groupCollapsed(`[Bonus Spawn Check] Проверка спавна для '${type}'`);

        // 1. Проверка кулдаунов
        if (state.cooldown > 0) {
           // console.log(`%cОТКАЗ: Персональный кулдаун активен (${state.cooldown} чанков осталось).`, 'color: orange;');
            //console.groupEnd();
            return false;
        }
        if (this.globalBonusCooldown > 0) {
           // console.log(`%cОТКАЗ: Глобальный кулдаун активен (${this.globalBonusCooldown} чанков осталось).`, 'color: orange;');
           // console.groupEnd();
            return false;
        }

        // 2. Расчет шанса с учетом "защиты от неудачи"
        const badLuckBonus = state.chunksSinceLastSpawn * settings.BAD_LUCK_PROTECTION_BONUS;
        const effectiveChance = baseChance + badLuckBonus;
        const finalChance = Math.min(effectiveChance, settings.MAX_SPAWN_CHANCE);

        //console.log(`Базовый шанс: ${(baseChance * 100).toFixed(1)}%`);
        //console.log(`Чанков без спавна: ${state.chunksSinceLastSpawn}`);
      //  console.log(`Бонус неудачи: +${(badLuckBonus * 100).toFixed(1)}%`);
       // console.log(`Эффективный шанс: ${(effectiveChance * 100).toFixed(1)}%`);
        if (effectiveChance > finalChance) {
          //  console.log(`%cШанс ограничен до: ${(finalChance * 100).toFixed(1)}%`, 'color: yellow;');
        }

        // 3. "Бросок кубика"
        let seedModX = 1, seedModZ = 1;
        switch (type) {
            case 'powerup': seedModX = 31; seedModZ = 37; break;
            case 'speedup': seedModX = 41; seedModZ = 43; break;
            case 'sunrise': seedModX = 53; seedModZ = 59; break;
            case 'xray': seedModX = 61; seedModZ = 67; break;
        }
        const roll = seededRandom(chunkX * seedModX, chunkZ * seedModZ, getSeed());
       // console.log(`Результат броска: ${roll.toFixed(4)} (нужно < ${finalChance.toFixed(4)})`);


        // 4. Принятие решения
        if (roll < finalChance) {
            //console.log(`%cУСПЕХ! Бонус '${type}' будет заспавнен.`, 'color: #4CAF50; font-weight: bold;');

            // Сбрасываем счетчики и устанавливаем кулдауны
            this.globalBonusCooldown = settings.GLOBAL_BONUS_SPAWN_COOLDOWN;
            state.cooldown = settings.BONUS_SPAWN_COOLDOWN;
            state.chunksSinceLastSpawn = 0;

           // console.log(`Установлен глобальный кулдаун: ${this.globalBonusCooldown} чанков.`);
           // console.log(`Установлен персональный кулдаун: ${state.cooldown} чанков.`);
           // console.log('Счетчик неудачи сброшен на 0.');
           // console.groupEnd();
            return true;
        } else {
           // console.log(`%cНЕУДАЧА. Бонус '${type}' не заспавнился.`, 'color: #F44336;');
           // console.groupEnd();
            return false;
        }
    }


    // ... (все остальные ваши методы: activateSuperJump, update, и т.д. остаются без изменений)
    activateSuperJump(position) {
        this.triggerParticles(this.particles.powerup, position);
        this.playCoinSound();
        this.isSuperJumpActive = true;
        this.superJumpRemainingTime = settings.POWERUP_SUPER_JUMP_DURATION;
        const comboMultiplier = this.triggerComboUpdate(null, true).multiplier;
        const newMultiplier = (comboMultiplier === 1) ? settings.POWERUP_SCORE_MULTIPLIER : comboMultiplier + settings.POWERUP_SCORE_MULTIPLIER;
        this.triggerComboUpdate({ multiplier: newMultiplier });
    }

    activateSpeedBoost(position) {
        this.triggerParticles(this.particles.speedup, position);
        this.playCoinSound();

        if (!this.isSpeedBoostActive) {
            settings.BUNNYHOP_MAX_SPEED += settings.SPEEDUP_MAX_SPEED_ADD;
            settings.MAX_PLAYER_SPEED += settings.SPEEDUP_MAX_SPEED_ADD;
            settings.BUNNYHOP_SPEED_BONUS += settings.SPEEDUP_BUNNYHOP_BONUS_ADD;
        }

        this.isSpeedBoostFading = false;
        this.isSpeedBoostActive = true;
        this.speedBoostRemainingTime = settings.SPEEDUP_DURATION;

        const comboMultiplier = this.triggerComboUpdate(null, true).multiplier;
        const newMultiplier = (comboMultiplier === 1) ? settings.SPEEDUP_SCORE_MULTIPLIER : comboMultiplier + settings.SPEEDUP_SCORE_MULTIPLIER;
        this.triggerComboUpdate({ multiplier: newMultiplier });
    }

    activateDaylight(position, currentTimeOfDay) {
        this.triggerParticles(this.particles.sunrise, position);
        this.playCoinSound();

        this.isNightTransitioning = false;

        if (!this.isDaylightEffectActive) {
            this.isDaylightEffectActive = true;
            this.originalTimeOfDayBeforeEffect = currentTimeOfDay;
            this.originalFogDistanceBeforeEffect = settings.FOG_DISTANCE;
            this.originalRenderDistanceBeforeEffect = settings.RENDER_DISTANCE;
        }

        this.isDayTransitioning = true;
        this.dayTransitionStartTime = this.clock.getElapsedTime();
        this.dayTransitionStartValue = currentTimeOfDay;
        this.dayTransitionStartFog = settings.FOG_DISTANCE;
        this.dayTransitionStartRender = settings.RENDER_DISTANCE;

        this.daylightEffectRemainingTime += settings.DAYLIGHT_EFFECT_DURATION;

        const comboMultiplier = this.triggerComboUpdate(null, true).multiplier;
        const newMultiplier = (comboMultiplier === 1) ? settings.SUNRISE_SCORE_MULTIPLIER : comboMultiplier + settings.SUNRISE_SCORE_MULTIPLIER;
        this.triggerComboUpdate({ multiplier: newMultiplier });
    }

    activateXRay(position) {
        this.triggerParticles(this.particles.xray, position);
        this.playCoinSound();
        this.isXRayActive = true;
        this.xRayRemainingTime = settings.XRAY_DURATION;

        const comboMultiplier = this.triggerComboUpdate(null, true).multiplier;
        const newMultiplier = (comboMultiplier === 1) ? settings.XRAY_SCORE_MULTIPLIER : comboMultiplier + settings.XRAY_SCORE_MULTIPLIER;
        this.triggerComboUpdate({ multiplier: newMultiplier });
    }

    update(delta, sky) {
        const currentTime = this.clock.getElapsedTime();
        let timeOfDay = sky.getTimeOfDay();

        if (this.isSuperJumpActive) {
            this.superJumpRemainingTime -= delta;
            if (this.superJumpRemainingTime <= 0) {
                this.isSuperJumpActive = false;
            }
        }

        if (this.isSpeedBoostActive) {
            this.speedBoostRemainingTime -= delta;
            if (this.speedBoostRemainingTime <= 0) {
                this.isSpeedBoostActive = false;
                this.isSpeedBoostFading = true;
                this.speedBoostFadeoutTimer = settings.SPEEDUP_FADEOUT_DURATION;
                settings.BUNNYHOP_MAX_SPEED -= settings.SPEEDUP_MAX_SPEED_ADD;
                settings.MAX_PLAYER_SPEED -= settings.SPEEDUP_MAX_SPEED_ADD;
                settings.BUNNYHOP_SPEED_BONUS -= settings.SPEEDUP_BUNNYHOP_BONUS_ADD;
            }
        }

        if (this.isXRayActive) {
            this.xRayRemainingTime -= delta;
            if (this.xRayRemainingTime <= 0) {
                this.isXRayActive = false;
            }
        }

        if (this.isDaylightEffectActive) {
            this.daylightEffectRemainingTime -= delta;
            if (this.daylightEffectRemainingTime <= 0 && !this.isNightTransitioning) {
                this.isDaylightEffectActive = false;
                this.isNightTransitioning = true;
                this.nightTransitionStartTime = currentTime;
                this.nightTransitionStartValue = timeOfDay;
                this.nightTransitionStartFog = settings.FOG_DISTANCE;
                this.nightTransitionStartRender = settings.RENDER_DISTANCE;
            }
        }

        if (this.isSpeedBoostFading) {
            this.speedBoostFadeoutTimer -= delta;
            if (this.speedBoostFadeoutTimer <= 0) {
                this.isSpeedBoostFading = false;
            }
        }

        if (this.isDayTransitioning) {
            const elapsedTime = currentTime - this.dayTransitionStartTime;
            let progress = elapsedTime / settings.DAY_TRANSITION_DURATION;
            if (progress >= 1.0) {
                progress = 1.0;
                this.isDayTransitioning = false;
            }
            const newTimeOfDay = lerp(this.dayTransitionStartValue, this.DAY_TRANSITION_TARGET, progress);
            sky.timeOfDay = newTimeOfDay;
            settings.FOG_DISTANCE = lerp(this.dayTransitionStartFog, this.DAY_TRANSITION_TARGET_FOG, progress);
            settings.RENDER_DISTANCE = Math.round(lerp(this.dayTransitionStartRender, settings.SUNRISE_RENDER_DISTANCE, progress));
            this.updateFog();
            this.forceChunkUpdate();
        }

        if (this.isNightTransitioning) {
            const elapsedTime = currentTime - this.nightTransitionStartTime;
            let progress = elapsedTime / settings.DAY_TRANSITION_DURATION;
            if (progress >= 1.0) {
                progress = 1.0;
                this.isNightTransitioning = false;
                sky.timeOfDay = this.originalTimeOfDayBeforeEffect;
                settings.FOG_DISTANCE = this.originalFogDistanceBeforeEffect;
                settings.RENDER_DISTANCE = this.originalRenderDistanceBeforeEffect;
            } else {
                const newTimeOfDay = lerp(this.nightTransitionStartValue, this.originalTimeOfDayBeforeEffect, progress);
                sky.timeOfDay = newTimeOfDay;
                settings.FOG_DISTANCE = lerp(this.nightTransitionStartFog, this.originalFogDistanceBeforeEffect, progress);
                settings.RENDER_DISTANCE = Math.round(lerp(this.nightTransitionStartRender, this.originalRenderDistanceBeforeEffect, progress));
            }
            this.updateFog();
            this.forceChunkUpdate();
        }
    }

    getSpeedBonuses() {
        let speedupBonusValue = 0;
        let playerSpeedupBonusValue = 0;

        if (this.isSpeedBoostActive) {
            speedupBonusValue = settings.SPEEDUP_MAX_SPEED_ADD;
            playerSpeedupBonusValue = settings.SPEEDUP_MAX_SPEED_ADD;
        } else if (this.isSpeedBoostFading) {
            const fadeProgress = this.speedBoostFadeoutTimer / settings.SPEEDUP_FADEOUT_DURATION;
            speedupBonusValue = lerp(0, settings.SPEEDUP_MAX_SPEED_ADD, fadeProgress);
            playerSpeedupBonusValue = lerp(0, settings.SPEEDUP_MAX_SPEED_ADD, fadeProgress);
        }

        return { speedupBonusValue, playerSpeedupBonusValue };
    }

    getEffectiveJumpStrength() {
        return this.isSuperJumpActive ? settings.POWERUP_SUPER_JUMP_STRENGTH : settings.JUMP_STRENGTH;
    }

    getRemainingTimes() {
        return {
            superJump: this.isSuperJumpActive ? Math.max(0, this.superJumpRemainingTime) : 0,
            speedBoost: this.isSpeedBoostActive ? Math.max(0, this.speedBoostRemainingTime) : 0,
            daylight: this.isDaylightEffectActive ? Math.max(0, this.daylightEffectRemainingTime) : 0,
            xray: this.isXRayActive ? Math.max(0, this.xRayRemainingTime) : 0
        };
    }
}