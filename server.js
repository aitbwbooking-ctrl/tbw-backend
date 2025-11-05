import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const OW = process.env.OPENWEATHER_API_KEY;
const US = process.env.UNSPLASH_ACCESS_KEY;
const OT = process.env.OPENTRIPMAP_API_KEY;
const OA = process.env.OPENAI_API_KEY;

app.get("/api/health",(req,res)=>res.json({ok:true}));

app.get("/api/weather", async (req,res)=>{
  const city = req.query.city;
  const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OW}&units=metric&lang=hr`);
  res.json(await r.json());
});

app.get("/api/photos", async (req,res)=>{
  const q = req.query.q;
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${q}&per_page=6&client_id=${US}`);
  res.json(await r.json());
});

app.get("/api/poi", async (req,res)=>{
  const city=req.query.city;
  const g = await (await fetch(`https://api.opentripmap.com/0.1/en/places/geoname?name=${city}&apikey=${OT}`)).json();
  const l = await (await fetch(`https://api.opentripmap.com/0.1/en/places/radius?radius=4000&lon=${g.lon}&lat=${g.lat}&limit=6&format=json&apikey=${OT}`)).json();

  const out = [];
  for(const p of l){
    const i = await (await fetch(`https://api.opentripmap.com/0.1/en/places/xid/${p.xid}?apikey=${OT}`)).json();
    out.push({
      name:i.name,
      short:i.wikipedia_extracts?.text?.slice(0,120)||"",
      lat:i.point?.lat, lon:i.point?.lon
    });
  }
  res.json({items:out});
});

app.post("/api/chat", async (req,res)=>{
  const msg=req.body.message;
  const r=await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${OA}`
    },
    body:JSON.stringify({
      model:"gpt-4o-mini",
      messages:[
        {role:"system",content:"Ti si turistički asistent. Odgovaraj kratko i na hrvatskom."},
        {role:"user",content:msg}
      ]
    })
  });
  const d=await r.json();
  res.json({reply:d.choices?.[0]?.message?.content||"Nema odgovora"});
});

app.listen(PORT,()=>console.log("TBW backend running"));
