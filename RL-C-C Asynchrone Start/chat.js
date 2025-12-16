// ФАЙЛ: chat.js

import * as THREE from 'three';

const botResponses = {
    greetings: { keywords: ["привет", "здаров", "ку", "hi", "hello"], response: "Привет! Как успехи?" },
    how_are_you: { keywords: ["как дела", "как ты", "что как"], response: "Все отлично, пытаюсь побить свой рекорд скорости. А ты?" },
    game_opinion: { keywords: ["игра", "нравится", "круто"], response: "Ага, игра затягивает! Особенно когда ловишь ритм в банни-хопе." },
    speed: { keywords: ["скорость", "быстро", "гонка"], response: "Gotta go fast! Скорость - это все!" },
    coins: { keywords: ["монеты", "деньги", "очки"], response: "Видел ту желтую штуку? За нее дают неплохой бонус к скорости." },
    bye: { keywords: ["пока", "бб", "до встречи", "bye"], response: "Удачи! Увидимся на трассе." }
};
const defaultResponse = "Хм, не знаю, что сказать. Просто бегаю :)";

export class Chat {
    constructor(context, texture, scale = 1.0) {
        this.context = context;
        this.texture = texture;
        this.scale = scale;

        // ... (остальные свойства без изменений)
        this.isInInputMode = false;
        this.visibilityTimer = 0;
        this.VISIBILITY_DURATION = 7.0;
        this.currentOpacity = 0.0;
        this.messageHistory = [];
        this.currentInput = "";
        this.maxHistoryLength = 10;
        this.cursorBlinkRate = 400;
    }

    // ... (методы showForInput, hideInput, addMessage, sendMessage, simulateResponse, handleKeydown, update остаются БЕЗ ИЗМЕНЕНИЙ)
    showForInput() { this.isInInputMode = true; this.visibilityTimer = this.VISIBILITY_DURATION; this.currentInput = ""; }
    hideInput() { this.isInInputMode = false; }
    addMessage(sender, text, color) { this.messageHistory.push({ sender, text, color }); if (this.messageHistory.length > this.maxHistoryLength) { this.messageHistory.shift(); } this.visibilityTimer = this.VISIBILITY_DURATION; }
    sendMessage() { const textToSend = this.currentInput.trim(); if (textToSend === "") return; this.addMessage('You', textToSend, '#87CEEB'); this.simulateResponse(textToSend); this.currentInput = ""; }
    simulateResponse(inputText) { const lowerCaseText = inputText.toLowerCase(); let response = defaultResponse; for (const category in botResponses) { const data = botResponses[category]; if (data.keywords.some(keyword => lowerCaseText.includes(keyword))) { response = data.response; break; } } const delay = 1000 + Math.random() * 1500; setTimeout(() => { this.addMessage('Player2', response, '#EEEEEE'); }, delay); }
    handleKeydown(event) { event.stopPropagation(); if (event.key.length === 1) { this.currentInput += event.key; } else if (event.key === 'Backspace') { this.currentInput = this.currentInput.slice(0, -1); } else if (event.key === 'Space') { this.currentInput += ' '; } }
    update(delta) { if (this.visibilityTimer > 0) { this.visibilityTimer -= delta; this.currentOpacity = Math.min(1.0, this.currentOpacity + delta * 4.0); } else { this.currentOpacity = Math.max(0.0, this.currentOpacity - delta * 4.0); } }
    calculateWrappedLines(ctx, text, maxWidth) { const words = text.split(' '); const lines = []; let currentLine = ''; for (const word of words) { const testLine = currentLine + word + ' '; const metrics = ctx.measureText(testLine); if (metrics.width > maxWidth && currentLine.length > 0) { lines.push(currentLine.trim()); currentLine = word + ' '; } else { currentLine = testLine; } } lines.push(currentLine.trim()); return lines; }
    hideImmediately() {
        this.isInInputMode = false;
        this.targetOpacity = 0;
        this.currentOpacity = 0;
        this.draw(); // Принудительно очищаем холст
    }


