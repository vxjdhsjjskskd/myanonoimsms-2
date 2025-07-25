import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './userModel.js'; // Импортируем модель пользователя MongoDB

// Загружаем переменные окружения из .env файла
dotenv.config();

// Импортируем основной файл бота
import { bot } from './bot.js'; // bot.js будет экспортировать инстанс Telegraf

const app = express();
// Render предоставляет порт через переменную окружения PORT
const port = process.env.PORT || 3000; 

// --- Инициализация MongoDB ---
const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
    if (!MONGO_URI) {
        console.error('❌ Ошибка: Переменная окружения MONGO_URI не установлена. Невозможно подключиться к базе данных.');
        process.exit(1); // Завершаем процесс, если нет URI
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB: Подключение к базе данных успешно.');

        // Делаем db (mongoose connection) доступным глобально, если это нужно для bot.js
        // В Telegraf обычно не требуется, но может быть полезно для других модулей.
        global.mongooseConnection = mongoose.connection;

    } catch (error) {
        console.error('❌ Ошибка подключения к MongoDB:', error);
        process.exit(1); // Завершаем процесс при ошибке подключения
    }
}

// --- Запуск веб-сервера для поддержания активности ---

// Корневой путь - просто подтверждает, что бот активен
app.get('/', (req, res) => {
    res.send('Анонимный Telegram бот активен!');
});

// ЭНДПОИНТ: /health для проверки работоспособности (как в вашем погодном боте)
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
    
    // Инициализируем MongoDB
    await connectDB();

    // Запускаем бота Telegraf в режиме Long Polling
    // bot.launch() блокирует выполнение, пока бот работает
    bot.launch()
        .then(() => {
            console.log('✅ Telegraf бот запущен в режиме Long Polling.');
        })
        .catch(err => {
            console.error('❌ Ошибка при запуске Telegraf бота:', err);
            process.exit(1); // Завершаем процесс при ошибке бота
        });
});

// Graceful stop (для корректной остановки бота при сигналах SIGINT/SIGTERM)
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
