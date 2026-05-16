// /api/session/[id] – hent eller oppdater samtale

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Mangler ID' });
  }

  try {
    if (req.method === 'GET') {
      const raw = await redis.get(`session:${id}`);
      if (!raw) {
        return res.status(404).json({ error: 'Samtale ikke funnet' });
      }
      const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json(session);
    }

    if (req.method === 'POST') {
      const raw = await redis.get(`session:${id}`);
      if (!raw) {
        return res.status(404).json({ error: 'Samtale ikke funnet' });
      }
      const session = typeof raw === 'string' ? JSON.parse(raw) : raw;

      // Oppdater felter
      const updates = req.body || {};
      if (updates.conversation) session.conversation = updates.conversation;
      if (updates.messageCount !== undefined) session.messageCount = updates.messageCount;
      if (updates.status) session.status = updates.status;
      session.updatedAt = new Date().toISOString();

      const ttl = session.status === 'completed' ? 60 * 60 * 24 * 365 : 60 * 60 * 24 * 90;
      await redis.set(`session:${id}`, JSON.stringify(session), { ex: ttl });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Bruk GET eller POST' });

  } catch (err) {
    console.error('Session API feil:', err);
    return res.status(500).json({ error: err.message });
  }
}
