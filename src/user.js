// src/user.js - Функции для работы с пользователями (обновленный для AnonAskBot и MongoDB)

// Импортируем функции доступа к данным из dataAccess.js (они теперь асинхронны)
const {
    getUserData,
    updateUserData,
} = require('./dataAccess'); // <--- ИЗМЕНЕНО: inMemoryDb -> dataAccess

// Импортируем функции из utils.js (они тоже теперь асинхронны)
const { generateAnonymousId, getTodayDateString, generateLinkCode } = require('./utils'); // <--- ИЗМЕНЕНО: generateUniqueLinkCode -> generateLinkCode

/**
 * Регистрирует нового пользователя или возвращает данные существующего.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<object>} Данные пользователя.
 */
async function registerUser(telegramId) {
    const telegramIdStr = String(telegramId);
    let userData = await getUserData(telegramIdStr); // <--- АСИНХРОННЫЙ ВЫЗОВ

    if (!userData) {
        const anonId = await generateAnonymousId(); // <--- АСИНХРОННЫЙ ВЫЗОВ
        const anonLinkCode = await generateLinkCode(); // <--- АСИНХРОННЫЙ ВЫЗОВ
        const today = getTodayDateString(); // Эта функция синхронна

        const newUserData = {
            chatId: telegramIdStr, // Добавляем chatId для создания нового пользователя
            anonymousId: anonId, // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
            anonLinkCode: anonLinkCode, // <--- ИЗМЕНЕНО: anon_link_code -> anonLinkCode
            registeredAt: new Date(), // <--- ИЗМЕНЕНО: registration_date -> registeredAt, используем Date
            messagesReceived: 0, // Добавлено, если не было
            messagesSent: 0, // Добавлено, если не было
            blockedUsers: [], // Добавлено, если не было
            messagesSentToday: 0, // <--- ИЗМЕНЕНО: messages_sent_today -> messagesSentToday
            lastSentDate: today, // <--- ИЗМЕНЕНО: last_sent_date -> lastSentDate
            isAutoBlocked: false, // <--- ИЗМЕНЕНО: is_auto_blocked -> isAutoBlocked
            autoBlockUntil: null, // <--- ИЗМЕНЕНО: auto_block_until -> autoBlockUntil
            currentCommandStep: null, // <--- ИЗМЕНЕНО: current_command_step -> currentCommandStep
            tempData: {}, // <--- ИЗМЕНЕНО: temp_data -> tempData
            lastAnonSenderChatId: null // <--- ИЗМЕНЕНО: last_anon_sender_chat_id -> lastAnonSenderChatId
        };
        userData = await updateUserData(telegramIdStr, newUserData); // <--- АСИНХРОННЫЙ ВЫЗОВ
        console.log(`[User] Новый пользователь зарегистрирован: ${telegramIdStr} -> ${anonId}, ссылка: ${anonLinkCode}`);
        return userData;
    } else {
        console.log(`[User] Существующий пользователь: ${telegramIdStr} -> ${userData.anonymousId}`); // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
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
    const today = getTodayDateString();
    if (userData.lastSentDate !== today) { // <--- ИЗМЕНЕНО: last_sent_date -> lastSentDate
        userData.messagesSentToday = 0; // <--- ИЗМЕНЕНО: messages_sent_today -> messagesSentToday
        userData.lastSentDate = today; // <--- ИЗМЕНЕНО: last_sent_date -> lastSentDate
    }
    userData.messagesSentToday++; // <--- ИЗМЕНЕНО: messages_sent_today -> messagesSentToday
    await updateUserData(telegramId, userData); // <--- АСИНХРОННЫЙ ВЫЗОВ
}

/**
 * Меняет анонимный ID пользователя на новый.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Новый анонимный ID.
 */
async function changeAnonymousId(telegramId) {
    const telegramIdStr = String(telegramId);
    let userData = await getUserData(telegramIdStr); // <--- АСИНХРОННЫЙ ВЫЗОВ

    if (!userData) {
        userData = await registerUser(telegramIdStr); // <--- АСИНХРОННЫЙ ВЫЗОВ
    }

    const oldAnonId = userData.anonymousId; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
    const newAnonId = await generateAnonymousId(); // <--- АСИНХРОННЫЙ ВЫЗОВ

    userData.anonymousId = newAnonId; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
    await updateUserData(telegramIdStr, userData); // <--- АСИНХРОННЫЙ ВЫЗОВ

    console.log(`[User] ID пользователя ${telegramIdStr} изменен с ${oldAnonId} на ${newAnonId}`);
    return newAnonId;
}

/**
 * Меняет анонимную ссылку пользователя на новую.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Новый код анонимной ссылки.
 */
async function changeAnonymousLink(telegramId) {
    const telegramIdStr = String(telegramId);
    let userData = await getUserData(telegramIdStr); // <--- АСИНХРОННЫЙ ВЫЗОВ

    if (!userData) {
        userData = await registerUser(telegramIdStr); // <--- АСИНХРОННЫЙ ВЫЗОВ
    }

    const oldAnonLinkCode = userData.anonLinkCode; // <--- ИЗМЕНЕНО: anon_link_code -> anonLinkCode
    const newAnonLinkCode = await generateLinkCode(); // <--- АСИНХРОННЫЙ ВЫЗОВ

    userData.anonLinkCode = newAnonLinkCode; // <--- ИЗМЕНЕНО: anon_link_code -> anonLinkCode
    await updateUserData(telegramIdStr, userData); // <--- АСИНХРОННЫЙ ВЫЗОВ

    console.log(`[User] Анонимная ссылка пользователя ${telegramIdStr} изменена с ${oldAnonLinkCode} на ${newAnonLinkCode}`);
    return newAnonLinkCode;
}

module.exports = {
    registerUser,
    updateMessageCount,
    changeAnonymousId,
    changeAnonymousLink
};
