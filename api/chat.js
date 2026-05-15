// Avansert chat-endepunkt for Minnio
// Basert på GuideLLM (2026), HEART-taksonomi (2024), og Cause-Aware Empathetic CoT (2024)
//
// Per tur gjør Claude internt:
// 1. ANALYSE av bestemors siste svar (innhold, emosjon, narrative-rikhet)
// 2. MEMORY-oppdatering (hva har vi lært?)
// 3. NAVIGASJON (hvor er vi i livshistorien?)
// 4. RESPONS (Minnas faktiske melding)
//
// Hele resoneringen skjer i én streaming-kall via structured output.

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  try {
    const { system, messages, memory } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Mangler messages' });
    }

    // Bygg ekstra kontekst fra memory hvis det finnes
    let enhancedSystem = system || '';
    if (memory && (memory.facts?.length > 0 || memory.emotional_threads?.length > 0)) {
      enhancedSystem += `

═══════════════════════════════════
MINNE FRA SAMTALEN SÅ LANGT
═══════════════════════════════════

VIKTIGE FAKTA NEVNT:
${memory.facts?.map(f => `• ${f}`).join('\n') || '(ingen så langt)'}

EMOSJONELLE TRÅDER (ting hun har følt sterkt om):
${memory.emotional_threads?.map(t => `• ${t}`).join('\n') || '(ingen så langt)'}

PERSONER HUN HAR NEVNT:
${memory.people?.map(p => `• ${p}`).join('\n') || '(ingen så langt)'}

NÅVÆRENDE TEMA: ${memory.current_topic || 'ikke fastsatt'}
SCENE-STATUS: ${memory.scene_depth || 'starter'}

Bruk dette til å koble nye ting til gamle ting. Hvis hun nevner en person eller et sted som er kjent, vis at du husker. Men ALDRI gjenta ordene hennes ordrett.`;
    }

    // CHAIN-OF-THOUGHT-instruksjoner som tvinger resonering før respons
    enhancedSystem += `

═══════════════════════════════════
DIN INTERNE PROSESS (CHAIN-OF-THOUGHT)
═══════════════════════════════════

Før du genererer responsen din, må du gå gjennom denne resoneringen INTERNT (vises ikke til brukeren).
Skriv resoneringen din inni <tenker>...</tenker>-tagger. Etter taggene kommer den faktiske responsen din.

STEG 1: HVA SA HUN?
- Hvilke konkrete ord, navn, steder eller hendelser nevner hun?
- Hva er den richeste detaljen (HEART-elementer: sansevivenhet, emosjon, plottvolum)?

STEG 2: HVA FØLER HUN?
- Hvilken emosjonell tone har svaret? (glede, sorg, stolthet, lengsel, nostalgi, smerte, lettelse, varme, etc.)
- Hva forårsaker denne følelsen? (årsaks-bevissthet er nøkkelen til ekte empati)

STEG 3: HVA SKAL JEG GRAVE I?
- Er denne scenen ferdig utforsket? (har vi sted + tid + mennesker + følelse + en konkret detalj?)
- Hvis ikke: hva mangler? Hva er det neste lille spørsmålet?
- Hvis ja: hvilket nytt område passer å bevege seg til?

STEG 4: HVILKEN RESPONS-TYPE?
Velg ÉN:
- A) STILLE SPØRSMÅL (bruk oftest) – bare neste spørsmål, ingen kommentar til det hun sa
- B) FØLELSESREFLEKSJON – navngi følelsen kort, så still mykt spørsmål
- C) KORT BEKREFTELSE + SPØRSMÅL – ett ord ("Ja." "Mhm." "Tenk det.") + spørsmål
- D) NY VINKEL – bytt tema mykt (kun når scenen er ferdig)

STEG 5: SJEKK FOR PAPEGØYE
Før du skriver responsen, sjekk:
- Gjentar jeg ordene hennes? → SKRIV OM
- Begynner jeg med "Så du..." eller "Du nevnte..."? → SKRIV OM
- Oppsummerer jeg det hun sa? → SKRIV OM
- Er det mer enn 2 setninger? → FORKORT
- Stiller jeg to spørsmål? → FJERN ETT

STEG 6: MEMORY-OPPDATERING
Etter responsen din, oppdater minnet inni <minne>...</minne>-tagger med JSON:
{
  "new_facts": ["fakta som ble nevnt"],
  "new_emotional_threads": ["nye følelser eller dybder"],
  "new_people": ["personer som ble nevnt"],
  "current_topic": "tema akkurat nå",
  "scene_depth": "starter | utforsker | dyp | ferdig"
}

═══════════════════════════════════
FORMAT PÅ DITT SVAR
═══════════════════════════════════

<tenker>
[Din analyse her, steg 1-5]
</tenker>

[Den faktiske setningen Minna sier til ${getNameFromSystem(system)} – kort, varm, naturlig]

<minne>
{ "new_facts": [...], "new_emotional_threads": [...], "new_people": [...], "current_topic": "...", "scene_depth": "..." }
</minne>`;

    // Velg modell – Opus 4.7 for empati, Sonnet 4.6 for kostnad
    const modelToUse = process.env.MINNIO_MODEL || 'claude-opus-4-7';

    const response = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 1024,
      system: enhancedSystem,
      messages: messages,
      temperature: 0.85, // litt varierende for naturlig samtale
    });

    const fullText = response.content[0].text;

    // Parse de tre delene
    const thinkingMatch = fullText.match(/<tenker>([\s\S]*?)<\/tenker>/);
    const memoryMatch = fullText.match(/<minne>([\s\S]*?)<\/minne>/);

    // Den faktiske responsen er det som er mellom </tenker> og <minne>
    let cleanResponse = fullText
      .replace(/<tenker>[\s\S]*?<\/tenker>/, '')
      .replace(/<minne>[\s\S]*?<\/minne>/, '')
      .trim();

    // Fallback hvis modellen ikke fulgte formatet
    if (!cleanResponse) {
      cleanResponse = fullText.trim();
    }

    // Parse memory-oppdatering
    let memoryUpdate = null;
    if (memoryMatch) {
      try {
        memoryUpdate = JSON.parse(memoryMatch[1].trim());
      } catch (e) {
        console.warn('Kunne ikke parse memory JSON:', e.message);
      }
    }

    return res.status(200).json({
      text: cleanResponse,
      thinking: thinkingMatch ? thinkingMatch[1].trim() : null,
      memory_update: memoryUpdate
    });

  } catch (err) {
    console.error('Chat API feil:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Plukker ut navnet fra system-prompten for å bruke i formatet
function getNameFromSystem(system) {
  if (!system) return 'henne';
  const match = system.match(/hjelper (\w+)/);
  return match ? match[1] : 'henne';
}
