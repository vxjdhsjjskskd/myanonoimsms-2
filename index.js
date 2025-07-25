import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './userModel.js'; // Импортируем модель пользователя MongoDB

// --- ИЗМЕНЕНО: Импортируем основной файл бота, который сам запускается ---
import './bot.js'; 

// Загружаем переменные окружения из .env файла
dotenv.config();

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
        global.mongooseConnection = mongoose.connection; // Делаем соединение доступным глобально
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
    
    // Инициализируем MongoDB. Бот запустится сам после успешного подключения (в bot.js)
    await connectDB(); 
});

// Graceful stop (для корректной остановки бота при сигналах SIGINT/SIGTERM)
process.once('SIGINT', async () => {
    console.log('Получен сигнал SIGINT. Остановка приложения...');
    // bot.stop() будет вызван в bot.js через глобальный обработчик
    if (global.mongooseConnection) {
        await global.mongooseConnection.close();
        console.log('🔗 MongoDB соединение закрыто.');
    }
    process.exit(0);
});
process.once('SIGTERM', async () => {
    console.log('Получен сигнал SIGTERM. Остановка приложения...');
    // bot.stop() будет вызван в bot.js через глобальный обработчик
    if (global.mongooseConnection) {
        await global.mongooseConnection.close();
        console.log('🔗 MongoDB соединение закрыто.');
    }
    process.exit(0);
});
