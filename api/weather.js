// /api/weather.js
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const city = req.query.city || "Split";
    const API = process.env.OPENWEATHER_KEY;

    if (!API) {
      return res.status(500).json({
        ok: false,
        error: "Missing OPENWEATHER_KEY in environment variables"
      });
    }

    const url =
      "https://api.openweathermap.org/data/2.5/weather?" +
      `q=${encodeURIComponent(city)}` +
      `&appid=${API}` +
      "&units=metric" +
      "&lang=hr";

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(500).json({
        ok: false,
        error: "OpenWeather API returned error",
        status: response.status
      });
    }

    const data = await response.json();

    return res.status(200).json({
      ok: true,
      city: data.name,
      temp: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      wind: data.wind.speed,
      condition: data.weather?.[0]?.description || "",
      icon: data.weather?.[0]?.icon || "",
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Weather API failure",
      message: err.message
    });
  }
}
