
// src/database.js - Упрощенная база данных в памяти

let users = {}; // { chatId: userData }
let anonLinkMap = {}; // { linkCode: chatId }

/**
 * Инициализация базы данных
 */
function initializeDb() {
    users = {};
    anonLinkMap = {};
    console.log('💾 База данных инициализирована');
}

/**
 * Получить данные пользователя
 */
function getUserData(chatId) {
    return users[String(chatId)] || null;
}

/**
 * Обновить данные пользователя
 */
function updateUserData(chatId, userData) {
    users[String(chatId)] = userData;
}

/**
 * Получить всех пользователей
 */
function getAllUsers() {
    return users;
}

/**
 * Получить карту анонимных ссылок
 */
function getAnonLinkMap() {
    return anonLinkMap;
}

/**
 * Установить запись в карте анонимных ссылок
 */
function setAnonLinkMapEntry(linkCode, chatId) {
    anonLinkMap[linkCode.toUpperCase()] = String(chatId);
}

/**
 * Удалить запись из карты анонимных ссылок
 */
function deleteAnonLinkMapEntry(linkCode) {
    delete anonLinkMap[linkCode.toUpperCase()];
}

module.exports = {
    initializeDb,
    getUserData,
    updateUserData,
    getAllUsers,
    getAnonLinkMap,
    setAnonLinkMapEntry,
    deleteAnonLinkMapEntry
};
