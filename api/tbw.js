export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const route = req.query.route;
  const city = req.query.city || "Split";

  function send(data) {
    return res.status(200).json({ ok: true, city, ...data });
  }

  switch (route) {

    case "weather":
      return send({
        temperature: 15,
        condition: "scattered clouds"
      });

    case "traffic":
      return send({
        status: "moderate",
        speed: "55 km/h",
        delay_min: 3,
        note: "Prometna nesreća – A1 kod Dugopolja, usporeno."
      });

    case "sea":
      return send({
        temperature: 18,
        note: "More oko 18°C, UV umjeren."
      });

    case "services":
      return send({
        items: [
          { name: "Konzum", status: "open", closes: "22:00" },
          { name: "Tommy", status: "open", closes: "21:00" }
        ]
      });

    case "transit":
      return send({
        items: [
          { type: "Bus", line: "37", from: "Split", to: "Trogir", next: "12:22" }
        ]
      });

    case "airport":
      return send({
        items: [
          {
            flight: "LH1412",
            from: "Frankfurt",
            to: "Zagreb",
            status: "on time",
            eta: "15:42"
          }
        ]
      });

    case "alerts":
      return send({
        alerts: [
          { message: "Prometna nesreća – A1 kod Dugopolja, usporeno" },
          { message: "Jako jugo – očekuje se neverin" }
        ]
      });

    default:
      return res.status(404).json({ ok: false, error: "Unknown route" });
  }
}
