// api/sessions-overview.js
// Lister alle samtaler med bok-status for admin-dashbordet.
// Beskyttet med et enkelt passord (MINNIO_ADMIN_KEY).

import { Redis } from '@upstash/redis';
import { bookSummary } from './_chapters.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Enkel beskyttelse: krev admin-nøkkel
  const adminKey = process.env.MINNIO_ADMIN_KEY || 'minnio2026';
  const provided = req.query.key || req.headers['x-admin-key'];

  if (provided !== adminKey) {
    return res.status(401).json({ error: 'Ugyldig admin-nøkkel' });
  }

  try {
    // Hent alle session-nøkler
    const keys = await redis.keys('session:*');
    const sessions = [];

    for (const key of keys) {
      try {
        const raw = await redis.get(key);
        if (!raw) continue;
        const s = typeof raw === 'string' ? JSON.parse(raw) : raw;

        const summary = bookSummary(s.bookState);

        sessions.push({
          id: s.id,
          name: s.profile?.name || 'Ukjent',
          buyer: s.buyer?.name || '',
          tier: s.tier || 'digital',
          status: s.status || 'created',
          archived: s.archived === true,
          messageCount: s.messageCount || 0,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          book: summary
        });
      } catch (e) {
        console.warn('Kunne ikke lese session:', key, e.message);
      }
    }

    // Sorter nyeste først
    sessions.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    return res.status(200).json({ sessions, count: sessions.length });

  } catch (err) {
    console.error('Sessions-overview feil:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
