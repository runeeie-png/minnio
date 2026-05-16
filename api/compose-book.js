// api/compose-book.js
// NIVÅ 2 – BOK-REDAKTØR.
//
// Tar hele samtalen og gjør den om til ferdig, vakker boktekst.
// Skriver kapittel for kapittel basert på de 12 kapitlene.
// Beholder personens egen stemme og uttrykk, men bygger ekte
// avsnitt og flyt – fjerner spørsmål/svar-formatet.
//
// Kalles fra dashboard når en samtale er rik nok til å bli bok.

import Anthropic from '@anthropic-ai/sdk';
import { Redis } from '@upstash/redis';
import { CHAPTERS } from './_chapters.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    const { sessionId, chapterId } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'Mangler sessionId' });
    }

    // Hent samtalen
    const raw = await redis.get(`session:${sessionId}`);
    if (!raw) {
      return res.status(404).json({ error: 'Samtale ikke funnet' });
    }
    const session = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const name = session.profile?.name || 'Fortelleren';
    const conversation = session.conversation || [];

    if (conversation.length < 2) {
      return res.status(400).json({ error: 'For lite samtale til å lage bok' });
    }

    // Bygg hele samtaletranskriptet
    const transcript = conversation
      .map(m => `${m.role === 'assistant' ? 'Minna' : name}: ${m.content}`)
      .join('\n\n');

    // Hvis chapterId er gitt: skriv bare det kapitlet.
    // Ellers: skriv hele boka (alle kapitler med materiale).
    const chaptersToWrite = chapterId
      ? CHAPTERS.filter(c => c.id === chapterId)
      : CHAPTERS;

    const bookState = session.bookState || {};

    const systemPrompt = `Du er en varm, dyktig norsk biografi-forfatter. Du skriver minnebøker basert på samtaler med eldre mennesker.

PERSONEN: ${name}

DIN OPPGAVE: Gjør samtalen om til vakker, sammenhengende boktekst skrevet i førsteperson (jeg-form), som om ${name} forteller selv.

REGLER FOR GOD MINNEBOK-TEKST:
- Skriv i jeg-form, som ${name}s egen stemme
- Behold personens egne ord, uttrykk og dialektpreg der det gir varme ("mor mi", "den gangen", "kara")
- Bygg ekte avsnitt med flyt – ALDRI spørsmål/svar-format
- Fjern Minnas spørsmål helt – la fortellingen stå alene
- Behold konkrete detaljer: navn, steder, årstall, sanseinntrykk
- Ikke dikt opp noe som ikke ble sagt. Hvis noe er uklart, skriv rundt det
- Ikke oppsummer tørt – gjenskap stemningen og varmen i det som ble fortalt
- Hvert kapittel skal kunne leses som et lite stykke litteratur
- Naturlig norsk, verken stivt eller barnslig
- Hvis det er lite materiale til et kapittel, skriv det kort heller enn å fylle med tomprat

FORMAT: Returner KUN kapittelteksten. Ingen overskrift, ingen metakommentar, ingen "Her er kapitlet". Bare den ferdige teksten.`;

    const results = [];

    for (const chapter of chaptersToWrite) {
      const chState = bookState[chapter.id];
      // Hopp over helt tomme kapitler hvis vi skriver hele boka
      if (!chapterId && (!chState || chState.richness < 15)) {
        results.push({
          chapterId: chapter.id,
          title: chapter.title,
          text: null,
          skipped: true,
          reason: 'For lite materiale'
        });
        continue;
      }

      const factsHint = chState?.facts?.length
        ? `\n\nFAKTA HENTET FRA SAMTALEN (bruk disse, men ikke som liste – vev dem inn):\n${chState.facts.map(f => `- ${f}`).join('\n')}`
        : '';

      const userPrompt = `KAPITTEL Å SKRIVE: "${chapter.title}"
Dette kapitlet handler om: ${chapter.description}
${factsHint}

HELE SAMTALEN (hent ut det som hører til dette kapitlet):
${transcript}

Skriv kapitlet "${chapter.title}" som vakker boktekst i ${name}s egen stemme. Bruk kun det som faktisk ble fortalt som hører til dette temaet.`;

      try {
        const response = await anthropic.messages.create({
          model: process.env.MINNIO_BOOK_MODEL || 'claude-opus-4-7',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        });

        const text = response.content[0].text.trim();
        results.push({
          chapterId: chapter.id,
          title: chapter.title,
          text,
          skipped: false
        });
      } catch (e) {
        console.error(`Feil ved kapittel ${chapter.id}:`, e.message);
        results.push({
          chapterId: chapter.id,
          title: chapter.title,
          text: null,
          skipped: true,
          reason: 'Feil under generering: ' + e.message
        });
      }
    }

    // Lagre den genererte boka i sesjonen
    const bookDraft = {
      generatedAt: new Date().toISOString(),
      chapters: results
    };
    session.bookDraft = bookDraft;
    const ttl = session.status === 'completed' ? 60 * 60 * 24 * 365 : 60 * 60 * 24 * 90;
    await redis.set(`session:${sessionId}`, JSON.stringify(session), { ex: ttl });

    return res.status(200).json({
      success: true,
      name,
      bookDraft
    });

  } catch (err) {
    console.error('Compose-book feil:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
