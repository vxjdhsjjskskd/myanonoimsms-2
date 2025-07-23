// src/handlers.js - Модуль для обработки команд бота (обновленный для AnonAskBot)

const {
    getUserData,
    getTelegramIdByAnonymousId,
    getTelegramIdByAnonLinkCode,
    getUsers,
    getMessages,
    getBlocks,
    updateUserData,
    updateBlocksData,
    getAnonIdMap,
    getAnonLinkMap
} = require('./inMemoryDb');

const { registerUser, updateMessageCount, changeAnonymousId, changeAnonymousLink } = require('./user');
const { recordMessage, getRecentMessages } = require('./chat');
const { sendAnonymousMessage, sendAnonymousReply } = require('./anonChat');
const { generateAnonymousId, getTodayDateString, isBlocked, checkAutoBlock, AUTO_BLOCK_DURATION_HOURS } = require('./utils');

// --- Константы, используемые в обработчиках ---
const MAX_MESSAGES_PER_DAY = 20; // Не используется для анонимных вопросов, но оставим для других функций
const MAX_MESSAGE_LENGTH = 500;

// --- Основные функции-обработчики команд бота ---

/**
 * Обрабатывает команду /start. Регистрирует нового пользователя или приветствует существующего.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {string|undefined} startPayload - Payload из ссылки /start (например, код анонимной ссылки).
 * @param {string} botUsername - Имя пользователя бота (для формирования ссылки).
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleStart(telegramId, startPayload, botUsername) {
    const telegramIdStr = String(telegramId);
    console.log(`[HANDLER] /start получено от Telegram ID: ${telegramIdStr}, Payload: ${startPayload}`);

    // Если есть startPayload, это, вероятно, кто-то перешел по анонимной ссылке
    if (startPayload) {
        const ownerTelegramId = getTelegramIdByAnonLinkCode(startPayload);
        if (ownerTelegramId && ownerTelegramId !== telegramIdStr) {
            // Это анонимный отправитель, который пришел по ссылке
            const senderData = getUserData(telegramIdStr);
            if (!senderData) {
                // Если анонимный отправитель не зарегистрирован, зарегистрируем его
                await registerUser(telegramIdStr);
            }
            // Устанавливаем состояние для анонимной отправки
            const userData = getUserData(telegramIdStr);
            userData.current_command_step = 'awaiting_anon_message';
            userData.temp_data = { owner_telegram_id: ownerTelegramId };
            updateUserData(telegramIdStr, userData);

            return `Вы собираетесь отправить анонимное сообщение владельцу этой ссылки. Введите ваше сообщение:`;
        } else if (ownerTelegramId === telegramIdStr) {
            // Пользователь перешел по своей собственной ссылке
            return `Привет! Это ваша собственная анонимная ссылка. Вы не можете отправить анонимное сообщение самому себе.\n\n` +
                   `Ваша ссылка для анонимных вопросов: \`https://t.me/${botUsername}?start=${startPayload}\``;
        }
    }

    // Если нет payload или payload недействителен, или это владелец ссылки
    const userData = await registerUser(telegramIdStr);
    const formattedAnonId = `\`${userData.anonymous_id}\``;
    const formattedAnonLink = `\`https://t.me/${botUsername}?start=${userData.anon_link_code}\``;

    return (
        `🎉 Добро пожаловать в Анонимную почту! Ваш уникальный ID: ${formattedAnonId}\n\n` +
        `Ваша личная ссылка для анонимных вопросов: ${formattedAnonLink}\n\n` +
        "Поделитесь этой ссылкой, чтобы другие могли задать вам анонимный вопрос или отправить сообщение.\n\n" +
        "**Основные команды (также доступны через кнопки):**\n" +
        "/mylink - показать свою анонимную ссылку\n" +
        "/myid - показать свой анонимный ID\n" +
        "/send - отправить сообщение (пошагово)\n" +
        "/inbox - показать последние 10 сообщений\n" +
        "/reply [текст] - ответить на последнее анонимное сообщение\n" +
        "/block [ID пользователя] - заблокировать\n" +
        "/unblock [ID пользователя] - разблокировать\n" +
        "/blocked - список заблокированных\n" +
        "/changeid - сменить свой анонимный ID\n" +
        "/changelink - сменить свою анонимную ссылку\n" +
        "/help - справка по командам\n\n" +
        "**Ограничения:** Сообщения до 500 символов. Автоматическая блокировка за мат и спам."
    );
}

/**
 * Обрабатывает команду /mylink. Показывает анонимную ссылку пользователя.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {string} botUsername - Имя пользователя бота.
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleMyLink(telegramId, botUsername) {
    const userData = getUserData(telegramId);
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }
    const formattedAnonLink = `\`https://t.me/${botUsername}?start=${userData.anon_link_code}\``;
    return `Ваша личная ссылка для анонимных вопросов: ${formattedAnonLink}`;
}

/**
 * Обрабатывает команду /myid. Показывает анонимный ID пользователя.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleMyId(telegramId) {
    const userData = getUserData(telegramId);
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }
    const formattedAnonId = `\`${userData.anonymous_id}\``;
    return `Ваш анонимный ID: ${formattedAnonId}`;
}

/**
 * Инициирует процесс отправки сообщения (шаг 1: запрос ID получателя).
 * @param {string|number} senderTelegramId - Telegram ID отправителя.
 * @returns {Promise<string>} Сообщение для отправки отправителю.
 */
