// =========================================================
// TBW NAVI PRO MAX – FRONTEND MODULE
// =========================================================

console.log("TBW NAVI PRO MAX loaded…");

const NAVI_API_BASE = "https://tbw-backend.vercel.app/api/navi";

async function callNavi(route, method = "GET", body = null) {
  try {
    const url = `${NAVI_API_BASE}?route=${encodeURIComponent(route)}`;
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Navi API error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("TBW NAVI PRO MAX ERROR:", err);
    return { error: true, message: err.message };
  }
}

// osnovne rute
async function naviHealth()     { return callNavi("health"); }
async function naviTraffic()    { return callNavi("traffic"); }
async function naviCameras()    { return callNavi("cameras"); }
async function naviAccidents()  { return callNavi("accidents"); }
async function naviRoadworks()  { return callNavi("roadworks"); }
async function naviTransit()    { return callNavi("transit"); }
async function naviAirport()    { return callNavi("airport"); }
async function naviWeather()    { return callNavi("weather"); }
async function naviHudConfig()  { return callNavi("hud"); }
async function naviVoiceInfo()  { return callNavi("voice"); }

// AI suvozač
async function naviAskAI(question) {
  return callNavi("ai-assistant", "POST", { question });
}

// bonus rute
async function naviFire()       { return callNavi("fire"); }
async function naviEarthquake() { return callNavi("earthquake"); }
async function naviFlood()      { return callNavi("flood"); }
async function naviStorm()      { return callNavi("storm"); }
async function naviRadar()      { return callNavi("radar"); }
async function naviFerry()      { return callNavi("ferry"); }
async function naviBorders()    { return callNavi("borders"); }

window.TBWNavi = {
  health:     naviHealth,
  traffic:    naviTraffic,
  cameras:    naviCameras,
  accidents:  naviAccidents,
  roadworks:  naviRoadworks,
  transit:    naviTransit,
  airport:    naviAirport,
  weather:    naviWeather,
  hud:        naviHudConfig,
  voice:      naviVoiceInfo,
  askAI:      naviAskAI,
  fire:       naviFire,
  earthquake: naviEarthquake,
  flood:      naviFlood,
  storm:      naviStorm,
  radar:      naviRadar,
  ferry:      naviFerry,
  borders:    naviBorders
};

console.log("TBW NAVI PRO MAX ready.");
