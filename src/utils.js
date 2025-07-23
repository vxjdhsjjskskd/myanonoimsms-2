// src/utils.js - Модуль для вспомогательных функций бота (обновленный для MongoDB - Упрощенная)

const { User } = require('./models'); // Импортируем модель User для проверки уникальности

// --- Константы ---
const ANONYMOUS_LINK_CODE_LENGTH = 8; // Длина кода для анонимной ссылки
const AUTO_BLOCK_KEYWORDS = ["мат", "спам", "ругательство", "непристойность"];
const AUTO_BLOCK_DURATION_HOURS = 24;

/**
 * Генерирует уникальный 8-символьный код для анонимной ссылки, проверяя его уникальность в БД.
 * @returns {Promise<string|null>} Уникальный код ссылки или null, если не удалось сгенерировать.
 */
async function generateLinkCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newCode;
    let isUnique = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 1000; // Увеличиваем количество попыток

    console.log(`[Utils.generateLinkCode] Начинаем генерацию уникального кода ссылки.`);
    do {
        newCode = '';
        for (let i = 0; i < ANONYMOUS_LINK_CODE_LENGTH; i++) {
            newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Проверяем уникальность в базе данных
        console.log(`[Utils.generateLinkCode] Попытка ${attempts + 1}: Проверяем код ${newCode}`);
        const existingUser = await User.findOne({ anonLinkCode: newCode });
        if (!existingUser) {
            isUnique = true;
            console.log(`[Utils.generateLinkCode] Код ${newCode} уникален.`);
        } else {
            console.log(`[Utils.generateLinkCode] Код ${newCode} уже существует.`);
        }
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
            console.error(`[Utils.generateLinkCode] ОШИБКА: Не удалось сгенерировать уникальный код после ${MAX_ATTEMPTS} попыток.`);
            return null; // Возвращаем null, если не удалось сгенерировать
        }
    } while (!isUnique);
    console.log(`[Utils.generateLinkCode] Сгенерирован уникальный код: ${newCode} за ${attempts} попыток.`);
    return newCode;
}

/**
 * Возвращает текущую дату в формате YYYY-MM-DD.
 * @returns {string} Строка с текущей датой.
 */
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Проверяет сообщение на наличие ключевых слов для автоматической блокировки (мат, спам).
 * @param {string} messageText - Текст сообщения.
 * @returns {boolean} True, если обнаружены запрещенные слова, иначе False.
 */
function checkAutoBlock(messageText) {
    const textLower = messageText.toLowerCase();
    for (const keyword of AUTO_BLOCK_KEYWORDS) {
        if (textLower.includes(keyword)) {
            return true;
        }
    }
    return false;
}

// Экспортируем все вспомогательные функции и константы
module.exports = {
    generateLinkCode,
    getTodayDateString,
    checkAutoBlock,
    AUTO_BLOCK_DURATION_HOURS
};
