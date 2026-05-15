export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
 
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
 
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text", debug: "No text in request body" });
 
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
 
    if (!apiKey) return res.status(400).json({ error: "Missing API key", debug: "ELEVENLABS_API_KEY not set" });
    if (!voiceId) return res.status(400).json({ error: "Missing Voice ID", debug: "ELEVENLABS_VOICE_ID not set" });
 
    const requestBody = {
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.75,
      },
    };
 
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify(requestBody),
      }
    );
 
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(400).json({
        error: "ElevenLabs avviste forespoerselen",
        elevenLabsStatus: response.status,
        elevenLabsResponse: errorText,
        voiceIdUsed: voiceId.substring(0, 10) + "...",
        apiKeyPrefix: apiKey.substring(0, 10) + "...",
        textLength: text.length,
        textSample: text.substring(0, 100),
      });
    }
 
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
 
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    return res.status(200).send(buffer);
 
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}

 
