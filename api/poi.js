// /api/poi.js
import { setCors, handleOptions } from "./_cors";

const OPENTRIPMAP_API_KEY = process.env.OPENTRIPMAP_API_KEY;

async function geocodeCity(city) {
  const url = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(
    city
  )}&apikey=${OPENTRIPMAP_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Geoname error");
  return r.json();
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  const city = req.query.city || "Split";

  if (!OPENTRIPMAP_API_KEY) {
    return res.status(200).json({
      items: [
        { name: `${city} Old Town`, short: "Historic center and city walls." },
        { name: "City Beach", short: "Popular local beach." },
      ],
      fallback: true,
    });
  }

  try {
    const geo = await geocodeCity(city);
    const { lat, lon } = geo;

    const url = `https://api.opentripmap.com/0.1/en/places/radius?radius=3000&lon=${lon}&lat=${lat}&rate=2&limit=10&apikey=${OPENTRIPMAP_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("Radius error");

    const list = await r.json();

    const items = list.features
      .map((f) => ({
        name: f.properties.name || "Unknown place",
        short: f.properties.kinds || "",
      }))
      .filter((i) => i.name);

    return res.status(200).json({ items });
  } catch (err) {
    console.error("POI ERROR", err);
    return res.status(200).json({
      items: [
        { name: `${city} Center`, short: "Main attractions area." },
        { name: "Harbor", short: "Promenade and ferries." },
      ],
      fallback: true,
    });
  }
}
