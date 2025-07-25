import { User } from './userModel.js';
import crypto from 'crypto'; // Для генерации уникального кода

// Функция для добавления нового пользователя или получения существующего
// Соответствует set_user из Python
async function setUser(chatId) {
    try {
        let user = await User.findOne({ chatId: chatId });
        if (!user) {
            // Генерируем уникальный код для нового пользователя
            const userCode = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 символов (5 байт * 2 hex)
            user = new User({
                chatId: chatId,
                userCode: userCode,
                receivedMessagesCount: 0,
                sentMessagesCount: 0,
                lastInteraction: new Date()
            });
            await user.save();
            console.log(`[DB] Новый пользователь ${chatId} добавлен с кодом ${userCode}`);
        } else {
            // Обновляем дату последнего взаимодействия
            user.lastInteraction = new Date();
            await user.save();
            console.log(`[DB] Пользователь ${chatId} обновлен (lastInteraction).`);
        }
        return user;
    } catch (error) {
        console.error(`[DB] Ошибка в setUser для ${chatId}:`, error);
        throw error; // Перебрасываем ошибку для обработки выше
    }
}

// Функция для получения уникального кода пользователя
// Соответствует get_code из Python
async function getUserCode(chatId) {
    try {
        const user = await User.findOne({ chatId: chatId });
        if (!user) {
            // Если пользователь не найден, можно создать его или вернуть null/ошибку
            // В данном случае, если код запрашивается, пользователь должен существовать
            console.warn(`[DB] Код запрошен для несуществующего пользователя ${chatId}.`);
            return null;
        }
        return user.userCode;
    } catch (error) {
        console.error(`[DB] Ошибка в getUserCode для ${chatId}:`, error);
        throw error;
    }
}

// Функция для получения Telegram ID пользователя по его уникальному коду
// Соответствует get_user из Python
async function getChatIdByCode(userCode) {
    try {
        const user = await User.findOne({ userCode: userCode });
        if (!user) {
            console.warn(`[DB] Пользователь с кодом ${userCode} не найден.`);
            return null; // Возвращаем null, если пользователь не найден
        }
        return user.chatId;
    } catch (error) {
        console.error(`[DB] Ошибка в getChatIdByCode для кода ${userCode}:`, error);
        throw error;
    }
}

// Функция для получения статистики сообщений пользователя
// Соответствует get_messages из Python
async function getMessageCounts(chatId) {
    try {
        const user = await User.findOne({ chatId: chatId });
        if (!user) {
            console.warn(`[DB] Статистика запрошена для несуществующего пользователя ${chatId}.`);
            return { received: 0, sent: 0 };
        }
        return {
            received: user.receivedMessagesCount,
            sent: user.sentMessagesCount
        };
    } catch (error) {
        console.error(`[DB] Ошибка в getMessageCounts для ${chatId}:`, error);
        throw error;
    }
}

// Функция для обновления счетчиков отправленных и полученных сообщений
// Соответствует add_messages_count из Python
async function addMessageCounts(senderId, receiverId) {
    try {
        // Обновляем счетчик отправленных сообщений для отправителя
        await User.updateOne(
            { chatId: senderId },
            { $inc: { sentMessagesCount: 1 }, $set: { lastInteraction: new Date() } }
        );
        console.log(`[DB] Счетчик отправленных сообщений для ${senderId} увеличен.`);

        // Обновляем счетчик полученных сообщений для получателя
        await User.updateOne(
            { chatId: receiverId },
            { $inc: { receivedMessagesCount: 1 }, $set: { lastInteraction: new Date() } }
        );
        console.log(`[DB] Счетчик полученных сообщений для ${receiverId} увеличен.`);
    } catch (error) {
        console.error(`[DB] Ошибка в addMessageCounts для отправителя ${senderId} и получателя ${receiverId}:`, error);
        throw error;
    }
}

export {
    setUser,
    getUserCode,
    getChatIdByCode,
    getMessageCounts,
    addMessageCounts
};
