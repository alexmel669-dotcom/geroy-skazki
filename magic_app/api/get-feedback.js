import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    try {
        const result = await sql`
            SELECT * FROM feedback 
            ORDER BY created_at DESC
        `;
        
        const statsQuery = await sql`
            SELECT 
                COUNT(*) as total,
                AVG(rating) as avg_rating,
                AVG(child_age) as avg_age,
                (SELECT fear FROM feedback GROUP BY fear ORDER BY COUNT(*) DESC LIMIT 1) as top_fear
            FROM feedback
        `;
        
        res.status(200).json({
            feedback: result.rows,
            stats: {
                total: statsQuery.rows[0]?.total || 0,
                avgRating: (statsQuery.rows[0]?.avg_rating || 0).toFixed(1),
                avgAge: (statsQuery.rows[0]?.avg_age || 0).toFixed(1),
                topFear: statsQuery.rows[0]?.top_fear || '—'
            }
        });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: error.message });
    }
}
