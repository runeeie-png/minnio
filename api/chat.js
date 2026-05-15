import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { system, messages } = req.body;

    if (!system || !messages) {
      return res.status(400).json({ error: "Missing system or messages" });
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1000,
      system: system,
      messages: messages,
    });

    const text = response.content[0]?.text || "";
    return res.status(200).json({ text });

  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
