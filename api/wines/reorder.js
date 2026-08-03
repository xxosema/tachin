/**
 * POST /api/wines/reorder — cambia el orden de los vinos (el que se ve en
 * la home, tal cual). Protegido por middleware.js.
 */

const { readWines, writeWines } = require("../_lib/store");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }

  try {
    const { order } = req.body || {};
    if (!Array.isArray(order) || !order.length) {
      res.status(400).json({ ok: false, error: "Falta el nuevo orden." });
      return;
    }

    const wines = await readWines();
    const byId = new Map(wines.map((w) => [w.id, w]));
    const reordered = order.map((id) => byId.get(id)).filter(Boolean);
    for (const wine of wines) {
      if (!order.includes(wine.id)) reordered.push(wine);
    }

    await writeWines(reordered);
    res.status(200).json({ ok: true, wines: reordered });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
