const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Импорт модулей
const { initializeDb, getUserData, updateUserData, getAnonLinkMap, setAnonLinkMapEntry, deleteAnonLinkMapEntry, getAllUsers } = require('./src/database');
const { generateAnonymousId, generateLinkCode } = require('./src/utils');

// Конфигурация
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 5000;

if (!TOKEN) {
    console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не найден в переменных окружения');
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

// Инициализация базы данных
initializeDb();

// Установка команд меню
bot.setMyCommands([
    { command: 'start', description: '🚀 Запустить бота' },
    { command: 'stats', description: '📊 Статистика' },
    { command: 'changelink', description: '🔗 Изменить ссылку' }
]);

// Обработчик команды /start
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const startPayload = match ? match[1] : null;

    console.log(`👤 /start от ${chatId}, payload: ${startPayload || 'нет'}`);

    // Если есть payload - это переход по анонимной ссылке
    if (startPayload) {
        const linkMap = getAnonLinkMap();
        const ownerChatId = linkMap[startPayload.toUpperCase()];

        if (ownerChatId && ownerChatId !== String(chatId)) {
            // Анонимный отправитель
            let userData = getUserData(chatId);
            if (!userData) {
                userData = {
                    chatId: String(chatId),
                    anonymousId: generateAnonymousId(),
                    linkCode: generateLinkCode(),
                    blockedUsers: [],
                    registeredAt: new Date().toISOString(),
                    messagesReceived: 0,
                    messagesSent: 0
                };
                updateUserData(chatId, userData);
                setAnonLinkMapEntry(userData.linkCode, String(chatId));
            }

            // Устанавливаем состояние для анонимного сообщения
            userData.waitingFor = 'anon_message';
            userData.targetOwner = ownerChatId;
            updateUserData(chatId, userData);

            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✖️ Отменить', callback_data: 'cancel_message' }]
                    ]
                }
            };

            return bot.sendMessage(chatId, 
                `🚀 Здесь можно отправить анонимное сообщение человеку, который опубликовал эту ссылку.\n\n` +
                `✍️ Напишите сюда всё, что хотите ему передать, и через несколько секунд он получит ваше сообщение, но не будет знать от кого.\n\n` +
                `Отправить можно фото, видео, 💬 текст, 🔊 голосовые, 📷 видеосообщения (кружки), а также ✨ стикеры`, 
                keyboard
            );
        } else if (ownerChatId === String(chatId)) {
            // Владелец перешел по своей ссылке - показываем обычное приветствие
            return handleStartCommand(chatId);
        } else {
            // Неверная ссылка
            return bot.sendMessage(chatId, 
                `❌ Ссылка недействительна или больше не активна.`
            );
        }
    }

    // Обычная команда /start
    return handleStartCommand(chatId);
});

// Функция обработки команды /start
async function handleStartCommand(chatId) {
    let userData = getUserData(chatId);
    if (!userData) {
        userData = {
            chatId: String(chatId),
            anonymousId: generateAnonymousId(),
            linkCode: generateLinkCode(),
            blockedUsers: [],
            registeredAt: new Date().toISOString(),
            messagesReceived: 0,
            messagesSent: 0
        };
        updateUserData(chatId, userData);
        setAnonLinkMapEntry(userData.linkCode, String(chatId));
        console.log(`✅ Новый пользователь: ${chatId}`);
    }

    const welcomeText = 
        `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
        `Твоя ссылка:\n` +
        `👉 https://t.me/${BOT_USERNAME}?start=${userData.linkCode}\n\n` +
        `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`;

    bot.sendMessage(chatId, welcomeText);
}

// Обработчик команды /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userData = getUserData(chatId);

    if (!userData) {
        return bot.sendMessage(chatId, 'Сначала используйте команду /start');
    }

    const statsText = 
        `📊 Ваша статистика:\n\n` +
        `📩 Получено сообщений: ${userData.messagesReceived || 0}\n` +
        `📤 Отправлено сообщений: ${userData.messagesSent || 0}\n` +
        `🚫 Заблокировано пользователей: ${userData.blockedUsers.length}\n` +
        `📅 Дата регистрации: ${new Date(userData.registeredAt).toLocaleDateString('ru-RU')}`;

    bot.sendMessage(chatId, statsText);
});

