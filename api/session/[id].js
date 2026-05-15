// GET  /api/session/[id]  - hente eksisterende samtale
// POST /api/session/[id]  - oppdatere samtale med ny tilstand

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || typeof id !== 'string' || id.length < 4 || id.length > 32) {
    return res.status(400).json({ error: 'Ugyldig samtale-ID' });
  }

  const key = `session:${id}`;

  // ─── GET: hent samtale ───
  if (req.method === 'GET') {
    try {
      const raw = await redis.get(key);
      if (!raw) {
        return res.status(404).json({ error: 'Samtalen ble ikke funnet. Lenken kan være utløpt.' });
      }

      // Upstash returnerer enten string eller objekt avhengig av hvordan det ble lagret
      const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json(session);

    } catch (err) {
      console.error('Session GET feil:', err);
      return res.status(500).json({ error: 'Kunne ikke hente samtale: ' + err.message });
    }
  }

  // ─── POST: oppdater samtale ───
  if (req.method === 'POST') {
    try {
      const updates = req.body || {};

      // Hent eksisterende først for å beholde uforanderlige felter
      const raw = await redis.get(key);
      if (!raw) {
        return res.status(404).json({ error: 'Samtalen finnes ikke' });
      }

      const existing = typeof raw === 'string' ? JSON.parse(raw) : raw;

      // Slå sammen – men vi tillater ikke at klienten endrer ID eller createdAt
      const session = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

      // Hvis status settes til 'completed', sett completedAt
      if (updates.status === 'completed' && !existing.completedAt) {
        session.completedAt = new Date().toISOString();
      }

      // Hvis fullført – behold 1 år. Hvis ikke – fortsatt 90 dager.
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
