/**
 * TACHÍN — servidor SOLO para previsualizar en local, sin Vercel.
 *
 * Sirve la web pública y reproduce el contrato de /api/wines y
 * /admin (incluida la autenticación) usando un JSON local en vez de
 * Vercel Blob, para poder abrir el sitio y probar el panel en tu
 * navegador antes de desplegar nada. NO se despliega (está fuera de
 * /api, así que Vercel no lo toca) y NO es lo que corre en producción
 * — allí manda api/*.js + middleware.js sobre Vercel Blob.
 *
 * Arrancar con:  node scripts/dev-server.js
 * Sitio:         http://localhost:4000
 * Admin:         http://localhost:4000/admin
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SEED_FILE = path.join(__dirname, "seed-wines.json");
const LOCAL_DATA_FILE = path.join(__dirname, ".local-wines.json");
const BOTTLES_DIR = path.join(ROOT, "assets", "bottles");
const ADMIN_HTML = path.join(ROOT, "admin", "index.html");
const PORT = process.env.PORT || 4000;

const ADMIN_USER = process.env.ADMIN_USER || "tachin";
const ADMIN_PASS = process.env.ADMIN_PASS || "TachinVino2026!";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

// ---------------------------------------------------------------------
// "Blob" local: un JSON en scripts/.local-wines.json (fuera de git),
// sembrado la primera vez desde seed-wines.json. Las imágenes se
// guardan de verdad en assets/bottles/.
// ---------------------------------------------------------------------

function ensureSeeded() {
  if (fs.existsSync(LOCAL_DATA_FILE)) return;
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  const wines = seed.map(({ bottleFile, ...wine }) => {
    const nutrition = {};
    for (const field of NUTRITION_FIELDS) nutrition[field] = "";
    return { ...nutrition, ...wine, bottle: "/" + bottleFile };
  });
  fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(wines, null, 2));
}

function readWines() {
  ensureSeeded();
  return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, "utf8"));
}

function writeWines(wines) {
  fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(wines, null, 2));
}

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

function extensionFor(imageName) {
  const m = String(imageName || "").match(/\.[a-z0-9]+$/i);
  const ext = m ? m[0].toLowerCase() : ".gif";
  return MIME[ext] ? ext : ".gif";
}

function saveImage(id, imageBase64, imageName) {
  const ext = extensionFor(imageName);
  const base64Data = String(imageBase64).replace(/^data:.*;base64,/, "");
  fs.mkdirSync(BOTTLES_DIR, { recursive: true });
  fs.writeFileSync(path.join(BOTTLES_DIR, `${id}${ext}`), Buffer.from(base64Data, "base64"));
  return `/assets/bottles/${id}${ext}`;
}

function deleteImageIfLocal(bottlePath) {
  if (!bottlePath || !bottlePath.startsWith("/assets/bottles/")) return;
  const abs = path.join(ROOT, bottlePath);
  if (abs.startsWith(BOTTLES_DIR) && fs.existsSync(abs)) fs.unlinkSync(abs);
}

const FIELDS = ["nombre", "tipo", "uva", "uvaCorta", "anada", "alcohol", "descripcion"];

// Información nutricional (opcional, por 100 ml, columna de 150 ml
// calculada en el sitio). Igual que en api/_lib/store.js.
const NUTRITION_FIELDS = ["calorias", "grasas", "saturadas", "carbohidratos", "azucar", "proteinas", "sal"];

function validate(data, { requireImage }) {
  for (const field of FIELDS) {
    if (!data[field] || !String(data[field]).trim()) return `Falta el campo "${field}".`;
  }
  if (requireImage && (!data.imageBase64 || !data.imageName)) return "Falta la imagen de la botella.";
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
    descripcion: String(data.descripcion).trim(),
  };
  for (const field of NUTRITION_FIELDS) {
    wine[field] = String(data[field] || "").trim();
  }
  return wine;
}

// ---------------------------------------------------------------------
// Auth (mismo esquema que middleware.js)
// ---------------------------------------------------------------------

function isAuthorized(req) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  return decoded.slice(0, sep) === ADMIN_USER && decoded.slice(sep + 1) === ADMIN_PASS;
}

function requireAuth(req, res) {
  if (isAuthorized(req)) return true;
  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="Tachin Admin"',
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end("Autenticación requerida.");
  return false;
}

// ---------------------------------------------------------------------
// Helpers HTTP
// ---------------------------------------------------------------------

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJSONBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("aborted", () => reject(new Error("Subida interrumpida.")));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(new Error("JSON inválido."));
      }
    });
  });
}

// ---------------------------------------------------------------------
// Rutas /api/wines
// ---------------------------------------------------------------------

async function handleWinesAPI(req, res, url) {
  if (req.method === "GET" && url === "/api/wines") {
    sendJSON(res, 200, { ok: true, wines: readWines() });
    return;
  }

  if (!requireAuth(req, res)) return;

  if (req.method === "POST" && url === "/api/wines") {
    try {
      const data = await readJSONBody(req);
      const err = validate(data, { requireImage: true });
      if (err) return sendJSON(res, 400, { ok: false, error: err });

      const wines = readWines();
      const id = uniqueId(slugify(data.nombre), wines.map((w) => w.id));
      const bottle = saveImage(id, data.imageBase64, data.imageName);
      const wine = normalizeWine(id, bottle, data);

      wines.push(wine);
      writeWines(wines);
      sendJSON(res, 200, { ok: true, wine });
    } catch (err) {
      sendJSON(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  const putMatch = req.method === "PUT" && url.match(/^\/api\/wines\/([^/]+)$/);
  if (putMatch) {
    const id = decodeURIComponent(putMatch[1]);
    try {
      const data = await readJSONBody(req);
      const err = validate(data, { requireImage: false });
      if (err) return sendJSON(res, 400, { ok: false, error: err });

      const wines = readWines();
      const idx = wines.findIndex((w) => w.id === id);
      if (idx === -1) return sendJSON(res, 404, { ok: false, error: `No existe el vino "${id}".` });

      const previous = wines[idx];
      let bottle = previous.bottle;
      if (data.imageBase64 && data.imageName) {
        bottle = saveImage(id, data.imageBase64, data.imageName);
        if (bottle !== previous.bottle) deleteImageIfLocal(previous.bottle);
      }

      const wine = normalizeWine(id, bottle, data);
      wines[idx] = wine;
      writeWines(wines);
      sendJSON(res, 200, { ok: true, wine });
    } catch (err) {
      sendJSON(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  const delMatch = req.method === "DELETE" && url.match(/^\/api\/wines\/([^/]+)$/);
  if (delMatch) {
    const id = decodeURIComponent(delMatch[1]);
    try {
      const wines = readWines();
      const idx = wines.findIndex((w) => w.id === id);
      if (idx === -1) return sendJSON(res, 404, { ok: false, error: `No existe el vino "${id}".` });

      const [removed] = wines.splice(idx, 1);
      writeWines(wines);
      deleteImageIfLocal(removed.bottle);
      sendJSON(res, 200, { ok: true, id });
    } catch (err) {
      sendJSON(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("No encontrado");
}

// ---------------------------------------------------------------------
// Estáticos + servidor
// ---------------------------------------------------------------------

function serveStatic(req, res, url) {
  const relPath = url === "/" ? "/index.html" : url;
  const abs = path.normalize(path.join(ROOT, relPath));
  if (!abs.startsWith(ROOT)) {
    res.writeHead(400);
    res.end("Ruta inválida");
    return;
  }
  fs.readFile(abs, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("No encontrado");
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = decodeURI(req.url.split("?")[0]);

  if (url === "/admin" || url === "/admin/") {
    if (!requireAuth(req, res)) return;
    fs.readFile(ADMIN_HTML, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end("No se pudo cargar admin/index.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(content);
    });
    return;
  }

  if (url.startsWith("/api/wines")) {
    handleWinesAPI(req, res, url);
    return;
  }

  // Reproduce los rewrites de vercel.json: cualquier URL bajo
  // /informacion-nutricional (con o sin id/barra detrás, da igual qué
  // pusieran los QR ya impresos) sirve siempre la misma nutricion.html
  // con la tabla de todos los vinos.
  if (/^\/informacion-nutricional(\/.*)?$/.test(url)) {
    serveStatic(req, res, "/nutricion.html");
    return;
  }

  serveStatic(req, res, url);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`TACHÍN (preview local) en http://localhost:${PORT}`);
  console.log(`Panel admin en http://localhost:${PORT}/admin  (usuario: ${ADMIN_USER})`);
});
