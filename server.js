import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());

// Rate limiter
const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

// Root check
app.get("/api/health", (req, res) => {
  res.json({ status: "TBW backend active ✅" });
});

// Google Maps key
app.get("/api/gmaps-key", (req, res) => {
  res.json({ key: process.env.GOOGLE_MAPS_API_KEY || "missing" });
});

// Weather
app.get("/api/weather", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "city param required" });

    const key = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${key}`;
    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Points of interest (POI)
app.get("/api/poi", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "city param required" });

    const url = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(city)}&apikey=${process.env.OPENTRIPMAP_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Photos
app.get("/api/photos", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "q param required" });

    const key = process.env.UNSPLASH_ACCESS_KEY;
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${key}`;
    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Traffic (mock)
app.get("/api/traffic", (req, res) => {
  res.json({ city: req.query.city, status: "Smooth traffic 🚗" });
});

// Start server
app.listen(PORT, () => console.log(`TBW backend running on port ${PORT}`));
