/**
 * TACHÍN — migración única del catálogo a Vercel Blob.
 *
 * Sube las imágenes de scripts/seed-wines.json (que apuntan a los
 * archivos que ya tenías en assets/bottles/) y el propio wines.json
 * a tu Blob Store. Se ejecuta UNA vez, después de crear el proyecto
 * en Vercel y enlazarlo a un Blob Store (Storage → Create → Blob).
 *
 * Uso:
 *   1. vercel link                      (conecta esta carpeta a tu proyecto)
 *   2. vercel env pull .env.local       (trae BLOB_READ_WRITE_TOKEN)
 *   3. node -r dotenv/config scripts/migrate-to-blob.js dotenv_config_path=.env.local
 *
 *   o, sin dotenv, directamente:
 *   BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxx node scripts/migrate-to-blob.js
 *
 * Si ya tienes vinos guardados en Blob, esto los SOBRESCRIBE (usa los
 * mismos id que en seed-wines.json). No lo vuelvas a correr después de
 * haber empezado a editar el catálogo desde /admin.
 */

const fs = require("fs");
const path = require("path");
const { put } = require("@vercel/blob");

const ROOT = path.join(__dirname, "..");
const SEED_FILE = path.join(__dirname, "seed-wines.json");

const MIME = {
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Igual que en api/_lib/store.js: info nutricional opcional, vacía
// hasta que se rellene desde /admin.
const NUTRITION_FIELDS = ["calorias", "grasas", "saturadas", "carbohidratos", "azucar", "proteinas", "sal"];

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "Falta BLOB_READ_WRITE_TOKEN.\n" +
        "Ejecuta `vercel link` y `vercel env pull .env.local` primero, o pásalo\n" +
        "directamente: BLOB_READ_WRITE_TOKEN=... node scripts/migrate-to-blob.js"
    );
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  const wines = [];

  for (const item of seed) {
    const { bottleFile, ...wine } = item;
    const localPath = path.join(ROOT, bottleFile);
    const ext = path.extname(localPath).toLowerCase();
    const buffer = fs.readFileSync(localPath);
    const pathname = `bottles/${wine.id}${ext}`;

    process.stdout.write(`Subiendo imagen de "${wine.nombre}" → ${pathname}... `);
    const result = await put(pathname, buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: MIME[ext] || "application/octet-stream",
      cacheControlMaxAge: 60,
    });
    console.log("ok");

    const nutrition = {};
    for (const field of NUTRITION_FIELDS) nutrition[field] = "";
    wines.push({ ...nutrition, ...wine, bottle: result.url });
  }

  process.stdout.write("Subiendo wines.json... ");
  await put("wines.json", JSON.stringify(wines, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  console.log("ok");

  console.log(`\nListo: ${wines.length} vinos migrados a Vercel Blob.`);
}

main().catch((err) => {
  console.error("\nError en la migración:", err.message);
  process.exit(1);
});
