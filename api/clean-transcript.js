// api/clean-transcript.js
// NIVÅ 1 – rydder rå tale-til-tekst FØR Minna hører den.
//
// Eldre mennesker snakker dialekt, ufullstendig, og hopper rundt.
// Scribe (STT) gjør ofte feil på norsk. Dette steget retter
// ÅPENBARE transkripsjonsfeil uten å endre meningen eller stemmen.
//
// KRITISK: Dette skal være konservativt. Vi retter feil – vi
// dikter ikke, oppsummerer ikke, og endrer ikke hva personen sa.

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  try {
    const { rawText, recentContext } = req.body || {};

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ error: 'Mangler rawText' });
    }

    // Veldig korte ytringer (ja, nei, mhm) trenger ikke rydding –
    // spar tid og penger, returner som de er.
    const trimmed = rawText.trim();
    if (trimmed.length < 12) {
      return res.status(200).json({ cleaned: trimmed, changed: false });
    }

    const systemPrompt = `Du er en norsk transkripsjonskorrektør for en minnebok-samtale med en eldre person.

Tale-til-tekst-systemet gjør ofte feil på norsk: feilhørte ord, manglende tegnsetting, dialektord som blir til feil ord, sammenhengende ord uten mellomrom.

DIN OPPGAVE: Rett ÅPENBARE transkripsjonsfeil. Returner KUN den rettede teksten – ingen forklaring, ingen anførselstegn.

DU SKAL:
- Rette ord som åpenbart er feilhørt (kontekst avgjør: "kø" → "kyr" hvis det handler om gård)
- Legge til naturlig tegnsetting (punktum, komma)
- Fikse setninger som ikke gir mening grammatisk
- Beholde dialektpreg og personlige uttrykk ("mor mi", "kara", "itte")
- Beholde nøyaktig hva personen mente å si

DU SKAL ALDRI:
- Legge til informasjon som ikke er der
- Oppsummere eller forkorte
- Fjerne innhold (selv om det er en sidehistorie)
- Gjøre språket mer formelt enn personen snakket
- Endre meningen
- "Forbedre" historien

Hvis teksten allerede er klar, returner den nesten uendret. Vær konservativ – ved tvil, behold originalen.`;

    const userPrompt = `${recentContext ? `SAMTALEKONTEKST (for å forstå hva som menes):\n${recentContext}\n\n` : ''}RÅ TRANSKRIPSJON SOM SKAL RETTES:
"${trimmed}"

Returner kun den rettede teksten.`;

    const response = await anthropic.messages.create({
      model: process.env.MINNIO_CLEAN_MODEL || 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    let cleaned = response.content[0].text.trim();

    // Fjern eventuelle anførselstegn modellen la til rundt svaret
    cleaned = cleaned.replace(/^["'«»]+|["'«»]+$/g, '').trim();

    // Sikkerhetsnett: hvis resultatet er tomt eller mistenkelig kort
    // sammenlignet med originalen, bruk originalen
    if (!cleaned || cleaned.length < trimmed.length * 0.4) {
      return res.status(200).json({ cleaned: trimmed, changed: false });
    }

    const changed = cleaned !== trimmed;
    return res.status(200).json({ cleaned, changed });

  } catch (err) {
    console.error('Clean-transcript feil:', err.message);
    // Ved feil: returner originalteksten uendret så samtalen ikke stopper
    return res.status(200).json({
      cleaned: req.body?.rawText || '',
      changed: false,
      error: err.message
    });
  }
}
