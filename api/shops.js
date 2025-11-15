// /api/shops.js
import { setCors, handleOptions } from "./_cors";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const OPENTRIPMAP_API_KEY = process.env.OPENTRIPMAP_API_KEY;

async function cityToCoords(city) {
  const url = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(
    city
  )}&apikey=${OPENTRIPMAP_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("geoname fail");
  return r.json();
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  const city = req.query.city || "Split";

  if (!GOOGLE_PLACES_API_KEY || !OPENTRIPMAP_API_KEY) {
    return res.status(200).json({
      items: [
        { name: "Local supermarket", status: "open", closes: "21:00" },
        { name: "Gas station", status: "open", closes: "00:00" },
      ],
      fallback: true,
    });
  }

  try {
    const geo = await cityToCoords(city);
    const loc = `${geo.lat},${geo.lon}`;

    const types = ["supermarket", "gas_station", "pharmacy", "hospital"];

    const results = [];

    for (const type of types) {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${loc}&radius=5000&type=${type}&key=${GOOGLE_PLACES_API_KEY}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      if (data.results) {
        results.push(
          ...data.results.map((p) => ({
            name: p.name,
            status: p.opening_hours?.open_now ? "open" : "closed / unknown",
            closes: "?",
          }))
        );
      }
    }

    return res.status(200).json({
      items: results.slice(0, 20),
    });
  } catch (err) {
    console.error("SHOPS ERROR", err);
    return res.status(200).json({
      items: [
        { name: "Main supermarket", status: "open", closes: "21:00" },
      ],
      fallback: true,
    });
  }
}
