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

# == ОБРАБОТЧИК WEBHOOK (САМЫЙ БАЗОВЫЙ) ==
async def handle_webhook_request(request: web.Request):
    """
    Обрабатывает входящие POST-запросы от Telegram.
    Это низкоуровневый обработчик, который передает сырые данные в диспетчер.
    """
    if str(request.url).endswith(WEBHOOK_PATH):
        try:
            # Получаем сырые JSON-данные из тела запроса
            update_data = await request.json()
            
            # Передаем сырые данные в диспетчер aiogram для обработки
            # Диспетчер сам десериализует их в объект Update и вызывает хэндлеры
            await dp.feed_raw_update(update_data)
            
            return web.Response(status=200) # Telegram ожидает 200 OK
        except Exception as e:
            logger.exception(f"Error processing webhook update: {e}")
            return web.Response(status=500) # Возвращаем 500 в случае ошибки
    else:
        logger.warning(f"Received request on unexpected path: {request.url}")
        return web.Response(status=404) # Неправильный путь вебхука


# == ФУНКЦИИ ЗАПУСКА И ОСТАНОВКИ AIOHTTP ПРИЛОЖЕНИЯ ==

async def on_startup_app(app: web.Application):
    """
    Функция, выполняемая при запуске aiohttp приложения.
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
        # Если подключение к БД критично, можно прервать запуск
        raise

    # Устанавливаем вебхук на Telegram API
    # drop_pending_updates=True очищает все накопившиеся обновления
    await bot.set_webhook(WEBHOOK_URL, drop_pending_updates=True)
    logger.info(f"Webhook set successfully to: {WEBHOOK_URL}")


async def on_shutdown_app(app: web.Application):
    """
    Функция, выполняемая при остановке aiohttp приложения.
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
    # Создаем aiohttp.web.Application
    web_app = web.Application()

    # Добавляем маршрут для обработки вебхуков
    web_app.router.add_post(WEBHOOK_PATH, handle_webhook_request)

    # Регистрируем функции запуска и остановки для aiohttp приложения
    web_app.on_startup.append(on_startup_app)
    web_app.on_shutdown.append(on_shutdown_app)

    logger.info(f"Starting web server for webhook on port {PORT}...")
    
    # Запускаем aiohttp веб-сервер
    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', PORT)
    await site.start()

    logger.info(f"Web server started on 0.0.0.0:{PORT}. Keeping process alive...")

    # Этот Future будет использоваться для поддержания работы event loop.
    # Он никогда не будет разрешен, пока процесс не будет остановлен извне (например, Render).
    # Это гарантирует, что main() не завершится преждевременно.
    try:
        await asyncio.Future() # Блокируем main() навсегда
    except asyncio.CancelledError:
        logger.info("Application stopped by CancelledError (e.g., SIGTERM).")
    except Exception as e:
        logger.exception(f"An unexpected error occurred in main loop: {e}")
    finally:
        # Очистка ресурсов при завершении работы
        await runner.cleanup()
        logger.info("Web server stopped and resources cleaned up.")


if __name__ == "__main__":
    asyncio.run(main())

