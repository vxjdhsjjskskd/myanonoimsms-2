import { Markup } from 'telegraf';

function cancelKeyboard() {
    return Markup.inlineKeyboard([
        Markup.button.callback('❌ Отменить', 'cancel') // Текст изменен
    ]);
}

// ИЗМЕНЕНО: Написать еще (вместо Отправить ещё раз)
function writeMoreKeyboard(userId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('✍️ Написать еще', `again_${userId}`) // Текст изменен
    ]);
}

// НОВАЯ КЛАВИАТУРА: Для анонимных сообщений (Ответить + Заблокировать)
function anonymousMessageButtons(originalSenderTgId, recipientTgId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('↩️ Ответить', `reply_to_sender_${originalSenderTgId}`),
        Markup.button.callback('🚫 Заблокировать', `block_user_${originalSenderTgId}_from_${recipientTgId}`) // Передаем ID отправителя и получателя
    ]);
}

// Клавиатура для подтверждения разблокировки (на случай, если понадобится)
function confirmUnblockKeyboard(blockedTgId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('✅ Подтвердить разблокировку', `confirm_unblock_${blockedTgId}`),
        Markup.button.callback('❌ Отмена', 'cancel_unblock')
    ]);
}


export {
    cancelKeyboard,
    writeMoreKeyboard, // Экспортируем новую клавиатуру
    anonymousMessageButtons, // Экспортируем новую комбинированную клавиатуру
    confirmUnblockKeyboard
};
