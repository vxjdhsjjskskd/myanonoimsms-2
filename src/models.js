// src/models.js - Определения схем и моделей Mongoose (Упрощенная версия)

const mongoose = require('mongoose');

// --- Схема для пользователя (User) ---
const userSchema = new mongoose.Schema({
    chatId: { // Telegram Chat ID пользователя
        type: String,
        required: true,
        unique: true, // Каждый Telegram ID уникален
        index: true   // Индексируем для быстрого поиска
    },
    anonLinkCode: { // Код для анонимной ссылки (payload в /start)
        type: String,
        required: true,
        unique: true, // Каждый код ссылки уникален
        index: true
    },
    // Поле linkCode оставлено для совместимости со старыми записями в БД, если они есть
    linkCode: {
        type: String,
        unique: false, // Не обязательно уникальное, так как основное anonLinkCode
        sparse: true // Позволяет индексировать только те документы, где это поле существует
    },
    blockedUsers: { // Массив Telegram Chat ID, заблокированных этим пользователем
        type: [String], // Массив строк (Telegram Chat IDs)
        default: []
    },
    registeredAt: { // Дата регистрации пользователя
        type: Date, // Используем Date объект для лучшей работы с датами
        required: true
    },
    messagesReceived: { // Количество полученных сообщений
        type: Number,
        default: 0
    },
    messagesSent: { // Количество отправленных сообщений
        type: Number,
        default: 0
    },
    isAutoBlocked: { // Флаг автоблокировки (за мат/спам)
        type: Boolean,
        default: false
    },
    autoBlockUntil: { // Дата и время, до которой действует автоблокировка
        type: Date,
        default: null
    },
    currentCommandStep: { // Для пошаговых команд (например, 'awaiting_anon_message')
        type: String,
        default: null
    },
    tempData: { // Временные данные для пошаговых команд (например, { owner_telegram_id: 'XYZ' })
        type: mongoose.Schema.Types.Mixed, // Позволяет хранить любые типы данных
        default: {}
    },
    lastAnonSenderChatId: { // Chat ID последнего анонимного отправителя (для ответа)
        type: String,
        default: null
    }
}, { timestamps: true }); // Добавляет createdAt и updatedAt автоматически

// --- Создаем модель User ---
const User = mongoose.model('User', userSchema);

module.exports = {
    User,
};
