// src/db.js - Модуль для подключения к базе данных MongoDB Atlas

const mongoose = require('mongoose');

/**
 * Устанавливает соединение с базой данных MongoDB Atlas.
 * @returns {Promise<void>} Промис, который разрешается при успешном подключении или отклоняется при ошибке.
 */
async function connectDb() {
    // Получаем URI подключения из переменной окружения
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        console.error('Ошибка: Переменная окружения MONGODB_URI не установлена.');
        console.error('Пожалуйста, установите MONGODB_URI с URI вашей базы данных MongoDB Atlas.');
        process.exit(1); // Завершаем процесс, если URI не найден
    }

    try {
        await mongoose.connect(mongoUri, {
            // useNewUrlParser и useUnifiedTopology больше не нужны в Mongoose 6+
            // и вызывают предупреждения. Их можно безопасно удалить.
        });
        console.log('[DB] Успешно подключено к MongoDB Atlas!');
    } catch (error) {
        console.error('[DB] Ошибка подключения к MongoDB Atlas:', error);
        process.exit(1); // Завершаем процесс при ошибке подключения к БД
    }
}

/**
 * Отключается от базы данных MongoDB.
 * Используется, например, при завершении работы приложения.
 * @returns {Promise<void>}
 */
async function disconnectDb() {
    try {
        await mongoose.disconnect();
        console.log('[DB] Отключено от MongoDB Atlas.');
    } catch (error) {
        console.error('[DB] Ошибка отключения от MongoDB Atlas:', error);
    }
}

module.exports = {
    connectDb,
    disconnectDb
};
