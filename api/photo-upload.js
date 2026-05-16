// api/photo-upload.js
// Tar imot et bilde fra giveren (i admin), validerer det,
// og lagrer det i Redis knyttet til en kommende/eksisterende samtale.
//
// Bildet lagres som base64 i Redis sammen med giverens beskrivelse
// og hvilket kapittel det hører til. Minna henter det senere når
// temaet passer.

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Maks ~4 MB rå base64 (Anthropic-grense er 3.75 MB faktisk bilde).
// Vi forventer at klienten allerede har skalert ned.
const MAX_BASE64_CHARS = 5_000_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  // Beskytt med admin-nøkkel (samme som dashboard)
  const adminKey = process.env.MINNIO_ADMIN_KEY || 'minnio2026';
  const provided = req.query.key || req.headers['x-admin-key'] || req.body?.key;
  if (provided !== adminKey) {
    return res.status(401).json({ error: 'Ugyldig admin-nøkkel' });
  }

  try {
    const { sessionId, photo } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'Mangler sessionId' });
    }
    if (!photo || !photo.data || !photo.description) {
      return res.status(400).json({ error: 'Bildet må ha både data og beskrivelse' });
    }

    // Valider base64-størrelse
    if (photo.data.length > MAX_BASE64_CHARS) {
      return res.status(400).json({
        error: 'Bildet er for stort. Prøv et mindre bilde (maks ca. 3 MB).'
      });
    }

    // Valider media-type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const mediaType = photo.mediaType || 'image/jpeg';
    if (!allowed.includes(mediaType)) {
      return res.status(400).json({ error: 'Bildeformat støttes ikke (bruk JPG eller PNG)' });
    }

    // Strip eventuelt data:-prefiks (Anthropic vil ha rå base64)
    let cleanData = photo.data;
    const prefixMatch = cleanData.match(/^data:image\/[a-z]+;base64,/);
    if (prefixMatch) {
      cleanData = cleanData.slice(prefixMatch[0].length);
    }

    // Hent samtalen
    const raw = await redis.get(`session:${sessionId}`);
    if (!raw) {
      return res.status(404).json({ error: 'Samtale ikke funnet' });
    }
    const session = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Initialiser photo-array hvis nødvendig
    if (!Array.isArray(session.photos)) session.photos = [];

    // Lag en unik foto-ID
    const photoId = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    session.photos.push({
      id: photoId,
      data: cleanData,
      mediaType: mediaType,
      description: photo.description.trim(),
      chapterId: photo.chapterId || null,    // hvilket kapittel (valgfritt)
      showFirst: photo.showFirst === true,   // skal vises helt i starten?
      shown: false                            // har Minna vist det ennå?
    });

    const ttl = session.status === 'completed'
      ? 60 * 60 * 24 * 365
      : 60 * 60 * 24 * 90;
    await redis.set(`session:${sessionId}`, JSON.stringify(session), { ex: ttl });

    return res.status(200).json({
      success: true,
      photoId,
      totalPhotos: session.photos.length
    });

  } catch (err) {
    console.error('Photo-upload feil:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
