/**
 * Pixelforge — who is allowed to spend the machine's CPU.
 *
 * There is no user store here, and there does not need to be: this app keeps
 * nothing of yours. Images go in, results come out, nothing is filed under a
 * name. So a session is just a signed cookie carrying the identity Authentik
 * vouched for, and identity itself lives there — including who is allowed in,
 * which is anybody in this application's group.
 *
 * The point of guarding it is not privacy but cost: removing a background runs
 * a neural network on the CPU for seconds at a time. Left open to the
 * internet, this is a free compute service for whoever finds it.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { oidcConfigured, type OidcIdentity } from "@/lib/oidc";

export const SESSION_COOKIE = "pixelforge_session";
const requestedTtl = Number(process.env.PIXELFORGE_SESSION_TTL_HOURS ?? 12);
const SESSION_TTL_HOURS = Number.isFinite(requestedTtl)
  ? Math.min(24, Math.max(1, requestedTtl))
  : 12;
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

export interface Account {
  sub: string;
  email: string;
  name?: string;
}

function secret(): string | null {
  const value = process.env.PIXELFORGE_SESSION_SECRET?.trim();
  return value && Buffer.byteLength(value, "utf8") >= 32 ? value : null;
}

/** Without a signing secret and an OIDC client, nobody can get in at all. */
export function isConfigured(): boolean {
  return Boolean(secret() && oidcConfigured());
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function issueToken(identity: OidcIdentity): string | null {
  const key = secret();
  if (!key) return null;
  const payload = Buffer.from(
    JSON.stringify({ ...identity, exp: Date.now() + SESSION_TTL_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

export function readToken(token: string | undefined): Account | null {
  const key = secret();
  if (!key || !token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(payload, key);

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Constant time: a normal comparison leaks the signature byte by byte
  // through how long it takes to answer.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof claims.exp !== "number" || claims.exp <= Date.now()) return null;
    if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 256 || typeof claims.email !== "string" || !claims.email || claims.email.length > 320 || (claims.name !== undefined && (typeof claims.name !== "string" || claims.name.length > 256))) return null;
    return { sub: claims.sub, email: claims.email, name: claims.name };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
};

export async function currentAccount(): Promise<Account | null> {
  const store = await cookies();
  return readToken(store.get(SESSION_COOKIE)?.value);
}

export async function startSession(identity: OidcIdentity): Promise<void> {
  const token = issueToken(identity);
  if (!token) throw new Error("PIXELFORGE_SESSION_SECRET is not set");
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** For the API routes: null to proceed, or the 401 to return. */
export async function requireAccount(): Promise<Response | null> {
  if (await currentAccount()) return null;
  return Response.json({ error: "Sign in to use this" }, { status: 401 });
}
