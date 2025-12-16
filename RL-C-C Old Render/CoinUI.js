// coinUI.js

import { getCoinBalance } from './coinCounter.js';

let coinBalanceElement = null;
let lastDisplayedBalance = -1; // Храним последнее отображенное значение

/**
 * Инициализирует UI-компонент, находя его в DOM.
 */
export function initCoinUI() {
    coinBalanceElement = document.getElementById('coin-balance');
    if (coinBalanceElement) {
        console.log("Coin UI инициализирован.");
        updateCoinUI(); // Обновляем сразу при запуске
    } else {
        console.error("Элемент #coin-balance не найден в DOM!");
    }
}

/**
 * Обновляет текст в UI, если баланс изменился.
 */
export function updateCoinUI() {
    if (!coinBalanceElement) return;

    const currentBalance = getCoinBalance();

    // Обновляем DOM только если значение действительно изменилось.
    // Это небольшая, но важная оптимизация.
    if (currentBalance !== lastDisplayedBalance) {
        coinBalanceElement.textContent = currentBalance;
        lastDisplayedBalance = currentBalance;
    }
}