// api/analyze.js
// BAKGRUNNS-AGENT – kjører usynlig etter hvert svar fra fortelleren.
//
// Gjør tre ting (basert på Panfilova et al., Nature 2026):
//  1. COMPLETENESS: Vurderer hvilket kapittel siste svar bidro til,
//     og hvor rikt det kapitlet nå er dekket (0-100)
//  2. FAKTA-EKSTRAKSJON: Trekker ut tørre, objektive fakta
//  3. HULL-DETEKSJON: Identifiserer hva som mangler for at kapitlet
//     skal bli en god boktekst – dette mates tilbake til Minna
//
// Returnerer oppdatert bok-tilstand + et "gravingshint" til Minna.

import Anthropic from '@anthropic-ai/sdk';
import { CHAPTERS, emptyBookState } from './_chapters.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  try {
    const { lastUserMessage, recentTranscript, bookState } = req.body || {};

    if (!lastUserMessage) {
      return res.status(400).json({ error: 'Mangler lastUserMessage' });
    }

    const currentBook = bookState || emptyBookState();

    // Bygg en kompakt kapittel-oversikt til prompten
    const chapterList = CHAPTERS.map(ch =>
      `- ${ch.id}: "${ch.title}" – trenger: ${ch.needs.join('; ')} (nå: ${currentBook[ch.id]?.richness || 0}%)`
    ).join('\n');

    const systemPrompt = `Du er en usynlig analytiker for en norsk minnebok. Du ser IKKE fortelleren – du analyserer bare teksten.

DE 12 KAPITLENE I BOKA:
${chapterList}

DIN OPPGAVE – analyser fortellerens SISTE svar og returner KUN gyldig JSON (ingen forklaring, ingen markdown):

{
  "chapter": "<id på kapitlet dette svaret bidrar mest til, eller null>",
  "new_facts": ["tørre, objektive fakta fra svaret, maks 15 ord hver, KUN det som direkte står i teksten"],
  "covered_needs": ["hvilke av kapitlets 'trenger'-punkter som nå er dekket"],
  "richness_delta": <heltall 0-25: hvor mye dette svaret økte kapitlets rikhet. Tomt/vagt svar=0-5, konkret=8-15, rikt med sanseinntrykk og følelse=16-25>,
  "missing": "<én setning: hva mangler fortsatt for at DETTE kapitlet skal bli en god boktekst>",
  "dig_hint": "<ett konkret, kort norsk oppfølgingsspørsmål Minna kan stille for å fylle hullet. Naturlig, varmt, maks 12 ord. ALDRI gjenta fortellerens ord.>"
}

REGLER:
- new_facts: KUN det som eksplisitt står. Ingen tolkninger eller antakelser.
- Hvis svaret er rikt nok (alle 'trenger' dekket): sett "dig_hint" til null
- richness_delta skal være ærlig: et generelt "det var fint" gir 0-3
- Vær streng. En god bok krever konkrete scener, ikke generelle utsagn.`;

    const userPrompt = `SISTE SVAR FRA FORTELLEREN:
"${lastUserMessage}"

NYLIG SAMTALE (kontekst):
${recentTranscript || '(ingen tidligere kontekst)'}

Analyser og returner JSON.`;

    const response = await anthropic.messages.create({
      model: process.env.MINNIO_ANALYZE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    let raw = response.content[0].text.trim();

    // Fjern eventuelle markdown-fences
    raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch (e) {
      console.error('Kunne ikke parse analyse-JSON:', raw.slice(0, 200));
      // Returner uendret bok-tilstand hvis parsing feiler
      return res.status(200).json({
        bookState: currentBook,
        dig_hint: null,
        parsed: false
      });
    }

    // Oppdater bok-tilstanden
    const updatedBook = { ...currentBook };
    const chId = analysis.chapter;

    if (chId && updatedBook[chId]) {
      const ch = updatedBook[chId];
      const chapterDef = CHAPTERS.find(c => c.id === chId);

      // Legg til nye fakta (unngå duplikater, maks 25 per kapittel)
      if (Array.isArray(analysis.new_facts)) {
        const existing = new Set(ch.facts);
        for (const f of analysis.new_facts) {
          if (f && !existing.has(f)) ch.facts.push(f);
        }
        ch.facts = ch.facts.slice(-25);
      }

      // Legg til dekkede behov
      if (Array.isArray(analysis.covered_needs)) {
        const cov = new Set(ch.covered_needs);
        for (const n of analysis.covered_needs) cov.add(n);
        ch.covered_needs = [...cov];
      }

      // Øk rikhet (maks 100)
      const delta = Math.max(0, Math.min(25, parseInt(analysis.richness_delta) || 0));
      ch.richness = Math.min(100, ch.richness + delta);

      // Oppdater status
      if (ch.richness >= 70) ch.status = 'rik';
      else if (ch.richness >= (chapterDef?.minRichness || 50)) ch.status = 'god';
      else if (ch.richness > 0) ch.status = 'påbegynt';
      else ch.status = 'tom';

      updatedBook[chId] = ch;
    }

    return res.status(200).json({
      bookState: updatedBook,
      dig_hint: analysis.dig_hint || null,
      missing: analysis.missing || null,
      chapter: chId,
      parsed: true
    });

  } catch (err) {
    console.error('Analyze API feil:', err.message);
    if (err.error) console.error('Detalj:', JSON.stringify(err.error));
    // Ved feil: returner uendret tilstand så samtalen ikke stopper
    return res.status(200).json({
      bookState: req.body?.bookState || emptyBookState(),
      dig_hint: null,
      error: err.message,
      parsed: false
    });
  }
}
