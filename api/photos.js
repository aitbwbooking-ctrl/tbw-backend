// /api/photos.js
import { setCors, handleOptions } from "./_cors";

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  const q = req.query.q || "Croatia";

  if (!UNSPLASH_ACCESS_KEY) {
    // fallback
    return res.status(200).json({
      results: [],
      fallback: true,
    });
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      q
    )}&per_page=8&orientation=landscape`;

    const apiRes = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    });

    if (!apiRes.ok) {
      throw new Error("Unsplash error " + apiRes.status);
    }

    const data = await apiRes.json();
    return res.status(200).json({
      results: data.results || [],
    });
  } catch (err) {
    console.error("PHOTOS ERROR", err);
    return res.status(200).json({
      results: [],
      fallback: true,
    });
  }
}
