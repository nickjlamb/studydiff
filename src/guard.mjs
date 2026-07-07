// Production guards for the public deployment: identify the caller, rate-limit
// live (API-spending) requests per IP, cap total live calls per day so a burst
// can't drain the API budget, and cache results so repeated comparisons are free.
// Zero dependencies, all in-memory (fine for a single-instance portfolio app).

/** Best-effort client IP behind Railway's proxy. */
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Fixed-window limiter.
 * @param {{perHour:number, dailyGlobalLive:number}} opts
 */
export function createLimiter({ perHour = 30, dailyGlobalLive = 300 } = {}) {
  const hits = new Map();           // ip -> { count, windowStart }
  let live = { count: 0, day: today() };

  function today() { return new Date().toISOString().slice(0, 10); }

  return {
    /** @returns {{ok:boolean, reason?:string, retryAfter?:number}} */
    check(ip, isLive) {
      const now = Date.now();
      const rec = hits.get(ip);
      if (!rec || now - rec.windowStart > 3600_000) {
        hits.set(ip, { count: 1, windowStart: now });
      } else {
        rec.count++;
        if (rec.count > perHour) {
          return { ok: false, reason: `Rate limit: ${perHour} requests/hour. Try again later.`, retryAfter: Math.ceil((3600_000 - (now - rec.windowStart)) / 1000) };
        }
      }
      if (isLive) {
        if (live.day !== today()) live = { count: 0, day: today() };
        if (live.count >= dailyGlobalLive) {
          return { ok: false, reason: 'The live demo has hit its daily cap. Try the built-in examples, which always work.' };
        }
        live.count++;
      }
      return { ok: true };
    },
    stats() { return { trackedIps: hits.size, liveToday: live.count }; },
  };
}

/** Tiny LRU + TTL cache. */
export function createCache({ max = 200, ttlMs = 6 * 3600_000 } = {}) {
  const map = new Map(); // key -> { value, expires }
  return {
    get(key) {
      const e = map.get(key);
      if (!e) return undefined;
      if (Date.now() > e.expires) { map.delete(key); return undefined; }
      map.delete(key); map.set(key, e); // bump recency
      return e.value;
    },
    set(key, value) {
      map.set(key, { value, expires: Date.now() + ttlMs });
      if (map.size > max) map.delete(map.keys().next().value); // evict oldest
    },
  };
}

/** Security headers, including a CSP that permits embedding from pharmatools.ai. */
export function securityHeaders(res, { embedOrigins = "'self'" } = {}) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    `frame-ancestors ${embedOrigins}`,
  ].join('; '));
}
