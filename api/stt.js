export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    // Read raw body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    // Forward to ElevenLabs as multipart form data
    const boundary = "----minnioBoundary" + Date.now();
    const contentType = req.headers["content-type"] || "audio/webm";

    const formParts = [];
    formParts.push(Buffer.from(`--${boundary}\r\n`));
    formParts.push(Buffer.from(`Content-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n`));
    formParts.push(Buffer.from(`--${boundary}\r\n`));
    formParts.push(Buffer.from(`Content-Disposition: form-data; name="language_code"\r\n\r\nnor\r\n`));
    formParts.push(Buffer.from(`--${boundary}\r\n`));
    formParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n`));
    formParts.push(Buffer.from(`Content-Type: ${contentType}\r\n\r\n`));
    formParts.push(audioBuffer);
    formParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(formParts);

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.text || "" });

  } catch (err) {
    console.error("STT error:", err);
    return res.status(500).json({ error: err.message });
  }
}
