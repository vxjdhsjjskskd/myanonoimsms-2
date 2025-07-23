// src/handlers.js - Модуль для обработки команд бота

const {
    getUserData,
    getTelegramIdByAnonLinkCode,
    getAnonLinkMap, // Оставлено, если вдруг где-то используется напрямую, но в этой логике не нужно
    updateUserData,
} = require('./dataAccess');

const { registerUser, changeAnonymousLink } = require('./user');
const { recordMessage, getRecentMessages } = require('./chat');
const { sendAnonymousMessage, sendAnonymousReply } = require('./anonChat');
const { getTodayDateString, checkAutoBlock, AUTO_BLOCK_DURATION_HOURS } = require('./utils');

const MAX_MESSAGE_LENGTH = 500;

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
            senderData.currentCommandStep = 'awaiting_anon_message';
            senderData.tempData = { owner_telegram_id: ownerTelegramId };
            await updateUserData(telegramIdStr, senderData);

            return `🚀 Здесь можно отправить анонимное сообщение человеку, который опубликовал эту ссылку.\n\n` +
                   `✍️ Напишите сюда всё, что хотите ему передать, и через несколько секунд он получит ваше сообщение, но не будет знать от кого.\n\n` +
                   `Отправить можно фото, видео, 💬 текст, 🔊 голосовые, 📷 видеосообщения (кружки), а также ✨ стикеры`;
        } else if (ownerTelegramId === telegramIdStr) {
            const userData = await getUserData(telegramIdStr);
            console.log(`[HANDLER.handleStart] Пользователь ${telegramIdStr} перешел по своей ссылке. Данные:`, userData);
            return `Привет! Это ваша собственная анонимная ссылка. Вы не можете отправить анонимное сообщение самому себе.\n\n` +
                   `Ваша ссылка для анонимных вопросов: \`https://t.me/${botUsername}?start=${userData.anonLinkCode}\``;
        } else {
            console.log(`[HANDLER.handleStart] Ссылка с payload ${startPayload} недействительна.`);
            return `❌ Ссылка недействительна или больше не активна.`;
        }
    }

    console.log(`[HANDLER.handleStart] Обычный /start от ${telegramIdStr}. Регистрируем/получаем пользователя.`);
    const userData = await registerUser(telegramIdStr);
    console.log(`[HANDLER.handleStart] Данные пользователя после регистрации/получения:`, userData);
    const formattedAnonLink = `\`https://t.me/${botUsername}?start=${userData.anonLinkCode}\``;
    console.log(`[HANDLER.handleStart] Формируемая ссылка: ${formattedAnonLink}`);

    return (
        `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
        `Твоя ссылка:\n` +
        `👉 ${formattedAnonLink}\n\n` +
        `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`
    );
}

async function handleMyLink(telegramId, botUsername) {
    console.log(`[HANDLER.handleMyLink] Получено /mylink от ${telegramId}.`);
    const userData = await getUserData(telegramId);
    if (!userData) {
        console.log(`[HANDLER.handleMyLink] Пользователь ${telegramId} не найден.`);
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }
    console.log(`[HANDLER.handleMyLink] Данные пользователя для /mylink:`, userData);
    const formattedAnonLink = `\`https://t.me/${botUsername}?start=${userData.anonLinkCode}\``;
    console.log(`[HANDLER.handleMyLink] Формируемая ссылка для /mylink: ${formattedAnonLink}`);
    return `Ваша личная ссылка для анонимных вопросов: ${formattedAnonLink}`;
}

async function handleMyId(telegramId) {
    return "Команда /myid больше не поддерживается. Используйте /mylink для получения вашей анонимной ссылки.";
}

async function initiateSendMessage(senderTelegramId) {
    return "Команда /send больше не поддерживается. Отправка анонимных сообщений происходит только через вашу личную ссылку.";
}

async function handleSendMessageStep() {
    return { responseForSender: "Эта функция больше не поддерживается." };
}

async function handleReply(ownerTelegramId, args) {
    const replyText = args.join(' ');
    if (!replyText) {
        return { responseForOwner: "Использование: `/reply [ваш ответ]`" };
    }
    const result = await sendAnonymousReply(ownerTelegramId, replyText);
    return result;
}

async function handleInbox(telegramId) {
    return "📬 У вас пока нет новых сообщений. История сообщений не сохраняется.";
}

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

async function handleChangeId(telegramId) {
    return "Команда /changeid больше не поддерживается, так как анонимный ID не используется.";
}

async function handleChangeLink(telegramId, botUsername) {
    const userData = await getUserData(telegramId);
    if (!userData) {
        return "Пожалуйста, сначала используйте команду /start для регистрации.";
    }

    const oldAnonLinkCode = userData.anonLinkCode;
    const newAnonLinkCode = await changeAnonymousLink(telegramId);

    const formattedNewAnonLink = `\`https://t.me/${botUsername}?start=${newAnonLinkCode}\``;

    return `✅ Ваша анонимная ссылка успешно изменена с \`https://t.me/${botUsername}?start=${oldAnonLinkCode}\` на ${formattedNewAnonLink}.`;
}

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

async function handleUserTextMessage(chatId, messageText) {
    const userData = await getUserData(chatId);
    if (!userData) {
        return null;
    }

    if (userData.currentCommandStep === 'awaiting_anon_message') {
        const result = await sendAnonymousMessage(chatId, userData.tempData.owner_telegram_id, messageText);
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
