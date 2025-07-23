// app.js - Основной файл для запуска Telegram бота (с MongoDB Atlas)

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { connectDb } = require('./src/db'); // Импорт функции подключения к БД

// Импорт модулей логики бота (все функции теперь асинхронны)
const {
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
    handleUserTextMessage // <--- Добавлено
} = require('./src/handlers'); // <--- ИЗМЕНЕНО: handlers.js

const { getUserData, updateUserData } = require('./src/dataAccess'); // Для прямого доступа в app.js
const { generateAnonymousId, generateLinkCode } = require('./src/utils'); // Для прямого доступа в app.js

// Конфигурация
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Render сам предоставляет PORT, используем его. Если нет, то 3000 как запасной.
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
    console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не найден в переменных окружения.');
    process.exit(1);
}

// Создание бота и веб-сервера
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

let BOT_USERNAME = '';

// Health endpoint для uptimebot
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        bot: 'Anonymous Ask Bot',
        uptime: process.uptime()
    });
});

// Запуск веб-сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Health endpoint доступен по адресу: http://0.0.0.0:${PORT}/health`);
    console.log(`📊 Для uptimebot используйте: https://[ваш-домен]/health`);
});

// Получение имени бота
bot.getMe().then(me => {
    BOT_USERNAME = me.username;
    console.log(`🤖 Бот запущен: @${BOT_USERNAME}`);
}).catch(err => {
    console.error('❌ Ошибка получения информации о боте:', err);
});

// --- Инициализация базы данных MongoDB Atlas ---
connectDb().then(() => {
    console.log('✅ База данных MongoDB Atlas подключена. Запускаем логику бота...');
    // После успешного подключения к БД, можно инициализировать остальную логику
    initializeBotLogic();
}).catch(err => {
    console.error('❌ Критическая ошибка подключения к базе данных:', err);
    process.exit(1);
});

