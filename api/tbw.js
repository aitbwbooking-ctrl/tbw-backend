export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const route = req.query.route;
    const city = req.query.city || "Split";

    function send(data) {
        return res.status(200).json({ ok: true, ...data });
    }

    switch (route) {

        case "weather":
            return send({
                city,
                temperature: 15,
                condition: "scattered clouds"
            });

        case "traffic":
            return send({
                traffic_status: "moderate",
                speed: "55 km/h",
                delay: "3 min"
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
                buses: [
                    { line: 37, from: "Split", to: "Trogir", next: "12:22" }
                ]
            });

        // ⭐ NOVO – STANJE MORA (popravlja sve tvoje greške)
        case "sea":
            return send({
                sea: {
                    temperature: "13°C",
                    uv: "umjeren",
                    message: "More oko 13°C. UV umjeren."
                }
            });

        case "airport":
            return send({
                flights: [
                    {
                        flight_no: "LH1412",
                        from: "Frankfurt",
                        to: "Zagreb",
                        status: "on time",
                        eta: "15:42"
                    }
                ],
                rds: [
                    { message: "Požar u blizini Dugopolja – oprez!" }
                ]
            });

        case "alerts":
            return send({
                alerts: [
                    "Prometna nesreća – A1 kod Dugopolja",
                    "Jako jugo – očekuje se nevera"
                ]
            });

        default:
            return res.status(404).json({ ok: false, error: "Unknown route" });
    }
}
