export default async function handler(req, res) {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    // Временный ответ без БД для теста
    return res.status(200).json({
        total_events: 42,
        daily_stats: [],
        event_stats: [
            { event_type: 'game_fish', count: 10, unique_users: 5 },
            { event_type: 'fear_detected', count: 3, unique_users: 2 }
        ],
        fear_stats: [
            { fear: 'темноты', count: 2 },
            { fear: 'врачей', count: 1 }
        ],
        active_users: [
            { user_id: 'test1', user_email: 'test@example.com', child_name: 'Соня', events_count: 15, last_active: new Date().toISOString() }
        ],
        achievement_stats: [
            { achievement: '🎤 Первый разговор', count: 5 }
        ],
        game_stats: [
            { event_type: 'game_fish', count: 10, avg_score: 15 }
        ]
    });
}
