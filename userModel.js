import mongoose from 'mongoose';

// --- Определение схемы пользователя для анонимного бота ---
// Здесь хранятся только необходимые данные без шифрования
const userSchema = new mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
        unique: true
    },
    // Поле для уникального кода пользователя (например, для ссылки ?start=КОД)
    userCode: {
        type: String,
        required: true,
        unique: true
    },
    // Количество полученных анонимных сообщений
    receivedMessagesCount: {
        type: Number,
        default: 0
    },
    // Количество отправленных анонимных сообщений
    sentMessagesCount: {
        type: Number,
        default: 0
    },
    // Дата последнего взаимодействия (для очистки неактивных пользователей, если нужно)
    lastInteraction: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Добавляет createdAt и updatedAt автоматически
});

// Экспортируем модель
export const User = mongoose.model('User', userSchema);
