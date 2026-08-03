/**
 * TACHÍN — acceso al catálogo de vinos en Vercel Blob.
 *
 * El catálogo entero vive en un único blob "wines.json" (array de
 * vinos). Cada imagen de botella es otro blob bajo "bottles/<id>.<ext>".
 * Ambos se escriben con addRandomSuffix:false + allowOverwrite:true
 * para tener siempre la misma URL por vino, y con un cacheControlMaxAge
 * bajo (60s, el mínimo que permite Vercel Blob) para que los cambios se
 * reflejen rápido en el sitio público pese al cache de CDN.
 */

const { head, put, del } = require("@vercel/blob");

const WINES_PATH = "wines.json";
const BOTTLES_PREFIX = "bottles/";
const FRESH_SECONDS = 60;

const REQUIRED_FIELDS = ["nombre", "tipo", "uva", "uvaCorta", "anada", "alcohol", "descripcion"];

// Información nutricional (opcional, por 100 ml). La columna de 150 ml
// (copa de referencia) se calcula sola en el sitio, no hace falta
// guardarla. Vacío ("") significa "todavía sin confirmar".
const NUTRITION_FIELDS = ["calorias", "grasas", "saturadas", "carbohidratos", "azucar", "proteinas", "sal"];

const MIME = {
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function slugify(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueId(base, existingIds) {
  const safeBase = base || "vino";
  let id = safeBase;
  let i = 2;
  while (existingIds.includes(id)) {
    id = `${safeBase}-${i}`;
    i++;
  }
  return id;
}

async function readWines() {
  let meta;
  try {
    meta = await head(WINES_PATH);
  } catch (err) {
    return []; // todavía no existe ningún vino: catálogo vacío
  }
  const res = await fetch(meta.url, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo leer el catálogo desde Blob.");
  return res.json();
}

async function writeWines(wines) {
  await put(WINES_PATH, JSON.stringify(wines, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: FRESH_SECONDS,
  });
}

function extensionFor(imageName) {
  const m = String(imageName || "").match(/\.[a-z0-9]+$/i);
  const ext = m ? m[0].toLowerCase() : ".gif";
  return MIME[ext] ? ext : ".gif";
}

async function saveImage(id, imageBase64, imageName) {
  const ext = extensionFor(imageName);
  const base64Data = String(imageBase64).replace(/^data:.*;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const result = await put(`${BOTTLES_PREFIX}${id}${ext}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: MIME[ext],
    cacheControlMaxAge: FRESH_SECONDS,
  });
  return result.url;
}

async function deleteImage(url) {
  if (!url) return;
  try {
    await del(url);
  } catch (err) {
    // ya no existía: nada que hacer
  }
}

function validate(data, { requireImage }) {
  for (const field of REQUIRED_FIELDS) {
    if (!data[field] || !String(data[field]).trim()) {
      return `Falta el campo "${field}".`;
    }
  }
  if (requireImage && (!data.imageBase64 || !data.imageName)) {
    return "Falta la imagen de la botella.";
  }
  return null;
}

function normalizeWine(id, bottle, data) {
  const wine = {
    id,
    nombre: String(data.nombre).trim(),
    tipo: String(data.tipo).trim(),
    uva: String(data.uva).trim(),
    uvaCorta: String(data.uvaCorta).trim(),
    anada: String(data.anada).trim(),
    alcohol: String(data.alcohol).trim(),
    volumen: String(data.volumen || "750").trim(),
    bottle,
    sulfitos: String(data.sulfitos || "SIN SULFITOS AÑADIDOS").trim(),
    ingredientes: String(data.ingredientes || "").trim(),
    descripcion: String(data.descripcion).trim(),
  };
  for (const field of NUTRITION_FIELDS) {
    wine[field] = String(data[field] || "").trim();
  }
  return wine;
}

module.exports = {
  readWines,
  writeWines,
  saveImage,
  deleteImage,
  slugify,
  uniqueId,
  validate,
  normalizeWine,
};
