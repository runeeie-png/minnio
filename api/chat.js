// Enkel, robust chat-endepunkt for Minnio
// Ingen Chain-of-Thought, ingen memory-parsing – bare ren samtale

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  try {
    const { system, messages, digHint } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Mangler messages' });
    }

    // Hvis bakgrunns-agenten har sendt et gravingshint, legg det til
    // i system-prompten som en diskret instruksjon til Minna.
    let finalSystem = system || 'Du er Minna, en varm norsk samtalepartner.';
    if (digHint && typeof digHint === 'string' && digHint.trim()) {
      finalSystem += `\n\n─────────────────────\nINTERN STYRING (vises ikke til fortelleren):\nBoka mangler fortsatt noe på dette området. Et godt neste spørsmål kan være rundt: "${digHint.trim()}". Bruk dette som inspirasjon, men formuler det med dine egne ord, naturlig og varmt. Hvis fortelleren akkurat har åpnet et nytt og rikt spor, kan du følge det i stedet.`;
    }

    // Saner meldinger – kritisk for Anthropic API
    let safeMessages = messages
      .filter(m => m && m.content && typeof m.content === 'string' && m.content.trim().length > 0)
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.trim()
      }));

    // Slå sammen påfølgende meldinger med samme rolle
    const merged = [];
    for (const msg of safeMessages) {
      if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
        merged[merged.length - 1].content += '\n\n' + msg.content;
      } else {
        merged.push(msg);
      }
    }
    safeMessages = merged;

    // Første melding må være user
    if (safeMessages.length > 0 && safeMessages[0].role === 'assistant') {
      safeMessages.unshift({ role: 'user', content: 'Fortsett samtalen.' });
    }

    // Siste melding må være user (Opus 4.7 støtter ikke assistant-prefill)
    if (safeMessages.length > 0 && safeMessages[safeMessages.length - 1].role === 'assistant') {
      safeMessages.push({ role: 'user', content: 'Fortsett.' });
    }

    if (safeMessages.length === 0) {
      return res.status(400).json({ error: 'Ingen gyldige meldinger' });
    }

    // Velg modell – Sonnet 4.6 er billigere og fungerer like bra for samtaler
    const modelToUse = process.env.MINNIO_MODEL || 'claude-sonnet-4-6';

    // Bygg request dynamisk – temperature er deprecated på Opus 4.7/4.6 og Sonnet 4.6
    const requestBody = {
      model: modelToUse,
      max_tokens: 512,
      system: finalSystem,
      messages: safeMessages,
    };

    // Bare legg til temperature for eldre modeller
    const supportsTemperature = !modelToUse.includes('opus-4-7') 
      && !modelToUse.includes('opus-4-6')
      && !modelToUse.includes('sonnet-4-6');
    
    if (supportsTemperature) {
      requestBody.temperature = 0.8;
    }

    const response = await anthropic.messages.create(requestBody);
    const text = response.content[0].text;

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Chat API feil:', err.message);
    if (err.error) console.error('Anthropic detail:', JSON.stringify(err.error));
    
    return res.status(500).json({ 
      error: err.message,
      detail: err.error?.error?.message || null
    });
  }
}
