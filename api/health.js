// /api/health.js
import { setCors, handleOptions } from "./_cors";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  return res.status(200).json({
    ok: true,
    service: "TBW BACKEND",
    time: new Date().toISOString(),
  });
}
