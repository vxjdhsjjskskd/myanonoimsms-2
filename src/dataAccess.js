// src/dataAccess.js - Модуль для доступа к данным MongoDB (заменяет src/database.js)

const { User } = require('./models'); // Импортируем модель User

/**
 * Инициализация базы данных (для MongoDB это просто подключение).
 * В этой версии функция initializeDb из app.js будет вызывать connectDb из src/db.js.
 * Здесь мы просто возвращаем Promise.resolve(), чтобы не ломать текущую логику app.js.
 */
async function initializeDb() {
    console.log("[DB Access] Инициализация слоя доступа к данным (MongoDB).");
    // Реальное подключение к БД будет в app.js через src/db.js
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
 * Получает карту linkCode -> chatId.
 * В MongoDB это будет поиск по коллекции User.
 * @returns {Promise<object>} Объект, где ключ - linkCode, значение - chatId.
 */
async function getAnonLinkMap() {
    const users = await User.find({}).select('linkCode chatId').lean();
    const linkMap = {};
    users.forEach(user => {
        // Добавлена проверка на user.linkCode
        if (user.linkCode) {
            linkMap[user.linkCode.toUpperCase()] = user.chatId;
        } else {
            console.warn(`[DB Access] Пользователь с chatId ${user.chatId} не имеет linkCode.`);
        }
    });
    return linkMap;
}

/**
 * Устанавливает запись в карте linkCode -> chatId (создает пользователя).
 * Эта функция будет вызываться только при регистрации нового пользователя.
 * @param {string} linkCode - Код ссылки.
 * @param {string|number} chatId - Telegram Chat ID пользователя.
 * @returns {Promise<void>}
 */
async function setAnonLinkMapEntry(linkCode, chatId) {
    // Эта логика будет встроена в updateUserData/createUser,
    // так как linkCode является полем в документе User.
    // Здесь заглушка, чтобы не ломать импорты.
    console.warn("[DB Access] setAnonLinkMapEntry вызывается, но логика встроена в User-операции.");
    return Promise.resolve();
}

/**
 * Удаляет запись из карты linkCode -> chatId (при смене ссылки).
 * @param {string} linkCode - Код ссылки для удаления.
 * @returns {Promise<void>}
 */
async function deleteAnonLinkMapEntry(linkCode) {
    // Эта логика будет обрабатываться при обновлении linkCode пользователя.
    // Если пользователь меняет ссылку, старая ссылка перестает быть связанной с ним.
    // Для обеспечения уникальности старый linkCode просто перестает использоваться.
    // Если нужно полностью удалить запись, это сложнее без отдельной коллекции для ссылок.
    console.warn("[DB Access] deleteAnonLinkMapEntry вызывается, но логика удаления старых ссылок не требуется, т.к. linkCode уникален для пользователя.");
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
    initializeDb, // Заглушка, реальная инициализация в app.js
    getUserData,
    updateUserData,
    getAnonLinkMap,
    setAnonLinkMapEntry, // Заглушка
    deleteAnonLinkMapEntry, // Заглушка
    getAllUsers
};
