// src/handlers.js - Модуль для обработки команд бота (обновленный для AnonAskBot и MongoDB)

// Импортируем функции доступа к данным из dataAccess.js (они будут асинхронными)
const {
    getUserData,
    getTelegramIdByAnonymousId,
    getTelegramIdByAnonLinkCode,
    getAnonLinkMap,
    updateUserData,
    // getBlocks, // Не используется напрямую, т.к. блокировки в User модели
    // updateBlocksData, // Не используется напрямую, т.к. блокировки в User модели
    // getMessages, // Заглушка, т.к. сообщения не хранятся в БД
    // getUsers, // Не используется напрямую
    // getAnonIdMap // Не используется напрямую
} = require('./dataAccess'); // <--- ИЗМЕНЕНО: inMemoryDb -> dataAccess

// Импортируем функции из user.js (они тоже станут асинхронными)
const { registerUser, updateMessageCount, changeAnonymousId, changeAnonymousLink } = require('./user');
// Импортируем функции из chat.js (они тоже станут асинхронными)
const { recordMessage, getRecentMessages } = require('./chat');
// Импортируем функции из anonChat.js (они тоже станут асинхронными)
const { sendAnonymousMessage, sendAnonymousReply } = require('./anonChat');
// Импортируем функции из utils.js (они тоже станут асинхронными)
const { generateAnonymousId, getTodayDateString, checkAutoBlock, AUTO_BLOCK_DURATION_HOURS } = require('./utils');

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
        // Получаем linkMap асинхронно
        const linkMap = await getAnonLinkMap();
        const ownerTelegramId = linkMap[startPayload.toUpperCase()];

        if (ownerTelegramId && ownerTelegramId !== telegramIdStr) {
            // Это анонимный отправитель, который пришел по ссылке
            let senderData = await getUserData(telegramIdStr); // <--- АСИНХРОННЫЙ ВЫЗОВ
            if (!senderData) {
                // Если анонимный отправитель не зарегистрирован, зарегистрируем его
                senderData = await registerUser(telegramIdStr); // <--- АСИНХРОННЫЙ ВЫЗОВ
            }
            // Устанавливаем состояние для анонимной отправки
            senderData.currentCommandStep = 'awaiting_anon_message'; // <--- ИЗМЕНЕНО: current_command_step -> currentCommandStep
            senderData.tempData = { owner_telegram_id: ownerTelegramId }; // <--- ИЗМЕНЕНО: temp_data -> tempData
            await updateUserData(telegramIdStr, senderData); // <--- АСИНХРОННЫЙ ВЫЗОВ

            return `Вы собираетесь отправить анонимное сообщение владельцу этой ссылки. Введите ваше сообщение:`;
        } else if (ownerTelegramId === telegramIdStr) {
            // Пользователь перешел по своей собственной ссылке
            const userData = await getUserData(telegramIdStr); // Получаем данные пользователя
            return `Привет! Это ваша собственная анонимная ссылка. Вы не можете отправить анонимное сообщение самому себе.\n\n` +
                   `Ваша ссылка для анонимных вопросов: \`https://t.me/${botUsername}?start=${userData.anonLinkCode}\``; // <--- ИЗМЕНЕНО: anon_link_code -> anonLinkCode
        }
    }

    // Если нет payload или payload недействителен, или это владелец ссылки
    const userData = await registerUser(telegramIdStr); // <--- АСИНХРОННЫЙ ВЫЗОВ
    const formattedAnonId = `\`${userData.anonymousId}\``; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
    const formattedAnonLink = `\`https://t.me/${botUsername}?start=${userData.anonLinkCode}\``; // <--- ИЗМЕНЕНО: anon_link_code -> anonLinkCode

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
    const userData = await getUserData(telegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }
    const formattedAnonLink = `\`https://t.me/${botUsername}?start=${userData.anonLinkCode}\``; // <--- ИЗМЕНЕНО: anon_link_code -> anonLinkCode
    return `Ваша личная ссылка для анонимных вопросов: ${formattedAnonLink}`;
}

/**
 * Обрабатывает команду /myid. Показывает анонимный ID пользователя.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Сообщение для отправки пользователю.
 */
async function handleMyId(telegramId) {
    const userData = await getUserData(telegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }
    const formattedAnonId = `\`${userData.anonymousId}\``; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
    return `Ваш анонимный ID: ${formattedAnonId}`;
}

