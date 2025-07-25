import mongoose from 'mongoose';

// --- Определение схемы пользователя для анонимного бота ---
const userSchema = new mongoose.Schema({
    tg_id: {
        type: Number,
        required: true,
        unique: true
    },
    code: {
        type: String,
        required: true,
        unique: true
    },
    message_get: {
        type: Number,
        default: 0
    },
    message_count: {
        type: Number,
        default: 0
    },
    linkClicksCount: {
        type: Number,
        default: 0
    },
    blockedUsers: { // НОВОЕ ПОЛЕ: Массив ID пользователей, которых заблокировал этот пользователь
        type: [Number],
        default: []
    },
    lastInteraction: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'anon_users'
});

// --- НОВАЯ СХЕМА: Для временного хранения контекста анонимных сообщений ---
const anonMessageContextSchema = new mongoose.Schema({
    // ID сообщения, которое бот отправил получателю
    bot_message_id: {
        type: Number,
        required: true,
        unique: true // Каждое сообщение бота уникально
    },
    // ID чата, в который бот отправил это сообщение (ID получателя)
    recipient_chat_id: {
        type: Number,
        required: true
    },
    // ID оригинального отправителя
    original_sender_id: {
        type: Number,
        required: true
    },
    // ID сообщения, которое оригинальный отправитель отправил боту (для цепочки ответов)
    original_sender_message_id: {
        type: Number,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now,
        expires: '5d' // Автоматическое удаление документов через 5 дней
    }
}, {
    collection: 'anon_message_contexts' // Отдельная коллекция
});

// Экспортируем модели
export const User = mongoose.model('User', userSchema);
export const AnonMessageContext = mongoose.model('AnonMessageContext', anonMessageContextSchema);
