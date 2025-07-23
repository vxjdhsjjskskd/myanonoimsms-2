// src/inMemoryDb.js - Хранилище данных в оперативной памяти (обновленный для AnonAskBot)

// --- Глобальные переменные для данных бота (хранятся в памяти) ---
let users = {};
let blocks = {};
let messages = []; // В этом режиме сообщения хранятся по-другому, но оставим для совместимости
let anonIdMap = {}; // Это для старых анонимных ID
let anonLinkMap = {}; // НОВОЕ: map: anon_link_code -> owner_telegram_id

// --- Функции для доступа и изменения данных ---

// Геттеры
function getUsers() {
    return users;
}

function getBlocks() {
    return blocks;
}

function getMessages() {
    return messages; // Пока оставим, если вдруг понадобится для других функций
}

function getAnonIdMap() {
    return anonIdMap;
}

function getAnonLinkMap() { // НОВЫЙ Геттер
    return anonLinkMap;
}

// Функции-помощники для получения конкретных записей
function getUserData(telegramId) {
    return users[String(telegramId)];
}

function getTelegramIdByAnonymousId(anonymousId) {
    return anonIdMap[anonymousId.toUpperCase()];
}

function getTelegramIdByAnonLinkCode(anonLinkCode) { // НОВЫЙ Геттер
    return anonLinkMap[anonLinkCode.toUpperCase()];
}

// Сеттеры/Обновления
function updateUserData(telegramId, userData) {
    users[String(telegramId)] = userData;
}

function setAnonIdMapEntry(anonId, telegramId) {
    anonIdMap[anonId] = String(telegramId);
}

function deleteAnonIdMapEntry(anonId) {
    delete anonIdMap[anonId];
}

function setAnonLinkMapEntry(anonLinkCode, telegramId) { // НОВЫЙ Сеттер
    anonLinkMap[anonLinkCode] = String(telegramId);
}

function deleteAnonLinkMapEntry(anonLinkCode) { // НОВЫЙ Сеттер
    delete anonLinkMap[anonLinkCode];
}

function updateBlocksData(blockerAnonId, blockedList) {
    blocks[blockerAnonId] = blockedList;
}

function addMessage(message) {
    messages.push(message);
}

async function initializeDb() {
    console.log("[In-Memory DB] Инициализация базы данных в памяти.");
}

// Экспортируем все функции для доступа к данным
module.exports = {
    initializeDb,
    getUsers,
    getBlocks,
    getMessages,
    getAnonIdMap,
    getAnonLinkMap, // Экспортируем новый геттер
    getUserData,
    getTelegramIdByAnonymousId,
    getTelegramIdByAnonLinkCode, // Экспортируем новый геттер
    updateUserData,
    setAnonIdMapEntry,
    deleteAnonIdMapEntry,
    setAnonLinkMapEntry, // Экспортируем новый сеттер
    deleteAnonLinkMapEntry, // Экспортируем новый сеттер
    updateBlocksData,
    addMessage
};
