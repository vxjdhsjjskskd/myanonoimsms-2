// src/models.js - Определения схем и моделей Mongoose

const mongoose = require('mongoose');

// --- Схема для пользователя (User) ---
const userSchema = new mongoose.Schema({
    chatId: { // Telegram Chat ID пользователя
        type: String,
        required: true,
        unique: true, // Каждый Telegram ID уникален
        index: true   // Индексируем для быстрого поиска
    },
    anonymousId: { // Анонимный ID, который выдается ботом
        type: String,
        required: true,
        unique: true, // Каждый анонимный ID уникален
        index: true
    },
    anonLinkCode: { // Код для анонимной ссылки (payload в /start)
        type: String,
        required: true,
        unique: true, // Каждый код ссылки уникален
        index: true
    },
    blockedUsers: { // Массив анонимных ID, заблокированных этим пользователем
        type: [String], // Массив строк
        default: []
    },
    registeredAt: { // Дата регистрации пользователя
        type: Date, // Используем Date объект для лучшей работы с датами
        required: true
    },
    messagesSentToday: { // Количество сообщений, отправленных сегодня (для лимитов)
        type: Number,
        default: 0
    },
    lastSentDate: { // Дата последнего отправленного сообщения
        type: String, // YYYY-MM-DD
        default: null
    },
    isAutoBlocked: { // Флаг автоблокировки (за мат/спам)
        type: Boolean,
        default: false
    },
    autoBlockUntil: { // Дата и время, до которой действует автоблокировка
        type: Date,
        default: null
    },
    currentCommandStep: { // Для пошаговых команд (например, 'awaiting_recipient_id')
        type: String,
        default: null
    },
    tempData: { // Временные данные для пошаговых команд (например, { recipient_id: 'XYZ' })
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
