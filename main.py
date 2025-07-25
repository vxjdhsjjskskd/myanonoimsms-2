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
    # Важно: если переменная не установлена, скрипт завершится,
    # что предотвратит дальнейшие ошибки и покажет проблему в логах Render.
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
# ParseMode.HTML установлен по умолчанию для удобства
bot = Bot(token=bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# == РЕГИСТРАЦИЯ РОУТЕРОВ ==
# Включаем роутеры из ваших модулей commands и handlers.
# Убедитесь, что в commands.py и handlers.py у вас созданы объекты Router,
# например: rt = Router()
dp.include_routers(commands.rt, handlers.rt)

# == ФУНКЦИИ ЗАПУСКА И ОСТАНОВКИ ==

async def on_startup(dispatcher: Dispatcher):
    """
    Функция, выполняемая при запуске бота.
    Здесь устанавливается вебхук и происходит подключение к БД.
    """
    logger.info("Starting bot and setting webhook...")
    
    # Подключение к MongoDB Atlas
    try:
        logger.info("Connecting to MongoDB Atlas...")
        # Вызываем вашу функцию для подключения к базе данных.
        # Если ваша функция 'async_main' (которую мы переименовали в 'connect_to_mongo_db')
        # не отвечает за подключение к БД, или если у вас другая функция,
        # замените вызов 'await connect_to_mongo_db()' на вашу реальную функцию.
        await connect_to_mongo_db() 
        logger.info("Successfully connected to MongoDB Atlas!")
    except Exception as e:
        logger.exception(f"Failed to connect to MongoDB Atlas: {e}")
        # Если подключение к БД критично, можете выбросить исключение, чтобы остановить деплой.
        # Иначе, бот запустится, но без доступа к БД.
        raise # Если критично, чтобы бот не работал без БД

    # Устанавливаем вебхук на Telegram API
    # 'drop_pending_updates=True' удаляет все обновления, которые Telegram
    # накопил, пока бот был оффлайн. Это полезно при первом запуске или после сбоев.
    await bot.set_webhook(WEBHOOK_URL, drop_pending_updates=True)
    logger.info(f"Webhook set successfully to: {WEBHOOK_URL}")


async def on_shutdown(dispatcher: Dispatcher):
    """
    Функция, выполняемая при остановке бота.
    Здесь удаляется вебхук и закрывается сессия бота.
    """
    logger.info("Shutting down bot and deleting webhook...")
    # Удаляем вебхук, чтобы Telegram перестал отправлять обновления на этот URL
    await bot.delete_webhook()
    # Закрываем сессию бота
    await bot.session.close()
    logger.info("Webhook deleted and bot session closed.")


# == ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА ==

async def main():
    """
    Главная асинхронная функция, которая запускает бота как веб-сервис.
    """
    # Регистрируем функции запуска и остановки в диспетчере
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Создаем веб-приложение aiohttp для обработки входящих вебхуков
    web_app = web.Application()
    # Привязываем хэндлер обновлений aiogram к нашему пути вебхука.
    # Это ключевая строка для aiogram 3.x
    web_app.router.add_post(WEBHOOK_PATH, dp.update_handler)

    # Запускаем веб-сервер
    runner = web.AppRunner(web_app)
    await runner.setup()
    # '0.0.0.0' означает, что сервер будет слушать на всех доступных сетевых интерфейсах.
    # Это обязательно для работы на хостингах типа Render.
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
        # Убедимся, что ресурсы веб-сервера корректно очищены при завершении работы
        await runner.cleanup()
        logger.info("Web server stopped.")


if __name__ == "__main__":
    # Запускаем главную асинхронную функцию
    asyncio.run(main())
