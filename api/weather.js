// /api/weather.js
import { setCors, handleOptions } from "./_cors";

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  const city = req.query.city || "Split";

  if (!OPENWEATHER_API_KEY) {
    // fallback
    return res.status(200).json({
      name: city,
      main: {
        temp: 22,
        feels_like: 23,
        humidity: 60,
      },
      weather: [{ description: "clear sky (fallback)" }],
    });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&units=metric&appid=${OPENWEATHER_API_KEY}`;

    const apiRes = await fetch(url);
    if (!apiRes.ok) {
      throw new Error("OpenWeather error: " + apiRes.status);
    }
    const data = await apiRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("WEATHER ERROR", err);
    return res.status(200).json({
      name: city,
      main: {
        temp: 22,
        feels_like: 23,
        humidity: 60,
      },
      weather: [{ description: "weather unavailable (fallback)" }],
    });
  }
}
