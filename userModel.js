import mongoose from 'mongoose';

// --- Определение схемы пользователя для анонимного бота (как в Python) ---
const userSchema = new mongoose.Schema({
    tg_id: { // Соответствует tg_id из Python
        type: Number,
        required: true,
        unique: true
    },
    code: { // Соответствует code из Python
        type: String,
        required: true,
        unique: true
    },
    message_get: { // Соответствует message_get (полученные сообщения) из Python
        type: Number,
        default: 0
    },
    message_count: { // Соответствует message_count (отправленные сообщения) из Python
        type: Number,
        default: 0
    },
    linkClicksCount: { // Новое поле для подсчета переходов по ссылке
        type: Number,
        default: 0
    },
    lastInteraction: { // Добавлено для удобства очистки неактивных пользователей
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true, // Добавляет createdAt и updatedAt автоматически
    collection: 'anon_users' // <-- САМОЕ ВАЖНОЕ ИЗМЕНЕНИЕ: Указываем новую коллекцию!
});

// Экспортируем модель
export const User = mongoose.model('User', userSchema);
