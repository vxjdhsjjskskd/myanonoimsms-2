// src/dataAccess.js - Модуль для доступа к данным MongoDB (заменяет src/database.js)

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
 * @param {string|number} chatId - Telegram Chat ID пользователя.
 * @returns {Promise<object|null>} Объект пользователя или null, если не найден.
 */
async function getUserData(chatId) {
    return await User.findOne({ chatId: String(chatId) }).lean();
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
        Object.assign(existingUser, userData);
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
 * @returns {Promise<object>} Объект, где ключ - linkCode, значение - chatId.
 */
async function getAnonLinkMap() {
    const users = await User.find({}).select('linkCode chatId').lean();
    const linkMap = {};
    users.forEach(user => {
        if (user.linkCode) { // Добавлена проверка на существование linkCode
            linkMap[user.linkCode.toUpperCase()] = user.chatId;
        } else {
            console.warn(`[DB Access] Пользователь с chatId ${user.chatId} не имеет linkCode.`);
        }
    });
    return linkMap;
}

/**
 * Заглушка, так как логика создания/обновления linkCode теперь встроена в User модель.
 */
async function setAnonLinkMapEntry(linkCode, chatId) {
    console.warn("[DB Access] setAnonLinkMapEntry вызывается, но логика встроена в User-операции.");
    return Promise.resolve();
}

/**
 * Заглушка, так как логика удаления старых linkCode не требуется напрямую.
 */
async function deleteAnonLinkMapEntry(linkCode) {
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
    initializeDb,
    getUserData,
    updateUserData,
    getAnonLinkMap,
    setAnonLinkMapEntry,
    deleteAnonLinkMapEntry,
    getAllUsers
};
