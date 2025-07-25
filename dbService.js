import { User } from './userModel.js';
import crypto from 'crypto'; // Для генерации уникального кода

// Функция для добавления нового пользователя или получения существующего
async function setUser(tgId) {
    try {
        let user = await User.findOne({ tg_id: tgId });
        if (!user) {
            const userCode = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 символов (5 байт * 2 hex)
            // ИЗМЕНЕНО: Передаем tg_id и code в конструктор User сразу
            user = new User({
                tg_id: tgId, // <-- Обязательное поле
                code: userCode, // <-- Обязательное поле
                message_get: 0,
                message_count: 0,
                linkClicksCount: 0,
                lastInteraction: new Date()
            });
            await user.save();
            console.log(`[DB] Добавлен новый пользователь: ${tgId}, код: ${userCode}`);
        } else {
            user.lastInteraction = new Date(); // Обновляем дату последнего взаимодействия
            await user.save();
        }
        return user;
    } catch (error) {
        console.error(`[DB] Ошибка в setUser для ${tgId}:`, error.message);
        throw error;
    }
}

// Функция для получения уникального кода пользователя
async function getUserCode(tgId) {
    try {
        const user = await User.findOne({ tg_id: tgId });
        return user ? user.code : null;
    } catch (error) {
        console.error(`[DB] Ошибка в getUserCode для ${tgId}:`, error.message);
        throw error;
    }
}

// Функция для получения Telegram ID пользователя по его уникальному коду
async function getTgIdByCode(userCode) {
    try {
        const user = await User.findOne({ code: userCode });
        return user ? user.tg_id : null;
    } catch (error) {
        console.error(`[DB] Ошибка в getTgIdByCode для кода ${userCode}:`, error.message);
        throw error;
    }
}

// Функция для получения статистики сообщений пользователя
async function getMessageCounts(tgId) {
    try {
        const user = await User.findOne({ tg_id: tgId });
        if (!user) {
            return { received: 0, sent: 0, linkClicks: 0 };
        }
        return {
            received: user.message_get,
            sent: user.message_count,
            linkClicks: user.linkClicksCount || 0
        };
    } catch (error) {
        console.error(`[DB] Ошибка в getMessageCounts для ${tgId}:`, error.message);
        throw error;
    }
}

// Функция для обновления счетчиков отправленных и полученных сообщений
async function addMessageCounts(senderId, receiverId) {
    try {
        await User.updateOne(
            { tg_id: senderId },
            { $inc: { message_count: 1 }, $set: { lastInteraction: new Date() } }
        );
        await User.updateOne(
            { tg_id: receiverId },
            { $inc: { message_get: 1 }, $set: { lastInteraction: new Date() } }
        );
    } catch (error) {
        console.error(`[DB] Ошибка в addMessageCounts для отправителя ${senderId} и получателя ${receiverId}:`, error.message);
        throw error;
    }
}

// Новая функция для увеличения счетчика переходов по ссылке
async function addLinkClick(tgId) {
    try {
        await User.updateOne(
            { tg_id: tgId },
            { $inc: { linkClicksCount: 1 }, $set: { lastInteraction: new Date() } }
        );
        console.log(`[DB] Увеличен счетчик переходов по ссылке для пользователя: ${tgId}`);
    } catch (error) {
        console.error(`[DB] Ошибка в addLinkClick для ${tgId}:`, error.message);
        throw error;
    }
}

export {
    setUser,
    getUserCode,
    getTgIdByCode,
    getMessageCounts,
    addMessageCounts,
    addLinkClick
};
