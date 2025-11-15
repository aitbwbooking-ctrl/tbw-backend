// /api/describe.js
import { setCors, handleOptions } from "./_cors";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  const name = req.query.name || "destination";

  if (!OPENAI_API_KEY) {
    return res.status(200).json({
      speech: `I currently don't have AI access configured, but I can say that ${name} is likely a nice place to explore.`,
      fallback: true,
    });
  }

  try {
    const prompt = `User asked: "${name}". 
Respond with a short, spoken-style answer (2–4 sentences) about travel, roads, places or weather related to this.`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!apiRes.ok) {
      throw new Error("OpenAI error " + apiRes.status);
    }

    const data = await apiRes.json();
    const speech =
      data.choices?.[0]?.message?.content ||
      `I don't have details about ${name} right now.`;

    return res.status(200).json({ speech });
  } catch (err) {
    console.error("DESCRIBE ERROR", err);
    return res.status(200).json({
      speech: `AI is temporarily unavailable. For now, plan your route carefully and always follow road signs.`,
      fallback: true,
    });
  }
}
