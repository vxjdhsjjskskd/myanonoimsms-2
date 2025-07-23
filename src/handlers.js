// src/handlers.js - Модуль для обработки команд бота

const {
    getUserData,
    getTelegramIdByAnonLinkCode,
    updateUserData,
} = require('./dataAccess');

const { registerUser, changeAnonymousLink } = require('./user');
const { sendAnonymousMessage, sendAnonymousReply } = require('./anonChat');
const { getTodayDateString, checkAutoBlock, AUTO_BLOCK_DURATION_HOURS } = require('./utils');

const MAX_MESSAGE_LENGTH = 500;

/**
 * Обрабатывает команду /start. Регистрирует нового пользователя или приветствует существующего.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {string|undefined} startPayload - Payload из ссылки /start (например, код анонимной ссылки).
 * @param {string} botUsername - Имя пользователя бота (для формирования ссылки).
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleStart(telegramId, startPayload, botUsername) {
    const telegramIdStr = String(telegramId);
    console.log(`[HANDLER.handleStart] Получено /start от ${telegramIdStr}, Payload: ${startPayload || 'нет'}`);

    if (startPayload) {
        const ownerTelegramId = await getTelegramIdByAnonLinkCode(startPayload);
        console.log(`[HANDLER.handleStart] ownerTelegramId для payload ${startPayload}: ${ownerTelegramId}`);

        if (ownerTelegramId && ownerTelegramId !== telegramIdStr) {
            let senderData = await getUserData(telegramIdStr);
            if (!senderData) {
                console.log(`[HANDLER.handleStart] Отправитель ${telegramIdStr} не зарегистрирован, регистрируем.`);
                senderData = await registerUser(telegramIdStr);
                console.log(`[HANDLER.handleStart] Данные отправителя после регистрации:`, senderData);
            }
            // Устанавливаем состояние для анонимной отправки
            senderData.currentCommandStep = 'awaiting_anon_message';
            senderData.tempData = { owner_telegram_id: ownerTelegramId };
            await updateUserData(telegramIdStr, senderData);

            return `🚀 Здесь можно отправить анонимное сообщение человеку, который опубликовал эту ссылку.\n\n` +
                   `✍️ Напишите сюда всё, что хотите ему передать, и через несколько секунд он получит ваше сообщение, но не будет знать от кого.\n\n` +
                   `Отправить можно фото, видео, 💬 текст, 🔊 голосовые, 📷 видеосообщения (кружки), а также ✨ стикеры`;
        } else if (ownerTelegramId === telegramIdStr) {
            const userData = await getUserData(telegramIdStr);
            console.log(`[HANDLER.handleStart] Пользователь ${telegramIdStr} перешел по своей ссылке. Данные:`, userData);
            // Используем anonLinkCode или linkCode для совместимости со старыми записями
            const currentAnonLinkCode = userData.anonLinkCode || userData.linkCode;
            return `Привет! Это ваша собственная анонимная ссылка. Вы не можете отправить анонимное сообщение самому себе.\n\n` +
                   `Ваша ссылка для анонимных вопросов: \`https://t.me/${botUsername}?start=${currentAnonLinkCode}\``;
        } else {
            console.log(`[HANDLER.handleStart] Ссылка с payload ${startPayload} недействительна.`);
            return `❌ Ссылка недействительна или больше не активна.`;
        }
    }

    console.log(`[HANDLER.handleStart] Обычный /start от ${telegramIdStr}. Регистрируем/получаем пользователя.`);
    const userData = await registerUser(telegramIdStr);
    console.log(`[HANDLER.handleStart] Данные пользователя после регистрации/получения:`, userData);
    // Используем anonLinkCode или linkCode для совместимости со старыми записями
    const currentAnonLinkCode = userData.anonLinkCode || userData.linkCode;
    const formattedAnonLink = `\`https://t.me/${botUsername}?start=${currentAnonLinkCode}\``;
    console.log(`[HANDLER.handleStart] Формируемая ссылка: ${formattedAnonLink}`);

    return (
        `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
        `Твоя ссылка:\n` +
        `👉 ${formattedAnonLink}\n\n` +
        `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`
    );
}

/**
 * Обрабатывает команду /mylink. Показывает анонимную ссылку пользователя.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {string} botUsername - Имя пользователя бота.
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleMyLink(telegramId, botUsername) {
    console.log(`[HANDLER.handleMyLink] Получено /mylink от ${telegramId}.`);
    const userData = await getUserData(telegramId);
    if (!userData) {
        console.log(`[HANDLER.handleMyLink] Пользователь ${telegramId} не найден.`);
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }
    console.log(`[HANDLER.handleMyLink] Данные пользователя для /mylink:`, userData);
    // Используем anonLinkCode или linkCode для совместимости со старыми записями
    const currentAnonLinkCode = userData.anonLinkCode || userData.linkCode;
    const formattedAnonLink = `\`https://t.me/${botUsername}?start=${currentAnonLinkCode}\``;
    console.log(`[HANDLER.handleMyLink] Формируемая ссылка для /mylink: ${formattedAnonLink}`);
    return `Ваша личная ссылка для анонимных вопросов: ${formattedAnonLink}`;
}

// Функции, которые больше не поддерживаются
async function handleMyId(telegramId) {
    return "Команда /myid больше не поддерживается. Используйте /mylink для получения вашей анонимной ссылки.";
}
async function initiateSendMessage(senderTelegramId) {
    return "Команда /send больше не поддерживается. Отправка анонимных сообщений происходит только через вашу личную ссылку.";
}
async function handleSendMessageStep() {
    return { responseForSender: "Эта функция больше не поддерживается." };
}
async function handleInbox(telegramId) {
    return "📬 У вас пока нет новых сообщений. История сообщений не сохраняется.";
}
async function handleChangeId(telegramId) {
    return "Команда /changeid больше не поддерживается, так как анонимный ID не используется.";
}

/**
 * Обрабатывает команду /reply. Отвечает на последнее анонимное сообщение.
 * @param {string|number} ownerTelegramId - Telegram ID владельца ссылки (отвечающего).
 * @param {string[]} args - Массив аргументов команды (текст ответа).
 * @returns {Promise<object>} Объект с результатом для владельца и данными для анонимного отправителя.
 */
