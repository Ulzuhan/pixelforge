const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 30, windowMs = 60 * 60 * 1000): Response | null {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((time) => time > cutoff);
  if (recent.length >= limit) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((recent[0] + windowMs - now) / 1000)) } });
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [candidate, values] of hits) if (values.at(-1)! <= cutoff) hits.delete(candidate);
  return null;
}
