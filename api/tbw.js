export default async function handler(req, res) {

  // ===== GLOBAL CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ===== READ ROUTE =====
  const route = req.query.route;
  const send = (data) => res.status(200).json({ ok: true, ...data });

  // ===== IMPORT ENV KEYS =====
  const OPENWEATHER = process.env.OPENWEATHER_API_KEY;
  const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY;
  const OPENTRIP = process.env.OPENTRIPMAP_API_KEY;
  const TOMTOM = process.env.TOMTOM_API_KEY;
  const GOOGLE_MAPS = process.env.GOOGLE_MAPS_API_KEY;

  // ===== HELPERS =====
  async function fetchJSON(url) {
    const r = await fetch(url);
    return r.json();
  }

  // ============================================
  // ===============  ROUTES  ===================
  // ============================================

  switch (route) {

    // ============================================
    // 1) HEALTH CHECK
    // ============================================
    case "health":
      return send({
        service: "TBW AI PREMIUM BACKEND",
        status: "running",
        version: "5.0.0"
      });


    // ============================================
    // 2) WEATHER (REAL API)
    // ============================================
    case "weather": {
      const city = req.query.city || "Split";
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${OPENWEATHER}`;
      let data = await fetchJSON(url);

      return send({
        city: data.name,
        temp: data.main.temp,
        feels_like: data.main.feels_like,
        humidity: data.main.humidity,
        wind: data.wind.speed,
        condition: data.weather[0].description,
        icon: data.weather[0].icon
      });
    }


    // ============================================
    // 3) PHOTOS (Unsplash)
    // ============================================
    case "photos": {
      const q = req.query.q || "Croatia";
      const url = `https://api.unsplash.com/search/photos?query=${q}&per_page=10&client_id=${UNSPLASH}`;
      const data = await fetchJSON(url);

      return send({
        results: data.results?.map(p => ({
          url: p.urls.small,
          alt: p.alt_description
        }))
      });
    }


    // ============================================
    // 4) POI / ATTRACTIONS (OPENTRIPMAP)
    // ============================================
    case "poi": {
      const city = req.query.city || "Split";
      const geo = await fetchJSON(`https://geocode.xyz/${city}?json=1`);

      const lat = geo.latt;
      const lon = geo.longt;

      const url = `https://api.opentripmap.com/0.1/en/places/radius?radius=3000&lon=${lon}&lat=${lat}&apikey=${OPENTRIP}`;
      const data = await fetchJSON(url);

      return send({
        items: data.features?.map(p => ({
          name: p.properties.name,
          kind: p.properties.kinds
        }))
      });
    }


    // ============================================
    // 5) TRAFFIC (TomTom)
    // ============================================
    case "traffic": {
      const city = req.query.city || "Split";

      const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?key=${TOMTOM}&point=43.5081,16.4402`;

      const t = await fetchJSON(url);

      return send({
        traffic_status: t.flowSegmentData.roadClosure ? "closed" : "open",
        speed: t.flowSegmentData.currentSpeed,
        free_speed: t.flowSegmentData.freeFlowSpeed
      });
    }


    // ============================================
    // 6) AIRPORT STATUS (FAKE BUT REALISTIC)
    // ============================================
    case "airport":
      return send({
        flights: [
          {
            flight_no: "LH1412",
            from: "Frankfurt",
            to: "Zagreb",
            eta: "15:42",
            delay: "0 min",
            gate: "A6",
            status: "on time"
          },
          {
            flight_no: "OU653",
            from: "Split",
            to: "Zagreb",
            eta: "17:10",
            delay: "12 min",
            gate: "B3",
            status: "delayed"
          }
        ]
      });


    // ============================================
    // 7) SHOPS / SERVICES
    // ============================================
    case "shops":
      return send({
        items: [
          { name: "Konzum", status: "open", closes: "22:00" },
          { name: "Tommy", status: "open", closes: "21:00" },
          { name: "DM", status: "open", closes: "20:00" }
        ]
      });


    // ============================================
    // 8) PUBLIC TRANSIT
    // ============================================
    case "transit":
      return send({
        buses: [
          { line: 37, from: "Split", to: "Trogir", next: "12:25" }
        ],
        trams: [
          { line: 12, from: "Dubrava", to: "Ljubljanica", next: "4 min" }
        ],
        trains: [
          { line: "IC-248", from: "Zagreb", to: "Vinkovci", next: "14:10" }
        ]
      });


    // ============================================
    // 9) EMERGENCY ALERTS
    // ============================================
    case "alerts":
      return send({
        alerts: [
          { type: "fire", message: "Požar u blizini Dugopolja – oprez!" },
          { type: "accident", message: "Prometna kod Solina – zastoj 2.3km" }
        ]
      });


    // ============================================
    // 10) NAVIGATION (Google Directions)
    // ============================================
    case "navigate": {
      const from = req.query.from || "Zagreb";
      const to = req.query.to || "Split";

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from}&destination=${to}&key=${GOOGLE_MAPS}`;
      const d = await fetchJSON(url);

      return send({
        summary: d.routes[0].summary,
        distance: d.routes[0].legs[0].distance.text,
        duration: d.routes[0].legs[0].duration.text
      });
    }


    // ============================================
    // 11) AI VOICE ASSISTANT
    // ============================================
    case "ai":
      return send({
        reply: "Razumijem. Izračunavam najbolju rutu za vas..."
      });


    // ============================================
    // 404 UNKNOWN ROUTE
    // ============================================
    default:
      return res.status(404).json({
        ok: false,
        error: "Unknown route"
      });
  }
}
