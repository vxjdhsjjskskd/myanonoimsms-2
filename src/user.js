// src/user.js - Функции для работы с пользователями (обновленный для AnonAskBot и MongoDB - Упрощенная)

// Импортируем функции доступа к данным из dataAccess.js (они теперь асинхронны)
const {
    getUserData,
    updateUserData,
} = require('./dataAccess');

// Импортируем функции из utils.js (они теперь асинхронны)
const { getTodayDateString, generateLinkCode } = require('./utils'); // generateAnonymousId удален

/**
 * Регистрирует нового пользователя или возвращает данные существующего.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<object>} Данные пользователя.
 */
async function registerUser(telegramId) {
    const telegramIdStr = String(telegramId);
    let userData = await getUserData(telegramIdStr); // АСИНХРОННЫЙ ВЫЗОВ

    if (!userData) {
        const anonLinkCode = await generateLinkCode(); // АСИНХРОННЫЙ ВЫЗОВ
        const today = getTodayDateString(); // Эта функция синхронна

        const newUserData = {
            chatId: telegramIdStr, // Добавляем chatId для создания нового пользователя
            anonLinkCode: anonLinkCode,
            registeredAt: new Date(),
            messagesReceived: 0,
            messagesSent: 0,
            blockedUsers: [], // Массив Telegram Chat ID для блокировок
            isAutoBlocked: false,
            autoBlockUntil: null,
            currentCommandStep: null,
            tempData: {},
            lastAnonSenderChatId: null
        };
        userData = await updateUserData(telegramIdStr, newUserData); // АСИНХРОННЫЙ ВЫЗОВ
        console.log(`[User] Новый пользователь зарегистрирован: ${telegramIdStr}, ссылка: ${anonLinkCode}`);
        return userData;
    } else {
        console.log(`[User] Существующий пользователь: ${telegramIdStr}`);
        return userData;
    }
}

/**
 * Обновляет счетчик сообщений пользователя за день.
 * (Эта функция не используется в текущей логике, так как нет лимитов на отправку анонимных сообщений)
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {object} userData - Текущие данные пользователя (уже полученные из БД).
 * @returns {Promise<void>}
 */
async function updateMessageCount(telegramId, userData) {
    // Эта функция не используется в вашей описанной логике (нет лимитов на сообщения).
    // Если она вам понадобится в будущем, ее нужно будет доработать.
    console.warn("[User] updateMessageCount вызывается, но не используется в текущей логике.");
    return Promise.resolve();
}

/**
 * Меняет анонимную ссылку пользователя на новую.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Новый код анонимной ссылки.
 */
async function changeAnonymousLink(telegramId) {
    const telegramIdStr = String(telegramId);
    let userData = await getUserData(telegramIdStr); // АСИНХРОННЫЙ ВЫЗОВ

    if (!userData) {
        userData = await registerUser(telegramIdStr); // АСИНХРОННЫЙ ВЫЗОВ
    }

    const oldAnonLinkCode = userData.anonLinkCode;
    const newAnonLinkCode = await generateLinkCode(); // АСИНХРОННЫЙ ВЫЗОВ

    userData.anonLinkCode = newAnonLinkCode;
    await updateUserData(telegramIdStr, userData); // АСИНХРОННЫЙ ВЫЗОВ

    console.log(`[User] Анонимная ссылка пользователя ${telegramIdStr} изменена с ${oldAnonLinkCode} на ${newAnonLinkCode}`);
    return newAnonLinkCode;
}

// changeAnonymousId удален, так как anonymousId больше не используется

module.exports = {
    registerUser,
    updateMessageCount,
    changeAnonymousLink
};
