import { Telegraf, Markup, Scenes, session } from 'telegraf';
import dotenv from 'dotenv';

// Импортируем сервисы базы данных и клавиатуры
import { setUser, getUserCode, getTgIdByCode, getMessageCounts, addMessageCounts, addLinkClick, updateUserCode, blockUser, unblockUser, isUserBlocked, saveAnonMessageContext, getAnonMessageContext } from './dbService.js';
import { cancelKeyboard, writeMoreKeyboard, anonymousMessageButtons, confirmUnblockKeyboard } from './keyboards.js';

// Загружаем переменные окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
export const bot = new Telegraf(BOT_TOKEN);

// --- FSM (Finite State Machine) - Сцены и состояния ---

// Сцена для отправки ПЕРВОГО анонимного сообщения
const sendScene = new Scenes.BaseScene('sendScene');

sendScene.enter(async (ctx) => {
    await ctx.reply(
        "👉 Введите сообщение, которое хотите отправить.\n\n" +
        "🤖 Бот поддерживает следующие типы сообщений: `Текст, фото, видео, голосовые сообщения, видеосообщения, стикеры, документы, опросы, GIF.`",
        { reply_markup: cancelKeyboard().reply_markup, parse_mode: "Markdown", reply_to_message_id: ctx.message ? ctx.message.message_id : undefined }
    );
});

