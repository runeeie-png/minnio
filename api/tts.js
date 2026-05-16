// TTS-endepunkt – ElevenLabs Flash v2.5 for norsk

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Mangler text' });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'XB0fDUnXU5powFXDhCwa'; // Charlotte

    if (!apiKey) {
      console.error('TTS: ELEVENLABS_API_KEY mangler i miljøvariabler');
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY er ikke satt i Vercel' });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      // Hent den EKTE feilmeldingen fra ElevenLabs så vi kan feilsøke
      const errText = await response.text();
      console.error(`ElevenLabs feil (HTTP ${response.status}):`, errText);
      return res.status(500).json({
        error: `ElevenLabs svarte ${response.status}`,
        detail: errText,
        voiceId: voiceId
      });
    }

    const audioBuffer = await response.arrayBuffer();

    // Sjekk at vi faktisk fikk lyd-data
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.error('TTS: ElevenLabs returnerte tom lyd');
      return res.status(500).json({ error: 'ElevenLabs returnerte tom lyd' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    return res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('TTS error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
