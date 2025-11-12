export default function handler(req, res) {
  // Demo odgovor – kasnije ćemo spojiti na prave izvore
  res.status(200).json({
    city: "Split",
    opened: [
      { name: "Kaufland", until: "21:00" },
      { name: "Konzum", until: "21:00" }
    ],
    closed: [{ name: "Lidl" }]
  });
}
