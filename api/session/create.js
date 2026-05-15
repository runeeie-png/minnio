// POST /api/session/create
// Lager ny samtale-session. Kalles fra kjøpsflyt etter Stripe-betaling.
// Input: { profile, buyer, tier }
// Output: { id, url }

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Genererer kort, lesbar ID (8 tegn, ikke forvirrende karakterer)
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
    const { profile, buyer, tier } = req.body || {};

    // Valider input
    if (!profile || !profile.name) {
      return res.status(400).json({ error: 'Mangler profil (minst navn)' });
    }

    // Generer unik ID (sjekker mot kollisjon, selv om det er ekstremt usannsynlig)
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
        age: profile.age || '70–80 år',
        place: profile.place || '',
        keywords: profile.keywords || [],
        extra: profile.extra || ''
      },
      buyer: buyer || null,           // { name, email, phone, foreword }
      tier: tier || 'digital',         // digital | innbundet | arvepakke
      conversation: [],
      messageCount: 0,
      status: 'created',               // created | in_progress | completed | shipped
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };

    // Lagre med 90 dagers TTL (sletter automatisk etter 3 mnd hvis ikke fullført)
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
