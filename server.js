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

const limiter = rateLimit({ windowMs: 60_000, max: 160 });
app.use(limiter);

// KEYS (Render -> Environment)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const OPENTRIPMAP_API_KEY = process.env.OPENTRIPMAP_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

// HEALTH
app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date() }));

// WEATHER (OpenWeather current)
app.get("/api/weather", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "city param required" });
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=hr`;
    const d = await (await fetch(url)).json();
    res.json(d);
  } catch {
    res.status(500).json({ error: "weather_failed" });
  }
});

// PHOTOS (Unsplash)
app.get("/api/photos", async (req, res) => {
  try {
    const q = req.query.q || "Croatia";
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      q
    )}&per_page=8&client_id=${UNSPLASH_ACCESS_KEY}`;
    const d = await (await fetch(url)).json();
    res.json(d);
  } catch {
    res.status(500).json({ error: "photos_failed" });
  }
});

// POI (OpenTripMap)
app.get("/api/poi", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "city param required" });
    const geoU = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(
      city
    )}&apikey=${OPENTRIPMAP_API_KEY}`;
    const g = await (await fetch(geoU)).json();
    if (!g.lat || !g.lon) return res.json({ items: [] });

    const listU = `https://api.opentripmap.com/0.1/en/places/radius?radius=5000&lon=${g.lon}&lat=${g.lat}&rate=2&limit=10&format=json&apikey=${OPENTRIPMAP_API_KEY}`;
    const L = await (await fetch(listU)).json();
    const out = [];
    for (const p of L) {
      try {
        const infoU = `https://api.opentripmap.com/0.1/en/places/xid/${p.xid}?apikey=${OPENTRIPMAP_API_KEY}`;
        const I = await (await fetch(infoU)).json();
        out.push({
          name: I.name || p.name || "Znamenitost",
          kind: I.kinds || "",
          short:
            I.wikipedia_extracts?.text?.split(". ").slice(0, 2).join(". ") ||
            I.info?.descr ||
            "",
          lon: I.point?.lon,
          lat: I.point?.lat,
        });
      } catch {}
    }
    res.json({ items: out });
  } catch {
    res.status(500).json({ error: "poi_failed" });
  }
});

// SEA STATE (aproksimacija iz zraka + opis)
app.get("/api/sea", async (req, res) => {
  try {
    const city = req.query.city || "Split";
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const d = await (await fetch(url)).json();
    const t = Math.round(d?.main?.temp ?? 18);
    const seaTemp = Math.max(12, Math.min(28, Math.round(t - 2))); // gruba aproksimacija
    res.json({
      city,
      seaTemp,
      wave: "0.3 m (mirno)",
      uv: "UMJERENO",
      text: `More mirno, vidljivost dobra. Temp. mora oko ${seaTemp}°C.`,
    });
  } catch {
    res.status(500).json({ error: "sea_failed" });
  }
});

// ALERTS (demo ticker + grad)
app.get("/api/alerts", async (req, res) => {
  const city = req.query.city || "Hrvatska";
  res.json({
    alerts: [
      { type: "traffic", message: `Promet u ${city} uglavnom uredan.` },
      { type: "weather", message: `Nema posebnih vremenskih upozorenja za ${city}.` },
      { type: "hazard", message: `Obavijest: provjerite lokalne kamere i ograničenja brzine.` },
    ],
    updated: Date.now(),
  });
});

// TRAFFIC STATUS (REST)
app.get("/api/traffic", (_req, res) => {
  res.json({
    status: "free flow",
    incidents: [
      { type: "radar", road: "A1", km: 237, city: "Šibenik" },
      { type: "work", road: "A3", km: 78, city: "Novska" },
    ],
    last_update: new Date(),
  });
});

// TRAFFIC STREAM (SSE / RDS feed)
app.get("/api/traffic/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  send({ type: "hello", at: Date.now() });

  const timer = setInterval(() => {
    const sample = [
      { type: "radar", msg: "Radar na A1, ograničenje 100 km/h." },
      { type: "accident", msg: "Manja nesreća, sporije na obilaznici." },
      { type: "work", msg: "Radovi na cesti, suženje traka." },
      { type: "info", msg: "Promet uglavnom uredan." },
    ];
    send({ type: "rds", event: sample[Math.floor(Math.random() * sample.length)], at: Date.now() });
  }, 8000);

  req.on("close", () => clearInterval(timer));
});

// HOTELS (server-side Google Places Text Search) – CORS safe
app.get("/api/hotels/search", async (req, res) => {
  try {
    const city = req.query.city || "Split";
    const locResp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        city
      )}&key=${GOOGLE_PLACES_API_KEY}`
    );
    const loc = await locResp.json();
    const pos = loc?.results?.[0]?.geometry?.location;
    if (!pos) return res.json({ items: [] });

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      "apartment " + city
    )}&location=${pos.lat},${pos.lng}&radius=5000&key=${GOOGLE_PLACES_API_KEY}`;
    const d = await (await fetch(url)).json();
    const items = (d.results || []).slice(0, 10).map((p) => ({
      id: p.place_id,
      name: p.name,
      address: p.formatted_address,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
      price: `${40 + Math.round(Math.random() * 60)} € / noć`,
      rating: p.rating || 4.3,
    }));
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: "hotels_failed" });
  }
});

// AI short description (OpenAI)
app.get("/api/describe", async (req, res) => {
  try {
    const { name, city } = req.query;
    if (!name) return res.status(400).json({ error: "name required" });
    const prompt = `U 1–2 rečenice (≤40 riječi) ukratko i zanimljivo opiši turističku znamenitost "${name}" u ${
      city || "Hrvatskoj"
    } na hrvatskom jeziku.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });
    const d = await r.json();
    const txt = d?.choices?.[0]?.message?.content?.trim() || `O ${name} trenutno nemam detalja.`;
    res.json({ speech: txt, lang: "hr" });
  } catch {
    res.status(500).json({ error: "ai_failed" });
  }
});

app.listen(PORT, () => console.log(`✅ TBW backend on :${PORT}`));
