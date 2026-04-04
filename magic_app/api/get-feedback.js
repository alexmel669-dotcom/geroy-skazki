// api/get-feedback.js — временная заглушка
export default async function handler(req, res) {
    res.status(200).json({
        feedback: [],
        stats: {
            total: 0,
            avgRating: "0.0",
            avgAge: "0.0",
            topFear: "—"
        }
    });
}
