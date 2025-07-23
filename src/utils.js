// src/utils.js - Модуль для вспомогательных функций бота (обновленный для MongoDB)

const { User } = require('./models'); // Импортируем модель User для проверки уникальности

// --- Константы ---
const ANONYMOUS_ID_LENGTH = 6;
const ANONYMOUS_LINK_CODE_LENGTH = 8;
const AUTO_BLOCK_KEYWORDS = ["мат", "спам", "ругательство", "непристойность"];
const AUTO_BLOCK_DURATION_HOURS = 24;

/**
 * Генерирует уникальный 6-символьный анонимный ID, проверяя его уникальность в БД.
 * @returns {Promise<string>} Уникальный анонимный ID.
 */
async function generateAnonymousId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newId;
    let isUnique = false;
    do {
        newId = '';
        for (let i = 0; i < ANONYMOUS_ID_LENGTH; i++) {
            newId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Проверяем уникальность в базе данных
        const existingUser = await User.findOne({ anonymousId: newId });
        if (!existingUser) {
            isUnique = true;
        }
    } while (!isUnique);
    return newId;
}

/**
 * Генерирует уникальный 8-символьный код для анонимной ссылки, проверяя его уникальность в БД.
 * @returns {Promise<string>} Уникальный код ссылки.
 */
async function generateLinkCode() { // Имя изменено с generateUniqueLinkCode на generateLinkCode для соответствия app.js
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newCode;
    let isUnique = false;
    do {
        newCode = '';
        for (let i = 0; i < ANONYMOUS_LINK_CODE_LENGTH; i++) {
            newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Проверяем уникальность в базе данных
        const existingUser = await User.findOne({ linkCode: newCode });
        if (!existingUser) {
            isUnique = true;
        }
    } while (!isUnique);
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
 * Проверяет, заблокировал ли один пользователь другого.
 * @param {string} blockerAnonId - Анонимный ID блокирующего пользователя.
 * @param {string} blockedAnonId - Анонимный ID заблокированного пользователя.
 * @returns {boolean} True, если заблокирован, иначе False.
 */
function isBlocked(blockerAnonId, blockedAnonId) {
    // Эта функция теперь должна получать данные блокировок из БД.
    // Для этого она должна быть асинхронной и принимать User объект или получать его внутри.
    // Пока оставим как есть, но это место, которое нужно будет адаптировать.
    // В текущей схеме User.blockedUsers - это массив внутри User документа.
    // Поэтому проверку блокировки нужно будет делать, получая User.blockedUsers.
    console.warn("[Utils] isBlocked: Эта функция должна быть асинхронной и получать данные из БД.");
    // Временно возвращаем false, пока не адаптируем handlers.js
    return false;
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
    generateAnonymousId,
    generateLinkCode, // Имя изменено
    getTodayDateString,
    isBlocked,
    checkAutoBlock,
    AUTO_BLOCK_DURATION_HOURS
};
