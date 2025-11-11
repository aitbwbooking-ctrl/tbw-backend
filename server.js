import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();

// --------- MIDDLEWARE ----------
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json());
app.use(morgan("tiny"));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// --------- ENV ----------
const {
  PORT = 3001,
  OPENWEATHER_API_KEY,
  GOOGLE_PLACES_API_KEY,
  TOMTOM_API_KEY,
  OPENAI_API_KEY
} = process.env;

const HAS = {
  ow: !!OPENWEATHER_API_KEY,
  gp: !!GOOGLE_PLACES_API_KEY,
  tt: !!TOMTOM_API_KEY,
  oa: !!OPENAI_API_KEY
};

// Util: graceful external fetch
async function safeGet(url, cfg = {}) {
  try {
    const r = await axios.get(url, cfg);
    return { ok: true, data: r.data };
  } catch (e) {
    return { ok: false, error: e?.response?.data || e.message };
  }
}

// --------- HEALTH ----------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "TBW AI PREMIUM BACKEND",
    has: HAS,
    time: new Date().toISOString()
  });
});

// --------- ALERTS / TICKER (promet + radari + požari + trgovine) ----------
app.get("/api/alerts", async (req, res) => {
  const city = (req.query.city || "Zagreb").trim();
  const items = [
    `TBW LIVE • ${city}`,
    `Promet: uglavnom uredan`,
    `Nema posebnih vremenskih upozorenja za ${city}`
  ];
  // ako ima TomTom key, probaj dohvatiti 1-2 incidenta u krugu ~30km oko ZG
  if (HAS.tt) {
    const lat = req.query.lat || "45.813";
    const lon = req.query.lon || "15.977";
    const u = `https://api.tomtom.com/traffic/services/5/incidentDetails?lat=${lat}&lon=${lon}&radius=30000&key=${TOMTOM_API_KEY}`;
    const t = await safeGet(u);
    if (t.ok && Array.isArray(t.data?.incidents)) {
      t.data.incidents.slice(0, 2).forEach(i => {
        const desc = i?.properties?.description || "Prometni događaj";
        items.push(`🚧 ${desc}`);
      });
    }
  } else {
    items.push("🛣️ Obilaznica djelomično opterećena");
  }
  // demo trgovine
  items.push("🛒 Lidl i Kaufland otvoreni • Konzum zatvara u 21:00");
  res.json({ ok: true, city, items });
});

// --------- SHOPS / OPEN NOW (Google Places) ----------
app.get("/api/shops", async (req, res) => {
  const q = req.query.q || "grocery";
  const city = req.query.city || "Zagreb";
  if (!HAS.gp) {
    return res.json({
      ok: true,
      openNow: [
        { name: "Lidl", closes: "22:00" },
        { name: "Kaufland", closes: "22:00" }
      ]
    });
  }
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    `${q} in ${city}`
  )}&key=${GOOGLE_PLACES_API_KEY}`;
  const r = await safeGet(url);
  if (!r.ok) return res.json({ ok: false, error: "Google Places fail" });
  const openNow = (r.data.results || [])
    .slice(0, 6)
    .map(s => ({
      name: s.name,
      closes: s.opening_hours?.open_now ? "otvoreno" : "zatvoreno",
      address: s.formatted_address,
      rating: s.rating
    }));
  res.json({ ok: true, openNow });
});

// --------- TRAFFIC INCIDENTS (TomTom) ----------
app.get("/api/traffic/events", async (req, res) => {
  if (!HAS.tt) {
    return res.json({
      ok: true,
      items: [
        { msg: "Pojačan promet prema centru" },
        { msg: "Zastoj kod ulaza na obilaznicu" }
      ]
    });
  }
  const lat = req.query.lat || "45.813";
  const lon = req.query.lon || "15.977";
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?lat=${lat}&lon=${lon}&radius=30000&key=${TOMTOM_API_KEY}`;
  const r = await safeGet(url);
  if (!r.ok) return res.json({ ok: false, items: [] });
  const items = (r.data.incidents || []).slice(0, 8).map(i => ({
    msg: i?.properties?.description || "Prometni događaj"
  }));
  res.json({ ok: true, items });
});

// --------- VRIJEME (OpenWeather) ----------
app.get("/api/weather", async (req, res) => {
  const city = req.query.city || "Zagreb";
  if (!HAS.ow) {
    return res.json({
      ok: true,
      city,
      temp: 12,
      humidity: 68,
      wind: 4,
      air: "Dobar",
      icon: "01d"
    });
  }
  const u = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    city
  )}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  const r = await safeGet(u);
  if (!r.ok) return res.json({ ok: false, error: "OW fail" });
  const d = r.data;
  res.json({
    ok: true,
    city,
    temp: d?.main?.temp,
    humidity: d?.main?.humidity,
    wind: d?.wind?.speed,
    air: "Dostupno s AQI API (kasnije)",
    icon: d?.weather?.[0]?.icon
  });
});

// --------- STANJE MORA (demo + hook za real API) ----------
app.get("/api/sea", async (req, res) => {
  // Ovdje možeš spojiti se na stvarni izvor (Copernicus/NOAA/Meteo)
  res.json({
    ok: true,
    temp: 18.2,
    waves: "0.5 m",
    wind: "7 kt",
    photos: [
      "https://images.pexels.com/photos/460376/pexels-photo-460376.jpeg",
      "https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg",
      "https://images.pexels.com/photos/36717/makarska-riviera-croatia-vacation-sea.jpg",
      "https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg",
      "https://images.pexels.com/photos/533923/pexels-photo-533923.jpeg",
      "https://images.pexels.com/photos/462162/pexels-photo-462162.jpeg"
    ]
  });
});

// --------- BOOKING “meta” (otvaranje partnera – mock potvrda) ----------
app.post("/api/book", (req, res) => {
  res.json({
    ok: true,
    message: "TBW: rezervacija proslijeđena partnerskim servisima (Booking/Expedia/Airbnb)."
  });
});

// --------- AI CONCIERGE (OpenAI) ----------
app.post("/api/ai", async (req, res) => {
  const text = req.body?.message || "Pozdrav!";
  if (!HAS.oa) {
    return res.json({ ok: true, reply: "AI je spreman. Spoji OPENAI_API_KEY za pune odgovore." });
  }
  try {
    const r = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Ti si TBW AI Concierge. Odgovaraj kratko, jasno i korisno na hrvatskom." },
          { role: "user", content: text }
        ],
        temperature: 0.7
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
    );
    const msg = r.data?.choices?.[0]?.message?.content?.trim() || "Nema odgovora.";
    res.json({ ok: true, reply: msg });
  } catch (e) {
    res.json({ ok: false, reply: "AI trenutno nije dostupan." });
  }
});

// --------- 404 ----------
app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

// --------- EXPORT / LISTEN ----------
// Vercel serverless: export default app
const isVercel = !!process.env.VERCEL;
if (isVercel) {
  export default app;
} else {
  app.listen(PORT, () => console.log(`TBW Backend ✅ listening on :${PORT}`));
}
