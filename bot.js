import { Telegraf, Markup, Scenes, session } from 'telegraf';
import dotenv from 'dotenv';

// Импортируем модель пользователя и сервисы базы данных
import { User } from './userModel.js'; // Хотя User импортируется в dbService, оставлю здесь для ясности
import { setUser, getUserCode, getChatIdByCode, getMessageCounts, addMessageCounts } from './dbService.js';
import { cancelKeyboard, sendAgainKeyboard } from './keyboards.js';

// Загружаем переменные окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
export const bot = new Telegraf(BOT_TOKEN); // Экспортируем инстанс бота

// --- FSM (Finite State Machine) - Сцены и состояния ---
// Определяем сцену для отправки сообщений
const sendScene = new Scenes.BaseScene('sendScene');

// Состояние для ожидания кода/сообщения
sendScene.enter(async (ctx) => {
    await ctx.reply(
        "👉 Введите сообщение, которое хотите отправить.\n\n" +
        "🤖 Бот поддерживает следующие типы сообщений: `Текст, фото, видео, голосовые сообщения, видеосообщения, стикеры, документы, опросы, GIF.`",
        { reply_markup: cancelKeyboard().reply_markup, parse_mode: "Markdown" }
    );
});

// Обработчик для текстовых сообщений в состоянии Send.code
sendScene.on('text', async (ctx) => {
    const userIdToSend = ctx.scene.state.user; // Получаем ID получателя из состояния сцены
    const senderId = ctx.from.id;

    try {
        await addMessageCounts(senderId, userIdToSend); // Обновляем счетчики

        await ctx.telegram.sendMessage(userIdToSend, `✉️ *Пришло новое сообщение!*\n\n${ctx.message.text}`, { parse_mode: "Markdown" });
        await ctx.reply(`✅ Сообщение отправлено!`, sendAgainKeyboard(userIdToSend));
        await ctx.scene.leave(); // Выходим из сцены
    } catch (e) {
        console.error(`Ошибка при отправке текстового сообщения:`, e);
        await ctx.reply(
            `⚠️❌ Произошла ошибка: \`${e.message}\`\n\n` +
            `Попробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).`,
            { parse_mode: "Markdown", reply_markup: cancelKeyboard().reply_markup }
        );
    }
});

// Обработчики для медиафайлов в состоянии Send.code
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
            // Video notes do not support captions directly in sendVideoNote, send text separately
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(userIdToSend, caption, { parse_mode: "Markdown" });
            }
            await ctx.telegram.sendVideoNote(userIdToSend, message.video_note.file_id);
        } else if (message.sticker) {
            // Stickers do not support captions directly in sendSticker, send text separately
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(userIdToSend, caption, { parse_mode: "Markdown" });
            }
            await ctx.telegram.sendSticker(userIdToSend, message.sticker.file_id);
        } else if (message.poll) {
            const question = message.poll.question;
            const options = message.poll.options.map(o => o.text);
            await ctx.telegram.sendMessage(userIdToSend, baseText, { parse_mode: "Markdown" }); // Send base text first
            await ctx.telegram.sendPoll(userIdToSend, question, options, {
                is_anonymous: message.poll.is_anonymous,
                type: message.poll.type,
                allows_multiple_answers: message.poll.allows_multiple_answers
            });
        } else {
            // Fallback for unhandled media types or if message is empty
            return ctx.reply("⚠️ Бот пока не поддерживает этот тип сообщения или произошла ошибка. Пожалуйста, попробуйте другой тип.");
        }

        await ctx.reply(`✅ Сообщение отправлено!`, sendAgainKeyboard(userIdToSend));
        await ctx.scene.leave(); // Выходим из сцены
    } catch (e) {
        console.error(`Ошибка при отправке медиа/опроса:`, e);
        await ctx.reply(
            `⚠️❌ Произошла ошибка: \`${e.message}\`\n\n` +
            `Попробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).`,
            { parse_mode: "Markdown", reply_markup: cancelKeyboard().reply_markup }
        );
    }
});

// Обработчик для кнопки "Отмена" внутри сцены
sendScene.action('cancel', async (ctx) => {
    await ctx.answerCbQuery("Действие отменено!");
    await ctx.deleteMessage(); // Удаляем сообщение с кнопкой "Отмена"
    await ctx.scene.leave(); // Выходим из сцены
});


// Создаем менеджер сцен
const stage = new Scenes.Stage([sendScene]);

// Регистрируем middleware для сессий и сцен
bot.use(session());
bot.use(stage.middleware());


// --- Антифлуд Middleware ---
const cooldowns = new Map();
const COOLDOWN_SECONDS = 3; 

