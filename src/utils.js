// src/utils.js - Утилиты для бота

const { getAnonLinkMap } = require('./database');

/**
 * Генерирует случайный анонимный ID
 */
function generateAnonymousId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Генерирует уникальный код для ссылки
 */
function generateLinkCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Проверяем уникальность
    const anonLinkMap = getAnonLinkMap();
    if (anonLinkMap[result.toUpperCase()]) {
        return generateLinkCode();
    }

    return result;
}

module.exports = {
    generateAnonymousId,
    generateLinkCode
};
