import { Markup } from 'telegraf';

function cancelKeyboard() {
    return Markup.inlineKeyboard([
        Markup.button.callback('❌ Отменить', 'cancel')
    ]);
}

function writeMoreKeyboard(userId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('✍️ Написать еще', `again_${userId}`)
    ]);
}

// ИЗМЕНЕНО: Только кнопка "Заблокировать", без "Ответить"
function anonymousMessageButtons(originalSenderTgId, recipientTgId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('🚫 Заблокировать', `block_user_${originalSenderTgId}_from_${recipientTgId}`)
    ]);
}

function confirmUnblockKeyboard(blockedTgId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('✅ Подтвердить разблокировку', `confirm_unblock_${blockedTgId}`),
        Markup.button.callback('❌ Отмена', 'cancel_unblock')
    ]);
}


export {
    cancelKeyboard,
    writeMoreKeyboard,
    anonymousMessageButtons,
    confirmUnblockKeyboard
};