bot.use(async (ctx, next) => {
    const userId = ctx.from.id;
    const now = Date.now();

    // Обновляем lastInteraction при каждом сообщении
    if (ctx.chat && ctx.chat.id) {
        await setUser(ctx.chat.id); // Обновляем lastInteraction через setUser
    }

    const lastExecuted = cooldowns.get(userId);
    if (lastExecuted) {
        const timeElapsed = now - lastExecuted;
        const timeLeft = (COOLDOWN_SECONDS * 1000) - timeElapsed;
        if (timeLeft > 0) {
            const secondsLeft = Math.ceil(timeLeft / 1000);
            console.log(`[Anti-flood] User ${userId} is on cooldown for ${secondsLeft}s.`);
            return ctx.reply(`Пожалуйста, подождите ${secondsLeft} секунд перед отправкой следующего запроса.`);
        }
    }
    cooldowns.set(userId, now);
    return next();
});


// --- Обработчики команд ---

// Команда /start
bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    const messageText = ctx.message.text;

    // Установка пользователя и получение его кода
    await setUser(chatId);
    const userCode = await getUserCode(chatId);

    const botInfo = await ctx.telegram.getMe();
    const link = `https://t.me/${botInfo.username}?start=${userCode}`;

    // Проверяем, есть ли код в сообщении (для перехода по ссылке)
    if (messageText && messageText.length > 6 && messageText.startsWith('/start ')) {
        const receivedCode = messageText.substring(7);
        const userIdToSend = await getChatIdByCode(receivedCode);

        if (userIdToSend) {
            ctx.scene.enter('sendScene', { user: userIdToSend }); // Переходим в сцену отправки
        } else {
            await ctx.reply(`Неверный код пользователя: \`${receivedCode}\`. Пожалуйста, проверьте ссылку.`, { parse_mode: "Markdown" });
        }
    } else {
        // Обычный запуск бота
        await ctx.reply(
            `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
            `Твоя ссылка:\n👉 \`${link}\`\n\n` +
            `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`,
            { parse_mode: 'Markdown' }
        );
    }
});

// Команда /profile (аналог /mystats)
bot.command('profile', async (ctx) => {
    const chatId = ctx.chat.id;
    const { received, sent } = await getMessageCounts(chatId);
    const userCode = await getUserCode(chatId);

    const botInfo = await ctx.telegram.getMe();
    const link = `https://t.me/${botInfo.username}?start=${userCode}`;

    await ctx.reply(
        `➖➖➖➖➖➖➖➖➖➖➖\n` +
        `*Информация о вас:*\n \n` +
        `👤 Username: @${ctx.from.username || 'N/A'}\n` +
        `ℹ️ Id: ${ctx.from.id}\n\n` +
        `*Сообщения:*\n` +
        `📥 Кол-во полученных: ${received}\n` +
        `📤 Кол-во отправленных: ${sent}\n` +
        `                         \n` +
        `🔗 Твоя ссылка: \n` +
        `👉\`${link}\`\n` +
        `➖➖➖➖➖➖➖➖➖➖➖`,
        { parse_mode: 'Markdown' }
    );
});

// Команда /help
bot.command('help', async (ctx) => {
    await ctx.reply("Помощь будет");
});

// --- Обработка callback_query для кнопки "Отправить ещё раз" ---
bot.action(/^again_(.+)$/, async (ctx) => {
    const userIdToSend = ctx.match[1]; // Получаем ID пользователя из callback_data
    await ctx.answerCbQuery(); // Отвечаем на callback_query
    await ctx.deleteMessage(); // Удаляем предыдущее сообщение с кнопкой

    ctx.scene.enter('sendScene', { user: userIdToSend }); // Переходим в сцену отправки
});


// Общий обработчик текстовых сообщений (если не попал ни в одну команду/FSM)
bot.on('text', async (ctx) => {
    // Если сообщение не было обработано сценой, то это неизвестная команда или просто текст
    await ctx.reply('Я не понял вашу команду. Пожалуйста, используйте команды из меню или следуйте инструкциям для отправки анонимного сообщения.');
});

// Обработка любых других типов сообщений, не обработанных FSM
bot.on('message', async (ctx) => {
    // Если сообщение не было обработано ни одной сценой, ни текстовым хэндлером выше
    if (!ctx.message.text && !ctx.message.caption) { // Если нет текста или подписи (для медиа)
        await ctx.reply('Я не понял ваш запрос. Пожалуйста, используйте команды из меню или отправьте поддерживаемый тип сообщения.');
    }
});

