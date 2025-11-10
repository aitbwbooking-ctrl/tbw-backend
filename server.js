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

// ------------ helperi ------------
async function geocodeCity(city){
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`;
  const r = await fetch(u, { headers:{ "User-Agent":"tbw-ai-premium/1.0" }});
  const j = await r.json();
  if(!j?.length) return null;
  return { lat:+j[0].lat, lon:+j[0].lon, name:j[0].display_name };
}

// ------------ health ------------
app.get("/api/health", (_req,res)=> res.json({ ok:true, time:Date.now() }));

// ------------ ticker / alerts ------------
app.get("/api/alerts", async (req,res)=>{
  const city = req.query.city || "Hrvatska";
  const msgs = [
    `Promet u ${city} uglavnom uredan.`,
    `Nema posebnih vremenskih upozorenja za ${city}.`,
    `Savjet: provjerite radove i ograničenja brzine.`,
    `Napomena: EV punionice vidljive su na karti.`
  ];
  res.json({ alerts: msgs.map(text=>({text})), updated: Date.now() });
});

// ------------ vrijeme + more + zrak ------------
app.get("/wx", async (req,res)=>{
  try{
    const city = req.query.city || "Zagreb";
    const geo = await geocodeCity(city);
    if(!geo) return res.json({ city, error:"nogeo" });

    // MET Norway (zrak)
    const metUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${geo.lat}&lon=${geo.lon}`;
    const metR = await fetch(metUrl,{ headers:{ "User-Agent":"tbw-ai-premium/1.0" }});
    const metJ = await metR.json();
    const now = metJ?.properties?.timeseries?.[0];
    const d = now?.data?.instant?.details || {};
    const temp = Math.round(d.air_temperature ?? 0);
    const wind = Math.round(d.wind_speed ?? 0);
    const humid = Math.round(d.relative_humidity ?? 0);
    const pressure = Math.round(d.air_pressure_at_sea_level ?? 0);

    // Open-Meteo marine (temp mora)
    const seaU = `https://marine-api.open-meteo.com/v1/marine?latitude=${geo.lat}&longitude=${geo.lon}&hourly=sea_surface_temperature`;
    const seaR = await fetch(seaU); const seaJ = await seaR.json();
    const sea = Math.round(seaJ?.hourly?.sea_surface_temperature?.[0] ?? 0);

    res.json({ city, lat:geo.lat, lon:geo.lon, temp, wind, humid, pressure, sea, uv:null });
  }catch(e){ res.status(500).json({ error:"wx_failed" }); }
});

// ------------ fotografije (Wikimedia) ------------
app.get("/photos", async (req,res)=>{
  try{
    const city = req.query.city || "Croatia";
    const u = `https://commons.wikimedia.org/w/api.php?action=query&origin=*&format=json&prop=pageimages|images&generator=search&gsrsearch=${encodeURIComponent(city)}&gsrlimit=12&pithumbsize=640`;
    const r = await fetch(u); const j = await r.json();
    const pages = Object.values(j.query?.pages || {});
    const photos = pages.map(p=>p.thumbnail?.source).filter(Boolean);
    res.json({ photos });
  }catch(e){ res.status(500).json({ error:"photos_failed" }); }
});

// ------------ POI (Wikipedia geosearch) ------------
app.get("/poi", async (req,res)=>{
  try{
    const city = req.query.city || "Split";
    const geo = await geocodeCity(city);
    if(!geo) return res.json({ items:[] });

    const u = `https://hr.wikipedia.org/w/api.php?action=query&origin=*&list=geosearch&gscoord=${geo.lat}|${geo.lon}&gsradius=8000&gslimit=12&format=json`;
    const r = await fetch(u); const j = await r.json();
    const items = (j.query?.geosearch||[]).map(p=>({
      name:p.title, dist:p.dist, page:`https://hr.wikipedia.org/?curid=${p.pageid}`, category:"poi"
    }));
    res.json({ items });
  }catch(e){ res.status(500).json({ error:"poi_failed" }); }
});

// ------------ servisi & hitne ------------
app.get("/services", async (_req,res)=>{
  const items = [
    { name:"Policija 192", type:"emergency", href:"tel:192" },
    { name:"Hitna 194", type:"emergency", href:"tel:194" },
    { name:"Vatrogasci 193", type:"emergency", href:"tel:193" },
    { name:"EU 112", type:"emergency", href:"tel:112" },
    { name:"EV punionice (PlugShare)", type:"ev", href:"https://www.plugshare.com/" },
    { name:"Najbliža bolnica (Mape)", type:"health", href:"https://www.google.com/maps/search/hospital/" }
  ];
  res.json({ items });
});

// ------------ rezervacije (demo + redirect partneri) ------------
app.get("/booking/search", async (req,res)=>{
  const { city="Split" } = req.query;
  const rnd = (a,b)=>Math.round(a + Math.random()*(b-a));
  const mk = (i)=>({ id:i, name:`${city} Apartment #${100+i}`, price:rnd(45,180), address:`${city} centar`, rating:(Math.random()*2+3).toFixed(1) });
  res.json({ results: [mk(1),mk(2),mk(3),mk(4),mk(5),mk(6)] });
});
app.post("/booking/reserve", async (req,res)=> res.json({ ok:true, id:req.body?.id||null }));

// ------------ AI heuristika (bez ključeva) ------------
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

app.listen(PORT, ()=> console.log(`✅ TBW backend listening on :${PORT}`));
