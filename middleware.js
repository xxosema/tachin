/**
 * TACHÍN — protección del panel admin (login propio + cookie de
 * sesión firmada, en vez del diálogo nativo de Basic Auth).
 *
 * Cubre /admin (la página) y /api/wines* salvo el GET (que tiene que
 * quedar público: es como el propio sitio carga el catálogo) y la
 * propia pantalla de login (si no, nadie podría llegar a ella).
 *
 * Usuario y contraseña en las variables de entorno ADMIN_USER /
 * ADMIN_PASS de Vercel (api/login.js las valida). La cookie se firma
 * con SESSION_SECRET — configúrala también en Vercel; si no está
 * definida se usa un valor por defecto (solo vale para desarrollo).
 */

import { next } from "@vercel/edge";

export const config = {
  matcher: ["/admin/:path*", "/api/wines/:path*"],
};

const COOKIE_NAME = "tachin_session";
const LOGIN_PATHS = ["/admin/login", "/admin/login.html"];

function getSecret() {
  return process.env.SESSION_SECRET || "tachin-dev-secret-cambia-esto-en-produccion";
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function hmacHex(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hasValidSession(request) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await hmacHex(payload, getSecret());
  if (expected !== signature) return false;
  const expires = parseInt(payload, 10);
  return Boolean(expires) && Date.now() / 1000 < expires;
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  // Lectura pública del catálogo: sin login.
  if (pathname.startsWith("/api/wines") && request.method === "GET") {
    return next();
  }

  // La pantalla de login tiene que poder verse sin sesión.
  if (LOGIN_PATHS.includes(pathname)) {
    return next();
  }

  if (await hasValidSession(request)) {
    return next();
  }

  if (pathname.startsWith("/admin")) {
    return Response.redirect(new URL("/admin/login", request.url), 307);
  }

  return new Response(JSON.stringify({ ok: false, error: "Sesión no válida. Vuelve a iniciar sesión." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
