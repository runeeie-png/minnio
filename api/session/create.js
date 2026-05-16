// POST /api/session/create – lager ny samtale

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

function generateId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  try {
    if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
      return res.status(500).json({
        error: 'Mangler Redis-konfigurasjon. Sett KV_REST_API_URL i Vercel.'
      });
    }

    const { profile, buyer, tier } = req.body || {};

    if (!profile || !profile.name) {
      return res.status(400).json({ error: 'Mangler profil (minst navn)' });
    }

    const id = generateId();
    const now = new Date().toISOString();
    const session = {
      id,
      profile: {
        name: profile.name,
        gender: profile.gender || 'kvinne',
        age: profile.age || '70–80 år',
        place: profile.place || '',
        keywords: profile.keywords || [],
        extra: profile.extra || ''
      },
      buyer: buyer || null,
      tier: tier || 'digital',
      conversation: [],
      messageCount: 0,
      status: 'created',
      createdAt: now,
      updatedAt: now
    };

    // TTL: 90 dager
    await redis.set(`session:${id}`, JSON.stringify(session), { ex: 60 * 60 * 24 * 90 });

    // Bygg lenken fra det FAKTISKE domenet forespørselen kom fra.
    // Dette gjør at lenken alltid er riktig – uansett hvilket domene
    // appen kjøres på (minnio.app, vercel-preview, osv.).
    // Kan aldri bli en skrivefeil.
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'minnio.app';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const fullUrl = `${proto}://${host}/s/${id}`;

    return res.status(200).json({
      success: true,
      id,
      url: `/s/${id}`,
      fullUrl
    });

  } catch (err) {
    console.error('Create session feil:', err);
    return res.status(500).json({ error: 'Kunne ikke lage samtale: ' + err.message });
  }
}
