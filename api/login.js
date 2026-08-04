/**
 * POST /api/login — valida usuario/contraseña y, si son correctos,
 * deja una cookie de sesión firmada (ver api/_lib/session.js).
 */

const { COOKIE_NAME, MAX_AGE_SECONDS, createSessionToken } = require("./_lib/session");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }

  const { user, pass } = req.body || {};
  const expectedUser = process.env.ADMIN_USER || "tachin";
  const expectedPass = process.env.ADMIN_PASS || "TachinVino2026!";

  if (user !== expectedUser || pass !== expectedPass) {
    res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos." });
    return;
  }

  const token = createSessionToken();
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`
  );
  res.status(200).json({ ok: true });
};
