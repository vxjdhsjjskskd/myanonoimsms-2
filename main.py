"""
Файл с главной функцией запуска бота (async def main)
Модифицирован для работы с Telegram Long Polling на Render,
с добавлением минимального aiohttp веб-сервера для удовлетворения требований Render.

"""

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiohttp import web # Импортируем web для создания HTTP сервера
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

# == ОБРАБОТЧИКИ ДЛЯ МИНИМАЛЬНОГО ВЕБ-СЕРВЕРА AIOHTTP ==

async def index_handler(request):
    """
    Простой обработчик для корневого URL.
    Подтверждает, что веб-сервер активен.
    """
    return web.Response(text="Анонимный бот активен и работает!")

async def health_check_handler(request):
    """
    Обработчик для проверки работоспособности (Health Check).
    """
    # Здесь можно добавить проверку статуса MongoDB, если нужно
    db_status = "connected" # Предполагаем, что connect_to_mongo_db уже отработал
    return web.json_response({"status": "OK", "bot_status": "polling", "database": db_status})


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

    # == УСТАНОВКА КОМАНД МЕНЮ TELEGRAM ==
    # Здесь мы устанавливаем команды, которые будут отображаться в меню бота в Telegram.
    await bot.set_my_commands([
        types.BotCommand(command="start", description="🚀 Запустить бота"),
        types.BotCommand(command="profile", description="📊 Мой профиль (статистика и ссылка)"),
        types.BotCommand(command="help", description="❓ Помощь"),
        # types.BotCommand(command="url", description="🔗 Изменить/показать ссылку"),
        # types.BotCommand(command="issue", description="💡 Предложить идею"),
        # types.BotCommand(command="lang", description="🏳️ Выбрать язык"),
    ])
    logger.info("Telegram bot commands set successfully.")

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
    Главная асинхронная функция, которая запускает бота и веб-сервер.
    """
    # Регистрируем функции запуска и остановки для диспетчера
    dp.startup.register(on_startup_polling)
    dp.shutdown.register(on_shutdown_polling)

    # Создаем aiohttp.web.Application для минимального веб-сервера
    web_app = web.Application()
    web_app.router.add_get('/', index_handler)
    web_app.router.add_get('/health', health_check_handler) # Для проверки работоспособности

    # Запускаем aiohttp веб-сервер
    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', PORT)

    logger.info(f"Starting aiohttp web server on 0.0.0.0:{PORT}...")
    await site.start()
    logger.info("aiohttp web server started.")

    # Запускаем Long Polling бота и ждем, пока веб-сервер закроется
    logger.info("Starting bot's Long Polling loop alongside web server...")
    try:
        # Запускаем обе задачи параллельно
        await asyncio.gather(
            dp.start_polling(bot), # Long Polling для Telegram
            site.wait_closed()     # Ждем закрытия веб-сервера (по сути, держит процесс живым)
        )
    except asyncio.CancelledError:
        logger.info("Application stopped by CancelledError (e.g., SIGTERM).")
    except Exception as e:
        logger.exception(f"An unexpected error occurred during application runtime: {e}")
    finally:
        # Очистка ресурсов при завершении работы
        await runner.cleanup() # Очистка ресурсов aiohttp
        logger.info("Web server and bot polling stopped, resources cleaned up.")


if __name__ == "__main__":
    asyncio.run(main())

