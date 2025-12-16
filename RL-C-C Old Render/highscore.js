// highscore.js

// Ключ, по которому мы будем хранить рекорд в браузере
const HIGH_SCORE_STORAGE_KEY = 'myGameHighScore';

let currentScore = 0;
let highScore = 0;

// Ссылки на HTML-элементы для отображения
let currentScoreEl;
let highScoreEl;

// --- Внутренняя функция для обновления текста на экране ---
function updateDisplay() {
    if (currentScoreEl) {
        currentScoreEl.textContent = `Score: ${currentScore}`;
    }
    if (highScoreEl) {
        highScoreEl.textContent = `High Score: ${highScore}`;
    }
}

// --- Функции, которые мы будем вызывать из game.js ---

/**
 * Инициализирует систему рекордов.
 * Вызывается один раз при запуске игры.
 */
export function initHighScore() {
    // Находим HTML-элементы
    currentScoreEl = document.getElementById('current-score');
    highScoreEl = document.getElementById('high-score');

    // Загружаем рекорд из памяти браузера
    const savedHighScore = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    highScore = savedHighScore ? parseInt(savedHighScore, 10) : 0;

    // Сбрасываем текущий счет
    currentScore = 0;

    // Обновляем отображение
    updateDisplay();
    console.log(`High score system initialized. High score is ${highScore}`);
}

/**
 * Добавляет очки к текущему счету.
 * @param {number} points - Количество добавляемых очков.
 */
export function addScore(points) {
    currentScore += points;

    // Проверяем, не побит ли рекорд
    if (currentScore > highScore) {
        highScore = currentScore;
        // Сохраняем новый рекорд в память браузера
        localStorage.setItem(HIGH_SCORE_STORAGE_KEY, highScore.toString());
    }

    // Обновляем отображение
    updateDisplay();
}

/**
 * Сбрасывает текущий счет (полезно для будущей кнопки "Начать заново").
 */
export function resetScore() {
    currentScore = 0;
    updateDisplay();
}