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

const limiter = rateLimit({ windowMs: 60_000, max: 180 });
app.use(limiter);

// Keys (Render env)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const OPENTRIPMAP_API_KEY = process.env.OPENTRIPMAP_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";

// Health
app.get("/api/health", (_req,res)=>res.json({ok:true,time:new Date().toISOString()}));

// Weather
app.get("/api/weather", async (req,res)=>{
  try{
    const city = req.query.city;
    if(!city) return res.status(400).json({error:"city param required"});
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=hr`;
    const r = await fetch(url); const d = await r.json();
    res.json(d);
  }catch(e){ res.status(500).json({error:"weather_failed"}); }
});

// Photos
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

// ==== ALERTS PRO ====
// In-memory admin alerts (persist kroz redeploy nije garantirano; za demo OK)
let adminAlerts = [];

// Public aggregator (demo – uvijek vraća nešto + admin dodatke)
app.get("/api/alerts", async (req,res)=>{
  const city = req.query.city || "Hrvatska";
  const base = [
    {type:"traffic", message:`Promet u ${city} je uglavnom uredan.`, severity:"low"},
    {type:"weather", message:`Nema posebnih vremenskih upozorenja za ${city}.`, severity:"low"}
  ];

  // TODO: Ovdje možeš dodati realne feedove (HAK/DHMZ/Meteoalarm) i pushati u array "base"
  // Npr. try { const feed = await fetch(...).then(r=>r.json()); base.push(...mapFeed(feed)); } catch{}

  // Daj admin alerts prioritet (prvi u listi -> popup + sirena)
  const alerts = [...adminAlerts, ...base].slice(0,10);
  res.json({ alerts, updated: Date.now() });
});

// Admin: dodaj alert (Authorization: Bearer <ADMIN_TOKEN>)
app.post("/api/alerts/push", (req,res)=>{
  try{
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({error:"unauthorized"});

    const { type="hazard", message="", severity="medium" } = req.body || {};
    if (!message) return res.status(400).json({error:"message required"});

    adminAlerts.unshift({ type, message, severity });
    // limit
    adminAlerts = adminAlerts.slice(0,20);
    res.json({ ok:true, count: adminAlerts.length });
  }catch(e){ res.status(500).json({error:"push_failed"}); }
});

// Simple traffic (placeholder)
app.get("/api/traffic", (_req,res)=> res.json({status:"free flow", last_update:new Date()}));

// AI chat (opcionalno, ako koristiš)
app.post("/api/chat", async (req,res)=>{
  try{
    const msg = (req.body?.message||"").slice(0,400);
    const prompt = `Odgovori kratko i korisno na hrvatskom:\n\n${msg}`;
    const r = await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${OPENAI_API_KEY}`},
      body: JSON.stringify({ model:"gpt-4o-mini", messages:[{role:"user", content: prompt}], temperature:0.4 })
    });
    const d = await r.json();
    res.json({ reply: d?.choices?.[0]?.message?.content?.trim() || "OK." });
  }catch(e){ res.json({ reply:"(AI trenutno nedostupan.)" }); }
});

app.listen(PORT, ()=> console.log(`✅ TBW backend on :${PORT}`));
