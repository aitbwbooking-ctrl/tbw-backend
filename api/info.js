export default function handler(req, res) {
  res.status(200).json({
    city: "Split",
    country: "Hrvatska",
    timezone: "CET (UTC+1)",
    language: "Hrvatski",
    currency: "EUR",
    info: "TBW Navigator AI backend v1.0"
  });
}
