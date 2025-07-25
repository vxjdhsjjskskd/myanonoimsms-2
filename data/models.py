import os
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import uuid # Для генерации уникальных кодов

logging.basicConfig(level=logging.INFO)

# Инициализация клиента MongoDB
# URI подключения будет браться из переменной окружения MONGO_URI
# Пример: mongodb+srv://user:password@cluster.mongodb.net/
client: AsyncIOMotorClient = None # Будет инициализирован в async_main

# Название базы данных и коллекции
DATABASE_NAME = "anon_bot_db" # Можно изменить на любое другое имя для вашей БД
USERS_COLLECTION = "users"

async def async_main():
    """
    Инициализирует подключение к MongoDB Atlas.
    """
    global client
    mongo_uri = os.getenv("MONGO_URI")

    if not mongo_uri:
        logging.error("MONGO_URI environment variable is not set!")
        raise ValueError("MONGO_URI environment variable is not set.")

    try:
        client = AsyncIOMotorClient(mongo_uri)
        # Проверяем подключение, выполнив простую операцию
        await client.admin.command('ping')
        logging.info("Successfully connected to MongoDB Atlas!")
    except Exception as e:
        logging.error(f"Could not connect to MongoDB Atlas: {e}")
        raise

async def close_mongo_connection():
    """
    Закрывает подключение к MongoDB.
    """
    global client
    if client:
        client.close()
        logging.info("MongoDB connection closed.")


def get_db():
    """
    Возвращает объект базы данных.
    """
    if client is None:
        raise RuntimeError("MongoDB client is not initialized. Call async_main() first.")
    return client[DATABASE_NAME]

def get_users_collection():
    """
    Возвращает коллекцию пользователей.
    """
    return get_db()[USERS_COLLECTION]


# --- Вспомогательные функции для работы с данными ---

async def generate_unique_code():
    """
    Генерирует уникальный 6-символьный код для пользователя.
    """
    while True:
        # Генерируем случайный UUID и берем первые 6 символов, переводим в верхний регистр
        code = str(uuid.uuid4().hex)[:6].upper()
        # Проверяем, существует ли уже такой код в базе
        user = await get_users_collection().find_one({"code": code})
        if not user:
            return code

async def get_user_data(tg_id: int):
    """
    Получает данные пользователя по его Telegram ID.
    """
    return await get_users_collection().find_one({"tg_id": tg_id})

async def get_user_by_code(code: str):
    """
    Получает Telegram ID пользователя по его анонимному коду.
    """
    user = await get_users_collection().find_one({"code": code})
    return user["tg_id"] if user else None

async def add_user(tg_id: int):
    """
    Добавляет нового пользователя, если его нет, и возвращает его анонимный код.
    """
    users_collection = get_users_collection()
    user_data = await users_collection.find_one({"tg_id": tg_id})

    if not user_data:
        new_code = await generate_unique_code()
        user_doc = {
            "tg_id": tg_id,
            "message_count": 0, # Отправленные сообщения
            "message_get": 0,   # Полученные сообщения
            "code": new_code
        }
        await users_collection.insert_one(user_doc)
        logging.info(f"New user {tg_id} added with code {new_code}")
        return new_code
    else:
        return user_data["code"] # Возвращаем существующий код

async def increment_message_count(tg_id: int):
    """
    Увеличивает счетчик отправленных сообщений для пользователя.
    """
    await get_users_collection().update_one(
        {"tg_id": tg_id},
        {"$inc": {"message_count": 1}}
    )

async def increment_message_get(tg_id: int):
    """
    Увеличивает счетчик полученных сообщений для пользователя.
    """
    await get_users_collection().update_one(
        {"tg_id": tg_id},
        {"$inc": {"message_get": 1}}
    )
