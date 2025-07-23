// src/anonChat.js - Модуль для логики анонимных вопросов/ответов

const { getUserData, updateUserData, getTelegramIdByAnonymousId, getAnonIdMap } = require('./inMemoryDb');
const { checkAutoBlock, AUTO_BLOCK_DURATION_HOURS } = require('./utils');

const MAX_MESSAGE_LENGTH = 500; // Максимальная длина сообщения

/**
 * Обрабатывает отправку анонимного сообщения от отправителя к владельцу ссылки.
 * @param {string|number} senderChatId - Chat ID анонимного отправителя.
 * @param {string} ownerTelegramId - Telegram ID владельца ссылки.
 * @param {string} messageText - Текст анонимного сообщения.
 * @returns {Promise<object>} Объект с результатом для отправителя и данными для владельца.
 */
async function sendAnonymousMessage(senderChatId, ownerTelegramId, messageText) {
    const ownerData = getUserData(ownerTelegramId);

    if (!ownerData) {
        return { responseForSender: "❌ Владелец ссылки не найден или его аккаунт бота удален." };
    }

    // Проверка на автоблок для анонимного сообщения
    if (checkAutoBlock(messageText)) {
        // Мы не можем заблокировать анонимного отправителя, но можем не отправлять сообщение
        return { responseForSender: `🚫 Ваше сообщение содержит запрещенные слова. Оно не отправлено.` };
    }

    if (messageText.length > MAX_MESSAGE_LENGTH) {
        return { responseForSender: `Сообщение слишком длинное. Максимум ${MAX_MESSAGE_LENGTH} символов.` };
    }

    // Сохраняем chat ID анонимного отправителя для возможности ответа
    ownerData.last_anon_sender_chat_id = senderChatId;
    updateUserData(ownerTelegramId, ownerData);

    return {
        responseForOwner: `📬 **Новое анонимное сообщение:**\n_${messageText}_\n\nЧтобы ответить, используйте команду \`/reply [ваш ответ]\`.`,
        ownerTelegramId: ownerTelegramId, // Передаем ID владельца для app.js, чтобы он знал, кому отправить
        senderChatId: senderChatId, // Это chat ID анонимного отправителя
        messageText: messageText
    };
}

/**
 * Обрабатывает отправку ответа на анонимное сообщение от владельца ссылки к анонимному отправителю.
 * @param {string|number} ownerTelegramId - Telegram ID владельца ссылки (отвечающего).
 * @param {string} replyText - Текст ответа.
 * @returns {Promise<object>} Объект с результатом для владельца и данными для анонимного отправителя.
 */
async function sendAnonymousReply(ownerTelegramId, replyText) {
    const ownerData = getUserData(ownerTelegramId);

    if (!ownerData) {
        return { responseForOwner: "Пожалуйста, сначала используйте команду /start для регистрации." };
    }

    if (!ownerData.last_anon_sender_chat_id) {
        return { responseForOwner: "❌ Нет недавних анонимных сообщений, на которые можно ответить. Возможно, вы еще не получали их или уже ответили." };
    }

    if (replyText.length > MAX_MESSAGE_LENGTH) {
        return { responseForOwner: `Ответ слишком длинный. Максимум ${MAX_MESSAGE_LENGTH} символов.` };
    }

    // Проверка на автоблок для ответа
    if (checkAutoBlock(replyText)) {
        // Если владелец ссылки нарушает правила, можно временно заблокировать его
        ownerData.is_auto_blocked = true;
        ownerData.auto_block_until = new Date(Date.now() + AUTO_BLOCK_DURATION_HOURS * 60 * 60 * 1000).toISOString();
        updateUserData(ownerTelegramId, ownerData);
        return {
            responseForOwner: `🚫 Ваш ответ содержит запрещенные слова. Вы автоматически заблокированы на ${AUTO_BLOCK_DURATION_HOURS} часов.\nОтвет не отправлен.`
        };
    }

    const recipientChatId = ownerData.last_anon_sender_chat_id;

    // Сбрасываем last_anon_sender_chat_id после ответа, чтобы избежать повторных ответов на одно и то же сообщение
    ownerData.last_anon_sender_chat_id = null;
    updateUserData(ownerTelegramId, ownerData);

    return {
        responseForOwner: `✅ Ваш ответ успешно отправлен анонимному пользователю.`,
        recipientChatId: recipientChatId,
        replyText: `💬 **Ответ от владельца:**\n_${replyText}_`
    };
}

module.exports = {
    sendAnonymousMessage,
    sendAnonymousReply
};
