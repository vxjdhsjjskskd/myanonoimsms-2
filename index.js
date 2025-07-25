import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './userModel.js'; // Импортируем модель пользователя MongoDB

// Загружаем переменные окружения из .env файла
dotenv.config();

// Импортируем основной файл бота
import { bot } from './bot.js'; // bot.js будет экспортировать инстанс Telegraf

const app = express();
const port = process.env.PORT || 3000; 

// --- Инициализация MongoDB ---
const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
    if (!MONGO_URI) {
        console.error('❌ Ошибка: Переменная окружения MONGO_URI не установлена. Невозможно подключиться к базе данных.');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB: Подключение к базе данных успешно.');
        global.mongooseConnection = mongoose.connection;
    } catch (error) {
        console.error('❌ Ошибка подключения к MongoDB:', error);
        process.exit(1);
    }
}

// --- Запуск веб-сервера для поддержания активности ---

app.get('/', (req, res) => {
    res.send('Анонимный Telegram бот активен!');
});

app.get('/health', (req, res) => {
    const dbStatus = global.mongooseConnection && global.mongooseConnection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
        status: 'OK',
        service: 'Anonymous Telegram Bot',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
            status: dbStatus,
        }
    });
});


app.listen(port, async () => {
    console.log(`🌐 Веб-сервер запущен на порту ${port}`);
    console.log(`🏥 Health check доступен по адресу: http://localhost:${port}/health`);
    
    await connectDB();

    // --- ИЗМЕНЕНО: Более агрессивное удаление вебхука перед запуском Long Polling ---
    try {
        console.log('[Bot] Попытка удалить существующий вебхук перед запуском Long Polling...');
        // bot.telegram.deleteWebhook() возвращает true/false
        const deleted = await bot.telegram.deleteWebhook();
        if (deleted) {
            console.log('[Bot] Вебхук успешно удален.');
        } else {
            console.log('[Bot] Вебхук не был активен или уже удален.');
        }
    } catch (error) {
        console.error('[Bot] Ошибка при удалении вебхука:', error.message);
        // Продолжаем, даже если ошибка, так как Long Polling может работать
    }
    // --- КОНЕЦ ИЗМЕНЕННОГО БЛОКА ---

    bot.launch()
        .then(() => {
            console.log('✅ Telegraf бот запущен в режиме Long Polling.');
        })
        .catch(err => {
            console.error('❌ Ошибка при запуске Telegraf бота:', err);
            // Важно: если это 409 Conflict, бот все равно может начать работать после нескольких попыток.
            // Render будет пытаться перезапустить сервис.
        });
});

// Graceful stop
process.once('SIGINT', async () => {
    console.log('Получен сигнал SIGINT. Остановка бота...');
    await bot.stop('SIGINT');
    if (global.mongooseConnection) {
        await global.mongooseConnection.close();
        console.log('🔗 MongoDB соединение закрыто.');
    }
    console.log('🔗 Бот остановлен (SIGINT).');
    process.exit(0);
});
process.once('SIGTERM', async () => {
    console.log('Получен сигнал SIGTERM. Остановка бота...');
    await bot.stop('SIGTERM');
    if (global.mongooseConnection) {
        await global.mongooseConnection.close();
        console.log('🔗 MongoDB соединение закрыто.');
    }
    console.log('🔗 Бот остановлен (SIGTERM).');
    process.exit(0);
});