    // --- ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ МЕТОД DRAW ---
    draw() {
        if (!this.context || !this.texture || this.currentOpacity <= 0) {
            if (this.context) this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
            this.texture.needsUpdate = true;
            return;
        };

        const ctx = this.context;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // --- НОВЫЕ КОНСТАНТЫ ДЛЯ УПРАВЛЕНИЯ ШРИФТОМ ---
        const FONT_VERTICAL_STRETCH = 1.1; // <--- ГЛАВНЫЙ ПАРАМЕТР! 1.3 = на 30% выше. Поставьте 1.5 для более высокого.

        const BASE_FONT_SIZE = 50; // Базовый размер шрифта
        const BASE_LINE_HEIGHT = 53; // Базовая высота строки

        const FONT_SIZE = BASE_FONT_SIZE * this.scale;
        const PADDING = 15 * this.scale;
        const LINE_HEIGHT = BASE_LINE_HEIGHT * this.scale * FONT_VERTICAL_STRETCH; // Высота строки теперь зависит от растяжения!
        // --- КОНЕЦ НОВЫХ КОНСТАНТ ---

        const FONT = `${FONT_SIZE}px 'Roboto Mono'`; // <--- ИЗМЕНЕНИЕ ЗДЕСЬ
        const MAX_WIDTH = width - PADDING * 2;

        ctx.clearRect(0, 0, width, height);

        const baseOpacity = this.isInInputMode ? 0.7 : 0.4;
        const finalOpacity = baseOpacity * this.currentOpacity;
        ctx.fillStyle = `rgba(0, 0, 0, ${finalOpacity})`;
        ctx.fillRect(0, 0, width, height);

        ctx.font = FONT;
        let currentY = height - PADDING;

        // 1. Отрисовка строки ввода
        if (this.isInInputMode) {
            currentY -= LINE_HEIGHT;
            let inputText = `> ${this.currentInput}`;
            if (Math.floor(Date.now() / this.cursorBlinkRate) % 2 === 0) {
                inputText += '_';
            }
            ctx.save(); // Сохраняем состояние холста
            ctx.translate(PADDING, height - PADDING); // Перемещаем точку отсчета в место отрисовки текста
            ctx.scale(1, FONT_VERTICAL_STRETCH); // Растягиваем холст по вертикали
            ctx.fillStyle = `rgba(255, 255, 255, ${this.currentOpacity})`;
            ctx.fillText(inputText, 0, 0); // Рисуем в новой, растянутой системе координат
            ctx.restore(); // Возвращаем холст в нормальное состояние
        }

        // 2. Отрисовка истории сообщений
        for (let i = this.messageHistory.length - 1; i >= 0; i--) {
            if (currentY < 0) break;

            const msg = this.messageHistory[i];
            const senderPrefix = `${msg.sender}: `;
            const prefixWidth = ctx.measureText(senderPrefix).width;

            const textLines = this.calculateWrappedLines(ctx, msg.text, MAX_WIDTH - prefixWidth);

            for (let j = textLines.length - 1; j >= 0; j--) {
                const line = textLines[j];
                let lineX = PADDING;
                const color = new THREE.Color(msg.color);

                ctx.save(); // Сохраняем
                ctx.translate(lineX, currentY); // Перемещаем
                ctx.scale(1, FONT_VERTICAL_STRETCH); // Растягиваем
                ctx.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${this.currentOpacity})`;

                if (j === 0) {
                    ctx.fillText(senderPrefix, 0, 0);
                    ctx.fillText(line, prefixWidth, 0);
                } else {
                    ctx.fillText(line, prefixWidth, 0);
                }

                ctx.restore(); // Возвращаем
                currentY -= LINE_HEIGHT;
            }
        }

        this.texture.needsUpdate = true;
    }
}