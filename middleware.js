/**
 * TACHÍN — protección del panel admin (HTTP Basic Auth).
 *
 * Cubre /admin (la página) y /api/wines* salvo el GET (que tiene que
 * quedar público: es como el propio sitio carga el catálogo).
 *
 * Usuario y contraseña en las variables de entorno ADMIN_USER /
 * ADMIN_PASS de Vercel. Si no están definidas, usa las de abajo por
 * defecto — para producción, configúralas en el proyecto de Vercel.
 */

import { next } from "@vercel/edge";

export const config = {
  matcher: ["/admin/:path*", "/api/wines/:path*"],
};

function unauthorized() {
  return new Response("Autenticación requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Tachin Admin"' },
  });
}

export default function middleware(request) {
  const { pathname } = new URL(request.url);

  // Lectura pública del catálogo: sin login.
  if (pathname.startsWith("/api/wines") && request.method === "GET") {
    return next();
  }

  const authHeader = request.headers.get("authorization") || "";
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();

  let decoded;
  try {
    decoded = atob(encoded);
  } catch (err) {
    return unauthorized();
  }
  const sep = decoded.indexOf(":");
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  const expectedUser = process.env.ADMIN_USER || "tachin";
  const expectedPass = process.env.ADMIN_PASS || "TachinVino2026!";
  if (user !== expectedUser || pass !== expectedPass) return unauthorized();

  return next();
}
