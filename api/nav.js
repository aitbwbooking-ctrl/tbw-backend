// api/nav.js
import fetch from "node-fetch";
import { checkProToken } from "./_proAuth";

export default async function handler(req, res) {
  try {
    // -----------------------------
    // 1) READ PARAMS
    // -----------------------------
    const from = req.query.from;
    const to = req.query.to;

    if (!from || !to) {
      return res.status(400).json({
        error: "missing_params",
        message: "Parametri 'from' i 'to' su obavezni."
      });
    }

    // -----------------------------
    // 2) TOKEN + DEVICE ID
    // -----------------------------
    const clientToken =
      req.headers["x-tbw-token"] ||
      req.query.token ||
      "";

    const deviceId =
      req.headers["x-tbw-device"] ||
      req.query.deviceId ||
      "";

    const tokenCheck = checkProToken(clientToken, deviceId);
    const isPro = tokenCheck.isPro;

    // -----------------------------
    // 3) API KEYS iz ENV-a
    // -----------------------------
    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    const ORS_API_KEY = process.env.ORS_API_KEY;

    if (!GOOGLE_API_KEY) {
      console.warn("⚠ GOOGLE_MAPS_API_KEY nije postavljen u Vercel ENV");
    }
    if (!ORS_API_KEY) {
      console.warn("⚠ ORS_API_KEY nije postavljen u Vercel ENV");
    }

    // -----------------------------
    // 4) FREE MODE = OpenRouteService
    // -----------------------------
    if (!isPro) {
      console.log("NAV MODE: FREE");

      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}`;

      const body = {
        coordinates: [],
      };

      // geocoding FREE
      const geoUrl = (place) =>
        `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(
          place
        )}`;

      const gFrom = await (await fetch(geoUrl(from))).json();
      const gTo = await (await fetch(geoUrl(to))).json();

      if (!gFrom.features?.length || !gTo.features?.length) {
        return res.status(404).json({ error: "location_not_found" });
      }

      const [lonF, latF] = gFrom.features[0].geometry.coordinates;
      const [lonT, latT] = gTo.features[0].geometry.coordinates;

      body.coordinates = [
        [lonF, latF],
        [lonT, latT],
      ];

      const r = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

      const data = await r.json();

      return res.json({
        mode: "FREE",
        provider: "ORS",
        from,
        to,
        route: data,
      });
    }

    // -----------------------------
    // 5) PRO MODE = GOOGLE NAVIGATION
    // -----------------------------
    console.log("NAV MODE: PRO");

    const googleUrl =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${encodeURIComponent(from)}` +
      `&destination=${encodeURIComponent(to)}` +
      `&key=${GOOGLE_API_KEY}`;

    const gRes = await fetch(googleUrl);
    const gData = await gRes.json();

    if (!gData.routes?.length) {
      return res.status(404).json({ error: "google_no_route" });
    }

    return res.json({
      mode: "PRO",
      provider: "GOOGLE",
      from,
      to,
      route: gData,
    });

  } catch (err) {
    console.error("NAV ERROR:", err);
    return res.status(500).json({
      error: "nav_failed",
      message: err.message,
    });
  }
}
