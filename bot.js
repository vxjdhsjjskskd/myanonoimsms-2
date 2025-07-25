import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
// Импортируем модель пользователя MongoDB
import { User } from './userModel.js'; 

// Загружаем переменные окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
export const bot = new Telegraf(BOT_TOKEN); // Экспортируем инстанс бота

// --- Вспомогательные функции для работы с MongoDB (будут реализованы позже) ---
// Эти функции будут взаимодействовать с вашей User моделью
async function getUserData(chatId) {
    // TODO: Реализовать получение данных пользователя из MongoDB
    // Пример: return await User.findOne({ chatId: chatId });
    console.log(`[MongoDB] Получение данных для пользователя ${chatId}`);
    return null; 
}

async function upsertUserData(chatId, data) {
    // TODO: Реализовать обновление/создание данных пользователя в MongoDB
    // Пример: await User.findOneAndUpdate({ chatId: chatId }, { $set: data }, { upsert: true, new: true });
    console.log(`[MongoDB] Обновление/создание данных для пользователя ${chatId}:`, data);
}

async function generateUserCode(chatId) {
    // TODO: Реализовать генерацию и сохранение уникального кода для пользователя
    console.log(`[MongoDB] Генерация кода для пользователя ${chatId}`);
    return "YOUR_GENERATED_CODE"; // Заглушка
}

async function getUserIdByCode(code) {
    // TODO: Реализовать поиск chatId по уникальному коду
    console.log(`[MongoDB] Поиск пользователя по коду ${code}`);
    return null; // Заглушка
}

async function updateMessageCounts(senderId, receiverId) {
    // TODO: Реализовать обновление счетчиков отправленных/полученных сообщений
    console.log(`[MongoDB] Обновление счетчиков сообщений: отправитель ${senderId}, получатель ${receiverId}`);
}


// --- Антифлуд (базовая заглушка) ---
const cooldowns = new Map();
const COOLDOWN_SECONDS = 3; 

bot.use(async (ctx, next) => {
    const userId = ctx.from.id;
    const now = Date.now();

    // Обновляем lastInteraction (позже будет использовать upsertUserData)
    // await upsertUserData(userId, { lastInteraction: new Date() });

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


// --- Главное меню (Reply Keyboard) ---
// Это заглушка, будет заменена на ваши кнопки из key.js
const mainKeyboard = Markup.keyboard([
    ['/start', '/profile'],
    ['/help']
]).resize();


// --- Обработчики команд ---

// Команда /start
bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    // TODO: Реализовать set_user и получение userCode
    await upsertUserData(chatId, { chatId: chatId, receivedMessagesCount: 0, sentMessagesCount: 0 }); // Пример инициализации
    const userCode = await generateUserCode(chatId); // Заглушка

    const botInfo = await ctx.telegram.getMe();
    const link = `https://t.me/${botInfo.username}?start=${userCode}`;

    await ctx.reply(
        `🚀 Начни получать анонимные сообщения прямо сейчас!\n\n` +
        `Твоя ссылка:\n👉 \`${link}\`\n\n` +
        `Размести эту ссылку ☝️ в описании профиля Telegram/TikTok/Instagram, чтобы начать получать анонимные сообщения 💬`,
        { parse_mode: 'Markdown', ...mainKeyboard }
    );
});

// Команда /profile (аналог /mystats)
bot.command('profile', async (ctx) => {
    const chatId = ctx.chat.id;
    // TODO: Реализовать получение статистики (get_messages, get_code)
    const userData = await getUserData(chatId); // Заглушка
    const received = userData ? userData.receivedMessagesCount : 0;
    const sent = userData ? userData.sentMessagesCount : 0;
    const userCode = userData ? userData.userCode : await generateUserCode(chatId); // Заглушка

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
        { parse_mode: 'Markdown', ...mainKeyboard }
    );
});

// Команда /help
bot.command('help', async (ctx) => {
    await ctx.reply("Помощь будет", mainKeyboard);
});

// TODO: Добавить хэндлеры для отправки сообщений (FSM) из tg_bot/handlers.py
// TODO: Добавить обработку callback_query из tg_bot/handlers.py
// TODO: Добавить команды /mystats, /url, /issue, /lang, если они нужны и будут реализованы.

// Общий обработчик текстовых сообщений (если не попал ни в одну команду/FSM)
bot.on('text', async (ctx) => {
    // TODO: Здесь будет логика для FSM Send.code и других текстовых сообщений
    await ctx.reply('Я не понял вашу команду. Пожалуйста, используйте команды из меню или следуйте инструкциям для отправки анонимного сообщения.', mainKeyboard);
});

            