// Обработчик команды /changelink
bot.onText(/\/changelink/, async (msg) => {
    const chatId = msg.chat.id;
    const userData = getUserData(chatId);

    if (!userData) {
        return bot.sendMessage(chatId, 'Сначала используйте команду /start');
    }

    // Удаляем старую ссылку и создаем новую
    deleteAnonLinkMapEntry(userData.linkCode);
    const newLinkCode = generateLinkCode();
    setAnonLinkMapEntry(newLinkCode, String(chatId));

    userData.linkCode = newLinkCode;
    updateUserData(chatId, userData);

    const newLinkText = 
        `🔗 Ссылка успешно изменена!\n\n` +
        `Твоя новая ссылка:\n` +
        `👉 https://t.me/${BOT_USERNAME}?start=${newLinkCode}\n\n` +
        `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`;

    bot.sendMessage(chatId, newLinkText);
});

// Обработчик callback-запросов (инлайн кнопок)
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message.chat.id;

    await bot.answerCallbackQuery(callbackQuery.id);

    const userData = getUserData(chatId);
    if (!userData) return;

    switch (data) {
        case 'cancel_message':
            userData.waitingFor = null;
            userData.targetOwner = null;
            updateUserData(chatId, userData);
            bot.editMessageText(
                '❌ Отправка сообщения отменена.',
                {
                    chat_id: chatId,
                    message_id: message.message_id
                }
            );
            break;

        case 'send_more':
            if (userData.lastTargetOwner) {
                userData.waitingFor = 'anon_message';
                userData.targetOwner = userData.lastTargetOwner;
                updateUserData(chatId, userData);

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
            }
            break;

        case 'block_sender':
            if (userData.lastAnonSender) {
                if (!userData.blockedUsers.includes(userData.lastAnonSender)) {
                    userData.blockedUsers.push(userData.lastAnonSender);
                    updateUserData(chatId, userData);
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
                bot.sendMessage(chatId, '🚫 Отправитель заблокирован');
            }
            break;

        case 'clear_blacklist':
            userData.blockedUsers = [];
            updateUserData(chatId, userData);
            bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                {
                    chat_id: chatId,
                    message_id: message.message_id
                }
            );
            bot.sendMessage(chatId, '✅ Черный список очищен');
            break;
    }
});

// Обработчик всех типов сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    // Игнорируем команды
    if (msg.text && (msg.text.startsWith('/start') || msg.text === '/stats' || msg.text === '/changelink')) {
        return;
    }

    const userData = getUserData(chatId);
    if (!userData) {
        return bot.sendMessage(chatId, 'Сначала используйте команду /start');
    }

    // Обработка анонимного сообщения
    if (userData.waitingFor === 'anon_message') {
        return handleAnonymousMessage(chatId, msg, userData);
    }

    // Обработка ответа на анонимное сообщение (reply)
    if (msg.reply_to_message && userData.lastAnonSender) {
        return handleReplyMessage(chatId, msg, userData);
    }
});

