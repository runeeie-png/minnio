// TTS-endepunkt – ElevenLabs Flash v2.5 for norsk

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Mangler text' });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'XB0fDUnXU5powFXDhCwa'; // Charlotte (norsk)

    if (!apiKey) {
      return res.status(500).json({ error: 'Mangler ELEVENLABS_API_KEY' });
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
      const err = await response.text();
      console.error('ElevenLabs feil:', err);
      return res.status(500).json({ error: 'TTS feilet' });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: err.message });
  }
}
