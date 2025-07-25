"""
Файл с главной функцией запуска бота (async def main)
Модифицирован для работы с Telegram Webhooks на Render.

"""

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiohttp import web # Убедитесь, что aiohttp установлен (в requirements.txt)
import asyncio
import logging
import os

# Конфигурация логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# == ИМПОРТЫ ВАШИХ МОДУЛЕЙ ==
# ОБЯЗАТЕЛЬНО: Раскомментируйте и убедитесь, что пути правильные для ваших файлов!
# Например, если у вас commands.py и handlers.py находятся в папке tg_bot:
from tg_bot import commands, handlers

# ОБЯЗАТЕЛЬНО: Если у вас есть функция для подключения к MongoDB,
# импортируйте её здесь. Я предполагаю, что ваша функция 'async_main'
# из 'data.models' отвечает за это. Если нет, замените 'connect_to_mongo_db'
# на правильное название вашей функции подключения к БД, и 'data.models'
# на правильный путь к вашему файлу.
from data.models import async_main as connect_to_mongo_db


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
# Включаем роутеры из ваших модулей commands и handlers.
# Убедитесь, что в commands.py и handlers.py у вас созданы объекты Router,
# например: rt = Router()
dp.include_routers(commands.rt, handlers.rt)

# == ФУНКЦИИ ЗАПУСКА И ОСТАНОВКИ ==

async def on_startup(bot: Bot):
    """
    Функция, выполняемая при запуске бота.
    Здесь происходит подключение к БД и установка вебхука.
    """
    logger.info("Starting bot and setting webhook...")
    
    # Подключение к MongoDB Atlas
    try:
        logger.info("Connecting to MongoDB Atlas...")
        await connect_to_mongo_db() 
        logger.info("Successfully connected to MongoDB Atlas!")
    except Exception as e:
        logger.exception(f"Failed to connect to MongoDB Atlas: {e}")
        raise # Если подключение к БД критично, можно прервать запуск

    # Устанавливаем вебхук на Telegram API
    # drop_pending_updates=True очищает все накопившиеся обновления
    await bot.set_webhook(WEBHOOK_URL, drop_pending_updates=True)
    logger.info(f"Webhook set successfully to: {WEBHOOK_URL}")


async def on_shutdown(bot: Bot):
    """
    Функция, выполняемая при остановке бота.
    Здесь удаляется вебхук и закрывается сессия бота.
    """
    logger.info("Shutting down bot and deleting webhook...")
    await bot.delete_webhook()
    await bot.session.close()
    logger.info("Webhook deleted and bot session closed.")


# == ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА ==

async def main():
    """
    Главная асинхронная функция, которая запускает бота как веб-сервис.
    """
    
    # Регистрация функций on_startup и on_shutdown
    # Это важно, так как они будут вызваны aiogram
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Запуск веб-сервера aiohttp и обработка вебхуков
    # aiogram 3.x использует web.run_app для запуска веб-сервера
    # с встроенной логикой обработки вебхуков.
    logger.info(f"Starting web server for webhook on port {PORT}...")
    try:
        await dp.start_polling( # Используем start_polling для интеграции с aiohttp.web_app
            bot,
            webhook_url=WEBHOOK_URL,
            # Создаем aiohttp.web.Application для aiogram
            web_app_factory=lambda: web.Application(),
            web_server_host='0.0.0.0',
            web_server_port=PORT
        )
    except asyncio.CancelledError:
        logger.info("Application stopped by CancelledError.")
    except Exception as e:
        logger.exception(f"An error occurred during webhook startup: {e}")
    finally:
        logger.info("Bot stopped.")


if __name__ == "__main__":
    asyncio.run(main())
