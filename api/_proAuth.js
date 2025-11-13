// api/_proAuth.js
export function loadTokens() {
  try {
    const raw = process.env.TBW_TOKENS_JSON;
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (e) {
    console.error("TBW_TOKENS_JSON parse error:", e);
    return [];
  }
}

export function checkProToken(token, deviceId) {
  const tokens = loadTokens();
  if (!token) {
    return { isPro: false, reason: "no_token" };
  }

  const t = tokens.find((x) => x.token === token);
  if (!t) {
    return { isPro: false, reason: "not_found" };
  }

  if (t.active === false) {
    return { isPro: false, reason: "inactive" };
  }

  if (t.expiresAt) {
    const now = Date.now();
    const exp = Date.parse(t.expiresAt);
    if (!isNaN(exp) && exp < now) {
      return { isPro: false, reason: "expired" };
    }
  }

  if (!t.deviceId) {
    return { isPro: true, reason: "first_lock", userToken: t };
  }

  if (deviceId && t.deviceId === deviceId) {
    return { isPro: true, reason: "same_device", userToken: t };
  }

  return { isPro: false, reason: "device_mismatch" };
}
