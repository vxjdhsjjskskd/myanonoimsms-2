from aiogram.fsm.context import FSMContext
from aiogram import types, F, Router, Bot # Bot здесь не нужен, если используется message.bot
from .commands import Send # Импортируем состояния из commands
from .key import cancel, send_again # Импортируем клавиатуры
from data.requests import add_messages_count # Импортируем функцию для добавления счетчика сообщений


rt = Router() # Создаем роутер для хэндлеров


@rt.message(F.text, Send.code)
async def send_code(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    # Получаем объект бота через message.bot
    current_bot = message.bot 
    code = await state.get_data()
    user_id = code["user"]

    base = "✉️ *Пришло новое сообщение!*\n\n"
    try:
        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        await current_bot.send_message(user_id, text=base + message.text, parse_mode="Markdown")
        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()
    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())


@rt.message(F.photo, Send.code)
async def send_photo(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    current_bot = message.bot
    code = await state.get_data()
    user_id = code["user"]

    base = "✉️ *Пришло новое сообщение!*\n\n"

    try:
        text = base + str(message.caption if message.caption else "")

        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        await current_bot.send_photo(user_id, photo=message.photo[-1].file_id, caption=text, parse_mode="Markdown")
        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()
    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())


@rt.message(F.video, Send.code)
async def send_video(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    current_bot = message.bot
    code = await state.get_data()
    user_id = code["user"]

    base = "*✉️ Пришло новое сообщение!*\n\n"

    try:
        text = base + str(message.caption if message.caption else "")

        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        await current_bot.send_video(user_id, video=message.video.file_id, caption=text, parse_mode="Markdown")
        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()

    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())
        # Обратите внимание: у вас было две строки message.answer в конце этого блока,
        # одна из которых была без parse_mode. Я оставил только одну, с parse_mode.
        # await message.answer("⚠️❌ Произошла ошибка: " + str(e) + "\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).")


@rt.message(F.document, Send.code)
async def send_document(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    current_bot = message.bot
    code = await state.get_data()
    user_id = code["user"]

    base = "*✉️ Пришло новое сообщение!*\n\n"

    try:
        text = base + str(message.caption if message.caption else "")

        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        await current_bot.send_document(user_id, document=message.document.file_id, caption=text, parse_mode="Markdown")
        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()

    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())


@rt.message(F.audio, Send.code)
async def send_audio(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    current_bot = message.bot
    code = await state.get_data()
    user_id = code["user"]

    base = "*✉️ Пришло новое сообщение!*\n\n"

    try:
        text = base + str(message.caption if message.caption else "")

        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        await current_bot.send_audio(user_id, audio=message.audio.file_id, caption=text, parse_mode="Markdown")
        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()

    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())


@rt.message(F.voice, Send.code)
async def send_voice(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    current_bot = message.bot
    code = await state.get_data()
    user_id = code["user"]

    base = "*✉️ Пришло новое сообщение!*\n\n"

    try:
        text = base + str(message.caption if message.caption else "")

        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        await current_bot.send_voice(user_id, voice=message.voice.file_id, caption=text, parse_mode="Markdown")
        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()

    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())


@rt.message(F.video_note, Send.code)
async def send_video_note(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    current_bot = message.bot
    code = await state.get_data()
    user_id = code["user"]

    base = "*✉️ Пришло новое сообщение!*\n\n"

    try:
        text = base + str(message.caption if message.caption else "")

        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        # Для video_note обычно не требуется text в send_message,
        # а send_video_note не имеет аргумента text.
        # Если вы хотите отправить текст отдельно, то send_message,
        # если текст это caption для video_note, то caption.
        # Я предполагаю, что text это caption для video_note.
        await current_bot.send_video_note(user_id, video_note=message.video_note.file_id)
        # Если caption нужен, то:
        if text and text != base: # Проверяем, есть ли реальный текст помимо базового
             await current_bot.send_message(user_id, text=text, parse_mode="Markdown")

        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()

    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())


@rt.message(F.sticker, Send.code)
async def send_sticker(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    current_bot = message.bot
    code = await state.get_data()
    user_id = code["user"]

    base = "*✉️ Пришло новое сообщение!*\n\n"

    try:
        text = base + str(message.caption if message.caption else "")

        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        # Стикерам обычно не нужен text в send_message,
        # а send_sticker не имеет аргумента text.
        # Если вы хотите отправить текст отдельно, то send_message.
        if text and text != base: # Проверяем, есть ли реальный текст помимо базового
             await current_bot.send_message(user_id, text=text, parse_mode="Markdown")
        await current_bot.send_sticker(user_id, sticker=message.sticker.file_id)
        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()

    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())
        

@rt.message(F.poll, Send.code)
async def send_poll(message: types.Message, state: FSMContext): # Убрали 'bot: Bot'
    current_bot = message.bot
    code = await state.get_data()
    user_id = code["user"]

    base = "*✉️ Пришло новое сообщение!*\n\n"

    question = message.poll.question
    options_obj = message.poll.options

    options = []
    for option in options_obj:
        options.append(option.text)

    try:
        await add_messages_count(sender_id=message.from_user.id, receiver_id=user_id)

        # Для опросов base текст можно отправить отдельно, а затем сам опрос
        if base and base != "":
            await current_bot.send_message(user_id, text=base, parse_mode="Markdown")
        
        await current_bot.send_poll(user_id, question=str(question), options=options, is_anonymous=message.poll.is_anonymous, type=message.poll.type, allows_multiple_answers=message.poll.allows_multiple_answers)
        await message.answer(f"✅ Сообщение отправлено!", reply_markup=send_again(user_id=user_id))
        
        await state.clear()

    except Exception as e:
        await message.answer("⚠️❌ Произошла ошибка: `" + str(e) + "`\n\nПопробуйте ещё раз или напишите администратору (@ArtizSQ или @RegaaTG).", parse_mode="Markdown", reply_markup=cancel())


@rt.callback_query(F.data == "cancel")
async def cancel_button(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer("Действие отменено!")
    await callback.message.delete()
    await state.clear()


@rt.callback_query(F.data.startswith("again_"))
async def send_again_button(callback: types.CallbackQuery, state: FSMContext):
    user_id = callback.data.split("_")[1]
    await state.update_data({"user": user_id})
    await callback.message.edit_text("👉 Введите сообщение, которое хотите отправить.\n\n🤖 Бот поддерживает следующие типы сообщений: `Текст, фото, видео, голосовые сообщения, видеосообщения, стикеры, документы, GIF.`", reply_markup=cancel(), parse_mode="Markdown")
    await state.set_state(Send.code)
    
