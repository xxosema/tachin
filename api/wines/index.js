/**
 * GET  /api/wines  — lista pública del catálogo (la usa el propio sitio).
 * POST /api/wines  — crea un vino nuevo. Protegido por middleware.js.
 */

const { readWines, writeWines, saveImage, slugify, uniqueId, validate, normalizeWine } = require("../_lib/store");

module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      const wines = await readWines();
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.status(200).json({ ok: true, wines });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const data = req.body || {};
      const err = validate(data, { requireImage: true });
      if (err) {
        res.status(400).json({ ok: false, error: err });
        return;
      }

      const wines = await readWines();
      const id = uniqueId(
        slugify(data.nombre),
        wines.map((w) => w.id)
      );
      const bottle = await saveImage(id, data.imageBase64, data.imageName);
      const wine = normalizeWine(id, bottle, data);

      wines.push(wine);
      await writeWines(wines);

      res.status(200).json({ ok: true, wine });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ ok: false, error: "Método no permitido." });
};