async function initiateSendMessage(senderTelegramId) {
    const senderData = getUserData(senderTelegramId);
    if (!senderData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }
    // Сбрасываем текущее состояние, если оно было
    senderData.current_command_step = 'awaiting_recipient_id';
    senderData.temp_data = {};
    updateUserData(senderTelegramId, senderData);
    return "Введите ID получателя:";
}

/**
 * Обрабатывает отправку сообщения по шагам или по команде.
 * @param {string|number} senderTelegramId - Telegram ID отправителя.
 * @param {string} messageText - Текст сообщения пользователя.
 * @param {string|undefined} directRecipientId - Прямой ID получателя, если команда введена сразу (для /send [ID] [текст])
 * @param {string|undefined} directMessageText - Прямой текст сообщения, если команда введена сразу
 * @returns {Promise<object>} Объект с результатом отправки.
 */
async function handleSendMessageStep(senderTelegramId, messageText, directRecipientId = undefined, directMessageText = undefined) {
    const senderData = getUserData(senderTelegramId);
    if (!senderData) {
        return { responseForSender: "Пожалуйста, сначала используйте команду /start для регистрации." };
    }

    const senderAnonId = senderData.anonymous_id;

    // Проверка на автоблок отправителя
    if (senderData.is_auto_blocked) {
        const blockUntil = new Date(senderData.auto_block_until);
        if (new Date() < blockUntil) {
            const remainingTimeMs = blockUntil.getTime() - new Date().getTime();
            const hours = Math.floor(remainingTimeMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
            return { responseForSender: `🚫 Вы временно заблокированы за нарушение правил. Блокировка истекает через ${hours} ч ${minutes} мин.` };
        } else {
            senderData.is_auto_blocked = false;
            senderData.auto_block_until = null;
            updateUserData(senderTelegramId, senderData);
        }
    }

    let recipientAnonId;
    let finalMessageText;

    if (directRecipientId && directMessageText) {
        // Если команда /send [ID] [текст] была введена сразу
        recipientAnonId = directRecipientId.toUpperCase();
        finalMessageText = directMessageText;
        // Сбрасываем состояние, так как это прямая команда
        senderData.current_command_step = null;
        senderData.temp_data = {};
        updateUserData(senderTelegramId, senderData);
    } else if (senderData.current_command_step === 'awaiting_recipient_id') {
        recipientAnonId = messageText.toUpperCase();
        senderData.temp_data.recipient_id = recipientAnonId;
        senderData.current_command_step = 'awaiting_message_text';
        updateUserData(senderTelegramId, senderData);
        return { responseForSender: `ID получателя установлен: **${recipientAnonId}**. Теперь введите текст сообщения:` };
    } else if (senderData.current_command_step === 'awaiting_message_text') {
        recipientAnonId = senderData.temp_data.recipient_id;
        finalMessageText = messageText;
        // Сброс состояния после получения текста
        senderData.current_command_step = null;
        senderData.temp_data = {};
        updateUserData(senderTelegramId, senderData);
    } else {
        // Неизвестное состояние или неверное использование
        return { responseForSender: "Неизвестное состояние команды. Пожалуйста, попробуйте снова или используйте /help." };
    }

    // --- Общие проверки после получения всех данных ---
    if (finalMessageText.length > MAX_MESSAGE_LENGTH) {
        return { responseForSender: `Сообщение слишком длинное. Максимум ${MAX_MESSAGE_LENGTH} символов. Пожалуйста, попробуйте снова.` };
    }

    if (checkAutoBlock(finalMessageText)) {
        senderData.is_auto_blocked = true;
        senderData.auto_block_until = new Date(Date.now() + AUTO_BLOCK_DURATION_HOURS * 60 * 60 * 1000).toISOString();
        updateUserData(senderTelegramId, senderData);
        return {
            responseForSender: `🚫 Ваше сообщение содержит запрещенные слова. Вы автоматически заблокированы на ${AUTO_BLOCK_DURATION_HOURS} часов.\nСообщение не отправлено.`
        };
    }

    const recipientTelegramId = getTelegramIdByAnonymousId(recipientAnonId);

    if (!recipientTelegramId) {
        return { responseForSender: "❌ Пользователь с таким ID не найден." };
    }
    if (recipientTelegramId === String(senderTelegramId)) {
        return { responseForSender: "Вы не можете отправить сообщение самому себе." };
    }

    const recipientData = getUserData(recipientTelegramId);
    if (!recipientData) {
        return { responseForSender: "❌ Ошибка: данные получателя не найдены." };
    }

    if (isBlocked(recipientAnonId, senderAnonId)) {
        return { responseForSender: "❌ Вы не можете отправить сообщение этому пользователю, так как он вас заблокировал." };
    }
    if (isBlocked(senderAnonId, recipientAnonId)) {
        return { responseForSender: "❌ Вы заблокировали этого пользователя и не можете ему отправлять сообщения." };
    }

    updateMessageCount(senderTelegramId, senderData);
    if (senderData.messages_sent_today > MAX_MESSAGES_PER_DAY) {
        return { responseForSender: `🚫 Вы достигли лимита в ${MAX_MESSAGES_PER_DAY} сообщений в день. Попробуйте завтра.` };
    }

    // recordMessage(senderAnonId, recipientAnonId, finalMessageText); // Не используем для этого типа сообщений

    return {
        responseForSender: `✅ Сообщение успешно отправлено пользователю **${recipientAnonId}**.\nОтправлено сегодня: ${senderData.messages_sent_today}/${MAX_MESSAGES_PER_DAY}`,
        recipientTelegramId: recipientTelegramId,
        senderAnonId: senderAnonId,
        messageText: finalMessageText
    };
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
 * Обрабатывает команду /inbox. Показывает последние 10 полученных сообщений.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Сообщение со списком входящих сообщений.
 */
async function handleInbox(telegramId) {
    const userData = getUserData(telegramId);
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const userAnonId = userData.anonymous_id;
    const receivedMessages = getMessages().filter(msg => msg.recipient_anon_id === userAnonId); // Пока используем старые сообщения
    receivedMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (receivedMessages.length === 0) {
        return "📬 У вас пока нет новых сообщений.";
    }

    let response = "📬 **Последние 10 полученных сообщений:**\n\n";
    for (let i = 0; i < Math.min(10, receivedMessages.length); i++) {
        const msg = receivedMessages[i];
        const timestampDt = new Date(msg.timestamp);
        const formattedTime = timestampDt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const formattedDate = timestampDt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        response += (
            `**${i + 1}. От ${msg.sender_anon_id}** (${formattedTime} ${formattedDate}):\n` +
            `_${msg.message_text}_\n\n`
        );
    }
    return response;
}

/**
 * Обрабатывает команду /block. Блокирует указанного пользователя.
 * @param {string|number} blockerTelegramId - Telegram ID блокирующего пользователя.
 * @param {string[]} args - Массив аргументов команды (ID пользователя для блокировки).
 * @returns {Promise<string>} Сообщение для отправки блокирующему пользователю.
 */
async function handleBlock(blockerTelegramId, args) {
    const blockerData = getUserData(blockerTelegramId);
    const blocks = getBlocks();
    if (!blockerData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    if (args.length === 0) {
        return "Использование: `/block [ID пользователя для блокировки]`";
    }

    const blockerAnonId = blockerData.anonymous_id;
    const blockedAnonId = args[0].toUpperCase();

    if (!getTelegramIdByAnonymousId(blockedAnonId)) {
        return "❌ Пользователь с таким ID не найден.";
    }
    if (blockedAnonId === blockerAnonId) {
        return "Вы не можете заблокировать самого себя.";
    }

    if (!blocks[blockerAnonId]) {
        blocks[blockerAnonId] = [];
    }

    if (blocks[blockerAnonId].includes(blockedAnonId)) {
        return `🚫 Пользователь **${blockedAnonId}** уже заблокирован.`;
    }

    blocks[blockerAnonId].push(blockedAnonId);
    updateBlocksData(blockerAnonId, blocks[blockerAnonId]);
    return `✅ Пользователь **${blockedAnonId}** успешно заблокирован. Он больше не сможет отправлять вам сообщения.`;
}

/**
 * Обрабатывает команду /unblock. Разблокирует указанного пользователя.
 * @param {string|number} unblockerTelegramId - Telegram ID разблокирующего пользователя.
 * @param {string[]} args - Массив аргументов команды (ID пользователя для разблокировки).
 * @returns {Promise<string>} Сообщение для отправки разблокирующему пользователю.
 */
async function handleUnblock(unblockerTelegramId, args) {
    const unblockerData = getUserData(unblockerTelegramId);
    const blocks = getBlocks();
    if (!unblockerData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    if (args.length === 0) {
        return "Использование: `/unblock [ID пользователя для разблокировки]`";
    }

    const unblockerAnonId = unblockerData.anonymous_id;
    const unblockedAnonId = args[0].toUpperCase();

    if (!blocks[unblockerAnonId] || !blocks[unblockerAnonId].includes(unblockedAnonId)) {
        return `🚫 Пользователь **${unblockedAnonId}** не найден в вашем списке заблокированных.`;
    }

    blocks[unblockerAnonId] = blocks[unblockerAnonId].filter(id => id !== unblockedAnonId);
    updateBlocksData(unblockerAnonId, blocks[unblockerAnonId]);
    return `✅ Пользователь **${unblockedAnonId}** успешно разблокирован.`;
}

/**
 * Обрабатывает команду /blocked. Показывает список заблокированных пользователей.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Сообщение со списком заблокированных пользователей.
 */
async function handleBlocked(telegramId) {
    const userData = getUserData(telegramId);
    const blocks = getBlocks();
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const userAnonId = userData.anonymous_id;
    const blockedList = blocks[userAnonId] || [];

    if (blockedList.length === 0) {
        return "✅ Ваш список заблокированных пользователей пуст.";
    }

    let response = "🚫 **Список заблокированных пользователей:**\n";
    for (const blockedId of blockedList) {
        response += `- ${blockedId}\n`;
    }
    return response;
}

/**
 * Обрабатывает команду /changeid. Меняет анонимный ID пользователя.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleChangeId(telegramId) {
    const userData = getUserData(telegramId);
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const oldAnonId = userData.anonymous_id;
    const newAnonId = await changeAnonymousId(telegramId);

    const formattedNewAnonId = `\`${newAnonId}\``;

    return `✅ Ваш анонимный ID успешно изменен с \`${oldAnonId}\` на ${formattedNewAnonId}.`;
}

/**
 * Обрабатывает команду /changelink. Меняет анонимную ссылку пользователя.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @param {string} botUsername - Имя пользователя бота.
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleChangeLink(telegramId, botUsername) {
    const userData = getUserData(telegramId);
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const oldAnonLinkCode = userData.anon_link_code;
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
        "/myid - показать свой анонимный ID\n" +
        "/send - отправить сообщение (пошагово)\n" +
        "/inbox - показать последние 10 полученных сообщений с ID отправителей\n" +
        "/reply [текст] - ответить на последнее анонимное сообщение\n" +
        "/block [ID пользователя] - заблокировать пользователя (он не сможет вам писать)\n" +
        "/unblock [ID пользователя] - разблокировать пользователя\n" +
        "/blocked - список заблокированных пользователей\n" +
        "/changeid - сменить свой анонимный ID\n" +
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
 * @returns {Promise<object|null>} Результат обработки сообщения или null, если это обычное сообщение.
 */
async function handleUserTextMessage(chatId, messageText) {
    const userData = getUserData(chatId);
    if (!userData) {
        return null;
    }

    // Обработка пошаговой отправки сообщения
    if (userData.current_command_step === 'awaiting_recipient_id' || userData.current_command_step === 'awaiting_message_text') {
        return await handleSendMessageStep(chatId, messageText);
    }

    // Обработка анонимного сообщения
    if (userData.current_command_step === 'awaiting_anon_message') {
        const ownerTelegramId = userData.temp_data.owner_telegram_id;
        // Сброс состояния
        userData.current_command_step = null;
        userData.temp_data = {};
        updateUserData(chatId, userData);
        
        const result = await sendAnonymousMessage(chatId, ownerTelegramId, messageText);
        return result;
    }

    // Если нет активной команды, возвращаем null
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
