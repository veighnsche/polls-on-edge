// ---
// Middleware: Anonymous JWT Auth & Cookie Parsing
// ---
// This middleware ensures every request has an anonymous JWT stored in an HttpOnly cookie.
// - Parses cookies and attaches a req.cookie(name) helper to the request object.
// - Issues a new anonymous JWT if missing or invalid, and sets it as an HttpOnly cookie.
// ---

import { sign, verify } from "hono/jwt";
import type { MiddlewareHandler } from "hono";

const JWT_COOKIE_NAME = "jwt";              // Name of the JWT cookie

/**
 * Hono middleware for:
 * 1. Parsing cookies and providing a req.cookie(name) helper for downstream handlers.
 * 2. Ensuring every request has a valid anonymous JWT (as an HttpOnly cookie).
 *
 * - If a valid JWT is present, it is used as-is.
 * - If missing or invalid, a new anonymous JWT is generated and set in the response.
 * - This pattern supports stateless, anonymous authentication for all users.
 */
export const anonJwtCookie: MiddlewareHandler = async (c, next) => {
  // --- Cookie Parsing ---
  // Parse the Cookie header into an object: { name: value, ... }
  const cookieHeader = c.req.raw.headers.get('cookie') || '';
  console.log('[anonJwtCookie] Raw cookie header:', cookieHeader);
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (!name) return;
    cookies[name] = decodeURIComponent(rest.join('='));
  });
  console.log('[anonJwtCookie] Parsed cookies:', cookies);
  // Attach a cookie(name) helper to the request object for easy access
  (c.req as any).cookie = (name: string) => cookies[name];

  // --- Anonymous JWT Logic ---
  // Check for a valid JWT cookie
  const JWT_SECRET = c.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set in the environment variables!");
  }
  const cookieValue = cookies[JWT_COOKIE_NAME];
  let valid = false;
  let jwtPayload: any = undefined;
  if (cookieValue) {
    try {
      jwtPayload = await verify(cookieValue, JWT_SECRET);
      valid = true; // JWT is valid
      console.log('[anonJwtCookie] Valid JWT found, payload:', jwtPayload);
    } catch (e) {
      console.log('[anonJwtCookie] Invalid or expired JWT:', e);
      // Invalid or expired token; will issue a new one
    }
  }
  // If no valid JWT, issue a new anonymous JWT and set it as an HttpOnly cookie
  if (!valid) {
    const payload = {
      sub: "anon-" + Math.random().toString(36).substring(2), // Unique anonymous subject
      role: "anonymous",
      iat: Math.floor(Date.now() / 1000), // Issued at (seconds)
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // Expires in 1 week
    };
    const token = await sign(payload, JWT_SECRET);
    c.header(
      "Set-Cookie",
      `${JWT_COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
    );
    jwtPayload = payload;
    console.log('[anonJwtCookie] Issued new anonymous JWT:', payload);
  }

  // Attach the JWT payload to context for downstream access
  c.set('jwtPayload', jwtPayload);
  console.log('[anonJwtCookie] Attached jwtPayload to context:', jwtPayload);

  await next(); // Continue to route handler
};
