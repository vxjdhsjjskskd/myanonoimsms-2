// Подключаем библиотеку для работы с Telegram API
const TelegramBot = require('node-telegram-bot-api');

// Получаем токен бота и ID админа из переменных окружения
// Это лучший способ для деплоя на Render/Heroku
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

// Проверяем, что переменные заданы
if (!TOKEN || !ADMIN_ID) {
  console.error('Ошибка: Не заданы переменные окружения BOT_TOKEN или ADMIN_ID!');
  process.exit(1);
}

// Создаем экземпляр бота
const bot = new TelegramBot(TOKEN, { polling: true });

// Этот объект будет хранить, кому сейчас отвечает админ
const adminReplyState = {};

console.log('Бот успешно запущен...');
console.log(`ID администратора: ${ADMIN_ID}`);


// --- ОБРАБОТКА СООБЩЕНИЙ ОТ ПОЛЬЗОВАТЕЛЕЙ ---

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const userId = msg.from.id;
  const userName = msg.from.first_name || '';
  const userLastName = msg.from.last_name || '';
  const userUsername = msg.from.username ? `@${msg.from.username}` : '(нет)';

  // Если сообщение от админа, обрабатываем его как ответ
  if (String(userId) === String(ADMIN_ID)) {
    // Проверяем, есть ли активный диалог для ответа
    if (adminReplyState[ADMIN_ID]) {
      const targetUserId = adminReplyState[ADMIN_ID];
      
      // Отправляем сообщение пользователя от имени бота (анонимно для пользователя)
      bot.copyMessage(targetUserId, ADMIN_ID, messageId).then(() => {
        bot.sendMessage(ADMIN_ID, `✅ Ответ успешно отправлен пользователю ${targetUserId}.`);
      }).catch(error => {
        console.error('Ошибка при отправке ответа:', error);
        bot.sendMessage(ADMIN_ID, `❌ Не удалось отправить ответ. Возможно, пользователь заблокировал бота.`);
      });

      // Очищаем состояние ответа
      delete adminReplyState[ADMIN_ID];
    }
    return; // Не пересылаем сообщения админа самому себе
  }

  // --- ПЕРЕСЫЛКА СООБЩЕНИЯ АДМИНУ ---

  // Формируем подпись к сообщению
  const caption = `
Новое сообщение!
<b>От:</b> ${userName} ${userLastName}
<b>Username:</b> ${userUsername}
<b>ID:</b> <code>${userId}</code>
  `;

  // Создаем инлайн-кнопку "Ответить"
  const options = {
    // 'parse_mode' позволяет использовать HTML-теги в тексте
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Ответить пользователю',
            // В callback_data зашиваем ID пользователя, чтобы знать, кому отвечать
            callback_data: `reply_to:${userId}`
          }
        ]
      ]
    }
  };
  
  // Пересылаем копию сообщения (любого типа) админу с подписью и кнопкой
  bot.forwardMessage(ADMIN_ID, chatId, messageId).then(() => {
    bot.sendMessage(ADMIN_ID, caption, options);
  }).catch(error => {
     console.error('Ошибка при пересылке:', error);
     bot.sendMessage(chatId, 'Извините, произошла техническая ошибка. Мы уже работаем над этим.');
  });
  
  // Уведомляем пользователя, что его сообщение доставлено
  bot.sendMessage(chatId, 'Спасибо! Ваше сообщение доставлено администратору. Ожидайте ответа.');
});


// --- ОБРАБОТКА НАЖАТИЯ НА ИНЛАЙН-КНОПКУ ---

bot.on('callback_query', (callbackQuery) => {
  const data = callbackQuery.data;
  const adminId = callbackQuery.from.id;

  if (String(adminId) !== String(ADMIN_ID)) return; // Реагируем только на нажатия админа

  // Проверяем, что это запрос на ответ
  if (data.startsWith('reply_to:')) {
    const userIdToReply = data.split(':')[1];
    
    // Сохраняем, какому пользователю админ собирается ответить
    adminReplyState[ADMIN_ID] = userIdToReply;

    // Сообщаем админу, что бот ждет его следующее сообщение
    bot.sendMessage(ADMIN_ID, `👇 Теперь просто отправьте мне сообщение (текст, фото, стикер, что угодно), и я перешлю его пользователю с ID: <code>${userIdToReply}</code>.`, {parse_mode: 'HTML'});
    
    // Отвечаем на callback, чтобы убрать "часики" на кнопке
    bot.answerCallbackQuery(callbackQuery.id);
  }
});
