// src/dataAccess.js - Модуль для доступа к данным MongoDB (заменяет src/inMemoryDb.js)

const { User } = require('./models'); // Импортируем модель User

/**
 * Инициализация базы данных (для MongoDB это просто подключение).
 * В этой версии функция initializeDb из app.js будет вызывать connectDb из src/db.js.
 * Здесь мы просто возвращаем Promise.resolve(), чтобы не ломать текущую логику app.js.
 */
async function initializeDb() {
    console.log("[DB Access] Инициализация слоя доступа к данным (MongoDB).");
    return Promise.resolve();
}

/**
 * Получает данные пользователя по chat ID.
 * @param {string|number} telegramId - Telegram Chat ID пользователя.
 * @returns {Promise<object|null>} Объект пользователя или null, если не найден.
 */
async function getUserData(telegramId) {
    return await User.findOne({ chatId: String(telegramId) }).lean(); // .lean() для получения простого JS объекта
}

/**
 * Обновляет данные пользователя. Если пользователя нет, создает его.
 * @param {string|number} telegramId - Telegram Chat ID пользователя.
 * @param {object} userData - Объект с полями для обновления или создания.
 * @returns {Promise<object>} Обновленный/созданный объект пользователя.
 */
async function updateUserData(telegramId, userData) {
    const existingUser = await User.findOne({ chatId: String(telegramId) });
    if (existingUser) {
        // Обновляем существующего пользователя
        Object.assign(existingUser, userData); // Копируем новые данные
        await existingUser.save();
        return existingUser.lean();
    } else {
        // Создаем нового пользователя
        const newUser = new User({ chatId: String(telegramId), ...userData });
        await newUser.save();
        return newUser.lean();
    }
}

/**
 * Получает Telegram ID пользователя по его анонимному ID.
 * @param {string} anonymousId - Анонимный ID пользователя.
 * @returns {Promise<string|null>} Telegram ID пользователя или null, если не найден.
 */
async function getTelegramIdByAnonymousId(anonymousId) {
    const user = await User.findOne({ anonymousId: anonymousId.toUpperCase() }).select('chatId').lean();
    return user ? user.chatId : null;
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
        if (user.anonLinkCode) { // Добавлена проверка на существование anonLinkCode
            linkMap[user.anonLinkCode.toUpperCase()] = user.chatId;
        } else {
            console.warn(`[DB Access] Пользователь с chatId ${user.chatId} не имеет anonLinkCode.`);
        }
    });
    return linkMap;
}

/**
 * Заглушка, так как логика создания/обновления linkCode теперь встроена в User модель.
 */
async function setAnonLinkMapEntry(anonLinkCode, telegramId) {
    console.warn("[DB Access] setAnonLinkMapEntry вызывается, но логика встроена в User-операции.");
    return Promise.resolve();
}

/**
 * Заглушка, так как логика удаления старых linkCode не требуется напрямую.
 */
async function deleteAnonLinkMapEntry(anonLinkCode) {
    console.warn("[DB Access] deleteAnonLinkMapEntry вызывается, но логика удаления старых ссылок не требуется, т.к. anonLinkCode уникален для пользователя.");
    return Promise.resolve();
}

/**
 * Заглушка, так как блокировки хранятся в User модели.
 */
function getBlocks() {
    console.warn("[DB Access] getBlocks вызывается, но блокировки хранятся в User модели.");
    return {}; // Возвращаем пустой объект, чтобы не ломать логику
}

/**
 * Заглушка, так как блокировки хранятся в User модели.
 */
async function updateBlocksData(blockerAnonId, blockedList) {
    console.warn("[DB Access] updateBlocksData вызывается, но блокировки хранятся в User модели.");
    return Promise.resolve();
}

/**
 * Заглушка, так как сообщения не хранятся в БД для inbox.
 */
function getMessages() {
    console.warn("[DB Access] getMessages вызывается, но сообщения не хранятся в БД для inbox.");
    return [];
}

/**
 * Заглушка, так как сообщения не хранятся в БД.
 */
function addMessage(message) {
    console.warn("[DB Access] addMessage вызывается, но сообщения не сохраняются в БД.");
}

/**
 * Заглушка, так как anonIdMap не используется напрямую.
 */
function getAnonIdMap() {
    console.warn("[DB Access] getAnonIdMap вызывается, но anonIdMap не используется напрямую.");
    return {};
}

/**
 * Заглушка, так как anonIdMap не используется напрямую.
 */
function setAnonIdMapEntry(anonId, telegramId) {
    console.warn("[DB Access] setAnonIdMapEntry вызывается, но anonIdMap не используется напрямую.");
    return Promise.resolve();
}

/**
 * Заглушка, так как anonIdMap не используется напрямую.
 */
function deleteAnonIdMapEntry(anonId) {
    console.warn("[DB Access] deleteAnonIdMapEntry вызывается, но anonIdMap не используется напрямую.");
    return Promise.resolve();
}

/**
 * Получает всех пользователей.
 * @returns {Promise<Array<object>>} Массив всех пользователей.
 */
async function getAllUsers() {
    return await User.find({}).lean();
}


module.exports = {
    initializeDb,
    getUserData,
    updateUserData,
    getTelegramIdByAnonymousId,
    getTelegramIdByAnonLinkCode,
    getAnonLinkMap,
    setAnonLinkMapEntry, // Заглушка
    deleteAnonLinkMapEntry, // Заглушка
    getBlocks, // Заглушка
    updateBlocksData, // Заглушка
    getMessages, // Заглушка
    addMessage, // Заглушка
    getAnonIdMap, // Заглушка
    setAnonIdMapEntry, // Заглушка
    deleteAnonIdMapEntry, // Заглушка
    getAllUsers
};
        
