// /api/alerts.js
import { setCors, handleOptions } from "./_cors";

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  const city = req.query.city || "Croatia";

  if (!OPENWEATHER_API_KEY) {
    return res.status(200).json({
      alerts: [
        { message: `No severe alerts. Drive safe around ${city}.` },
      ],
      fallback: true,
    });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("weather fail");
    const data = await r.json();

    const temp = data.main?.temp;
    const desc = data.weather?.[0]?.description || "";

    const alerts = [
      { message: `Weather in ${data.name}: ${Math.round(temp)}°C, ${desc}.` },
      { message: "Always follow road signs and speed limits." },
    ];

    return res.status(200).json({ alerts });
  } catch (err) {
    console.error("ALERTS ERROR", err);
    return res.status(200).json({
      alerts: [{ message: `Alerts unavailable. Drive safe in ${city}.` }],
      fallback: true,
    });
  }
}
