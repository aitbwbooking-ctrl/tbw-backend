export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { city = "Split" } = req.query;
  const API = process.env.OPENWEATHER_KEY;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${API}&units=metric&lang=hr`;

    const r = await fetch(url);
    const data = await r.json();

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: true, message: "Weather API error" });
  }
}
