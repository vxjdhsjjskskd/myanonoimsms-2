"""
Файл с главной функцией запуска бота (async def main)
Модифицирован для работы с Telegram Webhooks на Render.

"""

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiohttp import web # Импортируем web-сервер aiohttp
import asyncio
import logging
import os

# Конфигурация логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# == ИМПОРТЫ ВАШИХ МОДУЛЕЙ ==
# Предполагается, что эти модули находятся в папке tg_bot
from tg_bot import commands, handlers

# Предполагается, что в data.models или data.requests есть функция для подключения к MongoDB.
# Я предполагаю, что функция для подключения к БД называется connect_to_mongo_db.
# Если у вас она называется по-другому (например, async_main, но для БД),
# пожалуйста, измените `connect_to_mongo_db` на правильное название.
from data.models import async_main as connect_to_mongo_db # Переименовываем для ясности, если async_main - это подключение к БД


# == НАСТРОЙКИ БОТА И WEBHOOK ==

# Получаем токен бота из переменной окружения BOT_TOKEN
bot_token = os.getenv("BOT_TOKEN")
if not bot_token:
    logger.error("BOT_TOKEN environment variable is not set!")
    raise ValueError("BOT_TOKEN environment variable is not set.")

# Получаем WEBHOOK_HOST (Public URL Render-сервиса) из переменной окружения
WEBHOOK_HOST = os.getenv('WEBHOOK_HOST')
if not WEBHOOK_HOST:
    logger.error("WEBHOOK_HOST environment variable is not set! Please add it to Render.")
    raise ValueError("WEBHOOK_HOST environment variable is not set.")

# Путь для вебхука (например, /webhook/ВАШ_ТОКЕН_БОТА)
# Это делает путь уникальным и безопаснее.
WEBHOOK_PATH = f"/webhook/{bot_token}"
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"

# Получаем порт, который Render предоставит нашему сервису
PORT = int(os.environ.get("PORT", 8080)) # 8080 - запасной порт, если PORT не установлен

# Создаем объекты бота и диспетчера
bot = Bot(token=bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# == РЕГИСТРАЦИЯ РОУТЕРОВ ==
# Включаем роутеры из ваших модулей commands и handlers
dp.include_routers(commands.rt, handlers.rt)

# == ФУНКЦИИ ЗАПУСКА И ОСТАНОВКИ ==

async def on_startup(dispatcher: Dispatcher):
    logger.info("Starting bot and setting webhook...")
    
    # Подключение к MongoDB Atlas
    try:
        logger.info("Connecting to MongoDB Atlas...")
        # Вызываем вашу функцию для подключения к базе данных
        # Предполагается, что connect_to_mongo_db() успешно устанавливает соединение.
        # Если ваша функция async_main не отвечает за подключение к БД,
        # а делает что-то другое, вам нужно будет заменить этот вызов
        # на вашу реальную функцию подключения к MongoDB (например, из data.requests).
        await connect_to_mongo_db() 
        logger.info("Successfully connected to MongoDB Atlas!")
    except Exception as e:
        logger.exception(f"Failed to connect to MongoDB Atlas: {e}")
        # Вы можете решить, что делать дальше: завершить работу или продолжить без БД
        raise # Если критично, чтобы бот не работал без БД

    # Устанавливаем вебхук на Telegram API
    await bot.set_webhook(WEBHOOK_URL, drop_pending_updates=True)
    logger.info(f"Webhook set successfully to: {WEBHOOK_URL}")


async def on_shutdown(dispatcher: Dispatcher):
    logger.info("Shutting down bot and deleting webhook...")
    # Удаляем вебхук, чтобы бот не пытался получать обновления на уже несуществующий URL
    await bot.delete_webhook()
    # Закрываем сессию бота
    await bot.session.close()
    logger.info("Webhook deleted and bot session closed.")


# == ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА ==

async def main():
    # Регистрируем функции запуска и остановки
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Создаем веб-приложение aiohttp для обработки входящих вебхуков
    web_app = web.Application()
    # Привязываем хэндлер вебхука aiogram к нашему пути
    # aiogram сам разберется с входящими запросами от Telegram
    web_app.router.add_post(WEBHOOK_PATH, dp.web_hook_handler)

    # Запускаем веб-сервер
    runner = web.AppRunner(web_app)
    await runner.setup()
    # Важно: '0.0.0.0' означает, что сервер будет слушать на всех доступных сетевых интерфейсах
    # Это необходимо для работы на Render.
    site = web.TCPSite(runner, '0.0.0.0', PORT)
    await site.start()
    
    logger.info(f"Web server started on 0.0.0.0:{PORT}. Waiting for webhooks...")

    # Держим главный цикл asyncio запущенным, чтобы веб-сервер продолжал работать.
    # В случае вебхуков, это просто "бесконечный" цикл ожидания.
    try:
        while True:
            await asyncio.sleep(3600) # Ожидаем, пока веб-сервер работает
    except asyncio.CancelledError:
        logger.info("Application stopped by CancelledError.")
    finally:
        await runner.cleanup()
        logger.info("Web server stopped.")


if __name__ == "__main__":
    asyncio.run(main())
