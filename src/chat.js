// src/chat.js - Функции для работы с чатами/сообщениями (заглушка)

// Этот файл не используется в текущей логике app.js,
// но оставлен для совместимости или будущих расширений.

function recordMessage(senderAnonId, recipientAnonId, messageText) {
    console.log(`[Chat] Сообщение записано: от ${senderAnonId} к ${recipientAnonId}.`);
}

function getRecentMessages(userAnonId, limit = 10) {
    return [];
}

module.exports = {
    recordMessage,
    getRecentMessages
};
