// STT-endepunkt – ElevenLabs Scribe for norsk

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Bruk POST' });
  }

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Mangler ELEVENLABS_API_KEY' });

    // Les rådata fra requesten
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audioBuffer = Buffer.concat(chunks);

    if (audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Tom audio' });
    }

    // Bygg multipart form-data manuelt
    const boundary = '----formboundary' + Math.random().toString(36).slice(2);
    const parts = [];
    parts.push(`--${boundary}`);
    parts.push('Content-Disposition: form-data; name="model_id"');
    parts.push('');
    parts.push('scribe_v1');
    parts.push(`--${boundary}`);
    parts.push('Content-Disposition: form-data; name="language_code"');
    parts.push('');
    parts.push('nor');
    parts.push(`--${boundary}`);
    parts.push('Content-Disposition: form-data; name="file"; filename="audio.wav"');
    parts.push('Content-Type: audio/wav');
    parts.push('');
    
    const head = Buffer.from(parts.join('\r\n') + '\r\n');
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, audioBuffer, tail]);

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: body
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Scribe feil:', errText);
      return res.status(500).json({ error: 'STT feilet' });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.text || '' });

  } catch (err) {
    console.error('STT error:', err);
    return res.status(500).json({ error: err.message });
  }
}
