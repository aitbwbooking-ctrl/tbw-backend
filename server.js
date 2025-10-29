import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use(limiter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENTRIPMAP_API_KEY = process.env.OPENTRIPMAP_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🌦️ WEATHER
app.get("/api/weather", async (req, res) => {
  const city = req.query.city;
  if (!city) return res.status(400).json({ error: "city param required" });

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=hr`;
  const response = await fetch(url);
  const data = await response.json();
  res.json(data);
});

// 🗺️ POI (Points of Interest)
app.get("/api/poi", async (req, res) => {
  const city = req.query.city;
  if (!city) return res.status(400).json({ error: "city param required" });

  const url = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(city)}&apikey=${OPENTRIPMAP_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  res.json(data);
});

// 🖼️ PHOTOS
app.get("/api/photos", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "q param required" });

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${process.env.UNSPLASH_ACCESS_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  res.json(data);
});

// 🚦 TRAFFIC (mock data for now)
app.get("/api/traffic", async (req, res) => {
  const city = req.query.city;
  res.json({ city, status: "free flow", last_update: new Date() });
});

// ⚠️ ALERTS (mock AI data)
app.get("/api/alerts", async (req, res) => {
  const city = req.query.city;
  if (!city) return res.status(400).json({ error: "city param required" });

  res.json({
    city,
    alerts: [
      { type: "weather", message: `Nema upozorenja za ${city}.` },
      { type: "traffic", message: `Promet u ${city} je uredan.` },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`✅ TBW backend running on port ${PORT}`);
});
