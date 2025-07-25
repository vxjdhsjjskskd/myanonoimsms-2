import { User, AnonMessageContext } from './userModel.js'; // Импортируем AnonMessageContext
import crypto from 'crypto';

async function setUser(tgId) {
    try {
        let user = await User.findOne({ tg_id: tgId });
        if (!user) {
            const userCode = crypto.randomBytes(5).toString('hex').toUpperCase();
            user = new User({
                tg_id: tgId,
                code: userCode,
                message_get: 0,
                message_count: 0,
                linkClicksCount: 0,
                blockedUsers: [],
                lastInteraction: new Date()
            });
            await user.save();
            console.log(`[DB] Добавлен новый пользователь: ${tgId}, код: ${userCode}`);
        } else {
            user.lastInteraction = new Date();
            await user.save();
        }
        return user;
    } catch (error) {
        console.error(`[DB] Ошибка в setUser для ${tgId}:`, error.message);
        throw error;
    }
}

async function getUserCode(tgId) {
    try {
        const user = await User.findOne({ tg_id: tgId });
        return user ? user.code : null;
    } catch (error) {
        console.error(`[DB] Ошибка в getUserCode для ${tgId}:`, error.message);
        throw error;
    }
}

async function getTgIdByCode(userCode) {
    try {
        const user = await User.findOne({ code: userCode });
        return user ? user.tg_id : null;
    } catch (error) {
        console.error(`[DB] Ошибка в getTgIdByCode для кода ${userCode}:`, error.message);
        throw error;
    }
}

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

async function updateUserCode(tgId) {
    try {
        const newCode = crypto.randomBytes(5).toString('hex').toUpperCase();
        await User.updateOne(
            { tg_id: tgId },
            { $set: { code: newCode, lastInteraction: new Date() } }
        );
        console.log(`[DB] Код пользователя ${tgId} обновлен на ${newCode}`);
        return newCode;
    } catch (error) {
        console.error(`[DB] Ошибка в updateUserCode для ${tgId}:`, error.message);
        throw error;
    }
}

async function blockUser(blockerTgId, blockedTgId) {
    try {
        await User.updateOne(
            { tg_id: blockerTgId },
            { $addToSet: { blockedUsers: blockedTgId }, $set: { lastInteraction: new Date() } }
        );
        console.log(`[DB] Пользователь ${blockerTgId} заблокировал ${blockedTgId}.`);
    } catch (error) {
        console.error(`[DB] Ошибка в blockUser для ${blockerTgId} блокирующего ${blockedTgId}:`, error.message);
        throw error;
    }
}

async function unblockUser(blockerTgId, unblockedTgId) {
    try {
        await User.updateOne(
            { tg_id: blockerTgId },
            { $pull: { blockedUsers: unblockedTgId }, $set: { lastInteraction: new Date() } }
        );
        console.log(`[DB] Пользователь ${blockerTgId} разблокировал ${unblockedTgId}.`);
    } catch (error) {
        console.error(`[DB] Ошибка в unblockUser для ${blockerTgId} разблокирующего ${unblockedTgId}:`, error.message);
        throw error;
    }
}

async function isUserBlocked(blockerTgId, potentialBlockedTgId) {
    try {
        const user = await User.findOne({ tg_id: blockerTgId });
        if (!user) {
            return false;
        }
        return user.blockedUsers.includes(potentialBlockedTgId);
    } catch (error) {
        console.error(`[DB] Ошибка в isUserBlocked для ${blockerTgId} проверяющего ${potentialBlockedTgId}:`, error.message);
        throw error;
    }
}

// НОВАЯ ФУНКЦИЯ: Сохранение контекста анонимного сообщения
async function saveAnonMessageContext(botMessageId, recipientChatId, originalSenderId, originalSenderMessageId) {
    try {
        const context = new AnonMessageContext({
            bot_message_id: botMessageId,
            recipient_chat_id: recipientChatId,
            original_sender_id: originalSenderId,
            original_sender_message_id: originalSenderMessageId,
            created_at: new Date()
        });
        await context.save();
        console.log(`[DB] Сохранен контекст анонимного сообщения: bot_message_id=${botMessageId}, original_sender_id=${originalSenderId}`);
    } catch (error) {
        console.error(`[DB] Ошибка в saveAnonMessageContext:`, error.message);
        throw error;
    }
}

// НОВАЯ ФУНКЦИЯ: Получение контекста анонимного сообщения
async function getAnonMessageContext(botMessageId, recipientChatId) {
    try {
        const context = await AnonMessageContext.findOne({
            bot_message_id: botMessageId,
            recipient_chat_id: recipientChatId
        });
        return context ? context.toObject() : null;
    } catch (error) {
        console.error(`[DB] Ошибка в getAnonMessageContext для bot_message_id=${botMessageId}, recipient_chat_id=${recipientChatId}:`, error.message);
        throw error;
    }
}


export {
    setUser,
    getUserCode,
    getTgIdByCode,
    getMessageCounts,
    addMessageCounts,
    addLinkClick,
    updateUserCode,
    blockUser,
    unblockUser,
    isUserBlocked,
    saveAnonMessageContext, // Экспортируем новые функции
    getAnonMessageContext
};
