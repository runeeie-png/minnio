// GET  /api/session/[id]  - hente eksisterende samtale
// POST /api/session/[id]  - oppdatere samtale med ny tilstand

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || typeof id !== 'string' || id.length < 4 || id.length > 32) {
    return res.status(400).json({ error: 'Ugyldig samtale-ID' });
  }

  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    return res.status(500).json({
      error: 'Database ikke konfigurert. Upstash Redis må installeres via Vercel Marketplace.'
    });
  }

  const key = `session:${id}`;

  // ─── GET ───
  if (req.method === 'GET') {
    try {
      const raw = await redis.get(key);
      if (!raw) {
        return res.status(404).json({ error: 'Samtalen ble ikke funnet. Lenken kan være utløpt.' });
      }
      const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json(session);
    } catch (err) {
      console.error('Session GET feil:', err);
      return res.status(500).json({ error: 'Kunne ikke hente samtale: ' + err.message });
    }
  }

  // ─── POST ───
  if (req.method === 'POST') {
    try {
      const updates = req.body || {};

      const raw = await redis.get(key);
      if (!raw) {
        return res.status(404).json({ error: 'Samtalen finnes ikke' });
      }
      const existing = typeof raw === 'string' ? JSON.parse(raw) : raw;

      const session = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

      if (updates.status === 'completed' && !existing.completedAt) {
        session.completedAt = new Date().toISOString();
      }

      // Fullførte samtaler: 1 år. Ellers: 90 dager.
      const ttlSeconds = session.status === 'completed'
        ? 60 * 60 * 24 * 365
        : 60 * 60 * 24 * 90;

      await redis.set(key, JSON.stringify(session), { ex: ttlSeconds });

      return res.status(200).json({ ok: true, updatedAt: session.updatedAt });

    } catch (err) {
      console.error('Session POST feil:', err);
      return res.status(500).json({ error: 'Kunne ikke lagre samtale: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Bruk GET eller POST' });
}
