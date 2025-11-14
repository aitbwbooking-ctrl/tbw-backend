// api/navi.js
// TBW Navigation API (Model A - mjesečni PRO token)
// Vercel serverless (Node 18+, ESM). Jedan file, više "routa" preko internog routera.

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-TBW-Admin");
  if (req.method === "OPTIONS") return res.status(200).end();

  // --- ENV ---
  const {
    TBW_ACCESS_PASSWORD = "",
    GOOGLE_MAPS_API_KEY = "",
    GOOGLE_PLACES_API_KEY = "",
    TBW_TOKENS_JSON = "[]", // JSON array: [{token, expires, note}]
  } = process.env;

  // --- helpers ---
  const send = (code, data) =>
    res.status(code).json({ ok: code < 400, ...data });

  const readJSON = async () => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname.replace(/\/api\/navi\/?/, "/"); // normaliziraj na /subroute
  const q = Object.fromEntries(url.searchParams.entries());

  // --- token store (in-memory during invocation) ---
  let tokenStore;
  try {
    const parsed = JSON.parse(TBW_TOKENS_JSON || "[]");
    tokenStore = Array.isArray(parsed) ? parsed : [];
  } catch {
    tokenStore = [];
  }

  const genToken = () =>
    "PRO-" +
    [...crypto.getRandomValues(new Uint8Array(12))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

  const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  const daysLeft = (iso) => {
    const ms = new Date(iso) - new Date();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const findToken = (t) =>
    tokenStore.find((x) => x.token?.trim() === String(t || "").trim());

  const requireAdmin = () => {
    const hdr = req.headers["x-tbw-admin"];
    if (!TBW_ACCESS_PASSWORD || hdr !== TBW_ACCESS_PASSWORD) {
      send(401, { error: "Admin auth failed" });
      return false;
    }
    return true;
  };

  // ------------------ ROUTES ------------------

  // 1) Health
  if (req.method === "GET" && (path === "/" || path === "/health")) {
    return send(200, {
      service: "TBW NAVI",
      status: "running",
      time: new Date().toISOString(),
      endpoints: [
        "/api/navi/health",
        "/api/navi/places?q=Split&session=abc",
        "/api/navi/eta?origins=Zagreb&destinations=Split",
        "/api/navi/route",
        "/api/navi/token/check",
        "/api/navi/token/new  (admin)",
        "/api/navi/token/export (admin)",
      ],
    });
  }

  // 2) Admin: kreiraj novi PRO token (default 1 mjesec)
  if (req.method === "POST" && path === "/token/new") {
    if (!requireAdmin()) return;
    const body = await readJSON();
    const months = Math.max(1, Math.min(24, Number(body.months || 1)));
    const token = genToken();
    const expires = addMonths(new Date(), months).toISOString();
    tokenStore.push({
      token,
      expires,
      note: body.note || "",
      createdAt: new Date().toISOString(),
      months,
    });
    // VAZNO: Vercel nema trajni disk. Vrati cijeli JSON da ga kopiraš u ENV var TBW_TOKENS_JSON.
    return send(200, {
      message:
        "Token kreiran. Kopiraj 'tokens_json' u TBW_TOKENS_JSON i redeploy.",
      token,
      expires,
      months,
      tokens_json: JSON.stringify(tokenStore),
    });
  }

  // 3) Admin: export svih tokena (da ažuriraš TBW_TOKENS_JSON u Vercelu)
  if (req.method === "GET" && path === "/token/export") {
    if (!requireAdmin()) return;
    return send(200, {
      tokens: tokenStore,
      tokens_json: JSON.stringify(tokenStore),
      hint: "Zalijepi 'tokens_json' u ENV var TBW_TOKENS_JSON (All Environments), pa Redeploy.",
    });
  }

  // 4) Provjera tokena (public)
  if (req.method === "POST" && path === "/token/check") {
    const body = await readJSON();
    const token = (body.token || q.token || "").trim();
    if (!token) return send(400, { error: "Nedostaje token" });
    const rec = findToken(token);
    if (!rec) return send(200, { valid: false, reason: "not_found" });
    const left = daysLeft(rec.expires);
    return send(200, {
      valid: left >= 0,
      days_left: left,
      expires: rec.expires,
      note: rec.note || "",
    });
  }

  // 5) Places Autocomplete (FREE)
  if (req.method === "GET" && path === "/places") {
    try {
      const input = q.q || q.input || "";
      const sessiontoken = q.session || q.sessiontoken || "";
      if (!input) return send(400, { error: "Nedostaje q/input" });
      const urlPlaces = new URL(
        "https://maps.googleapis.com/maps/api/place/autocomplete/json"
      );
      urlPlaces.searchParams.set("input", input);
      urlPlaces.searchParams.set("key", GOOGLE_PLACES_API_KEY || GOOGLE_MAPS_API_KEY);
      urlPlaces.searchParams.set("language", q.lang || "hr");
      if (sessiontoken) urlPlaces.searchParams.set("sessiontoken", sessiontoken);

      const r = await fetch(urlPlaces, { method: "GET" });
      const data = await r.json();
      return send(200, { provider: "google-places", query: input, data });
    } catch (e) {
      return send(500, { error: "places_failed", detail: String(e) });
    }
  }

  // 6) ETA (Distance Matrix)
  if (req.method === "GET" && path === "/eta") {
    try {
      const origins = q.origins || q.origin;
      const destinations = q.destinations || q.destination;
      if (!origins || !destinations)
        return send(400, { error: "Nedostaje origins/destinations" });

      const m = (q.mode || "driving").toLowerCase();
      const urlDM = new URL(
        "https://maps.googleapis.com/maps/api/distancematrix/json"
      );
      urlDM.searchParams.set("origins", origins);
      urlDM.searchParams.set("destinations", destinations);
      urlDM.searchParams.set("mode", m);
      urlDM.searchParams.set("language", q.lang || "hr");
      urlDM.searchParams.set("key", GOOGLE_MAPS_API_KEY);

      const r = await fetch(urlDM, { method: "GET" });
      const data = await r.json();
      return send(200, { provider: "google-matrix", mode: m, data });
    } catch (e) {
      return send(500, { error: "eta_failed", detail: String(e) });
    }
  }

  // 7) Route (PRO ili FREE)
  if (req.method === "POST" && path === "/route") {
    try {
      const body = await readJSON();
      const origin = body.origin || q.origin;
      const destination = body.destination || q.destination;
      const mode = (body.mode || q.mode || "driving").toLowerCase();
      const token = (body.token || body.proToken || q.token || "").trim();

      if (!origin || !destination)
        return send(400, { error: "Nedostaje origin/destination" });

      // provjera PRO tokena
      let tier = "FREE";
      if (token) {
        const rec = findToken(token);
        if (rec && daysLeft(rec.expires) >= 0) tier = "PRO";
      }

      // Google Directions (koristimo za oba — razlika: PRO dozvoljava više parametara)
      const urlDir = new URL(
        "https://maps.googleapis.com/maps/api/directions/json"
      );
      urlDir.searchParams.set("origin", origin);
      urlDir.searchParams.set("destination", destination);
      urlDir.searchParams.set("mode", ["driving", "walking", "bicycling", "transit"].includes(mode) ? mode : "driving");
      urlDir.searchParams.set("language", body.lang || q.lang || "hr");
      if (tier === "PRO") {
        if (body.avoid) urlDir.searchParams.set("avoid", String(body.avoid)); // tolls|highways|ferries|indoor
        if (body.waypoints && Array.isArray(body.waypoints)) {
          urlDir.searchParams.set("waypoints", body.waypoints.join("|"));
        }
        if (body.departure_time) {
          urlDir.searchParams.set("departure_time", String(body.departure_time));
        }
      }
      urlDir.searchParams.set("key", GOOGLE_MAPS_API_KEY);

      const r = await fetch(urlDir, { method: "GET" });
      const data = await r.json();

      return send(200, {
        tier,
        provider: "google-directions",
        origin,
        destination,
        mode,
        data,
      });
    } catch (e) {
      return send(500, { error: "route_failed", detail: String(e) });
    }
  }

  // 8) Dostupni modovi (helper)
  if (req.method === "GET" && path === "/modes") {
    return send(200, {
      modes: ["driving", "walking", "bicycling", "transit"],
      default: "driving",
    });
  }

  // 404
  return send(404, { error: "Unknown route", path });
}
