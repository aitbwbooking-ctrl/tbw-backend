export default function handler(req, res) {
  if (req.method === 'GET' && req.url === '/api/health') {
    return res.status(200).json({
      ok: true,
      service: 'TBW AI BACKEND',
      status: 'running ✅',
      time: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && req.url === '/api/shops') {
    return res.status(200).json({
      city: 'Zagreb',
      open_now: [
        { name: 'Kaufland', until: '21:00' },
        { name: 'Konzum', until: '21:00' },
      ],
      closed: [{ name: 'Lidl' }],
    });
  }

  return res
    .status(200)
    .send('TBW AI BACKEND LIVE ✅ (try /api/health or /api/shops)');
}
