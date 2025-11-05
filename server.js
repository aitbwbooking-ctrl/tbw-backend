import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ DOZVOLI SAMO TVOJ FRONTEND
app.use(cors({
  origin: "https://tbw-frontend.onrender.com",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(helmet());
app.use(compression());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use(limiter);

// KEYS
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const OPENTRIPMAP_API_KEY = process.env.OPENTRIPMAP_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// HEALTH
app.get("/api/health", (_req,res)=>res.json({ok:true,time:new Date()}));

// ✅ CHAT endpoint
app.post("/api/chat", async (req, res) => {
  const message = req.body.message || "";
  if (!message) return res.json({ reply: "Molim unesite pitanje 😊" });

  return res.json({ reply: `Pitao si: "${message}". Backend je aktivan ✅` });
});

// WEATHER
app.get("/api/weather", async (req,res)=>{
  try{
    const city = req.query.city;
    if(!city) return res.status(400).json({error:"city param required"});
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=hr`;
    const r = await fetch(url); const d = await r.json();
    res.json(d);
  }catch(e){ res.status(500).json({error:"weather_failed"}); }
});

// PHOTOS
app.get("/api/photos", async (req,res)=>{
  try{
    const q = req.query.q || "Croatia";
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=8&client_id=${UNSPLASH_ACCESS_KEY}`;
    const r = await fetch(url); const d = await r.json();
    res.json(d);
  }catch(e){ res.status(500).json({error:"photos_failed"}); }
});

// POI
app.get("/api/poi", async (req,res)=>{
  try{
    const city = req.query.city;
    if(!city) return res.status(400).json({error:"city param required"});
    const geoU = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(city)}&apikey=${OPENTRIPMAP_API_KEY}`;
    const g = await (await fetch(geoU)).json();
    if(!g.lat || !g.lon) return res.json({items:[]});
    const listU = `https://api.opentripmap.com/0.1/en/places/radius?radius=5000&lon=${g.lon}&lat=${g.lat}&rate=2&limit=8&format=json&apikey=${OPENTRIPMAP_API_KEY}`;
    const L = await (await fetch(listU)).json();

    const out = [];
    for (const p of L){
      try{
        const infoU = `https://api.opentripmap.com/0.1/en/places/xid/${p.xid}?apikey=${OPENTRIPMAP_API_KEY}`;
        const I = await (await fetch(infoU)).json();
        out.push({
          name: I.name || p.name || "Attraction",
          kind: I.kinds || "",
          short: I.wikipedia_extracts?.text?.split(". ").slice(0,2).join(". ") || I.info?.descr || "",
          lon: I.point?.lon, lat: I.point?.lat
        });
      }catch(_){}
    }
    res.json({items:out});
  }catch(e){ res.status(500).json({error:"poi_failed"}); }
});

// ALERTS
app.get("/api/alerts", async (req,res)=>{
  const city = req.query.city || "Hrvatska";
  res.json({
    alerts:[
      {type:"weather", message:`Nema posebnih vremenskih upozorenja za ${city}.`},
      {type:"traffic", message:`Promet u ${city} je uglavnom uredan.`},
      {type:"hazard",  message:`Obavijest: provjerite lokalne kamere i ograničenja brzine.`}
    ],
    updated: Date.now()
  });
});

// TRAFFIC
app.get("/api/traffic", async (_req,res)=>{
  res.json({status:"free flow", last_update: new Date()});
});

// START
app.listen(PORT, ()=> console.log(`✅ TBW backend running on :${PORT}`));
