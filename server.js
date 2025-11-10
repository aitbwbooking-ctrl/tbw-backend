import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

app.set("trust proxy", 1);
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 180 }));

const UA = { headers:{ "User-Agent":"tbw-atlas/1.0 (+https://tbw)" }};

// -------- helpers
async function geocodeCity(city){
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`;
  const j = await (await fetch(u, UA)).json();
  if(!j?.length) return null;
  return { lat:+j[0].lat, lon:+j[0].lon, name:j[0].display_name };
}

// -------- health
app.get("/api/health", (_req,res)=> res.json({ ok:true, time:Date.now() }));

// -------- alerts ticker
app.get("/api/alerts", async (req,res)=>{
  const city = req.query.city || "Hrvatska";
  res.json({
    alerts:[
      {text:`Promet u ${city} uglavnom uredan.`},
      {text:`Nema posebnih vremenskih upozorenja za ${city}.`},
      {text:`Savjet: provjerite radove i ograničenja brzine.`}
    ],
    updated: Date.now()
  });
});

// -------- weather + sea + air
app.get("/wx", async (req,res)=>{
  try{
    const city = req.query.city || "Zagreb";
    const geo = await geocodeCity(city);
    if(!geo) return res.json({ city, error:"nogeo" });

    const met = await (await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${geo.lat}&lon=${geo.lon}`, UA
    )).json();
    const now = met?.properties?.timeseries?.[0];
    const d = now?.data?.instant?.details || {};
    const temp = Math.round(d.air_temperature ?? 0);
    const wind = Math.round(d.wind_speed ?? 0);
    const humid = Math.round(d.relative_humidity ?? 0);
    const pressure = Math.round(d.air_pressure_at_sea_level ?? 0);

    const seaJ = await (await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${geo.lat}&longitude=${geo.lon}&hourly=sea_surface_temperature`
    )).json();
    const sea = Math.round(seaJ?.hourly?.sea_surface_temperature?.[0] ?? 0);

    res.json({ city, lat:geo.lat, lon:geo.lon, temp, wind, humid, pressure, sea, uv:null });
  }catch(e){ res.status(500).json({ error:"wx_failed" }); }
});

// -------- photos (Wikimedia)
app.get("/photos", async (req,res)=>{
  try{
    const city = req.query.city || "Croatia";
    const u = `https://commons.wikimedia.org/w/api.php?action=query&origin=*&format=json&prop=pageimages|images&generator=search&gsrsearch=${encodeURIComponent(city)}&gsrlimit=12&pithumbsize=640`;
    const j = await (await fetch(u)).json();
    const pages = Object.values(j.query?.pages || {});
    const photos = pages.map(p=>p.thumbnail?.source).filter(Boolean);
    res.json({ photos });
  }catch(e){ res.status(500).json({ error:"photos_failed" }); }
});

// -------- POI (Wikipedia geosearch)
app.get("/poi", async (req,res)=>{
  try{
    const city = req.query.city || "Split";
    const geo = await geocodeCity(city);
    if(!geo) return res.json({ items:[] });
    const u = `https://hr.wikipedia.org/w/api.php?action=query&origin=*&list=geosearch&gscoord=${geo.lat}|${geo.lon}&gsradius=8000&gslimit=12&format=json`;
    const j = await (await fetch(u)).json();
    const items = (j.query?.geosearch||[]).map(p=>({
      name:p.title, dist:p.dist, page:`https://hr.wikipedia.org/?curid=${p.pageid}`, category:"poi"
    }));
    res.json({ items });
  }catch(e){ res.status(500).json({ error:"poi_failed" }); }
});

// -------- services & emergency
app.get("/services", async (_req,res)=>{
  res.json({ items:[
    { name:"Policija 192", type:"emergency", href:"tel:192" },
    { name:"Hitna 194", type:"emergency", href:"tel:194" },
    { name:"Vatrogasci 193", type:"emergency", href:"tel:193" },
    { name:"EU 112", type:"emergency", href:"tel:112" },
    { name:"EV punionice", type:"ev", href:"https://www.plugshare.com/" },
    { name:"Najbliža bolnica (Mape)", type:"health", href:"https://www.google.com/maps/search/hospital/" }
  ]});
});

// -------- booking (demo list + redirect partners)
app.get("/booking/search", async (req,res)=>{
  const { city="Split" } = req.query;
  const rnd = (a,b)=>Math.round(a + Math.random()*(b-a));
  const mk = (i)=>({ id:i, name:`${city} Apartment #${100+i}`, price:rnd(45,180), address:`${city} centar`, rating:(Math.random()*2+3).toFixed(1) });
  res.json({ results: [mk(1),mk(2),mk(3),mk(4),mk(5),mk(6)] });
});
app.post("/booking/reserve", async (req,res)=> res.json({ ok:true, id:req.body?.id||null }));

// -------- assistant (heuristika bez ključa)
app.post("/assistant/query", async (req,res)=>{
  const q = (req.body?.query||"").toLowerCase();
  if(/(ruta|vozi|put|do|za)/.test(q)){
    const m = q.match(/(?:do|za)\s+(.+)$/); return res.json({ intent:"route", to:m?m[1]:"" });
  }
  if(/(rezerv|apartman|hotel|smješta)/.test(q)){
    const m = q.match(/(?:u|za)\s+([A-Za-zčćžšđ\s]+)/); return res.json({ intent:"book", city:m?m[1].trim():"" });
  }
  res.json({ intent:"none" });
});

// -------- assistant LLM (Gemini prefer, OpenAI fallback)
app.post("/assistant/llm", async (req,res)=>{
  try{
    const { text, lang="hr" } = req.body||{};
    const GEM = process.env.GOOGLE_AI_KEY;
    const OAI = process.env.OPENAI_API_KEY;

    if(GEM){
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key="+GEM,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          contents:[{parts:[{text: `Odgovori koncizno na jeziku: ${lang}. Pitanje: ${text}` }]}]
        })
      });
      const j = await r.json();
      const out = j?.candidates?.[0]?.content?.parts?.[0]?.text || "Nema odgovora.";
      return res.json({ text: out, lang });
    }else if(OAI){
      const r = await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${OAI}`},
        body: JSON.stringify({
          model:"gpt-4o-mini",
          messages:[{role:"user", content:`Odgovori koncizno na jeziku: ${lang}. Pitanje: ${text}`}],
          temperature:0.6
        })
      });
      const j = await r.json();
      const out = j?.choices?.[0]?.message?.content?.trim() || "Nema odgovora.";
      return res.json({ text: out, lang });
    }else{
      return res.json({ text:"AI ključ nije postavljen na backendu.", lang });
    }
  }catch(e){
    res.status(500).json({ error:"llm_failed" });
  }
});

app.listen(PORT, ()=> console.log(`✅ TBW backend listening on :${PORT}`));
