// src/user.js - Функции для работы с пользователями (обновленный для AnonAskBot и MongoDB - Упрощенная)

// Импортируем функции доступа к данным из dataAccess.js (они теперь асинхронны)
const {
    getUserData,
    updateUserData,
} = require('./dataAccess');

// Импортируем функции из utils.js (они теперь асинхронны)
const { getTodayDateString, generateLinkCode } = require('./utils');

/**
 * Регистрирует нового пользователя или возвращает данные существующего.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<object>} Данные пользователя.
 */
async function registerUser(telegramId) {
    const telegramIdStr = String(telegramId);
    console.log(`[User.registerUser] Попытка получить данные для chatId: ${telegramIdStr}`);
    let userData = await getUserData(telegramIdStr); // АСИНХРОННЫЙ ВЫЗОВ

    if (!userData) {
        console.log(`[User.registerUser] Пользователь ${telegramIdStr} не найден, создаем нового.`);
        const anonLinkCode = await generateLinkCode(); // АСИНХРОННЫЙ ВЫЗОВ
        if (!anonLinkCode) {
            console.error(`[User.registerUser] ОШИБКА: generateLinkCode вернул null для ${telegramIdStr}.`);
            throw new Error("Не удалось сгенерировать уникальный код ссылки.");
        }
        console.log(`[User.registerUser] Сгенерирован anonLinkCode: ${anonLinkCode}`);
        const today = getTodayDateString();

        const newUserData = {
            chatId: telegramIdStr,
            anonLinkCode: anonLinkCode,
            registeredAt: new Date(),
            messagesReceived: 0,
            messagesSent: 0,
            blockedUsers: [],
            isAutoBlocked: false,
            autoBlockUntil: null,
            currentCommandStep: null,
            tempData: {},
            lastAnonSenderChatId: null
        };
        console.log(`[User.registerUser] Данные нового пользователя перед сохранением:`, newUserData);
        userData = await updateUserData(telegramIdStr, newUserData); // АСИНХРОННЫЙ ВЫЗОВ
        console.log(`[User.registerUser] Новый пользователь зарегистрирован и сохранен. Возвращаемые данные (после updateUserData):`, userData);
        return userData;
    } else {
        console.log(`[User.registerUser] Существующий пользователь: ${telegramIdStr}. Данные:`, userData);
        return userData;
    }
}

/**
 * Обновляет счетчик сообщений пользователя за день.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {object} userData - Текущие данные пользователя (уже полученные из БД).
 * @returns {Promise<void>}
 */
async function updateMessageCount(telegramId, userData) {
    console.warn("[User.updateMessageCount] Вызывается, но не используется в текущей логике.");
    return Promise.resolve();
}

/**
 * Меняет анонимную ссылку пользователя на новую.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Новый код анонимной ссылки.
 */
async function changeAnonymousLink(telegramId) {
    const telegramIdStr = String(telegramId);
    console.log(`[User.changeAnonymousLink] Попытка получить данные для chatId: ${telegramIdStr}`);
    let userData = await getUserData(telegramIdStr); // АСИНХРОННЫЙ ВЫЗОВ

    if (!userData) {
        console.log(`[User.changeAnonymousLink] Пользователь ${telegramIdStr} не найден, регистрируем.`);
        userData = await registerUser(telegramIdStr); // АСИНХРОННЫЙ ВЫЗОВ
    }

    const oldAnonLinkCode = userData.anonLinkCode;
    console.log(`[User.changeAnonymousLink] Старый anonLinkCode: ${oldAnonLinkCode}`);
    const newAnonLinkCode = await generateLinkCode(); // АСИНХРОННЫЙ ВЫЗОВ
    if (!newAnonLinkCode) {
        console.error(`[User.changeAnonymousLink] ОШИБКА: generateLinkCode вернул null при смене ссылки для ${telegramIdStr}.`);
        throw new Error("Не удалось сгенерировать новый уникальный код ссылки.");
    }
    console.log(`[User.changeAnonymousLink] Новый anonLinkCode: ${newAnonLinkCode}`);

    userData.anonLinkCode = newAnonLinkCode;
    await updateUserData(telegramIdStr, userData); // АСИНХРОННЫЙ ВЫЗОВ

    console.log(`[User.changeAnonymousLink] Анонимная ссылка пользователя ${telegramIdStr} изменена с ${oldAnonLinkCode} на ${newAnonLinkCode}`);
    return newAnonLinkCode;
}

module.exports = {
    registerUser,
    updateMessageCount,
    changeAnonymousLink
};
