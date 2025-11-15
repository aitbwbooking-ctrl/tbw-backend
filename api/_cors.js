// /api/_cors.js

export function cors(response, origin) {
  const allowed = [
    "https://tbw-frontend.vercel.app",
    "http://localhost:3000"
  ];

  const headers = {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json"
  };

  return new Response(response, { status: 200, headers });
}

export function handleOptions(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }
  return null;
}
