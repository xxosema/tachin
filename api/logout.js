/**
 * POST /api/logout — borra la cookie de sesión.
 */

const { COOKIE_NAME } = require("./_lib/session");

module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  res.status(200).json({ ok: true });
};
