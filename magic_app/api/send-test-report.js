// api/send-test-report.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    // В реальной жизни здесь будет запрос в БД за списком пользователей
    // Пока для теста на мамах мы отправим письмо СЕБЕ или одной тестовой маме
    
    const testEmail = "alexmel669@gmail.com"; // Потом заменим на список мам
    
    try {
        const { data, error } = await resend.emails.send({
            from: 'Люцик из Героя Сказок <lucik@geroy-skazki.ru>',
            to: [testEmail],
            subject: '🐱 Ваш ребенок стал храбрее! (отчет от Люцика)',
            html: `
                <div style="font-family: Arial; max-width: 600px;">
                    <h2>Мур-мур, дорогая мама! 😺</h2>
                    <p>Это я, кот Люцик. Мы с <strong>[Имя ребенка]</strong> отлично провели время сегодня.</p>
                    <p>📖 Мы придумали <strong>2 сказки</strong>.<br>
                    🛡️ Главный страх, с которым мы боролись сегодня — <strong>Темнота</strong>.</p>
                    <p>Мой совет на вечер: <em>«Перед сном скажите [Имя], что у него в комнате спрятан волшебный фонарик храбрости. Это очень помогает!»</em></p>
                    <hr>
                    <a href="https://geroy-skazki.vercel.app/parent.html" style="background: #FFA500; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📊 Посмотреть полный отчет</a>
                    <p style="color: gray; font-size: 12px; margin-top: 20px;">P.S. Завтра жду вас снова! Вечером у нас будет новая сказка на ночь 🌙</p>
                </div>
            `,
        });

        if (error) {
            return res.status(400).json({ error });
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
