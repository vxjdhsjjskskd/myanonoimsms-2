// src/chat.js - Функции для работы с чатами/сообщениями

const { getMessages, addMessage, getBlocks, getUsers, getAnonIdMap } = require('./inMemoryDb');
const { isBlocked } = require('./utils');

/**
 * Добавляет новое сообщение в историю.
 * @param {string} senderAnonId - Анонимный ID отправителя.
 * @param {string} recipientAnonId - Анонимный ID получателя.
 * @param {string} messageText - Текст сообщения.
 */
function recordMessage(senderAnonId, recipientAnonId, messageText) {
    const newMessage = {
        sender_anon_id: senderAnonId,
        recipient_anon_id: recipientAnonId,
        message_text: messageText,
        timestamp: new Date().toISOString()
    };
    addMessage(newMessage);
    console.log(`[Chat] Сообщение записано: от ${senderAnonId} к ${recipientAnonId}.`);
}

/**
 * Получает последние сообщения для пользователя.
 * @param {string} userAnonId - Анонимный ID пользователя.
 * @param {number} limit - Максимальное количество сообщений.
 * @returns {Array<object>} Массив сообщений.
 */
function getRecentMessages(userAnonId, limit = 10) {
    const messages = getMessages(); // Получаем актуальные сообщения
    const receivedMessages = messages.filter(msg => msg.recipient_anon_id === userAnonId);
    receivedMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return receivedMessages.slice(0, limit);
}

module.exports = {
    recordMessage,
    getRecentMessages
};
