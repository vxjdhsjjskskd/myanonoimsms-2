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

// Экспортируем модель
export const User = mongoose.model('User', userSchema);
