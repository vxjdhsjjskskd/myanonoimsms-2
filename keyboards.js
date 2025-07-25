import { Markup } from 'telegraf';

// Соответствует функции cancel из Python
function cancelKeyboard() {
    return Markup.inlineKeyboard([
        Markup.button.callback('Отмена', 'cancel')
    ]);
}

// Соответствует функции send_again из Python
function sendAgainKeyboard(userId) {
    return Markup.inlineKeyboard([
        Markup.button.callback('Отправить ещё раз', `again_${userId}`)
    ]);
}

export {
    cancelKeyboard,
    sendAgainKeyboard
};
