/**
 * PUT    /api/wines/:id  — edita un vino existente (el id no cambia).
 * DELETE /api/wines/:id  — lo elimina, junto con su imagen.
 * Ambos protegidos por middleware.js.
 */

const { readWines, writeWines, saveImage, deleteImage, validate, normalizeWine } = require("../_lib/store");

module.exports = async (req, res) => {
  const { id } = req.query;

  if (req.method === "PUT") {
    try {
      const data = req.body || {};
      const err = validate(data, { requireImage: false });
      if (err) {
        res.status(400).json({ ok: false, error: err });
        return;
      }

      const wines = await readWines();
      const idx = wines.findIndex((w) => w.id === id);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: `No existe ningún vino con id "${id}".` });
        return;
      }

      const previous = wines[idx];
      let bottle = previous.bottle;
      if (data.imageBase64 && data.imageName) {
        bottle = await saveImage(id, data.imageBase64, data.imageName);
        if (bottle !== previous.bottle) await deleteImage(previous.bottle);
      }

      const wine = normalizeWine(id, bottle, data);
      wines[idx] = wine;
      await writeWines(wines);

      res.status(200).json({ ok: true, wine });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  if (req.method === "DELETE") {
    try {
      const wines = await readWines();
      const idx = wines.findIndex((w) => w.id === id);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: `No existe ningún vino con id "${id}".` });
        return;
      }

      const [removed] = wines.splice(idx, 1);
      await writeWines(wines);
      await deleteImage(removed.bottle);

      res.status(200).json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  res.setHeader("Allow", "PUT, DELETE");
  res.status(405).json({ ok: false, error: "Método no permitido." });
};
