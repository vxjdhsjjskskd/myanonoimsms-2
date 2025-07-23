// src/chat.js - Функции для работы с чатами/сообщениями (обновленный для MongoDB)

// Импортируем только те функции, которые нужны и будут заглушками
const { getMessages, addMessage } = require('./dataAccess');

/**
 * Добавляет новое сообщение в историю.
 * В текущей реализации сообщения не сохраняются в БД. Это заглушка.
 * @param {string} senderAnonId - Анонимный ID отправителя.
 * @param {string} recipientAnonId - Анонимный ID получателя.
 * @param {string} messageText - Текст сообщения.
 */
function recordMessage(senderAnonId, recipientAnonId, messageText) {
    // В этой версии сообщения не сохраняются в БД для функции "Входящие".
    // Если вы хотите хранить историю всех сообщений, нужно будет создать отдельную схему Message в models.js
    // и реализовать логику сохранения в dataAccess.js.
    console.log(`[Chat] Сообщение записано (только в лог): от ${senderAnonId} к ${recipientAnonId}.`);
    addMessage({ // Вызываем заглушку
        sender_anon_id: senderAnonId,
        recipient_anon_id: recipientAnonId,
        message_text: messageText,
        timestamp: new Date().toISOString()
    });
}

/**
 * Получает последние сообщения для пользователя.
 * В текущей реализации сообщения не сохраняются в БД. Это заглушка.
 * @param {string} userAnonId - Анонимный ID пользователя.
 * @param {number} limit - Максимальное количество сообщений.
 * @returns {Array<object>} Массив сообщений.
 */
function getRecentMessages(userAnonId, limit = 10) {
    console.warn("[Chat] getRecentMessages вызывается, но сообщения не сохраняются в БД для inbox. Возвращается пустой массив.");
    // Если вы хотите, чтобы эта функция работала, вам нужно реализовать сохранение сообщений в БД.
    return [];
}

module.exports = {
    recordMessage,
    getRecentMessages
};