// Функция обработки анонимного сообщения
async function handleAnonymousMessage(chatId, msg, userData) {
    const ownerChatId = userData.targetOwner;
    const ownerData = getUserData(ownerChatId);

    if (!ownerData) {
        userData.waitingFor = null;
        userData.targetOwner = null;
        updateUserData(chatId, userData);
        return bot.sendMessage(chatId, '❌ Получатель недоступен');
    }

    // Проверка блокировки
    if (ownerData.blockedUsers.includes(userData.anonymousId)) {
        userData.waitingFor = null;
        userData.targetOwner = null;
        updateUserData(chatId, userData);
        return bot.sendMessage(chatId, '🚫 Вы заблокированы этим пользователем');
    }

    // Сохраняем информацию для возможности ответа
    ownerData.lastAnonSender = userData.anonymousId;
    ownerData.lastAnonSenderChatId = String(chatId);
    ownerData.messagesReceived = (ownerData.messagesReceived || 0) + 1;
    updateUserData(ownerChatId, ownerData);

    // Сохраняем для отправителя возможность написать еще
    userData.lastTargetOwner = ownerChatId;
    userData.messagesSent = (userData.messagesSent || 0) + 1;
    userData.waitingFor = null;
    userData.targetOwner = null;
    updateUserData(chatId, userData);

    // Отправляем сообщение получателю
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🚫 Заблокировать', callback_data: 'block_sender' }]
            ]
        }
    };

    // Пересылаем сообщение как есть
    let forwardedMessage;
    try {
        if (msg.text) {
            forwardedMessage = await bot.sendMessage(ownerChatId, 
                `🤿 У тебя новое анонимное сообщение!\n\n${msg.text}\n\n↩️ Свайпни для ответа.`, 
                keyboard
            );
        } else if (msg.photo) {
            forwardedMessage = await bot.sendPhoto(ownerChatId, msg.photo[msg.photo.length - 1].file_id, {
                caption: `🤿 У тебя новое анонимное сообщение!\n\n${msg.caption || ''}\n\n↩️ Свайпни для ответа.`,
                reply_markup: keyboard.reply_markup
            });
        } else if (msg.video) {
            forwardedMessage = await bot.sendVideo(ownerChatId, msg.video.file_id, {
                caption: `🤿 У тебя новое анонимное сообщение!\n\n${msg.caption || ''}\n\n↩️ Свайпни для ответа.`,
                reply_markup: keyboard.reply_markup
            });
        } else if (msg.voice) {
            forwardedMessage = await bot.sendVoice(ownerChatId, msg.voice.file_id, keyboard);
            await bot.sendMessage(ownerChatId, `🤿 У тебя новое анонимное голосовое сообщение!\n\n↩️ Свайпни для ответа.`);
        } else if (msg.video_note) {
            forwardedMessage = await bot.sendVideoNote(ownerChatId, msg.video_note.file_id, keyboard);
            await bot.sendMessage(ownerChatId, `🤿 У тебя новое анонимное видеосообщение!\n\n↩️ Свайпни для ответа.`);
        } else if (msg.sticker) {
            forwardedMessage = await bot.sendSticker(ownerChatId, msg.sticker.file_id, keyboard);
            await bot.sendMessage(ownerChatId, `🤿 У тебя новый анонимный стикер!\n\n↩️ Свайпни для ответа.`);
        }
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
    }

    // Подтверждение отправителю
    const confirmKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📝 Отправить ещё', callback_data: 'send_more' }]
            ]
        }
    };

    await bot.sendMessage(chatId, '🤿 Сообщение отправлено, ожидайте ответ!', confirmKeyboard);

    // Отправляем рекламное сообщение
    const promoText = 
        `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
        `Твоя ссылка:\n` +
        `👉 https://t.me/${BOT_USERNAME}?start=${userData.linkCode}\n\n` +
        `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`;

    bot.sendMessage(chatId, promoText);
}

// Функция обработки ответа на анонимное сообщение
async function handleReplyMessage(chatId, msg, userData) {
    if (!userData.lastAnonSenderChatId) {
        return;
    }

    const recipientChatId = userData.lastAnonSenderChatId;

    // Пересылаем ответ анонимному отправителю
    try {
        // Сначала цитируем оригинальное сообщение (упрощенно)
        await bot.sendMessage(recipientChatId, `💬 Ответ от владельца:`);

        // Затем пересылаем ответ как есть
        if (msg.text) {
            await bot.sendMessage(recipientChatId, msg.text);
        } else if (msg.photo) {
            await bot.sendPhoto(recipientChatId, msg.photo[msg.photo.length - 1].file_id, {
                caption: msg.caption || ''
            });
        } else if (msg.video) {
            await bot.sendVideo(recipientChatId, msg.video.file_id, {
                caption: msg.caption || ''
            });
        } else if (msg.voice) {
            await bot.sendVoice(recipientChatId, msg.voice.file_id);
        } else if (msg.video_note) {
            await bot.sendVideoNote(recipientChatId, msg.video_note.file_id);
        } else if (msg.sticker) {
            await bot.sendSticker(recipientChatId, msg.sticker.file_id);
        }

        // Кнопка "Написать ещё"
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📝 Написать ещё', callback_data: 'send_more' }]
                ]
            }
        };

        await bot.sendMessage(recipientChatId, '💌 Получен ответ!', keyboard);

        // Подтверждение отправителю
        bot.sendMessage(chatId, '✅ Ответ отправлен!');

    } catch (error) {
        console.error('Ошибка отправки ответа:', error);
        bot.sendMessage(chatId, '❌ Ошибка отправки ответа');
    }
}

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error.message);
});

bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error.message);
});

console.log('🚀 Бот запускается...');
