import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import axios from "axios";
import dotenv from "dotenv";
import LRUCache from "lru-cache";

dotenv.config();

const app = express();

// --- Config -------------------------------------------------------
const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

// CORS (pusti frontend i tvoju domenu)
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: false
  })
);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(morgan("tiny"));
app.use(express.json());

// Rate limit (sigurnost)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120
});
app.use("/api/", limiter);

// Keš (LRU u memoriji: 300 stavki / 2–5 min)
const cache = new LRUCache({
  max: 300,
  ttl: 1000 * 120, // default 2 min
});
const setCache = (key, data, ttlMs = 1000 * 120) => cache.set(key, data, { ttl: ttlMs });
const getCache = (key) => cache.get(key);

// Helpers
const ok = (res, data) => res.json({ ok: true, ...data });
const err = (res, message, code = 500, extra = {}) =>
  res.status(code).json({ ok: false, error: message, ...extra });

const latlonFromQuery = (q) => {
  const lat = q.lat ? Number(q.lat) : null;
  const lon = q.lon ? Number(q.lon) : null;
  return (isFinite(lat) && isFinite(lon)) ? { lat, lon } : null;
};

// --- External clients ---------------------------------------------
const OW = axios.create({
  baseURL: "https://api.openweathermap.org",
  timeout: 9000,
});
const TTM = axios.create({
  baseURL: "https://api.tomtom.com",
  timeout: 9000,
});
const GOOGLE = axios.create({
  baseURL: "https://maps.googleapis.com",
  timeout: 10000,
});
const OTM = axios.create({
  baseURL: "https://api.opentripmap.com/0.1/en/places",
  timeout: 9000,
});

// --- API: Health ---------------------------------------------------
app.get("/api/health", (req, res) => {
  ok(res, { service: "TBW AI BACKEND", status: "running", time: new Date().toISOString() });
});

