// POST /api/session/create
// Lager ny samtale-session.

import { Redis } from '@upstash/redis';

// Vercel Marketplace bruker KV_REST_API_*-prefix når Upstash installeres via dem.
// Direkte Upstash bruker UPSTASH_REDIS_REST_*. Vi støtter begge.
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

  // Sjekk at miljøvariabler faktisk er satt
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    return res.status(500).json({
      error: 'Database ikke konfigurert. Upstash Redis må installeres via Vercel Marketplace, og prosjektet må redeployes etterpå.'
    });
  }

  try {
    const { profile, buyer, tier } = req.body || {};

    if (!profile || !profile.name) {
      return res.status(400).json({ error: 'Mangler profil (minst navn)' });
    }

    let id;
    let attempts = 0;
    while (attempts < 5) {
      id = generateId();
      const exists = await redis.exists(`session:${id}`);
      if (!exists) break;
      attempts++;
    }

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
      updatedAt: now,
      completedAt: null
    };

    // 90 dagers TTL for nye samtaler
    await redis.set(`session:${id}`, JSON.stringify(session), { ex: 60 * 60 * 24 * 90 });

    return res.status(200).json({
      id,
      url: `/s/${id}`,
      fullUrl: `https://minnio.app/s/${id}`
    });

  } catch (err) {
    console.error('Session create feil:', err);
    return res.status(500).json({ error: 'Kunne ikke lage samtale: ' + err.message });
  }
}
