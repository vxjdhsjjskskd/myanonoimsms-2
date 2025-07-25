import { Markup } from 'telegraf';

function cancelKeyboard() {
    return Markup.inlineKeyboard([
        Markup.button.callback('Отмена', 'cancel')
    ]);
}

function sendAgainKeyboard(userId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('Отправить ещё раз', `again_${userId}`)
    ]);
}

// ИЗМЕНЕНО: Текст кнопки "Ответить анонимно" на "Ответить"
function replyToSenderKeyboard(originalSenderTgId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('Ответить', `reply_to_sender_${originalSenderTgId}`) // Текст изменен здесь
    ]);
}

export {
    cancelKeyboard,
    sendAgainKeyboard,
    replyToSenderKeyboard
};
