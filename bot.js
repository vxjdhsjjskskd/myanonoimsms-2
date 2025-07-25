import { Telegraf, Markup, Scenes, session } from 'telegraf';
import dotenv from 'dotenv';

// Импортируем сервисы базы данных и клавиатуры
import { setUser, getUserCode, getTgIdByCode, getMessageCounts, addMessageCounts, addLinkClick } from './dbService.js';
import { cancelKeyboard, sendAgainKeyboard } from './keyboards.js';

// Загружаем переменные окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
export const bot = new Telegraf(BOT_TOKEN);

// --- FSM (Finite State Machine) - Сцены и состояния ---
const sendScene = new Scenes.BaseScene('sendScene');

sendScene.enter(async (ctx) => {
    await ctx.reply(
        "👉 Введите сообщение, которое хотите отправить.\n\n" +
        "🤖 Бот поддерживает следующие типы сообщений: `Текст, фото, видео, голосовые сообщения, видеосообщения, стикеры, документы, опросы, GIF.`",
        { reply_markup: cancelKeyboard().reply_markup, parse_mode: "Markdown" }
    );
});

sendScene.on('text', async (ctx) => {
    const userIdToSend = ctx.scene.state.user;
    const senderId = ctx.from.id;

    try {
        await addMessageCounts(senderId, userIdToSend);

        await ctx.telegram.sendMessage(userIdToSend, `✉️ *Пришло новое сообщение!*\n\n${ctx.message.text}`, { parse_mode: "Markdown" });
        await ctx.reply(`✅ Сообщение отправлено!`, sendAgainKeyboard(userIdToSend));
        await ctx.scene.leave();
    } catch (e) {
        console.error(`[Bot] Ошибка отправки текста от ${senderId} к ${userIdToSend}:`, e.message);
        await ctx.reply(
            `⚠️❌ Произошла ошибка: \`${e.message}\`\n\n` +
            `Попробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).`,
            { parse_mode: "Markdown", reply_markup: cancelKeyboard().reply_markup }
        );
    }
});

sendScene.on(['photo', 'video', 'document', 'audio', 'voice', 'video_note', 'sticker', 'poll'], async (ctx) => {
    const userIdToSend = ctx.scene.state.user;
    const senderId = ctx.from.id;
    const message = ctx.message;
    const baseText = "✉️ *Пришло новое сообщение!*\n\n";
    const caption = message.caption ? baseText + message.caption : baseText;

    try {
        await addMessageCounts(senderId, userIdToSend);

        if (message.photo) {
            await ctx.telegram.sendPhoto(userIdToSend, message.photo[message.photo.length - 1].file_id, { caption: caption, parse_mode: "Markdown" });
        } else if (message.video) {
            await ctx.telegram.sendVideo(userIdToSend, message.video.file_id, { caption: caption, parse_mode: "Markdown" });
        } else if (message.document) {
            await ctx.telegram.sendDocument(userIdToSend, message.document.file_id, { caption: caption, parse_mode: "Markdown" });
        } else if (message.audio) {
            await ctx.telegram.sendAudio(userIdToSend, message.audio.file_id, { caption: caption, parse_mode: "Markdown" });
        } else if (message.voice) {
            await ctx.telegram.sendVoice(userIdToSend, message.voice.file_id, { caption: caption, parse_mode: "Markdown" });
        } else if (message.video_note) {
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(userIdToSend, caption, { parse_mode: "Markdown" });
            }
            await ctx.telegram.sendVideoNote(userIdToSend, message.video_note.file_id);
        } else if (message.sticker) {
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(userIdToSend, caption, { parse_mode: "Markdown" });
            }
            await ctx.telegram.sendSticker(userIdToSend, message.sticker.file_id);
        } else if (message.poll) {
            const question = message.poll.question;
            const options = message.poll.options.map(o => o.text);
            await ctx.telegram.sendMessage(userIdToSend, baseText, { parse_mode: "Markdown" });
            await ctx.telegram.sendPoll(userIdToSend, question, options, {
                is_anonymous: message.poll.is_anonymous,
                type: message.poll.type,
                allows_multiple_answers: message.poll.allows_multiple_answers
            });
        } else {
            return ctx.reply("⚠️ Бот пока не поддерживает этот тип сообщения или произошла ошибка. Пожалуйста, попробуйте другой тип.");
        }

        await ctx.reply(`✅ Сообщение отправлено!`, sendAgainKeyboard(userIdToSend));
        await ctx.scene.leave();
    } catch (e) {
        console.error(`[Bot] Ошибка отправки медиа/опроса от ${senderId} к ${userIdToSend}:`, e.message);
        await ctx.reply(
            `⚠️❌ Произошла ошибка: \`${e.message}\`\n\n` +
            `Попробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).`,
            { parse_mode: "Markdown", reply_markup: cancelKeyboard().reply_markup }
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


const stage = new Scenes.Stage([sendScene]);

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
            return ctx.reply(`Пожалуйста, подождите ${secondsLeft} секунд перед отправкой следующего запроса.`);
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
            await addLinkClick(userIdToSend);
            await ctx.scene.enter('sendScene', { user: userIdToSend });
        } else {
            await ctx.reply(`Неверный код пользователя: \`${receivedCode}\`. Пожалуйста, проверьте ссылку.`, { parse_mode: "Markdown" });
        }
    } else {
        await ctx.reply(
            `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
            `Твоя ссылка:\n👉 \`${link}\`\n\n` +
            `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.command('profile', async (ctx) => {
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
        { parse_mode: 'Markdown' }
    );
});

bot.command('help', async (ctx) => {
    await ctx.reply("Помощь будет");
});

bot.action(/^again_(.+)$/, async (ctx) => {
    const userIdToSend = ctx.match[1];
    await ctx.answerCbQuery();
    if (ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    }
    await ctx.scene.enter('sendScene', { user: userIdToSend });
});

bot.on('text', async (ctx) => {
    await ctx.reply('Я не понял вашу команду. Пожалуйста, используйте команды из меню или следуйте инструкциям для отправки анонимного сообщения.');
});

bot.on('message', async (ctx) => {
    const handledByScene = ctx.session && ctx.session.__scenes && ctx.session.__scenes.current;
    if (!handledByScene && !ctx.message.text && !ctx.message.caption && !ctx.message.photo && !ctx.message.video && !ctx.message.document && !ctx.message.audio && !ctx.message.voice && !ctx.message.video_note && !ctx.message.sticker && !ctx.message.poll) {
        await ctx.reply('Я не понял ваш запрос. Пожалуйста, используйте команды из меню или отправьте поддерживаемый тип сообщения.');
    }
});


// --- ЗАПУСК БОТА ---
// Эта функция будет вызываться при импорте bot.js
const startBot = async () => {
    // Ждем, пока MongoDB будет подключен
    while (!global.mongooseConnection || global.mongooseConnection.readyState !== 1) {
        console.log('[Bot Startup] Ожидание подключения к MongoDB...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Удаление вебхука перед запуском Long Polling
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

    // Запуск бота в режиме Long Polling
    bot.launch()
        .then(() => {
            console.log('✅ Telegraf бот запущен в режиме Long Polling.');
        })
        .catch(err => {
            console.error('❌ Ошибка при запуске Telegraf бота:', err);
            // Если это 409 Conflict, Render перезапустит сервис, и он может запуститься успешно.
        });
};

// Вызываем функцию запуска бота сразу при импорте этого модуля
startBot();

                          
