export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const route = req.query.route;
  const send = (data) => res.status(200).json({ ok: true, ...data });

  switch (route) {
    case "alerts":
      return send({
        alerts: [
          { message: "Prometna nesreća – A1 kod Dugopolja, usporeno." },
          { message: "Jako jugo očekuje se navečer." }
        ]
      });

    case "weather":
      return send({
        city: req.query.city || "Split",
        temperature: 15,
        condition: "scattered clouds"
      });

    case "traffic":
      return send({
        traffic_status: "normal",
        speed: 55,
        delay_min: 3
      });

    case "sea":
      return send({
        info: "More oko 13°C. UV umjeren."
      });

    case "shops":
      return send({
        items: [
          { name: "Konzum", status: "otvoreno", closes: "22:00" },
          { name: "Tommy", status: "otvoreno", closes: "21:00" }
        ]
      });

    case "transit":
      return send({
        buses: [
          { line: 37, from: "Split", to: "Trogir", next: "12:22" }
        ]
      });

    case "airport":
      return send({
        flights: [
          {
            flight_no: "LH1412",
            from: "Frankfurt",
            to: "Zagreb",
            arrival: "15:42",
            status: "on time"
          }
        ]
      });

    case "streetview":
      return send({
        heading: 120,
        pitch: 0,
        zoom: 1
      });

    case "ai-assistant":
      return send({
        reply: "Provjeravam sve podatke za vas..."
      });

    default:
      return res.status(404).json({
        ok: false,
        error: "Unknown route"
      });
  }
}
