"""
Файл с главной функцией запуска бота (async def main)
Модифицирован для работы с Telegram Long Polling на Render.

"""

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
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


# == НАСТРОЙКИ БОТА ==

# Получаем токен бота из переменной окружения BOT_TOKEN
bot_token = os.getenv("BOT_TOKEN")
if not bot_token:
    logger.error("BOT_TOKEN environment variable is not set!")
    raise ValueError("BOT_TOKEN environment variable is not set.")

# Создаем объекты бота и диспетчера
bot = Bot(token=bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# == РЕГИСТРАЦИЯ РОУТЕРОВ ==
# Включаем роутеры из ваших модулей commands и handlers.
# Убедитесь, что в commands.py и handlers.py у вас созданы объекты Router,
# например: rt = Router()
dp.include_routers(commands.rt, handlers.rt)

# == ФУНКЦИИ ЗАПУСКА И ОСТАНОВКИ ==

async def on_startup_polling(dispatcher: Dispatcher, bot: Bot):
    """
    Функция, выполняемая при запуске бота.
    Здесь происходит подключение к БД.
    """
    logger.info("Starting bot in Long Polling mode...")
    
    # Подключение к MongoDB Atlas
    try:
        logger.info("Connecting to MongoDB Atlas...")
        await connect_to_mongo_db() 
        logger.info("Successfully connected to MongoDB Atlas!")
    except Exception as e:
        logger.exception(f"Failed to connect to MongoDB Atlas: {e}")
        # Если подключение к БД критично, можно прервать запуск
        raise

    # Удаляем любые существующие вебхуки, чтобы избежать конфликтов с Long Polling
    # Это очень важно, если вы ранее устанавливали вебхуки.
    current_webhook_info = await bot.get_webhook_info()
    if current_webhook_info.url:
        logger.info(f"Existing webhook found: {current_webhook_info.url}. Deleting it...")
        await bot.delete_webhook(drop_pending_updates=True)
        logger.info("Webhook deleted successfully.")
    else:
        logger.info("No active webhook found.")

    logger.info("Bot is ready to start polling for updates.")


async def on_shutdown_polling(dispatcher: Dispatcher, bot: Bot):
    """
    Функция, выполняемая при остановке бота.
    Здесь закрывается сессия бота.
    """
    logger.info("Shutting down bot...")
    await bot.session.close()
    logger.info("Bot session closed.")


# == ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА ==

async def main():
    """
    Главная асинхронная функция, которая запускает бота в режиме Long Polling.
    """
    # Регистрируем функции запуска и остановки
    dp.startup.register(on_startup_polling)
    dp.shutdown.register(on_shutdown_polling)

    logger.info("Starting bot's Long Polling loop...")
    try:
        # Запускаем Long Polling. Эта функция блокирует выполнение,
        # пока бот работает, поэтому не нужен asyncio.Future().
        await dp.start_polling(bot)
    except asyncio.CancelledError:
        logger.info("Bot polling stopped by CancelledError.")
    except Exception as e:
        logger.exception(f"An unexpected error occurred during polling: {e}")
    finally:
        logger.info("Bot polling loop finished.")


if __name__ == "__main__":
    asyncio.run(main())

