export default function handler(req, res) {
  res.status(200).json({
    buses: [
      { line: "7", to: "Žnjan", next: "10:15" },
      { line: "8", to: "Bol", next: "10:20" }
    ],
    ferries: [
      { route: "Split - Supetar", next: "11:00" },
      { route: "Split - Stari Grad", next: "12:30" }
    ]
  });
}
