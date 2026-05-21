// api/analytics.js — Сбор аналитики
// Обновлено: 21 мая 2026
// Исправлено: импорт pg, добавлена валидация и защита от спама

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// Список допустимых типов событий (защита от мусора)
const ALLOWED_EVENT_TYPES = [
    'app_open',
    'session_end',
    'talk_start',
    'fear_detected',
    'story_generated',
    'story_night',
    'game_fish',
    'game_memory',
    'game_puzzle',
    'game_color',
    'game_emotion',
    'feed',
    'room_clean',
    'parent_page_view',
    'parent_advice_request',
    'share',
    'data_export',
    'dialogue_scored'
];

// Rate limiting (простая защита от спама)
const rateLimit = new Map();

function isRateLimited(userId, eventType) {
    const key = `${userId}_${eventType}`;
    const now = Date.now();
    const lastRequest = rateLimit.get(key);
    
    if (lastRequest && (now - lastRequest) < 1000) { // не чаще 1 раза в секунду
        return true;
    }
    
    rateLimit.set(key, now);
    // Очищаем старые записи каждые 5 минут
    setTimeout(() => rateLimit.delete(key), 300000);
    return false;
}

function validateEventData(event_type, event_data) {
    // Валидация типа события
    if (!ALLOWED_EVENT_TYPES.includes(event_type)) {
        console.warn(`Неизвестный тип события: ${event_type}`);
        return false;
    }
    
    // Валидация данных (проверка на слишком большие объекты)
    if (event_data && typeof event_data === 'object') {
        const dataStr = JSON.stringify(event_data);
        if (dataStr.length > 5000) {
            console.warn(`Слишком большие event_data: ${dataStr.length} символов`);
            return false;
        }
    }
    
    return true;
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    try {
        const { 
            event_type, 
            user_id, 
            user_email, 
            child_name, 
            child_age,
            event_data = {} 
        } = req.body;
        
        // Базовая валидация
        if (!event_type) {
            return res.status(400).json({ error: 'event_type обязателен' });
        }
        
        // Валидация типа события
        if (!validateEventData(event_type, event_data)) {
            return res.status(400).json({ error: 'Невалидный тип события или данные' });
        }
        
        // Простая защита от спама
        const rateLimitKey = user_id || 'anonymous';
        if (isRateLimited(rateLimitKey, event_type)) {
            return res.status(429).json({ error: 'Слишком много запросов' });
        }
        
        // Ограничение длины строк
        const safeUserId = user_id ? String(user_id).slice(0, 255) : null;
        const safeUserEmail = user_email ? String(user_email).slice(0, 255) : null;
        const safeChildName = child_name ? String(child_name).slice(0, 100) : null;
        const safeChildAge = child_age ? (typeof child_age === 'number' ? child_age : parseInt(child_age)) : null;
        
        // Очистка event_data от потенциально опасных полей
        const cleanEventData = {};
        if (event_data && typeof event_data === 'object') {
            const allowedFields = ['fear', 'score', 'story', 'platform', 'character', 'dialogueScore'];
            for (const field of allowedFields) {
                if (event_data[field] !== undefined) {
                    cleanEventData[field] = String(event_data[field]).slice(0, 500);
                }
            }
        }
        
        // Проверка подключения к БД
        let client;
        try {
            client = await pool.connect();
        } catch (dbError) {
            console.error('Ошибка подключения к БД:', dbError);
            // В продакшене не возвращаем ошибку клиенту, просто логируем
            return res.status(503).json({ error: 'База данных временно недоступна' });
        }
        
        try {
            // Используем параметризованный запрос с правильными колонками
            const query = `
                INSERT INTO analytics (
                    event_type, 
                    user_id, 
                    user_email, 
                    child_name, 
                    child_age,
                    event_data, 
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING id
            `;
            
            const result = await client.query(query, [
                event_type,
                safeUserId,
                safeUserEmail,
                safeChildName,
                safeChildAge,
                JSON.stringify(cleanEventData)
            ]);
            
            // Логируем только важные события в консоль (для отладки)
            if (['fear_detected', 'story_generated', 'app_open'].includes(event_type)) {
                console.log(`📊 Аналитика: ${event_type} | user: ${safeUserId?.slice(0, 20) || 'anon'} | child: ${safeChildName || 'unknown'}`);
            }
            
            res.status(200).json({ 
                success: true, 
                id: result.rows[0]?.id 
            });
            
        } catch (queryError) {
            console.error('Ошибка запроса к БД:', queryError);
            
            // Проверяем, существует ли таблица analytics
            if (queryError.code === '42P01') { // таблица не существует
                console.error('❌ Таблица analytics не существует! Выполните миграцию.');
                return res.status(500).json({ error: 'Ошибка конфигурации БД' });
            }
            
            return res.status(500).json({ error: 'Ошибка сохранения аналитики' });
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Analytics error:', error);
        // Не возвращаем ошибку клиенту, просто логируем
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
