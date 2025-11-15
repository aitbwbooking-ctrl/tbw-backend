// /api/traffic.js
import { setCors, handleOptions } from "./_cors";

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;
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

  if (!TOMTOM_API_KEY || !OPENTRIPMAP_API_KEY) {
    return res.status(200).json({
      city,
      description: `Traffic in ${city}: normal (fallback).`,
      level: "normal",
      fallback: true,
    });
  }

  try {
    const geo = await cityToCoords(city);
    const point = `${geo.lat},${geo.lon}`;

    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_API_KEY}&point=${point}`;

    const r = await fetch(url);
    if (!r.ok) throw new Error("TomTom flow error " + r.status);

    const data = await r.json();
    const cur = data.flowSegmentData.currentSpeed;
    const free = data.flowSegmentData.freeFlowSpeed;

    let level = "normal";
    if (cur < free * 0.4) level = "heavy";
    else if (cur < free * 0.7) level = "slow";

    const description = `Traffic in ${city}: ${level}. Avg speed ${cur} km/h (free ${free} km/h).`;

    return res.status(200).json({
      city,
      description,
      level,
      raw: data.flowSegmentData,
    });
  } catch (err) {
    console.error("TRAFFIC ERROR", err);
    return res.status(200).json({
      city,
      description: `Traffic info for ${city} unavailable, assume normal.`,
      level: "unknown",
      fallback: true,
    });
  }
}
