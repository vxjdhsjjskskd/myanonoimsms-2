// src/models.js - Определения схем и моделей Mongoose

const mongoose = require('mongoose');

// --- Схема для пользователя (User) ---
const userSchema = new mongoose.Schema({
    chatId: { // Telegram Chat ID пользователя
        type: String,
        required: true,
        unique: true,
        index: true
    },
    anonymousId: { // Анонимный ID, который выдается ботом
        type: String,
        required: true,
        unique: true,
        index: true
    },
    linkCode: { // Код для анонимной ссылки (payload в /start)
        type: String,
        required: true,
        unique: true,
        index: true
    },
    blockedUsers: { // Массив анонимных ID, заблокированных этим пользователем
        type: [String],
        default: []
    },
    registeredAt: { // Дата регистрации пользователя
        type: Date,
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
    // --- Поля для управления состоянием команды ---
    waitingFor: { // Например, 'anon_message'
        type: String,
        default: null
    },
    targetOwner: { // Chat ID владельца ссылки, которому отправляется анонимное сообщение
        type: String,
        default: null
    },
    lastAnonSender: { // Анонимный ID последнего анонимного отправителя (для кнопки "Заблокировать")
        type: String,
        default: null
    },
    lastAnonSenderChatId: { // Chat ID последнего анонимного отправителя (для ответа)
        type: String,
        default: null
    }
}, { timestamps: true });

// --- Создаем модель User ---
const User = mongoose.model('User', userSchema);

module.exports = {
    User
};
