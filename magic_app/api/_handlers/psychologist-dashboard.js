import { setCors } from '../_middleware/cors.js';
import { getQuery, requirePsychologist, redis } from '../_lib/psychologist-access.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = getQuery(req);
    const email = String(query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const access = await requirePsychologist(req, email);
    if (!access || (!access.admin && access.email !== email)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!access.user && !access.profile && !access.admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const referrals = asArray(await redis.get(`geroy:psychologist:${email}:referrals`));
    const chats = asArray(await redis.get(`geroy:psychologist:${email}:chats`));
    const bookings = asArray(await redis.get(`geroy:psychologist:${email}:bookings`));
    const reviews = asArray(await redis.get(`geroy:psychologist:${email}:reviews`));

    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 86400000);

    const bookingsThisWeek = bookings.filter((b) => {
      if (!b?.date) return false;
      const d = new Date(`${b.date}T${b.time || '00:00'}`);
      if (Number.isNaN(d.getTime())) return false;
      return d >= now && d <= weekLater;
    }).length;

    const averageRating = reviews.length
      ? (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
      : '0';

    const totalEarned = bookings
      .filter((b) => b.status === 'completed')
      .reduce((s, b) => s + (Number(b.price) || 0), 0);

    return res.status(200).json({
      email,
      name: access.name || email,
      promoCode: access.promoCode || access.profile?.promoCode || null,
      specialization: access.profile?.specialization || '',
      totalClients: referrals.length || access.profile?.clientsCount || 0,
      activeChats: chats.filter((c) => c.status === 'active').length,
      bookingsThisWeek,
      averageRating,
      totalEarned,
      recentClients: referrals.slice(-5).reverse(),
      upcomingBookings: bookings
        .filter((b) => b.status !== 'cancelled' && b.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(0, 5),
      recentReviews: reviews.slice(-5).reverse()
    });
  } catch (err) {
    console.error('psychologist-dashboard error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
