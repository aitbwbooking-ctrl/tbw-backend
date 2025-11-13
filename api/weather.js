export default function handler(req, res) {
  res.status(200).json({
    city: "Split",
    temperature: "19°C",
    condition: "sunčano ☀️",
    humidity: "64%",
    wind: "12 km/h",
    updated: new Date().toISOString()
  });
}
