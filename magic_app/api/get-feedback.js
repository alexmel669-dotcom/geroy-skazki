export default async function handler(req, res) {
    res.status(200).json({ 
        message: 'API работает, база не подключена',
        hasPostgresUrl: !!process.env.POSTGRES_URL
    });
}
