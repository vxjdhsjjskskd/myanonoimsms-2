// app.js - Основной файл для запуска Telegram бота (с MongoDB Atlas)

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { connectDb } = require('./src/db'); // Импорт функции подключения к БД

// Импорт модулей логики бота (все функции теперь асинхронны)
const {
    handleStart,
    handleMyLink,
    handleMyId, // Оставлено для совместимости, но возвращает сообщение об удалении
    initiateSendMessage, // Оставлено для совместимости, но возвращает сообщение об удалении
    handleSendMessageStep, // Оставлено для совместимости, но возвращает сообщение об удалении
    handleInbox, // Оставлено для совместимости, но возвращает сообщение об удалении
    handleReply,
    handleBlock,
    handleUnblock,
    handleBlocked,
    handleChangeId, // Оставлено для совместимости, но возвращает сообщение об удалении
    handleChangeLink,
    handleHelp,
    handleUserTextMessage
} = require('./src/handlers');

const { getUserData, updateUserData } = require('./src/dataAccess'); // Для прямого доступа в app.js

// Конфигурация
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
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
        { command: 'mylink', description: '🔗 Моя ссылка' },
        { command: 'reply', description: '↩️ Ответить' },
        { command: 'block', description: '🚫 Заблокировать' },
        { command: 'unblock', description: '✅ Разблокировать' },
        { command: 'blocked', description: '📋 Мои блокировки' },
        { command: 'changelink', description: '🔄 Сменить ссылку' },
        { command: 'help', description: '📚 Помощь' },
    ]);

    // --- ОБРАБОТЧИКИ КОМАНД И КНОПОК ---

    // Обработчик команды /start
    bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const startPayload = match ? match[1] : undefined;
        const response = await handleStart(chatId, startPayload, BOT_USERNAME);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Моя ссылка" или команды /mylink
    bot.onText(/\/mylink|Моя ссылка/, async (msg) => {
        const chatId = msg.chat.id;
        const response = await handleMyLink(chatId, BOT_USERNAME);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Мой ID" или команды /myid (теперь возвращает сообщение об удалении)
    bot.onText(/\/myid|Мой ID/, async (msg) => {
        const chatId = msg.chat.id;
        const response = await handleMyId(chatId);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Отправить" или команды /send (теперь возвращает сообщение об удалении)
    bot.onText(/\/send|Отправить/, async (msg) => {
        const chatId = msg.chat.id;
        const response = await initiateSendMessage(chatId);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Входящие" или команды /inbox (теперь возвращает сообщение об удалении)
    bot.onText(/\/inbox|Входящие/, async (msg) => {
        const chatId = msg.chat.id;
        const response = await handleInbox(chatId);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Ответить" или команды /reply
    bot.onText(/\/reply (.+)|Ответить/, async (msg, match) => {
        const chatId = msg.chat.id;
        const args = match ? match[1].split(' ') : [];

        if (msg.text === 'Ответить' && !match) { // Если просто нажата кнопка "Ответить" без текста
            bot.sendMessage(chatId, 'Пожалуйста, используйте формат: `/reply [ваш ответ]`', { parse_mode: 'Markdown' });
        } else {
            const result = await handleReply(chatId, args);
            bot.sendMessage(chatId, result.responseForOwner || result, { parse_mode: 'Markdown' });

            if (result.recipientChatId && result.replyText) {
                bot.sendMessage(result.recipientChatId, result.replyText, { parse_mode: 'Markdown' });
            }
        }
    });

    // Обработчик кнопки "Заблокировать" или команды /block
    bot.onText(/\/block|Заблокировать/, async (msg) => {
        const chatId = msg.chat.id.toString(); // Получаем Chat ID текущего пользователя
        if (msg.text === 'Заблокировать') {
            // Если нажата кнопка, но нет аргументов, просим ввести ID
            bot.sendMessage(chatId, 'Пожалуйста, используйте формат: `/block [Telegram Chat ID пользователя для блокировки]`', { parse_mode: 'Markdown' });
        } else {
            const match = msg.text.match(/\/block (.+)/);
            if (match && match[1]) {
                const args = match[1].split(' ');
                const response = await handleBlock(chatId, args);
                bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, 'Неверный формат. Используйте: `/block [Telegram Chat ID пользователя для блокировки]`', { parse_mode: 'Markdown' });
            }
        }
    });

    // Обработчик кнопки "Разблокировать" или команды /unblock
    bot.onText(/\/unblock|Разблокировать/, async (msg) => {
        const chatId = msg.chat.id.toString();
        if (msg.text === 'Разблокировать') {
            bot.sendMessage(chatId, 'Пожалуйста, используйте формат: `/unblock [Telegram Chat ID пользователя для разблокировки]`', { parse_mode: 'Markdown' });
        } else {
            const match = msg.text.match(/\/unblock (.+)/);
            if (match && match[1]) {
                const args = match[1].split(' ');
                const response = await handleUnblock(chatId, args);
                bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, 'Неверный формат. Используйте: `/unblock [Telegram Chat ID пользователя для разблокировки]`', { parse_mode: 'Markdown' });
            }
        }
    });

    // Обработчик кнопки "Мои блокировки" или команды /blocked
    bot.onText(/\/blocked|Мои блокировки/, async (msg) => {
        const chatId = msg.chat.id;
        const response = await handleBlocked(chatId);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Сменить ID" или команды /changeid (теперь возвращает сообщение об удалении)
    bot.onText(/\/changeid|Сменить ID/, async (msg) => {
        const chatId = msg.chat.id;
        const response = await handleChangeId(chatId);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Сменить ссылку" или команды /changelink
    bot.onText(/\/changelink|Сменить ссылку/, async (msg) => {
        const chatId = msg.chat.id;
        const response = await handleChangeLink(chatId, BOT_USERNAME);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Обработчик кнопки "Помощь" или команды /help
    bot.onText(/\/help|Помощь/, async (msg) => {
        const chatId = msg.chat.id;
        const response = handleHelp();
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // --- ГЛАВНЫЙ ОБРАБОТЧИК ДЛЯ ВСЕХ ТЕКСТОВЫХ СООБЩЕНИЙ (для анонимных вопросов и ответов) ---
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id.toString();
        const messageText = msg.text;

        // Игнорируем сообщения, которые начинаются с '/' (команды)
        if (messageText && messageText.startsWith('/')) {
            return;
        }
        // Игнорируем сообщения, которые являются текстом кнопок (если они не команды)
        const buttonTexts = ['Моя ссылка', 'Мой ID', 'Отправить', 'Входящие', 'Ответить', 'Мои блокировки', 'Заблокировать', 'Разблокировать', 'Сменить ID', 'Сменить ссылку', 'Помощь'];
        if (buttonTexts.includes(messageText) && !messageText.startsWith('/')) {
            return;
        }

        console.log(`[App.onMessage] Получено текстовое сообщение от chat ID: ${chatId}: "${messageText}"`);

        const userData = await getUserData(chatId);
        if (!userData) {
            return bot.sendMessage(chatId, 'Сначала используйте команду /start для регистрации.');
        }

        let result = null;

        if (userData.currentCommandStep === 'awaiting_anon_message') {
            // Пользователь перешел по анонимной ссылке и ждет сообщения
            result = await handleUserTextMessage(chatId, messageText); // Используем handleUserTextMessage
            // Состояние сбрасывается внутри handleUserTextMessage
        } else if (msg.reply_to_message && userData.lastAnonSenderChatId) {
            // Если это ответ на анонимное сообщение (через свайп)
            result = await handleReply(chatId, [messageText]);
        } else {
            // Если это обычное текстовое сообщение, которое не является частью пошаговой команды
            bot.sendMessage(chatId, 'Я понимаю только команды или кнопки. Используйте /help для справки.', { parse_mode: 'Markdown' });
            return;
        }

        if (result) {
            // Обработка результата отправки анонимного сообщения
            if (result.ownerTelegramId && result.senderChatId && result.messageText) {
                // Это новое анонимное сообщение, отправляем владельцу ссылки
                const ownerData = await getUserData(result.ownerTelegramId); // Получаем данные владельца для блокировок
                if (ownerData && ownerData.blockedUsers.includes(result.senderChatId)) {
                    // Если отправитель заблокирован владельцем, не отправляем сообщение
                    bot.sendMessage(result.senderChatId, `🚫 Ваше сообщение не может быть доставлено, так как вы заблокированы получателем.`);
                    return;
                }

                bot.sendMessage(result.ownerTelegramId, `🏄‍♂️ У тебя новое анонимное сообщение!\n\n${result.messageText}\n\n↩️ Свайпни для ответа.`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Заблокировать', callback_data: `block_sender:${result.senderChatId}` }] // Передаем Chat ID отправителя
                        ]
                    }
                });
                // Сохраняем lastAnonSenderChatId для владельца ссылки
                ownerData.lastAnonSenderChatId = String(result.senderChatId);
                await updateUserData(result.ownerTelegramId, ownerData); // Обновляем данные владельца

                // Отправляем отправителю подтверждение и его ссылку
                bot.sendMessage(result.senderChatId, '🏄‍♂️ Сообщение отправлено, ожидайте ответ!', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✍️ Отправить ещё', callback_data: 'send_more' }]
                        ]
                    }
                });
                const senderPromoData = await getUserData(result.senderChatId);
                const senderPromoLinkCode = senderPromoData.anonLinkCode || senderPromoData.linkCode; // Учитываем старое поле
                bot.sendMessage(result.senderChatId,
                    `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
                    `Твоя ссылка:\n` +
                    `👉 https://t.me/${BOT_USERNAME}?start=${senderPromoLinkCode}\n\n` +
                    `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`
                );

            }
            // Обработка результата ответа на анонимное сообщение
            else if (result.recipientChatId && result.replyText) {
                const recipientData = await getUserData(result.recipientChatId);
                if (recipientData && recipientData.blockedUsers.includes(chatId)) { // Проверяем, заблокирован ли отвечающий
                    bot.sendMessage(chatId, `🚫 Ваш ответ не может быть доставлен, так как вы заблокированы получателем.`);
                    return;
                }
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
        }
    });

    // Обработчик callback-запросов (инлайн кнопок)
    bot.on('callback_query', async (callbackQuery) => {
        const message = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = message.chat.id.toString();

        await bot.answerCallbackQuery(callbackQuery.id);

        const userData = await getUserData(chatId);
        if (!userData) return;

        if (data.startsWith('block_sender:')) {
            const blockedChatId = data.split(':')[1];
            if (!userData.blockedUsers.includes(blockedChatId)) {
                userData.blockedUsers.push(blockedChatId);
                await updateUserData(chatId, userData);
            }
            // Обновляем кнопку на "Очистить черный список"
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
            bot.sendMessage(chatId, `🚫 Отправитель **${blockedChatId}** заблокирован.`);
            return;
        }

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
                // targetOwnerForSendMore - это Chat ID владельца ссылки, которому отправлялось сообщение
                let targetOwnerForSendMore = userData.tempData.owner_telegram_id; // Для тех, кто пришел по ссылке
                if (!targetOwnerForSendMore && userData.lastAnonSenderChatId) {
                    // Если кнопка "Отправить ещё" нажата после ответа, то lastAnonSenderChatId - это владелец ссылки
                    // (т.е. тот, кому мы только что ответили, и кому хотим отправить еще одно анонимное сообщение)
                    targetOwnerForSendMore = userData.lastAnonSenderChatId;
                }

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
                    };

                    bot.sendMessage(chatId,
                        `🚀 Здесь можно отправить анонимное сообщение человеку, который опубликовал эту ссылку.\n\n` +
                        `✍️ Напишите сюда всё, что хотите ему передать, и через несколько секунд он получит ваше сообщение, но не будет знать от кого.\n\n` +
                        `Отправить можно фото, видео, 💬 текст, 🔊 голосовые, 📷 видеосообщения (кружки), а также ✨ стикеры`,
                        keyboard
                    );
                } else {
                    bot.sendMessage(chatId, 'Не удалось определить, кому отправить ещё сообщение. Пожалуйста, начните новую отправку через /start.');
                }
                break;

            case 'clear_blacklist':
                userData.blockedUsers = [];
                await updateUserData(chatId, userData);
                bot.editMessageReplyMarkup(
                    { inline_keyboard: [] }, // Убираем инлайн-кнопки
                    {
                        chat_id: chatId,
                        message_id: message.message_id
                    }
                );
                bot.sendMessage(chatId, '✅ Черный список очищен.');
                break;
        }
    });
}

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error.message);
});

bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error.message);
});

console.log('🚀 Бот запускается...');
                
