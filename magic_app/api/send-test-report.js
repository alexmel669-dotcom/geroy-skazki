// api/send-test-report.js
export default async function handler(req, res) {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ 
            error: 'RESEND_API_KEY не найден' 
        });
    }

    try {
        const { Resend } = await import('resend');
        const resend = new Resend(apiKey);
        
        const { data, error } = await resend.emails.send({
            from: 'Люцик из Героя Сказок <onboarding@resend.dev>', // ✅ Фикс
            to: ['alexmel669@gmail.com'],
            subject: '🐱 Мур! Тестовое письмо от Люцика!',
            html: `
                <h1>🐱 Привет, это Люцик!</h1>
                <p>Письмо успешно отправлено через Resend API.</p>
                <p>✅ Всё работает!</p>
            `,
        });

        if (error) {
            console.error('Resend error:', error);
            return res.status(400).json({ error: 'Resend API Error', details: error });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Письмо отправлено на alexmel669@gmail.com',
            emailId: data?.id 
        });
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
