# Импортируем функции для работы с базой данных из нашего нового data/models.py
from .models import add_user, get_user_by_code, get_user_data, increment_message_count, increment_message_get
import logging # Добавим логирование для отслеживания ошибок

logging.basicConfig(level=logging.INFO)

async def set_user(tg_id: int):
    """
    Добавляет пользователя в базу данных, если его еще нет.
    Возвращает анонимный код пользователя.
    """
    try:
        code = await add_user(tg_id)
        return code
    except Exception as e:
        logging.error(f"Error setting user {tg_id}: {e}")
        # В зависимости от требований, можно перевыбросить ошибку или вернуть None
        raise

async def get_code(tg_id: int):
    """
    Получает анонимный код пользователя по его Telegram ID.
    """
    try:
        user_data = await get_user_data(tg_id)
        if user_data:
            return user_data.get("code")
        else:
            # Если пользователя нет, возможно, его нужно добавить
            # Или это означает, что get_code вызывается до set_user
            logging.warning(f"User {tg_id} not found when trying to get code.")
            return None
    except Exception as e:
        logging.error(f"Error getting code for user {tg_id}: {e}")
        raise

async def get_user(code: str):
    """
    Получает Telegram ID пользователя по его анонимному коду.
    """
    try:
        user_tg_id = await get_user_by_code(code)
        if user_tg_id is None:
            logging.warning(f"User with code {code} not found.")
            # Вместо ValueError, лучше возвращать None и обрабатывать в вызывающем коде
            return None
        return user_tg_id
    except Exception as e:
        logging.error(f"Error getting user by code {code}: {e}")
        raise

async def get_messages(tg_id: int):
    """
    Получает количество отправленных и полученных сообщений для пользователя.
    """
    try:
        user_data = await get_user_data(tg_id)
        if user_data:
            count = user_data.get("message_count", 0) # По умолчанию 0, если поля нет
            get = user_data.get("message_get", 0)
            return count, get
        else:
            logging.warning(f"User {tg_id} not found when trying to get message stats.")
            return 0, 0 # Возвращаем нули, если пользователь не найден
    except Exception as e:
        logging.error(f"Error getting messages stats for user {tg_id}: {e}")
        raise
    
async def add_messages_count(sender_id: int, receiver_id: int):
    """
    Увеличивает счетчик отправленных сообщений для отправителя
    и счетчик полученных сообщений для получателя.
    """
    try:
        await increment_message_count(sender_id)
        await increment_message_get(receiver_id)
        logging.info(f"Message count updated: sender {sender_id} increased, receiver {receiver_id} increased.")
    except Exception as e:
        logging.error(f"Error updating message counts for sender {sender_id} and receiver {receiver_id}: {e}")
        raise
