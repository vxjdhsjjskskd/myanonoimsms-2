"""
Файл с главной функцией запуска бота (async def main)

"""

from aiogram import Bot, Dispatcher
import asyncio
import logging
import os # Импортируем модуль os для работы с переменными окружения

# Предполагается, что эти модули будут в папке tg_bot
from tg_bot import commands, handlers

# Предполагается, что async_main из data.models отвечает за инициализацию БД
# Мы пока оставим его, но позже заменим на логику MongoDB
from data.models import async_main 

logging.basicConfig(level=logging.INFO)

async def main():
    # Получаем токен бота из переменной окружения BOT_TOKEN
    # Если переменная не установлена, будет вызвана ошибка, что хорошо для отладки
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        logging.error("BOT_TOKEN environment variable is not set!")
        raise ValueError("BOT_TOKEN environment variable is not set.")

    bot = Bot(token=bot_token)
    dp = Dispatcher()

    dp.include_routers(commands.rt, handlers.rt)
    
    # Эту часть await async_main() мы будем менять, когда перейдем к MongoDB
    await async_main() 

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
