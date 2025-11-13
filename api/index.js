export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "TBW AI BACKEND",
    status: "running ✅",
    time: new Date().toISOString(),
    endpoints: [
      "/api/health",
      "/api/shops",
      "/api/weather",
      "/api/events",
      "/api/transport",
      "/api/emergency",
      "/api/info"
    ]
  });
}
