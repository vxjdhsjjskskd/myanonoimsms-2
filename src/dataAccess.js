// src/dataAccess.js - Модуль для доступа к данным MongoDB (Упрощенная версия)

const { User } = require('./models'); // Импортируем модель User

/**
 * Инициализация базы данных (для MongoDB это просто подключение).
 */
async function initializeDb() {
    console.log("[DB Access] Инициализация слоя доступа к данным (MongoDB).");
    return Promise.resolve();
}

/**
 * Получает данные пользователя по chat ID.
 * @param {string|number} chatId - Telegram Chat ID пользователя.
 * @returns {Promise<object|null>} Объект пользователя или null, если не найден.
 */
async function getUserData(chatId) {
    return await User.findOne({ chatId: String(chatId) }).lean(); // .lean() для получения простого JS объекта
}

/**
 * Обновляет данные пользователя. Если пользователя нет, создает его.
 * @param {string|number} chatId - Telegram Chat ID пользователя.
 * @param {object} userData - Объект с полями для обновления или создания.
 * @returns {Promise<object>} Обновленный/созданный объект пользователя.
 */
async function updateUserData(chatId, userData) {
    const existingUser = await User.findOne({ chatId: String(chatId) });
    if (existingUser) {
        // Обновляем существующего пользователя
        Object.assign(existingUser, userData); // Копируем новые данные
        await existingUser.save();
        return existingUser.lean();
    } else {
        // Создаем нового пользователя
        const newUser = new User({ chatId: String(chatId), ...userData });
        await newUser.save();
        return newUser.lean();
    }
}

/**
 * Получает Telegram ID пользователя по коду его анонимной ссылки.
 * @param {string} anonLinkCode - Код анонимной ссылки.
 * @returns {Promise<string|null>} Telegram ID пользователя или null, если не найден.
 */
async function getTelegramIdByAnonLinkCode(anonLinkCode) {
    const user = await User.findOne({ anonLinkCode: anonLinkCode.toUpperCase() }).select('chatId').lean();
    return user ? user.chatId : null;
}

/**
 * Получает карту linkCode -> chatId.
 * @returns {Promise<object>} Объект, где ключ - linkCode, значение - chatId.
 */
async function getAnonLinkMap() {
    const users = await User.find({}).select('anonLinkCode chatId').lean();
    const linkMap = {};
    users.forEach(user => {
        if (user.anonLinkCode) {
            linkMap[user.anonLinkCode.toUpperCase()] = user.chatId;
        } else {
            console.warn(`[DB Access] Пользователь с chatId ${user.chatId} не имеет anonLinkCode.`);
        }
    });
    return linkMap;
}

// --- Заглушки для функций, которые больше не используются ---
// (или их логика изменена и встроена в другие места)

async function getTelegramIdByAnonymousId(anonymousId) {
    console.warn("[DB Access] getTelegramIdByAnonymousId вызывается, но anonymousId больше не используется для поиска.");
    return null;
}

function getBlocks() {
    console.warn("[DB Access] getBlocks вызывается, но блокировки хранятся в User модели.");
    return {};
}

async function updateBlocksData(blockerAnonId, blockedList) {
    console.warn("[DB Access] updateBlocksData вызывается, но блокировки хранятся в User модели.");
    return Promise.resolve();
}

function getMessages() {
    console.warn("[DB Access] getMessages вызывается, но сообщения не хранятся в БД для inbox.");
    return [];
}

function addMessage(message) {
    console.warn("[DB Access] addMessage вызывается, но сообщения не сохраняются в БД.");
}

function getAnonIdMap() {
    console.warn("[DB Access] getAnonIdMap вызывается, но anonIdMap больше не используется.");
    return {};
}

function setAnonIdMapEntry(anonId, telegramId) {
    console.warn("[DB Access] setAnonIdMapEntry вызывается, но anonIdMap больше не используется.");
    return Promise.resolve();
}

function deleteAnonIdMapEntry(anonId) {
    console.warn("[DB Access] deleteAnonIdMapEntry вызывается, но anonIdMap больше не используется.");
    return Promise.resolve();
}

async function setAnonLinkMapEntry(anonLinkCode, telegramId) {
    console.warn("[DB Access] setAnonLinkMapEntry вызывается, но логика встроена в User-операции.");
    return Promise.resolve();
}

async function deleteAnonLinkMapEntry(anonLinkCode) {
    console.warn("[DB Access] deleteAnonLinkMapEntry вызывается, но логика удаления старых ссылок не требуется, т.к. anonLinkCode уникален для пользователя.");
    return Promise.resolve();
}

async function getAllUsers() {
    return await User.find({}).lean();
}


module.exports = {
    initializeDb,
    getUserData,
    updateUserData,
    getTelegramIdByAnonLinkCode,
    getAnonLinkMap,
    // Заглушки (если они все еще импортируются в других файлах)
    getTelegramIdByAnonymousId,
    getBlocks,
    updateBlocksData,
    getMessages,
    addMessage,
    getAnonIdMap,
    setAnonIdMapEntry,
    deleteAnonIdMapEntry,
    setAnonLinkMapEntry,
    deleteAnonLinkMapEntry,
    getAllUsers
};