// --- Функция, содержащая всю логику бота, которая запускается после подключения к БД ---
async function initializeBotLogic() {
    // Установка команд меню
    bot.setMyCommands([
        { command: 'start', description: '🚀 Запустить бота' },
        { command: 'stats', description: '📊 Статистика' },
        { command: 'changelink', description: '🔗 Изменить ссылку' }
    ]);

    // Обработчик команды /start
    bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const startPayload = match ? match[1] : undefined;

        console.log(`👤 /start от ${chatId}, payload: ${startPayload || 'нет'}`);
        const response = await handleStart(chatId, startPayload, BOT_USERNAME); // <--- АСИНХРОННЫЙ ВЫЗОВ
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' }); // mainKeyboard не нужна, если она не глобальная
    });

    // Обработчик кнопки "Моя ссылка" или команды /mylink
    bot.onText(/\/mylink|Моя ссылка/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /mylink или кнопки "Моя ссылка" для chat ID: ${chatId}`);
        const response = await handleMyLink(chatId, BOT_USERNAME); // <--- АСИНХРОННЫЙ ВЫЗОВ
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Мой ID" или команды /myid
    bot.onText(/\/myid|Мой ID/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /myid или кнопки "Мой ID" для chat ID: ${chatId}`);
        const response = await handleMyId(chatId); // <--- АСИНХРОННЫЙ ВЫЗОВ
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Отправить" или команды /send (инициирует пошаговую отправку)
    bot.onText(/\/send|Отправить/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /send или кнопки "Отправить" для chat ID: ${chatId}`);
        // Если это команда /send с аргументами (старый формат), обрабатываем ее напрямую
        const match = msg.text.match(/\/send (.+)/);
        if (match && match[1]) {
            const args = match[1].split(' ');
            const result = await handleSendMessageStep(chatId, null, args[0], args.slice(1).join(' ')); // <--- АСИНХРОННЫЙ ВЫЗОВ
            bot.sendMessage(chatId, result.responseForSender || result, { parse_mode: 'Markdown' });

            if (result.recipientTelegramId && result.senderAnonId && result.messageText) {
                bot.sendMessage(result.recipientTelegramId, `📬 Сообщение от **${result.senderAnonId}**: ${result.messageText}`, { parse_mode: 'Markdown' });
            }
        } else {
            // Если просто нажата кнопка "Отправить" или введена /send без аргументов, инициируем пошаговый процесс
            const response = await initiateSendMessage(chatId); // <--- АСИНХРОННЫЙ ВЫЗОВ
            bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        }
    });

    // Обработчик кнопки "Входящие" или команды /inbox
    bot.onText(/\/inbox|Входящие/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /inbox или кнопки "Входящие" для chat ID: ${chatId}`);
        const response = await handleInbox(chatId); // <--- АСИНХРОННЫЙ ВЫЗОВ
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Ответить" или команды /reply
    bot.onText(/\/reply (.+)|Ответить/, async (msg, match) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /reply или кнопки "Ответить" для chat ID: ${chatId}`);
        const args = match ? match[1].split(' ') : []; // Получаем аргументы, если это команда

        if (msg.text === 'Ответить') {
            bot.sendMessage(chatId, 'Пожалуйста, используйте формат: `/reply [ваш ответ]`', { parse_mode: 'Markdown' });
        } else {
            const result = await handleReply(chatId, args); // <--- АСИНХРОННЫЙ ВЫЗОВ
            bot.sendMessage(chatId, result.responseForOwner || result, { parse_mode: 'Markdown' });

            if (result.recipientChatId && result.replyText) {
                bot.sendMessage(result.recipientChatId, result.replyText, { parse_mode: 'Markdown' });
            }
        }
    });

    // Обработчик кнопки "Заблокировать" или команды /block
    bot.onText(/\/block|Заблокировать/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /block или кнопки "Заблокировать" для chat ID: ${chatId}`);
        if (msg.text === 'Заблокировать') {
            bot.sendMessage(chatId, 'Пожалуйста, используйте формат: `/block [ID пользователя для блокировки]`', { parse_mode: 'Markdown' });
        } else {
            const match = msg.text.match(/\/block (.+)/);
            if (match && match[1]) {
                const args = match[1].split(' ');
                const response = await handleBlock(chatId, args); // <--- АСИНХРОННЫЙ ВЫЗОВ
                bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, 'Неверный формат. Используйте: `/block [ID пользователя для блокировки]`', { parse_mode: 'Markdown' });
            }
        }
    });

    // Обработчик кнопки "Разблокировать" или команды /unblock
    bot.onText(/\/unblock|Разблокировать/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /unblock или кнопки "Разблокировать" для chat ID: ${chatId}`);
        if (msg.text === 'Разблокировать') {
            bot.sendMessage(chatId, 'Пожалуйста, используйте формат: `/unblock [ID пользователя для разблокировки]`', { parse_mode: 'Markdown' });
        } else {
            const match = msg.text.match(/\/unblock (.+)/);
            if (match && match[1]) {
                const args = match[1].split(' ');
                const response = await handleUnblock(chatId, args); // <--- АСИНХРОННЫЙ ВЫЗОВ
                bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, 'Неверный формат. Используйте: `/unblock [ID пользователя для разблокировки]`', { parse_mode: 'Markdown' });
            }
        }
    });

    // Обработчик кнопки "Мои блокировки" или команды /blocked
    bot.onText(/\/blocked|Мои блокировки/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /blocked или кнопки "Мои блокировки" для chat ID: ${chatId}`);
        const response = await handleBlocked(chatId); // <--- АСИНХРОННЫЙ ВЫЗОВ
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Сменить ID" или команды /changeid
    bot.onText(/\/changeid|Сменить ID/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /changeid или кнопки "Сменить ID" для chat ID: ${chatId}`);
        const response = await handleChangeId(chatId); // <--- АСИНХРОННЫЙ ВЫЗОВ
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Сменить ссылку" или команды /changelink
    bot.onText(/\/changelink|Сменить ссылку/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /changelink или кнопки "Сменить ссылку" для chat ID: ${chatId}`);
        const response = await handleChangeLink(chatId, BOT_USERNAME); // <--- АСИНХРОННЫЙ ВЫЗОВ
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Помощь" или команды /help
    bot.onText(/\/help|Помощь/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`[Bot Handler] Обработка /help или кнопки "Помощь" для chat ID: ${chatId}`);
        const response = handleHelp(); // Эта функция синхронна
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // --- ГЛАВНЫЙ ОБРАБОТЧИК ДЛЯ ВСЕХ ТЕКСТОВЫХ СООБЩЕНИЙ (для пошаговых команд и анонимных вопросов) ---
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const messageText = msg.text;

        // Игнорируем сообщения, которые начинаются с '/' (команды)
        if (messageText && messageText.startsWith('/')) {
            return;
        }
        // Игнорируем сообщения, которые являются текстом кнопок
        const buttonTexts = ['Моя ссылка', 'Мой ID', 'Отправить', 'Входящие', 'Ответить', 'Мои блокировки', 'Заблокировать', 'Разблокировать', 'Сменить ID', 'Сменить ссылку', 'Помощь'];
        if (buttonTexts.includes(messageText)) {
            return;
        }

        console.log(`[Bot Handler] Получено текстовое сообщение (не команда/кнопка) от chat ID: ${chatId}: "${messageText}"`);

        // Проверяем, находится ли пользователь в середине пошаговой команды
        const userData = await getUserData(chatId); // Получаем данные пользователя для проверки состояния
        if (!userData) {
            return bot.sendMessage(chatId, 'Сначала используйте команду /start для регистрации.');
        }

        let result = null;
        if (userData.currentCommandStep === 'awaiting_recipient_id' || userData.currentCommandStep === 'awaiting_message_text') {
            result = await handleSendMessageStep(chatId, messageText);
        } else if (userData.currentCommandStep === 'awaiting_anon_message') {
            // Если пользователь пришел по анонимной ссылке и ждет сообщения
            result = await sendAnonymousMessage(chatId, userData.tempData.owner_telegram_id, messageText);
            // После отправки анонимного сообщения, сбрасываем состояние
            userData.currentCommandStep = null;
            userData.tempData = {};
            await updateUserData(chatId, userData);
        } else if (msg.reply_to_message && userData.lastAnonSenderChatId) {
            // Если это ответ на анонимное сообщение
            result = await handleReply(chatId, [messageText]); // Передаем текст как аргумент
        }


        if (result) {
            // Если handleUserTextMessage вернул результат, это означает, что сообщение было частью пошаговой команды
            bot.sendMessage(chatId, result.responseForSender || result.responseForOwner || result, { parse_mode: 'Markdown' });

            // Если это было обычное сообщение, отправляем его получателю
            if (result.recipientTelegramId && result.senderAnonId && result.messageText) {
                bot.sendMessage(result.recipientTelegramId, `📬 Сообщение от **${result.senderAnonId}**: ${result.messageText}`, { parse_mode: 'Markdown' });
            }
            // Если это был анонимный вопрос, отправляем его владельцу ссылки
            else if (result.ownerTelegramId && result.senderChatId && result.messageText) { // ownerTelegramId - это получатель анонимного сообщения
                bot.sendMessage(result.ownerTelegramId, `🏄‍♂️ У тебя новое анонимное сообщение!\n\n${result.messageText}\n\n↩️ Свайпни для ответа.`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Заблокировать', callback_data: 'block_sender' }]
                        ]
                    }
                });
                // Сохраняем lastAnonSenderChatId для владельца ссылки
                const ownerData = await getUserData(result.ownerTelegramId);
                ownerData.lastAnonSenderChatId = String(result.senderChatId);
                ownerData.lastAnonSender = (await getUserData(result.senderChatId)).anonymousId; // Сохраняем анонимный ID отправителя
                await updateUserData(result.ownerTelegramId, ownerData);

                // Отправляем отправителю подтверждение и его ссылку
                bot.sendMessage(result.senderChatId, '🏄‍♂️ Сообщение отправлено, ожидайте ответ!', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✍️ Отправить ещё', callback_data: 'send_more' }]
                        ]
                    }
                });
                const senderPromoData = await getUserData(result.senderChatId);
                bot.sendMessage(result.senderChatId,
                    `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
                    `Твоя ссылка:\n` +
                    `👉 https://t.me/${BOT_USERNAME}?start=${senderPromoData.anonLinkCode}\n\n` +
                    `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`
                );

            }
            // Если это был ответ на анонимное сообщение
            else if (result.recipientChatId && result.replyText) {
                bot.sendMessage(result.recipientChatId, result.replyText, { parse_mode: 'Markdown' });
                // Добавляем инлайн кнопку "Написать ещё" для анонимного отправителя
                bot.sendMessage(result.recipientChatId, '🕊 Ваш ответ отправлен успешно', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✍️ Написать ещё', callback_data: 'send_more' }]
                        ]
                    }
                });
            }
        } else {
            // Если handleUserTextMessage вернул null, это обычное текстовое сообщение,
            // на которое бот может ответить, что не понимает.
            bot.sendMessage(chatId, 'Я понимаю только команды или кнопки. Используйте /help для справки.', { parse_mode: 'Markdown' });
        }
    });

    // Обработчик callback-запросов (инлайн кнопок)
    bot.on('callback_query', async (callbackQuery) => {
        const message = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = message.chat.id;

        await bot.answerCallbackQuery(callbackQuery.id);

        const userData = await getUserData(chatId);
        if (!userData) return;

        switch (data) {
            case 'cancel_message':
                userData.currentCommandStep = null;
                userData.tempData = {};
                await updateUserData(chatId, userData);
                bot.editMessageText(
                    '❌ Отправка сообщения отменена.',
                    {
                        chat_id: chatId,
                        message_id: message.message_id
                    }
                );
                break;

            case 'send_more':
                // lastAnonSenderChatId используется для "Ответить", а owner_telegram_id для "Отправить"
                let targetOwnerForSendMore = userData.tempData.owner_telegram_id || userData.lastAnonSenderChatId;

                if (targetOwnerForSendMore) {
                    userData.currentCommandStep = 'awaiting_anon_message';
                    userData.tempData = { owner_telegram_id: targetOwnerForSendMore };
                    await updateUserData(chatId, userData);

                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '✖️ Отменить', callback_data: 'cancel_message' }]
                            ]
                        }
                    }

                    bot.sendMessage(chatId,
                        `🚀 Здесь можно отправить анонимное сообщение человеку, который опубликовал эту ссылку.\n\n` +
                        `✍️ Напишите сюда всё, что хотите ему передать, и через несколько секунд он получит ваше сообщение, но не будет знать от кого.\n\n` +
                        `Отправить можно фото, видео, 💬 текст, 🔊 голосовые, 📷 видеосообщения (кружки), а также ✨ стикеры`,
                        keyboard
                    );
                } else {
                    bot.sendMessage(chatId, 'Не удалось определить, кому отправить ещё сообщение. Пожалуйста, начните новую отправку через /start или /send.');
                }
                break;

            case 'block_sender':
                if (userData.lastAnonSender) { // lastAnonSender - это анонимный ID отправителя
                    if (!userData.blockedUsers.includes(userData.lastAnonSender)) {
                        userData.blockedUsers.push(userData.lastAnonSender);
                        await updateUserData(chatId, userData);
                    }
                    bot.editMessageReplyMarkup(
                        {
                            inline_keyboard: [
                                [{ text: '🗑️ Очистить черный список', callback_data: 'clear_blacklist' }]
                            ]
                        },
                        {
                            chat_id: chatId,
                            message_id: message.message_id
                        }
                    );
                    bot.sendMessage(chatId, `🚫 Отправитель **${userData.lastAnonSender}** заблокирован.`);
                }
                break;

            case 'clear_blacklist':
                userData.blockedUsers = [];
                await updateUserData(chatId, userData);
                bot.editMessageReplyMarkup(
                    { inline_keyboard: [] },
                    {
                        chat_id: chatId,
                        message_id: message.message_id
                    }
                );
                bot.sendMessage(chatId, '✅ Черный список очищен.');
                break;
        }
    });
} // <--- ЗАКРЫВАЮЩАЯ СКОБКА initializeBotLogic() - ЭТО ПРАВИЛЬНОЕ ЗАВЕРШЕНИЕ ФУНКЦИИ

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error.message);
});

bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error.message);
});

console.log('🚀 Бот запускается...');
