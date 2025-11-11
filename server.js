import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(express.json());
app.use(cors({
  origin: "*"
}));

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "TBW AI BACKEND",
    status: "running ✅",
    time: new Date().toISOString()
  });
});

// ✅ Traffic (demo Google maps traffic tiles)
app.get("/api/traffic", async (req, res) => {
  res.json({
    demo: true,
    traffic: "live traffic tiles working ✅"
  });
});

// ✅ Weather (open-meteo, no key needed)
app.get("/api/weather", async (req, res) => {
  try {
    const { data } = await axios.get("https://api.open-meteo.com/v1/forecast?latitude=45.81&longitude=15.98&current_weather=true");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Weather API error" });
  }
});

// ✅ Sea temp (Hidrologija demo link)
app.get("/api/sea", async (req, res) => {
  res.json({
    location: "Adriatic",
    sea_temp: "17.8°C 🌊",
    waves: "0.3m",
    wind: "3 m/s"
  });
});

// ✅ Emergency services
app.get("/api/emergency", (req, res) => {
  res.json([
    { name: "Police", number: "192" },
    { name: "Fire Brigade", number: "193" },
    { name: "Ambulance", number: "194" },
    { name: "EU emergency", number: "112" }
  ]);
});

// ✅ Stores (open now demo)
app.get("/api/stores", (req, res) => {
  res.json([
    { name: "Kaufland", status: "Open ✅", closes: "21:00" },
    { name: "Konzum", status: "Open ✅", closes: "21:00" },
    { name: "Lidl", status: "Closed ❌", opens: "07:00" }
  ]);
});

// ✅ Booking search demo
app.get("/api/booking", (req, res) => {
  res.json({
    platform: "Booking.com API demo",
    status: "connected ✅"
  });
});

// ✅ Alerts (demo)
app.get("/api/alerts", (req, res) => {
  res.json([
    { type: "traffic", msg: "Zagreb – gužva na ulazu A1" },
    { type: "weather", msg: "Upozorenje na kišu u Dalmaciji" }
  ]);
});

// ✅ Default route
app.get("/", (req, res) => {
  res.send("TBW BACKEND ✅ LIVE");
});

export default app;
