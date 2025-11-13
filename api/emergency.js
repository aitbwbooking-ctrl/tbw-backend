export default function handler(req, res) {
  res.status(200).json({
    police: "192",
    fire_department: "193",
    ambulance: "194",
    emergency_center: "112",
    hospital: "KBC Split",
    pharmacy_24h: "Ljekarna 'Centar', Marmontova 2"
  });
}