/**
 * Инициирует процесс отправки сообщения (шаг 1: запрос ID получателя).
 * @param {string|number} senderTelegramId - Telegram ID отправителя.
 * @returns {Promise<string>} Сообщение для отправки отправителю.
 */
async function initiateSendMessage(senderTelegramId) {
    const senderData = await getUserData(senderTelegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!senderData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }
    // Сбрасываем текущее состояние, если оно было
    senderData.currentCommandStep = 'awaiting_recipient_id'; // <--- ИЗМЕНЕНО: current_command_step -> currentCommandStep
    senderData.tempData = {}; // <--- ИЗМЕНЕНО: temp_data -> tempData
    await updateUserData(senderTelegramId, senderData); // <--- АСИНХРОННЫЙ ВЫЗОВ
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
    const senderData = await getUserData(senderTelegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!senderData) {
        return { responseForSender: "Пожалуйста, сначала используйте команду /start для регистрации." };
    }

    const senderAnonId = senderData.anonymousId; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId

    // Проверка на автоблок отправителя
    if (senderData.isAutoBlocked) { // <--- ИЗМЕНЕНО: is_auto_blocked -> isAutoBlocked
        const blockUntil = new Date(senderData.autoBlockUntil); // <--- ИЗМЕНЕНО: auto_block_until -> autoBlockUntil
        if (new Date() < blockUntil) {
            const remainingTimeMs = blockUntil.getTime() - new Date().getTime();
            const hours = Math.floor(remainingTimeMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
            return { responseForSender: `🚫 Вы временно заблокированы за нарушение правил. Блокировка истекает через ${hours} ч ${minutes} мин.` };
        } else {
            senderData.isAutoBlocked = false; // <--- ИЗМЕНЕНО: is_auto_blocked -> isAutoBlocked
            senderData.autoBlockUntil = null; // <--- ИЗМЕНЕНО: auto_block_until -> autoBlockUntil
            await updateUserData(senderTelegramId, senderData); // <--- АСИНХРОННЫЙ ВЫЗОВ
        }
    }

    let recipientAnonId;
    let finalMessageText;

    if (directRecipientId && directMessageText) {
        // Если команда /send [ID] [текст] была введена сразу
        recipientAnonId = directRecipientId.toUpperCase();
        finalMessageText = directMessageText;
        // Сбрасываем состояние, так как это прямая команда
        senderData.currentCommandStep = null; // <--- ИЗМЕНЕНО: current_command_step -> currentCommandStep
        senderData.tempData = {}; // <--- ИЗМЕНЕНО: temp_data -> tempData
        await updateUserData(senderTelegramId, senderData); // <--- АСИНХРОННЫЙ ВЫЗОВ
    } else if (senderData.currentCommandStep === 'awaiting_recipient_id') { // <--- ИЗМЕНЕНО: current_command_step -> currentCommandStep
        recipientAnonId = messageText.toUpperCase();
        senderData.tempData.recipient_id = recipientAnonId; // <--- ИЗМЕНЕНО: temp_data -> tempData
        senderData.currentCommandStep = 'awaiting_message_text'; // <--- ИЗМЕНЕНО: current_command_step -> currentCommandStep
        await updateUserData(senderTelegramId, senderData); // <--- АСИНХРОННЫЙ ВЫЗОВ
        return { responseForSender: `ID получателя установлен: **${recipientAnonId}**. Теперь введите текст сообщения:` };
    } else if (senderData.currentCommandStep === 'awaiting_message_text') { // <--- ИЗМЕНЕНО: current_command_step -> currentCommandStep
        recipientAnonId = senderData.tempData.recipient_id; // <--- ИЗМЕНЕНО: temp_data -> tempData
        finalMessageText = messageText;
        // Сброс состояния после получения текста
        senderData.currentCommandStep = null; // <--- ИЗМЕНЕНО: current_command_step -> currentCommandStep
        senderData.tempData = {}; // <--- ИЗМЕНЕНО: temp_data -> tempData
        await updateUserData(senderTelegramId, senderData); // <--- АСИНХРОННЫЙ ВЫЗОВ
    } else {
        // Неизвестное состояние или неверное использование
        return { responseForSender: "Неизвестное состояние команды. Пожалуйста, попробуйте снова или используйте /help." };
    }

    // --- Общие проверки после получения всех данных ---
    if (finalMessageText.length > MAX_MESSAGE_LENGTH) {
        return { responseForSender: `Сообщение слишком длинное. Максимум ${MAX_MESSAGE_LENGTH} символов. Пожалуйста, попробуйте снова.` };
    }

    if (checkAutoBlock(finalMessageText)) {
        senderData.isAutoBlocked = true; // <--- ИЗМЕНЕНО: is_auto_blocked -> isAutoBlocked
        senderData.autoBlockUntil = new Date(Date.now() + AUTO_BLOCK_DURATION_HOURS * 60 * 60 * 1000); // <--- ИЗМЕНЕНО: auto_block_until -> autoBlockUntil, используем Date
        await updateUserData(senderTelegramId, senderData); // <--- АСИНХРОННЫЙ ВЫЗОВ
        return {
            responseForSender: `🚫 Ваше сообщение содержит запрещенные слова. Вы автоматически заблокированы на ${AUTO_BLOCK_DURATION_HOURS} часов.\nСообщение не отправлено.`
        };
    }

    const recipientTelegramId = await getTelegramIdByAnonymousId(recipientAnonId); // <--- АСИНХРОННЫЙ ВЫЗОВ

    if (!recipientTelegramId) {
        return { responseForSender: "❌ Пользователь с таким ID не найден." };
    }
    if (recipientTelegramId === String(senderTelegramId)) {
        return { responseForSender: "Вы не можете отправить сообщение самому себе." };
    }

    const recipientData = await getUserData(recipientTelegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!recipientData) {
        return { responseForSender: "❌ Ошибка: данные получателя не найдены." };
    }

    // Проверка блокировки: isBlocked теперь должна быть асинхронной и принимать данные из БД
    if (recipientData.blockedUsers.includes(senderAnonId)) { // <--- ИЗМЕНЕНО: используем recipientData.blockedUsers
        return { responseForSender: "❌ Вы не можете отправить сообщение этому пользователю, так как он вас заблокировал." };
    }
    if (senderData.blockedUsers.includes(recipientAnonId)) { // <--- ИЗМЕНЕНО: используем senderData.blockedUsers
        return { responseForSender: "❌ Вы заблокировали этого пользователя и не можете ему отправлять сообщения." };
    }

    await updateMessageCount(senderTelegramId, senderData); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (senderData.messagesSentToday > MAX_MESSAGES_PER_DAY) { // <--- ИЗМЕНЕНО: messages_sent_today -> messagesSentToday
        return { responseForSender: `🚫 Вы достигли лимита в ${MAX_MESSAGES_PER_DAY} сообщений в день. Попробуйте завтра.` };
    }

    // recordMessage(senderAnonId, recipientAnonId, finalMessageText); // Не используем для этого типа сообщений

    return {
        responseForSender: `✅ Сообщение успешно отправлено пользователю **${recipientAnonId}**.\nОтправлено сегодня: ${senderData.messagesSentToday}/${MAX_MESSAGES_PER_DAY}`, // <--- ИЗМЕНЕНО: messages_sent_today -> messagesSentToday
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
    const result = await sendAnonymousReply(ownerTelegramId, replyText); // <--- АСИНХРОННЫЙ ВЫЗОВ
    return result;
}


/**
 * Обрабатывает команду /inbox. Показывает последние 10 полученных сообщений.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Сообщение со списком входящих сообщений.
 */
async function handleInbox(telegramId) {
    const userData = await getUserData(telegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const userAnonId = userData.anonymousId; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
    // getMessages() теперь заглушка, т.к. сообщения не хранятся в БД для inbox
    // Если вы хотите хранить сообщения, нужно будет реализовать это в dataAccess.js и models.js
    const receivedMessages = getRecentMessages(userAnonId); // Вызываем заглушку, которая вернет []

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
    const blockerData = await getUserData(blockerTelegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!blockerData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    if (args.length === 0) {
        return "Использование: `/block [ID пользователя для блокировки]`";
    }

    const blockerAnonId = blockerData.anonymousId; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
    const blockedAnonId = args[0].toUpperCase();

    // Проверяем, существует ли пользователь, которого пытаются заблокировать
    const targetUserTelegramId = await getTelegramIdByAnonymousId(blockedAnonId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!targetUserTelegramId) {
        return "❌ Пользователь с таким ID не найден.";
    }
    if (blockedAnonId === blockerAnonId) {
        return "Вы не можете заблокировать самого себя.";
    }

    // Логика блокировки теперь в blockedUsers внутри User модели
    if (blockerData.blockedUsers.includes(blockedAnonId)) {
        return `🚫 Пользователь **${blockedAnonId}** уже заблокирован.`;
    }

    blockerData.blockedUsers.push(blockedAnonId);
    await updateUserData(blockerTelegramId, blockerData); // <--- АСИНХРОННЫЙ ВЫЗОВ
    return `✅ Пользователь **${blockedAnonId}** успешно заблокирован. Он больше не сможет отправлять вам сообщения.`;
}

/**
 * Обрабатывает команду /unblock. Разблокирует указанного пользователя.
 * @param {string|number} unblockerTelegramId - Telegram ID разблокирующего пользователя.
 * @param {string[]} args - Массив аргументов команды (ID пользователя для разблокировки).
 * @returns {Promise<string>} Сообщение для отправки разблокирующему пользователю.
 */
async function handleUnblock(unblockerTelegramId, args) {
    const unblockerData = await getUserData(unblockerTelegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!unblockerData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    if (args.length === 0) {
        return "Использование: `/unblock [ID пользователя для разблокировки]`";
    }

    const unblockerAnonId = unblockerData.anonymousId; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
    const unblockedAnonId = args[0].toUpperCase();

    if (!unblockerData.blockedUsers.includes(unblockedAnonId)) {
        return `🚫 Пользователь **${unblockedAnonId}** не найден в вашем списке заблокированных.`;
    }

    unblockerData.blockedUsers = unblockerData.blockedUsers.filter(id => id !== unblockedAnonId);
    await updateUserData(unblockerTelegramId, unblockerData); // <--- АСИНХРОННЫЙ ВЫЗОВ
    return `✅ Пользователь **${unblockedAnonId}** успешно разблокирован.`;
}

/**
 * Обрабатывает команду /blocked. Показывает список заблокированных пользователей.
 * @param {string|number} telegramId - Telegram ID пользователя.
 * @returns {Promise<string>} Сообщение со списком заблокированных пользователей.
 */
async function handleBlocked(telegramId) {
        const userData = await getUserData(telegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const blockedList = userData.blockedUsers || []; // <--- ИЗМЕНЕНО: используем blockedUsers из userData

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
    const userData = await getUserData(telegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const oldAnonId = userData.anonymousId; // <--- ИЗМЕНЕНО: anonymous_id -> anonymousId
    const newAnonId = await changeAnonymousId(telegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ

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
    const userData = await getUserData(telegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const oldAnonLinkCode = userData.anonLinkCode; // <--- ИЗМЕНЕНО: anon_link_code -> anonLinkCode
    const newAnonLinkCode = await changeAnonymousLink(telegramId); // <--- АСИНХРОННЫЙ ВЫЗОВ

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
 *
 * @param {string} messageText - Текст сообщения пользователя.
 * @returns {Promise<object|null>} Объект с результатом для отправителя/получателя или null, если сообщение не обработано.
 */
async function handleUserTextMessage(chatId, messageText) {
    const userData = await getUserData(chatId); // <--- АСИНХРОННЫЙ ВЫЗОВ
    if (!userData) {
        // Пользователь не зарегистрирован, не можем обработать текстовое сообщение
        return null; // Или можно вернуть сообщение "Пожалуйста, используйте /start"
    }

    // Проверяем, находится ли пользователь в середине пошаговой команды
    if (userData.currentCommandStep === 'awaiting_recipient_id' || userData.currentCommandStep === 'awaiting_message_text') {
        const result = await handleSendMessageStep(chatId, messageText); // <--- АСИНХРОННЫЙ ВЫЗОВ
        return result;
    }

    // Если это не часть пошаговой команды, и не команда, и не кнопка,
    // то это анонимное сообщение, пришедшее по ссылке.
    // Эту логику мы перенесли в app.js, когда обрабатываем /start с payload.
    // Здесь эта функция будет возвращать null, если сообщение не является частью пошаговой команды.
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