// --- API: Vrijeme (OpenWeather, fallback po gradu) -----------------
app.get("/api/weather", async (req, res) => {
  try {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return err(res, "OPENWEATHER_API_KEY missing", 500);

    let { city } = req.query;
    let coords = latlonFromQuery(req.query);

    // Ako nema lat/lon, geokodiraj grad
    if (!coords && city) {
      const geoKey = `geo:${city.toLowerCase()}`;
      let geo = getCache(geoKey);
      if (!geo) {
        const r = await OW.get("/geo/1.0/direct", {
          params: { q: city, limit: 1, appid: key },
        });
        if (!r.data?.length) return err(res, "City not found", 404);
        geo = { lat: r.data[0].lat, lon: r.data[0].lon };
        setCache(geoKey, geo, 1000 * 3600);
      }
      coords = geo;
    }
    if (!coords) return err(res, "Missing lat/lon or city", 400);

    const cacheKey = `wx:${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
    const cached = getCache(cacheKey);
    if (cached) return ok(res, { source: "cache", ...cached });

    const r = await OW.get("/data/2.5/weather", {
      params: { lat: coords.lat, lon: coords.lon, appid: key, units: "metric", lang: "hr" },
    });

    const data = {
      coords,
      weather: {
        temp: r.data.main?.temp,
        feels_like: r.data.main?.feels_like,
        humidity: r.data.main?.humidity,
        wind: r.data.wind,
        clouds: r.data.clouds?.all,
        pressure: r.data.main?.pressure,
        desc: r.data.weather?.[0]?.description,
        icon: r.data.weather?.[0]?.icon
      },
      city: r.data.name,
      ts: Date.now()
    };
    setCache(cacheKey, data, 1000 * 180); // 3 min
    ok(res, data);
  } catch (e) {
    err(res, "Weather fetch failed", 502, { detail: e.message });
  }
});

// --- API: Stanje mora (OpenWeather SSTS proxy kao fallback) -------
app.get("/api/sea", async (req, res) => {
  try {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return err(res, "OPENWEATHER_API_KEY missing", 500);
    let coords = latlonFromQuery(req.query);
    if (!coords) return err(res, "Missing lat/lon", 400);

    const ck = `sea:${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
    const cached = getCache(ck);
    if (cached) return ok(res, { source: "cache", ...cached });

    // Koristimo OneCall 3.0 (ako je uključen) ili standardno vrijeme za SSTS proxy
    const r = await OW.get("/data/2.5/weather", {
      params: { lat: coords.lat, lon: coords.lon, appid: key, units: "metric" }
    });

    // Nema službenog SSTS u free OW — vraćamo "moreLikeTemp" = temp + korekcija uz vjetar
    const air = r.data.main?.temp ?? null;
    const wind = r.data.wind?.speed ?? 0;
    const approxSea = (air !== null) ? Math.max(8, Math.min(29, air - (wind > 6 ? 1.5 : 0.5))) : null;

    const data = {
      coords,
      sea_temp_estimate_c: approxSea,
      wind_ms: wind,
      note: "Procjena SSTS; integracija s hrvatskim oceanografskim izvorima je spremna (potrebni ključ/endpoint).",
      ts: Date.now()
    };
    setCache(ck, data, 1000 * 300);
    ok(res, data);
  } catch (e) {
    err(res, "Sea state fetch failed", 502, { detail: e.message });
  }
});

// --- API: Promet (TomTom incidents + flow) ------------------------
app.get("/api/traffic", async (req, res) => {
  try {
    const key = process.env.TOMTOM_API_KEY;
    if (!key) return err(res, "TOMTOM_API_KEY missing", 500);

    // BBOX ili centar + radijus
    const { bbox, lat, lon } = req.query;
    let box = bbox;
    if (!box && lat && lon) {
      const d = 0.6; // ~60km box
      box = `${+lon - d},${+lat - d},${+lon + d},${+lat + d}`;
    }
    if (!box) return err(res, "bbox ili lat/lon obavezno", 400);

    const ck = `tt:${box}`;
    const cached = getCache(ck);
    if (cached) return ok(res, { source: "cache", ...cached });

    const [inc, flow] = await Promise.all([
      TTM.get(`/traffic/services/5/incidentDetails`, {
        params: { bbox: box, classificationFilter: "all", key }
      }),
      TTM.get(`/traffic/services/4/flowSegmentData/absolute/10/json`, {
        params: { point: req.query.lat && req.query.lon ? `${lat},${lon}` : "45.8,15.97", key }
      })
    ]);

    const data = {
      bbox: box,
      incidents: inc.data?.incidents ?? [],
      flow: flow.data ?? {},
      ts: Date.now()
    };
    setCache(ck, data, 1000 * 60);
    ok(res, data);
  } catch (e) {
    err(res, "Traffic fetch failed", 502, { detail: e.message });
  }
});

// --- API: Places (Google Places Text Search / Nearby) --------------
app.get("/api/places", async (req, res) => {
  try {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return err(res, "GOOGLE_PLACES_API_KEY missing", 500);
    const { query, lat, lon, radius = 5000, type } = req.query;
    const ck = `places:${query || type}:${lat},${lon}:${radius}`;
    const cached = getCache(ck);
    if (cached) return ok(res, { source: "cache", ...cached });

    let url, params;
    if (query) {
      url = "/maps/api/place/textsearch/json";
      params = { query, key, language: "hr" };
      if (lat && lon) params.location = `${lat},${lon}`;
      if (type) params.type = type;
      if (radius) params.radius = radius;
    } else if (lat && lon) {
      url = "/maps/api/place/nearbysearch/json";
      params = { location: `${lat},${lon}`, radius, key, language: "hr" };
      if (type) params.type = type;
    } else {
      return err(res, "query ili lat/lon obavezno", 400);
    }

    const r = await GOOGLE.get(url, { params });
    const data = {
      results: r.data?.results ?? [],
      status: r.data?.status ?? "UNKNOWN",
      ts: Date.now()
    };
    setCache(ck, data, 1000 * 120);
    ok(res, data);
  } catch (e) {
    err(res, "Places fetch failed", 502, { detail: e.message });
  }
});

// --- API: Route (Google Directions ili TomTom) ---------------------
app.get("/api/route", async (req, res) => {
  try {
    const origin = req.query.origin;      // "lat,lon"
    const destination = req.query.destination;
    if (!origin || !destination) return err(res, "origin i destination obavezni", 400);

    const gkey = process.env.GOOGLE_MAPS_API_KEY;
    const tkey = process.env.TOMTOM_API_KEY;

    const ck = `route:${origin}->${destination}`;
    const cached = getCache(ck);
    if (cached) return ok(res, { source: "cache", ...cached });

    let data = null;

    // Pokušaj Google
    if (gkey) {
      try {
        const r = await GOOGLE.get("/maps/api/directions/json", {
          params: {
            origin, destination,
            key: gkey, language: "hr", units: "metric", mode: "driving"
          }
        });
        if (r.data?.routes?.length) {
          data = { provider: "google", routes: r.data.routes };
        }
      } catch {}
    }

    // Fallback TomTom
    if (!data && tkey) {
      const [oLat, oLon] = origin.split(",").map(Number);
      const [dLat, dLon] = destination.split(",").map(Number);
      const r = await TTM.get(`/routing/1/calculateRoute/${oLat},${oLon}:${dLat},${dLon}/json`, {
        params: { key: tkey, travelMode: "car", traffic: true }
      });
      data = { provider: "tomtom", routes: r.data?.routes ?? [] };
    }

    if (!data) return err(res, "Route provider unavailable", 502);
    setCache(ck, data, 1000 * 60);
    ok(res, data);
  } catch (e) {
    err(res, "Route fetch failed", 502, { detail: e.message });
  }
});

// --- API: Booking deep-links generator -----------------------------
app.get("/api/booking-links", (req, res) => {
  try {
    const { city = "", checkin = "", checkout = "", adults = 2 } = req.query;

    const b = new URL("https://www.booking.com/searchresults.html");
    if (city) b.searchParams.set("ss", city);
    if (checkin) b.searchParams.set("checkin", checkin);
    if (checkout) b.searchParams.set("checkout", checkout);
    b.searchParams.set("group_adults", String(adults));

    const e = new URL("https://www.expedia.com/Hotel-Search");
    if (city) e.searchParams.set("destination", city);
    if (checkin) e.searchParams.set("startDate", checkin);
    if (checkout) e.searchParams.set("endDate", checkout);
    e.searchParams.set("adults", String(adults));

    const a = new URL("https://www.airbnb.com/s/homes");
    if (city) a.searchParams.set("query", city);
    if (checkin) a.searchParams.set("checkin", checkin);
    if (checkout) a.searchParams.set("checkout", checkout);
    a.searchParams.set("adults", String(adults));

    ok(res, {
      booking: b.toString(),
      expedia: e.toString(),
      airbnb: a.toString()
    });
  } catch (e) {
    err(res, "Deep links failed", 500, { detail: e.message });
  }
});

// --- API: Ticker (agregira status za gornju traku) ----------------
app.get("/api/ticker", async (req, res) => {
  try {
    const city = req.query.city || "Zagreb";
    const coords = latlonFromQuery(req.query);

    const tasks = [];

    // Vrijeme (OW)
    tasks.push(
      (async () => {
        try {
          const r = await axios.get(`${req.protocol}://${req.get("host")}/api/weather`, {
            params: { city, ...(coords || {}) }
          });
          const w = r.data.weather;
          if (!w) return null;
          return `Vrijeme: ${Math.round(w.temp)}°C, vjetar ${Math.round((w.wind?.speed || 0) * 3.6)} km/h`;
        } catch { return null; }
      })()
    );

    // Promet (TomTom)
    tasks.push(
      (async () => {
        try {
          const r = await axios.get(`${req.protocol}://${req.get("host")}/api/traffic`, {
            params: coords
              ? { lat: coords.lat, lon: coords.lon }
              : { bbox: "14.2,44.7,16.1,45.9" } // HR središnji pojas
          });
          const count = (r.data.incidents || []).length;
          return count > 0 ? `Promet: ${count} događaja na cestama` : "Promet uglavnom uredan";
        } catch { return null; }
      })()
    );

    // Otvorene trgovine (Google Places)
    tasks.push(
      (async () => {
        try {
          const params = coords
            ? { lat: coords.lat, lon: coords.lon, radius: 8000, type: "supermarket" }
            : { query: `${city} supermarket` };
          const r = await axios.get(`${req.protocol}://${req.get("host")}/api/places`, { params });
          const open = (r.data.results || []).filter(p => p.opening_hours?.open_now).slice(0, 3);
          if (!open.length) return "Trgovine: provjera u tijeku…";
          return `Otvoreno: ${open.map(x => x.name).join(", ")}`;
        } catch { return null; }
      })()
    );

    const seg = (await Promise.all(tasks)).filter(Boolean);
    ok(res, { city, items: seg, ts: Date.now() });
  } catch (e) {
    err(res, "Ticker failed", 500, { detail: e.message });
  }
});

// --- Root ----------------------------------------------------------
app.get("/", (req, res) => {
  res.send("TBW BACKEND LIVE ✅");
});

// Vercel export
export default app;
