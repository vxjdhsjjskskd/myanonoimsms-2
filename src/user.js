// src/user.js - Функции для работы с пользователями (обновленный для AnonAskBot)

const { getUsers, updateUserData, setAnonIdMapEntry, deleteAnonIdMapEntry, getAnonIdMap, setAnonLinkMapEntry, deleteAnonLinkMapEntry, getAnonLinkMap } = require('./inMemoryDb');
const { generateAnonymousId, getTodayDateString, generateUniqueLinkCode } = require('./utils'); // Добавлена generateUniqueLinkCode

/**
 * Регистрирует нового пользователя или возвращает данные существующего.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {object} Данные пользователя.
 */
async function registerUser(telegramId) {
    const telegramIdStr = String(telegramId);
    const users = getUsers();

    if (!users[telegramIdStr]) {
        const anonId = generateAnonymousId();
        const anonLinkCode = generateUniqueLinkCode(); // Генерируем уникальный код для ссылки
        const today = getTodayDateString();
        const newUserData = {
            anonymous_id: anonId,
            anon_link_code: anonLinkCode, // НОВОЕ ПОЛЕ
            registration_date: today,
            messages_sent_today: 0,
            last_sent_date: today,
            is_auto_blocked: false,
            auto_block_until: null,
            current_command_step: null,
            temp_data: {},
            last_anon_sender_chat_id: null // НОВОЕ ПОЛЕ для ответа на анонимные сообщения
        };
        updateUserData(telegramIdStr, newUserData);
        setAnonIdMapEntry(anonId, telegramIdStr);
        setAnonLinkMapEntry(anonLinkCode, telegramIdStr); // Сохраняем связку кода ссылки и Telegram ID
        console.log(`[User] Новый пользователь зарегистрирован: ${telegramIdStr} -> ${anonId}, ссылка: ${anonLinkCode}`);
        return newUserData;
    } else {
        console.log(`[User] Существующий пользователь: ${telegramIdStr} -> ${users[telegramIdStr].anonymous_id}`);
        return users[telegramIdStr];
    }
}

/**
 * Обновляет счетчик сообщений пользователя за день.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {object} userData - Текущие данные пользователя.
 */
function updateMessageCount(telegramId, userData) {
    const today = getTodayDateString();
    if (userData.last_sent_date !== today) {
        userData.messages_sent_today = 0;
        userData.last_sent_date = today;
    }
    userData.messages_sent_today++;
    updateUserData(telegramId, userData);
}

/**
 * Меняет анонимный ID пользователя на новый.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {string} Новый анонимный ID.
 */
async function changeAnonymousId(telegramId) {
    const telegramIdStr = String(telegramId);
    const users = getUsers();
    const anonIdMap = getAnonIdMap();

    if (!users[telegramIdStr]) {
        return (await registerUser(telegramIdStr)).anonymous_id;
    }

    const oldAnonId = users[telegramIdStr].anonymous_id;
    const newAnonId = generateAnonymousId();

    users[telegramIdStr].anonymous_id = newAnonId;
    updateUserData(telegramIdStr, users[telegramIdStr]);

    deleteAnonIdMapEntry(oldAnonId);
    setAnonIdMapEntry(newAnonId, telegramIdStr);

    console.log(`[User] ID пользователя ${telegramIdStr} изменен с ${oldAnonId} на ${newAnonId}`);
    return newAnonId;
}

/**
 * Меняет анонимную ссылку пользователя на новую.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {string} Новый код анонимной ссылки.
 */
async function changeAnonymousLink(telegramId) {
    const telegramIdStr = String(telegramId);
    const users = getUsers();
    const anonLinkMap = getAnonLinkMap();

    if (!users[telegramIdStr]) {
        return (await registerUser(telegramIdStr)).anon_link_code;
    }

    const oldAnonLinkCode = users[telegramIdStr].anon_link_code;
    const newAnonLinkCode = generateUniqueLinkCode();

    users[telegramIdStr].anon_link_code = newAnonLinkCode;
    updateUserData(telegramIdStr, users[telegramIdStr]);

    deleteAnonLinkMapEntry(oldAnonLinkCode); // Удаляем старую запись
    setAnonLinkMapEntry(newAnonLinkCode, telegramIdStr); // Добавляем новую

    console.log(`[User] Анонимная ссылка пользователя ${telegramIdStr} изменена с ${oldAnonLinkCode} на ${newAnonLinkCode}`);
    return newAnonLinkCode;
}


module.exports = {
    registerUser,
    updateMessageCount,
    changeAnonymousId,
    changeAnonymousLink
};
