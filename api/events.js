export default function handler(req, res) {
  res.status(200).json({
    upcoming: [
      { name: "TBW Konferencija 2025", date: "2025-11-14", location: "Spaladium Arena" },
      { name: "Startup Meetup", date: "2025-11-20", location: "City Center Split" }
    ],
    updated: new Date().toISOString()
  });
}
