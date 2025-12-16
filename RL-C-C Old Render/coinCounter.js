// coinCounter.js

// Переменная для хранения количества монет. `let` позволяет изменять её значение.
let coinBalance = 0;

/**
 * Возвращает текущий баланс монет.
 * @returns {number} Текущее количество монет.
 */
function getCoinBalance() {
    return coinBalance;
}

/**
 * Добавляет указанное количество монет к балансу.
 * @param {number} amount - Количество монет для добавления.
 */
function addCoins(amount) {
    if (amount > 0) {
        coinBalance += amount;
        console.log(`Добавлено ${amount} монет. Новый баланс: ${coinBalance}`);
    }
}

/**
 * Пытается списать монеты. Возвращает true в случае успеха и false, если монет недостаточно.
 * @param {number} amount - Количество монет для списания.
 * @returns {boolean} - True, если покупка совершена, иначе false.
 */
function spendCoins(amount) {
    if (amount > 0 && coinBalance >= amount) {
        coinBalance -= amount;
        console.log(`Потрачено ${amount} монет. Остаток: ${coinBalance}`);
        return true;
    }
    console.log(`Недостаточно монет для покупки. Требуется: ${amount}, в наличии: ${coinBalance}`);
    return false;
}

// Экспортируем функции, чтобы их можно было использовать в других файлах.
export { getCoinBalance, addCoins, spendCoins };