// api/session-archive.js
// Arkiverer eller gjenoppretter en samtale.
// Arkivering sletter ingenting – setter bare et flagg så samtalen
// skjules fra hovedlisten. Kan alltid hentes tilbake.

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  // Beskytt med admin-nøkkel
  const adminKey = process.env.MINNIO_ADMIN_KEY || 'minnio2026';
  const provided = req.query.key || req.headers['x-admin-key'] || req.body?.key;
  if (provided !== adminKey) {
    return res.status(401).json({ error: 'Ugyldig admin-nøkkel' });
  }

  try {
    const { sessionId, archived } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'Mangler sessionId' });
    }

    const raw = await redis.get(`session:${sessionId}`);
    if (!raw) {
      return res.status(404).json({ error: 'Samtale ikke funnet' });
    }

    const session = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Sett eller fjern arkiv-flagget. Ingenting slettes.
    session.archived = archived === true;
    session.updatedAt = new Date().toISOString();

    // Behold TTL-logikken
    const ttl = session.status === 'completed'
      ? 60 * 60 * 24 * 365
      : 60 * 60 * 24 * 90;
    await redis.set(`session:${sessionId}`, JSON.stringify(session), { ex: ttl });

    return res.status(200).json({
      success: true,
      archived: session.archived
    });

  } catch (err) {
    console.error('Archive feil:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