// Обработчики для отправки сообщений в sendScene (первое сообщение)
sendScene.on('text', async (ctx) => {
    const userIdToSend = ctx.scene.state.user; // Получатель
    const senderId = ctx.from.id; // Отправитель
    const originalSenderMessageId = ctx.message.message_id; // ID сообщения, которое отправитель только что отправил боту

    // Проверяем, не заблокировал ли получатель отправителя
    const isBlocked = await isUserBlocked(userIdToSend, senderId);
    if (isBlocked) {
        await ctx.reply(`🚫 Вы не можете отправить сообщение этому пользователю, так как он вас заблокировал.`, { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown" });
        return ctx.scene.leave();
    }

    try {
        await addMessageCounts(senderId, userIdToSend);

        // Отправляем сообщение получателю
        const sentMessageToRecipient = await ctx.telegram.sendMessage(userIdToSend, `✉️ *Пришло новое сообщение!*\n\n${ctx.message.text}`, {
            parse_mode: "Markdown",
            reply_markup: anonymousMessageButtons(senderId, userIdToSend).reply_markup // Кнопка Заблокировать
        });

        // Сохраняем контекст анонимного сообщения
        await saveAnonMessageContext(sentMessageToRecipient.message_id, userIdToSend, senderId, originalSenderMessageId);

        await ctx.reply(`✅ Сообщение отправлено!`, { reply_to_message_id: ctx.message.message_id, reply_markup: writeMoreKeyboard(userIdToSend).reply_markup });
        await ctx.scene.leave();
    } catch (e) {
        console.error(`[Bot] Ошибка отправки текста от ${senderId} к ${userIdToSend}:`, e.message);
        await ctx.reply(
            `⚠️❌ Произошла ошибка: \`${e.message}\`\n\n` +
            `Попробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).`,
            { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown", reply_markup: cancelKeyboard().reply_markup }
        );
    }
});

sendScene.on(['photo', 'video', 'document', 'audio', 'voice', 'video_note', 'sticker', 'poll'], async (ctx) => {
    const userIdToSend = ctx.scene.state.user;
    const senderId = ctx.from.id;
    const message = ctx.message;
    const baseText = "✉️ *Пришло новое сообщение!*\n\n";
    const caption = message.caption ? baseText + message.caption : baseText;
    const replyMarkup = anonymousMessageButtons(senderId, userIdToSend).reply_markup;
    const originalSenderMessageId = ctx.message.message_id;

    // Проверяем, не заблокировал ли получатель отправителя
    const isBlocked = await isUserBlocked(userIdToSend, senderId);
    if (isBlocked) {
        await ctx.reply(`🚫 Вы не можете отправить сообщение этому пользователю, так как он вас заблокировал.`, { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown" });
        return ctx.scene.leave();
    }

    try {
        await addMessageCounts(senderId, userIdToSend);

        let sentMessageToRecipient;
        if (message.photo) {
            sentMessageToRecipient = await ctx.telegram.sendPhoto(userIdToSend, message.photo[message.photo.length - 1].file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.video) {
            sentMessageToRecipient = await ctx.telegram.sendVideo(userIdToSend, message.video.file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.document) {
            sentMessageToRecipient = await ctx.telegram.sendDocument(userIdToSend, message.document.file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.audio) {
            sentMessageToRecipient = await ctx.telegram.sendAudio(userIdToSend, message.audio.file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.voice) {
            sentMessageToRecipient = await ctx.telegram.sendVoice(userIdToSend, message.voice.file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.video_note) {
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(userIdToSend, caption, { parse_mode: "Markdown", reply_markup: replyMarkup });
            }
            sentMessageToRecipient = await ctx.telegram.sendVideoNote(userIdToSend, message.video_note.file_id);
        } else if (message.sticker) {
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(userIdToSend, caption, { parse_mode: "Markdown", reply_markup: replyMarkup });
            }
            sentMessageToRecipient = await ctx.telegram.sendSticker(userIdToSend, message.sticker.file_id);
        } else if (message.poll) {
            const question = message.poll.question;
            const options = message.poll.options.map(o => o.text);
            await ctx.telegram.sendMessage(userIdToSend, baseText, { parse_mode: "Markdown", reply_markup: replyMarkup });
            sentMessageToRecipient = await ctx.telegram.sendPoll(userIdToSend, question, options, {
                is_anonymous: message.poll.is_anonymous,
                type: message.poll.type,
                allows_multiple_answers: message.poll.allows_multiple_answers
            });
        } else {
            return ctx.reply("⚠️ Бот пока не поддерживает этот тип сообщения или произошла ошибка. Пожалуйста, попробуйте другой тип.", { reply_to_message_id: ctx.message.message_id });
        }

        // Сохраняем контекст анонимного сообщения
        await saveAnonMessageContext(sentMessageToRecipient.message_id, userIdToSend, senderId, originalSenderMessageId);

        await ctx.reply(`✅ Сообщение отправлено!`, { reply_to_message_id: ctx.message.message_id, reply_markup: writeMoreKeyboard(userIdToSend).reply_markup });
        await ctx.scene.leave();
    } catch (e) {
        console.error(`[Bot] Ошибка отправки медиа/опроса от ${senderId} к ${userIdToSend}:`, e.message);
        await ctx.reply(
            `⚠️❌ Произошла ошибка: \`${e.message}\`\n\n` +
            `Попробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).`,
            { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown", reply_markup: cancelKeyboard().reply_markup }
        );
    }
});

sendScene.action('cancel', async (ctx) => {
    await ctx.answerCbQuery("Действие отменено!");
    if (ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    }
    await ctx.scene.leave();
});

// УДАЛЕНА СЦЕНА replyScene - Ответы теперь обрабатываются в bot.on('message')
// const replyScene = new Scenes.BaseScene('replyScene');
// ... (удалена вся логика replyScene)

const stage = new Scenes.Stage([sendScene]); // ОБНОВЛЕНО: Только sendScene

bot.use(session());
bot.use(stage.middleware());


// --- Антифлуд Middleware ---
const cooldowns = new Map();
const COOLDOWN_SECONDS = 3; 

bot.use(async (ctx, next) => {
    const userId = ctx.from.id;
    const now = Date.now();

    if (ctx.chat && ctx.chat.id) {
        await setUser(ctx.chat.id);
    }

    const lastExecuted = cooldowns.get(userId);
    if (lastExecuted) {
        const timeElapsed = now - lastExecuted;
        const timeLeft = (COOLDOWN_SECONDS * 1000) - timeElapsed;
        if (timeLeft > 0) {
            const secondsLeft = Math.ceil(timeLeft / 1000);
            return ctx.reply(`Пожалуйста, подождите ${secondsLeft} секунд перед отправкой следующего запроса.`, { reply_to_message_id: ctx.message.message_id });
        }
    }
    cooldowns.set(userId, now);
    return next();
});
// --- Обработчики команд ---

bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    const messageText = ctx.message.text;

    await setUser(chatId);
    const userCode = await getUserCode(chatId);

    const botInfo = await ctx.telegram.getMe();
    const link = `https://t.me/${botInfo.username}?start=${userCode}`;

    if (messageText && messageText.length > 6 && messageText.startsWith('/start ')) {
        const receivedCode = messageText.substring(7);
        const userIdToSend = await getTgIdByCode(receivedCode);

        if (userIdToSend) {
            // Проверяем, не заблокировал ли получатель отправителя (текущего пользователя)
            const isBlocked = await isUserBlocked(userIdToSend, chatId);
            if (isBlocked) {
                await ctx.reply(`🚫 Вы не можете отправить сообщение этому пользователю, так как он вас заблокировал.`, { parse_mode: "Markdown", reply_to_message_id: ctx.message.message_id });
                return; // Не входим в сцену отправки
            }
            await addLinkClick(userIdToSend);
            await ctx.scene.enter('sendScene', { user: userIdToSend });
        } else {
            await ctx.reply(`Неверный код пользователя: \`${receivedCode}\`. Пожалуйста, проверьте ссылку.`, { parse_mode: "Markdown", reply_to_message_id: ctx.message.message_id });
        }
    } else {
        await ctx.reply(
            `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
            `Твоя ссылка:\n👉 \`${link}\`\n\n` +
            `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`,
            { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }
        );
    }
});

// Команда /profile теперь /stats
bot.command('stats', async (ctx) => {
    const chatId = ctx.chat.id;
    const { received, sent, linkClicks } = await getMessageCounts(chatId);
    const userCode = await getUserCode(chatId);

    const botInfo = await ctx.telegram.getMe();
    const link = `https://t.me/${botInfo.username}?start=${userCode}`;

    await ctx.reply(
        `➖➖➖➖➖➖➖➖➖➖➖\n` +
        `*Статистика профиля*\n\n` +
        `➖ За всё время:\n` +
        `💬 Сообщений: ${received + sent}\n` +
        `👀 Переходов по ссылке: ${linkClicks}\n\n` +
        `🔗 Твоя ссылка: \n` +
        `👉\`${link}\`\n` +
        `➖➖➖➖➖➖➖➖➖➖➖`,
        { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }
    );
});

// НОВАЯ КОМАНДА: /url для изменения ссылки
bot.command('url', async (ctx) => {
    const chatId = ctx.chat.id;
    const userCode = await getUserCode(chatId);
    const botInfo = await ctx.telegram.getMe();
    const link = `https://t.me/${botInfo.username}?start=${userCode}`;

    await ctx.reply(
        `🔗 *Ваша текущая ссылка:*\n👉 \`${link}\`\n\n` +
        `Вы можете разместить ее в описании профиля.\n\n` +
        `Если вы хотите *сгенерировать новую ссылку*, нажмите кнопку ниже. ` +
        `Ваша старая ссылка перестанет работать.`,
        {
            reply_markup: Markup.inlineKeyboard([
                Markup.button.callback('Сгенерировать новую ссылку', 'generate_new_link')
            ]).reply_markup,
            parse_mode: 'Markdown',
            reply_to_message_id: ctx.message.message_id
        }
    );
});

bot.action('generate_new_link', async (ctx) => {
    await ctx.answerCbQuery('Генерируем новую ссылку...');
    const chatId = ctx.from.id;
    const newCode = await updateUserCode(chatId); // Используем новую функцию из dbService
    const botInfo = await ctx.telegram.getMe();
    const newLink = `https://t.me/${botInfo.username}?start=${newCode}`;

    await ctx.editMessageText(
        `✅ *Ваша новая ссылка успешно сгенерирована:*\n👉 \`${newLink}\`\n\n` +
        `Ваша старая ссылка больше недействительна.`,
        { parse_mode: 'Markdown', reply_to_message_id: ctx.callbackQuery.message.message_id } // reply_to_message_id для edit
    );
});


bot.command('help', async (ctx) => {
    await ctx.reply("Помощь будет", { reply_to_message_id: ctx.message.message_id });
});

// ОБРАБОТЧИК: Обработка callback_query для кнопки "Написать еще"
bot.action(/^again_(.+)$/, async (ctx) => {
    const userIdToSend = ctx.match[1];
    await ctx.answerCbQuery();
    if (ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    }
    await ctx.scene.enter('sendScene', { user: userIdToSend });
});

// ОБРАБОТЧИК: Блокировка пользователя
bot.action(/^block_user_(.+)_from_(.+)$/, async (ctx) => {
    const blockedTgId = parseInt(ctx.match[1]); // ID пользователя, которого нужно заблокировать
    const blockerTgId = parseInt(ctx.match[2]); // ID пользователя, который блокирует (текущий пользователь)

    await ctx.answerCbQuery('Блокировка пользователя...');

    if (blockerTgId !== ctx.from.id) { // Проверяем, что блокирует тот, кто нажал кнопку
        return ctx.reply('⚠️ Ошибка: Вы не можете заблокировать пользователя от имени другого аккаунта.', { reply_to_message_id: ctx.callbackQuery.message.message_id });
    }

    try {
        await blockUser(blockerTgId, blockedTgId);
        await ctx.editMessageText(`🚫 Пользователь ${blockedTgId} успешно заблокирован. Вы больше не будете получать от него анонимные сообщения.`, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error(`[Bot] Ошибка блокировки пользователя ${blockerTgId} -> ${blockedTgId}:`, e.message);
        await ctx.editMessageText(`⚠️❌ Произошла ошибка при блокировке: \`${e.message}\`. Попробуйте ещё раз.`, { parse_mode: 'Markdown' });
    }
});


// НОВЫЙ ОБРАБОТЧИК: Обработка сообщений, которые являются ответами на сообщения бота
bot.on('message', async (ctx) => {
    // Проверяем, является ли сообщение ответом на сообщение бота
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from.id === bot.botInfo.id) {
        const repliedToBotMessageId = ctx.message.reply_to_message.message_id;
        const currentChatId = ctx.chat.id;

        // Пытаемся получить контекст анонимного сообщения
        const anonContext = await getAnonMessageContext(repliedToBotMessageId, currentChatId);

        if (anonContext) {
            const originalSenderId = anonContext.original_sender_id;
            const originalSenderMessageId = anonContext.original_sender_message_id; // Используем ID оригинального сообщения отправителя
            const replierId = ctx.from.id; // Тот, кто отвечает (текущий пользователь)
            const message = ctx.message;
            const baseText = "✉️ *Пришло анонимное ответное сообщение!*\n\n";
            const caption = message.caption ? baseText + message.caption : baseText;
            const replyMarkup = anonymousMessageButtons(replierId, originalSenderId).reply_markup; // Кнопка Заблокировать

            // Проверяем, не заблокировал ли оригинальный отправитель отвечающего
            const isBlocked = await isUserBlocked(originalSenderId, replierId);
            if (isBlocked) {
                await ctx.reply(`🚫 Вы не можете отправить ответ этому пользователю, так как он вас заблокировал.`, { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown" });
                return;
            }

            try {
                await addMessageCounts(replierId, originalSenderId);

                // Пересоздаем сообщение для анонимности
                if (message.text) {
                    await ctx.telegram.sendMessage(originalSenderId, baseText + message.text, {
                        parse_mode: "Markdown",
                        reply_markup: replyMarkup,
                        reply_to_message_id: originalSenderMessageId // Имитация ответа на первое сообщение отправителя
                    });
                } else if (message.photo) {
                    await ctx.telegram.sendPhoto(originalSenderId, message.photo[message.photo.length - 1].file_id, {
                        caption: caption,
                        parse_mode: "Markdown",
                        reply_markup: replyMarkup,
                        reply_to_message_id: originalSenderMessageId
                    });
                } else if (message.video) {
                    await ctx.telegram.sendVideo(originalSenderId, message.video.file_id, {
                        caption: caption,
                        parse_mode: "Markdown",
                        reply_markup: replyMarkup,
                        reply_to_message_id: originalSenderMessageId
                    });
                } else if (message.document) {
                    await ctx.telegram.sendDocument(originalSenderId, message.document.file_id, {
                        caption: caption,
                        parse_mode: "Markdown",
                        reply_markup: replyMarkup,
                        reply_to_message_id: originalSenderMessageId
                    });
                } else if (message.audio) {
                    await ctx.telegram.sendAudio(originalSenderId, message.audio.file_id, {
                        caption: caption,
                        parse_mode: "Markdown",
                        reply_markup: replyMarkup,
                        reply_to_message_id: originalSenderMessageId
                    });
                } else if (message.voice) {
                    await ctx.telegram.sendVoice(originalSenderId, message.voice.file_id, {
                        caption: caption,
                        parse_mode: "Markdown",
                        reply_markup: replyMarkup,
                        reply_to_message_id: originalSenderMessageId
                    });
                } else if (message.video_note) {
                    if (caption && caption !== baseText) {
                        await ctx.telegram.sendMessage(originalSenderId, caption, { parse_mode: "Markdown", reply_markup: replyMarkup, reply_to_message_id: originalSenderMessageId });
                    }
                    await ctx.telegram.sendVideoNote(originalSenderId, message.video_note.file_id);
                } else if (message.sticker) {
                    if (caption && caption !== baseText) {
                        await ctx.telegram.sendMessage(originalSenderId, caption, { parse_mode: "Markdown", reply_markup: replyMarkup, reply_to_message_id: originalSenderMessageId });
                    }
                    await ctx.telegram.sendSticker(originalSenderId, message.sticker.file_id);
                } else if (message.poll) {
                    const question = message.poll.question;
                    const options = message.poll.options.map(o => o.text);
                    await ctx.telegram.sendMessage(originalSenderId, baseText, { parse_mode: "Markdown", reply_markup: replyMarkup, reply_to_message_id: originalSenderMessageId });
                    await ctx.telegram.sendPoll(originalSenderId, question, options, {
                        is_anonymous: message.poll.is_anonymous,
                        type: message.poll.type,
                        allows_multiple_answers: message.poll.allows_multiple_answers
                    });
                } else {
                    await ctx.reply("⚠️ Бот пока не поддерживает этот тип сообщения для анонимного ответа. Пожалуйста, попробуйте другой тип.", { reply_to_message_id: ctx.message.message_id });
                    return;
                }

                await ctx.reply('✅ Ваше ответное сообщение отправлено анонимно!', { reply_to_message_id: ctx.message.message_id, parse_mode: 'Markdown' });
                return; // Важно, чтобы сообщение было обработано здесь и не попало в общий обработчик
            } catch (e) {
                console.error(`[Bot] Ошибка отправки ответного сообщения от ${replierId} к ${originalSenderId}:`, e.message);
                await ctx.reply(
                    `⚠️❌ Произошла ошибка при отправке ответного сообщения: \`${e.message}\`\n\n` +
                    `Попробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).`,
                    { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown" }
                );
                return;
            }
        }
    }

    // Если сообщение не является ответом на сообщение бота, или контекст не найден,
    // обрабатываем его как обычный текст или неподдерживаемый тип
    const handledByScene = ctx.session && ctx.session.__scenes && ctx.session.__scenes.current;
    if (!handledByScene && ctx.message.text) {
        await ctx.reply('Я не понял вашу команду. Пожалуйста, используйте команды из меню или следуйте инструкциям для отправки анонимного сообщения.', { reply_to_message_id: ctx.message.message_id });
    } else if (!handledByScene) { // Если не текст и не сцена
        await ctx.reply('Я не понял ваш запрос. Пожалуйста, используйте команды из меню или отправьте поддерживаемый тип сообщения.', { reply_to_message_id: ctx.message.message_id });
    }
});


// --- ЗАПУСК БОТА ---
const startBot = async () => {
    while (!global.mongooseConnection || global.mongooseConnection.readyState !== 1) {
        console.log('[Bot Startup] Ожидание подключения к MongoDB...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    try {
        console.log('[Bot Startup] Попытка удалить существующий вебхук перед запуском Long Polling...');
        const deleted = await bot.telegram.deleteWebhook();
        if (deleted) {
            console.log('[Bot Startup] Вебхук успешно удален.');
        } else {
            console.log('[Bot Startup] Вебхук не был активен или уже удален.');
        }
    } catch (error) {
        console.error('[Bot Startup] Ошибка при удалении вебхука:', error.message);
    }

    await bot.telegram.setMyCommands([
        { command: 'start', description: '🚀 Запустить бота' },
        { command: 'stats', description: '📊 Моя статистика' },
        { command: 'url', description: '🔗 Моя ссылка' },
        { command: 'help', description: '❓ Помощь' }
    ]);
    console.log('[Bot Startup] Команды Telegram установлены.');

    bot.launch()
        .then(() => {
            console.log('✅ Telegraf бот запущен в режиме Long Polling.');
            // Получаем информацию о боте после запуска, чтобы использовать bot.botInfo.id
            bot.telegram.getMe().then(botInfo => {
                bot.botInfo = botInfo;
                console.log(`[Bot Info] Бот запущен как @${botInfo.username}`);
            });
        })
        .catch(err => {
            console.error('❌ Ошибка при запуске Telegraf бота:', err);
        });
};

// Вызываем функцию запуска бота сразу при импорте этого модуля
startBot();

// Graceful stop (для корректной остановки бота при сигналах SIGINT/SIGTERM)
process.once('SIGINT', async () => {
    console.log('Получен сигнал SIGINT. Остановка бота...');
    await bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
    console.log('Получен сигнал SIGTERM. Остановка бота...');
    await bot.stop('SIGTERM');
});
                                        
