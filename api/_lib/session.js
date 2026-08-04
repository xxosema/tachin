/**
 * TACHÍN — sesión de admin firmada (cookie, sin estado en servidor).
 *
 * En vez de guardar sesiones en algún sitio (no hay base de datos),
 * la cookie lleva la fecha de caducidad y una firma HMAC de esa fecha
 * con SESSION_SECRET. Verificarla es recalcular la firma y compararla
 * — si alguien la modifica sin conocer el secreto, deja de coincidir.
 *
 * Usado por api/login.js (Node) y scripts/dev-server.js (local). El
 * middleware (Edge) hace lo mismo pero con Web Crypto, porque el
 * runtime de Edge no tiene el módulo "crypto" de Node.
 */

const crypto = require("crypto");

const COOKIE_NAME = "tachin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

function getSecret() {
  return process.env.SESSION_SECRET || "tachin-dev-secret-cambia-esto-en-produccion";
}

function sign(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function createSessionToken() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token) return false;
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return false;
  if (sign(payload) !== signature) return false;
  const expires = parseInt(payload, 10);
  return Boolean(expires) && Date.now() / 1000 < expires;
}

function parseCookie(header, name) {
  const match = String(header || "").match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = { COOKIE_NAME, MAX_AGE_SECONDS, createSessionToken, verifySessionToken, parseCookie };