async function handleReply(ownerTelegramId, args) {
    const replyText = args.join(' ');
    if (!replyText) {
        return { responseForOwner: "Использование: `/reply [ваш ответ]`" };
    }
    const result = await sendAnonymousReply(ownerTelegramId, replyText);
    return result;
}

/**
 * Обрабатывает команду /block. Блокирует указанного пользователя по его Telegram Chat ID.
 * @param {string|number} blockerTelegramId - Telegram ID блокирующего пользователя.
 * @param {string[]} args - Массив аргументов команды (Telegram Chat ID пользователя для блокировки).
 * @returns {Promise<string>} Сообщение для отправки блокирующему пользователю.
 */
async function handleBlock(blockerTelegramId, args) {
    const blockerData = await getUserData(blockerTelegramId);
    if (!blockerData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    if (args.length === 0) {
        return "Использование: `/block [Telegram Chat ID пользователя для блокировки]`";
    }

    const blockedChatId = args[0];

    if (blockedChatId === String(blockerTelegramId)) {
        return "Вы не можете заблокировать самого себя.";
    }

    const targetUserData = await getUserData(blockedChatId);
    if (!targetUserData) {
        return "❌ Пользователь с таким ID не найден.";
    }

    if (blockerData.blockedUsers.includes(blockedChatId)) {
        return `🚫 Пользователь **${blockedChatId}** уже заблокирован.`;
    }

    blockerData.blockedUsers.push(blockedChatId);
    await updateUserData(blockerTelegramId, blockerData);
    return `✅ Пользователь **${blockedChatId}** успешно заблокирован. Он больше не сможет отправлять вам сообщения.`;
}

/**
 * Обрабатывает команду /unblock. Разблокирует указанного пользователя по его Telegram Chat ID.
 * @param {string|number} unblockerTelegramId - Telegram ID разблокирующего пользователя.
 * @param {string[]} args - Массив аргументов команды (Telegram Chat ID пользователя для разблокировки).
 * @returns {Promise<string>} Сообщение для отправки разблокирующему пользователю.
 */
async function handleUnblock(unblockerTelegramId, args) {
    const unblockerData = await getUserData(unblockerTelegramId);
    if (!unblockerData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    if (args.length === 0) {
        return "Использование: `/unblock [Telegram Chat ID пользователя для разблокировки]`";
    }

    const unblockedChatId = args[0];

    if (!unblockerData.blockedUsers.includes(unblockedChatId)) {
        return `🚫 Пользователь **${unblockedChatId}** не найден в вашем списке заблокированных.`;
    }

    unblockerData.blockedUsers = unblockerData.blockedUsers.filter(id => id !== unblockedChatId);
    await updateUserData(unblockerTelegramId, unblockerData);
    return `✅ Пользователь **${unblockedChatId}** успешно разблокирован.`;
}

/**
 * Обрабатывает команду /blocked. Показывает список заблокированных пользователей (по Telegram Chat ID).
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Сообщение со списком заблокированных пользователей.
 */
async function handleBlocked(telegramId) {
    const userData = await getUserData(telegramId);
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const blockedList = userData.blockedUsers || [];

    if (blockedList.length === 0) {
        return "✅ Ваш список заблокированных пользователей пуст.";
    }

    let response = "🚫 **Список заблокированных пользователей (по Chat ID):**\n";
    for (const blockedId of blockedList) {
        response += `- ${blockedId}\n`;
    }
    return response;
}

/**
 * Обрабатывает команду /changelink. Меняет анонимную ссылку пользователя.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {string} botUsername - Имя пользователя бота.
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleChangeLink(telegramId, botUsername) {
    const userData = await getUserData(telegramId);
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const oldAnonLinkCode = userData.anonLinkCode || userData.linkCode; // Учитываем старое поле
    const newAnonLinkCode = await changeAnonymousLink(telegramId);

    const formattedNewAnonLink = `\`https://t.me/${botUsername}?start=${newAnonLinkCode}\``;

    return `✅ Ваша анонимная ссылка успешно изменена с \`https://t.me/${botUsername}?start=${oldAnonLinkCode}\` на ${formattedNewAnonLink}.`;
}

/**
 * Обрабатывает команду /help. Показывает справку по командам.
 * @returns {string} Сообщение со справкой.
 */
function handleHelp() {
    return (
        "**📚 Справка по командам Анонимной почты:**\n\n" +
        "/mylink - показать свою анонимную ссылку\n" +
        "/reply [текст] - ответить на последнее анонимное сообщение\n" +
        "/block [Chat ID пользователя] - заблокировать пользователя (он не сможет вам писать)\n" +
        "/unblock [Chat ID пользователя] - разблокировать пользователя\n" +
        "/blocked - список заблокированных пользователей\n" +
        "/changelink - сменить свою анонимную ссылку\n" +
        "/help - эта справка\n\n" +
        "**Ограничения:**\n" +
        "- Сообщения до 500 символов.\n" +
        "- Автоматическая блокировка за мат и спам на 24 часа."
    );
}

/**
 * Общий обработчик текстовых сообщений, который управляет состоянием команд.
 * @param {string|number} chatId - ID чата пользователя.
 * @param {string} messageText - Текст сообщения пользователя.
 * @returns {Promise<object|null>} Объект с результатом для отправителя/получателя или null, если сообщение не обработано.
 */
async function handleUserTextMessage(chatId, messageText) {
    const userData = await getUserData(chatId);
    if (!userData) {
        return null;
    }

    if (userData.currentCommandStep === 'awaiting_anon_message') {
        const result = await sendAnonymousMessage(chatId, userData.tempData.owner_telegram_id, messageText);
        // После отправки анонимного сообщения, сбрасываем состояние
        userData.currentCommandStep = null;
        userData.tempData = {};
        await updateUserData(chatId, userData);
        return result;
    }

    return null;
}

module.exports = {
    handleStart,
    handleMyLink,
    handleMyId,
    initiateSendMessage,
    handleSendMessageStep,
    handleInbox,
    handleReply,
    handleBlock,
    handleUnblock,
    handleBlocked,
    handleChangeId,
    handleChangeLink,
    handleHelp,
    handleUserTextMessage
};
