import { Telegraf, Markup, Scenes, session } from 'telegraf';
import dotenv from 'dotenv';

// Импортируем сервисы базы данных и клавиатуры
import { setUser, getUserCode, getTgIdByCode, getMessageCounts, addMessageCounts, addLinkClick, updateUserCode, blockUser, unblockUser, isUserBlocked } from './dbService.js';
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

    // Проверяем, не заблокировал ли получатель отправителя
    const isBlocked = await isUserBlocked(userIdToSend, senderId);
    if (isBlocked) {
        await ctx.reply(`🚫 Вы не можете отправить сообщение этому пользователю, так как он вас заблокировал.`, { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown" });
        return ctx.scene.leave();
    }

    try {
        await addMessageCounts(senderId, userIdToSend);

        await ctx.telegram.sendMessage(userIdToSend, `✉️ *Пришло новое сообщение!*\n\n${ctx.message.text}`, {
            parse_mode: "Markdown",
            reply_markup: anonymousMessageButtons(senderId, userIdToSend).reply_markup
        });
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

    // Проверяем, не заблокировал ли получатель отправителя
    const isBlocked = await isUserBlocked(userIdToSend, senderId);
    if (isBlocked) {
        await ctx.reply(`🚫 Вы не можете отправить сообщение этому пользователю, так как он вас заблокировал.`, { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown" });
        return ctx.scene.leave();
    }

    try {
        await addMessageCounts(senderId, userIdToSend);

        let sentMessage;
        if (message.photo) {
            sentMessage = await ctx.telegram.sendPhoto(userIdToSend, message.photo[message.photo.length - 1].file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.video) {
            sentMessage = await ctx.telegram.sendVideo(userIdToSend, message.video.file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.document) {
            sentMessage = await ctx.telegram.sendDocument(userIdToSend, message.document.file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.audio) {
            sentMessage = await ctx.telegram.sendAudio(userIdToSend, message.audio.file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.voice) {
            sentMessage = await ctx.telegram.sendVoice(userIdToSend, message.voice.file_id, { caption: caption, parse_mode: "Markdown", reply_markup: replyMarkup });
        } else if (message.video_note) {
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(userIdToSend, caption, { parse_mode: "Markdown", reply_markup: replyMarkup });
            }
            sentMessage = await ctx.telegram.sendVideoNote(userIdToSend, message.video_note.file_id);
        } else if (message.sticker) {
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(userIdToSend, caption, { parse_mode: "Markdown", reply_markup: replyMarkup });
            }
            sentMessage = await ctx.telegram.sendSticker(userIdToSend, message.sticker.file_id);
        } else if (message.poll) {
            const question = message.poll.question;
            const options = message.poll.options.map(o => o.text);
            await ctx.telegram.sendMessage(userIdToSend, baseText, { parse_mode: "Markdown", reply_markup: replyMarkup });
            sentMessage = await ctx.telegram.sendPoll(userIdToSend, question, options, {
                is_anonymous: message.poll.is_anonymous,
                type: message.poll.type,
                allows_multiple_answers: message.poll.allows_multiple_answers
            });
        } else {
            return ctx.reply("⚠️ Бот пока не поддерживает этот тип сообщения или произошла ошибка. Пожалуйста, попробуйте другой тип.", { reply_to_message_id: ctx.message.message_id });
        }

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

// Сцена для ответа на анонимное сообщение
const replyScene = new Scenes.BaseScene('replyScene');

replyScene.enter(async (ctx) => {
    const originalSenderId = ctx.scene.state.originalSender; // Получаем ID оригинального отправителя из состояния сцены
    const repliedToMessageId = ctx.callbackQuery.message.message_id; // ID сообщения, на которое нажали "Ответить"

    if (!originalSenderId) {
        await ctx.reply('⚠️ Ошибка: Не удалось определить, кому ответить. Пожалуйста, начните сначала.', { parse_mode: 'Markdown', reply_to_message_id: repliedToMessageId });
        return ctx.scene.leave();
    }
    await ctx.reply('👉 Введите ваше анонимное ответное сообщение.', { reply_markup: cancelKeyboard().reply_markup, reply_to_message_id: repliedToMessageId });
});

// Обработчик для пересоздания сообщения для анонимности
replyScene.on('message', async (ctx) => {
    const originalSenderId = ctx.scene.state.originalSender; // Оригинальный отправитель
    const replierId = ctx.from.id; // Текущий пользователь, который отвечает
    const message = ctx.message;
    const baseText = "✉️ *Пришло анонимное ответное сообщение!*\n\n";
    const caption = message.caption ? baseText + message.caption : baseText;
    const replyMarkup = anonymousMessageButtons(replierId, originalSenderId).reply_markup;

    if (!originalSenderId) {
        await ctx.reply('⚠️ Ошибка: Не удалось определить, кому ответить. Пожалуйста, начните сначала.', { reply_to_message_id: ctx.message.message_id, parse_mode: 'Markdown' });
        return ctx.scene.leave();
    }

    // Проверяем, не заблокировал ли оригинальный отправитель отвечающего
    const isBlocked = await isUserBlocked(originalSenderId, replierId);
    if (isBlocked) {
        await ctx.reply(`🚫 Вы не можете отправить ответ этому пользователю, так как он вас заблокировал.`, { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown" });
        return ctx.scene.leave();
    }

    try {
        await addMessageCounts(replierId, originalSenderId);

        let sentMessage;
        // Используем message_id сообщения, на которое ответил пользователь, для имитации ответа
        const replyToMessageIdForOriginalSender = ctx.message.reply_to_message ? ctx.message.reply_to_message.message_id : undefined;

        if (message.text) {
            sentMessage = await ctx.telegram.sendMessage(originalSenderId, baseText + message.text, {
                parse_mode: "Markdown",
                reply_markup: replyMarkup,
                reply_to_message_id: replyToMessageIdForOriginalSender // Имитация ответа
            });
        } else if (message.photo) {
            sentMessage = await ctx.telegram.sendPhoto(originalSenderId, message.photo[message.photo.length - 1].file_id, {
                caption: caption,
                parse_mode: "Markdown",
                reply_markup: replyMarkup,
                reply_to_message_id: replyToMessageIdForOriginalSender
            });
        } else if (message.video) {
            sentMessage = await ctx.telegram.sendVideo(originalSenderId, message.video.file_id, {
                caption: caption,
                parse_mode: "Markdown",
                reply_markup: replyMarkup,
                reply_to_message_id: replyToMessageIdForOriginalSender
            });
        } else if (message.document) {
            sentMessage = await ctx.telegram.sendDocument(originalSenderId, message.document.file_id, {
                caption: caption,
                parse_mode: "Markdown",
                reply_markup: replyMarkup,
                reply_to_message_id: replyToMessageIdForOriginalSender
            });
        } else if (message.audio) {
            sentMessage = await ctx.telegram.sendAudio(originalSenderId, message.audio.file_id, {
                caption: caption,
                parse_mode: "Markdown",
                reply_markup: replyMarkup,
                reply_to_message_id: replyToMessageIdForOriginalSender
            });
        } else if (message.voice) {
            sentMessage = await ctx.telegram.sendVoice(originalSenderId, message.voice.file_id, {
                caption: caption,
                parse_mode: "Markdown",
                reply_markup: replyMarkup,
                reply_to_message_id: replyToMessageIdForOriginalSender
            });
        } else if (message.video_note) {
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(originalSenderId, caption, { parse_mode: "Markdown", reply_markup: replyMarkup, reply_to_message_id: replyToMessageIdForOriginalSender });
            }
            sentMessage = await ctx.telegram.sendVideoNote(originalSenderId, message.video_note.file_id);
        } else if (message.sticker) {
            if (caption && caption !== baseText) {
                await ctx.telegram.sendMessage(originalSenderId, caption, { parse_mode: "Markdown", reply_markup: replyMarkup, reply_to_message_id: replyToMessageIdForOriginalSender });
            }
            sentMessage = await ctx.telegram.sendSticker(originalSenderId, message.sticker.file_id);
        } else if (message.poll) {
            const question = message.poll.question;
            const options = message.poll.options.map(o => o.text);
            await ctx.telegram.sendMessage(originalSenderId, baseText, { parse_mode: "Markdown", reply_markup: replyMarkup, reply_to_message_id: replyToMessageIdForOriginalSender });
            sentMessage = await ctx.telegram.sendPoll(originalSenderId, question, options, {
                is_anonymous: message.poll.is_anonymous,
                type: message.poll.type,
                allows_multiple_answers: message.poll.allows_multiple_answers
            });
        } else {
            await ctx.reply("⚠️ Бот пока не поддерживает этот тип сообщения для анонимного ответа. Пожалуйста, попробуйте другой тип.", { reply_to_message_id: ctx.message.message_id });
            return;
        }

        await ctx.reply('✅ Ваше ответное сообщение отправлено анонимно!', { reply_to_message_id: ctx.message.message_id, parse_mode: 'Markdown' });
        await ctx.scene.leave();
    } catch (e) {
        console.error(`[Bot] Ошибка отправки ответного сообщения от ${replierId} к ${originalSenderId}:`, e.message);
        await ctx.reply(
            `⚠️❌ Произошла ошибка при отправке ответного сообщения: \`${e.message}\`\n\n` +
            `Попробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).`,
            { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown", reply_markup: cancelKeyboard().reply_markup }
        );
    }
});

replyScene.action('cancel', async (ctx) => {
    await ctx.answerCbQuery("Действие отменено!");
    if (ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    }
    await ctx.scene.leave();
});
