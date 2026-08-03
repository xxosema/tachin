/**
 * TACHÍN — lógica del sitio
 * Carga el catálogo desde /api/wines (Vercel Blob, gestionado desde
 * /admin) y renderiza la rejilla de la home y la ficha de cada vino.
 */

const BODEGA = {
  embotellador: "Embotellado por Viños do Macizo Ourensán S.L. (R.E. 42.597/OU)",
  direccion: "Fontei - A Rúa - 32350 | Ourense - Galicia - España",
  origen: "Producto de España",
  email: "contacto@tachinadega.com",
  telefono: "+34 627 89 10 04",
};

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function fetchWines() {
  const res = await fetch("/api/wines");
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "No se pudo cargar el catálogo.");
  return data.wines;
}

function setupCarousel(grid) {
  // En escritorio la rejilla es un carrusel horizontal: convertimos el
  // scroll vertical de la rueda en desplazamiento lateral.
  grid.addEventListener(
    "wheel",
    (event) => {
      if (grid.scrollWidth <= grid.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      grid.scrollLeft += event.deltaY;
    },
    { passive: false }
  );

  // Flechas del carrusel: avanzan/retroceden una botella por clic,
  // se apagan en los extremos y desaparecen si no hay overflow.
  const prev = document.getElementById("arrow-prev");
  const next = document.getElementById("arrow-next");
  if (!prev || !next) return;

  function cardStep() {
    const card = grid.firstElementChild;
    if (!card) return grid.clientWidth;
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  }

  function updateArrows() {
    const maxScroll = grid.scrollWidth - grid.clientWidth;
    const hasOverflow = maxScroll > 1;
    prev.hidden = !hasOverflow;
    next.hidden = !hasOverflow;
    prev.disabled = grid.scrollLeft <= 1;
    next.disabled = grid.scrollLeft >= maxScroll - 1;
  }

  prev.addEventListener("click", () => {
    grid.scrollBy({ left: -cardStep(), behavior: "smooth" });
  });
  next.addEventListener("click", () => {
    grid.scrollBy({ left: cardStep(), behavior: "smooth" });
  });

  grid.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);
  updateArrows();
}

async function renderHome() {
  const grid = document.getElementById("wine-grid");
  if (!grid) return;

  let wines;
  try {
    wines = await fetchWines();
  } catch (err) {
    grid.innerHTML = `<p class="not-found">No se pudo cargar el catálogo.</p>`;
    return;
  }

  grid.innerHTML = wines
    .map(
      (wine) => `
      <a class="wine-card" href="vino.html?id=${encodeURIComponent(wine.id)}">
        <img
          class="wine-card__bottle"
          src="${wine.bottle}"
          alt="Botella de ${escapeHTML(wine.nombre)}"
          loading="lazy"
        />
        <span class="wine-card__name">${escapeHTML(wine.nombre)}</span>
        <span class="wine-card__uva">${escapeHTML(wine.uvaCorta)}</span>
        <span class="wine-card__meta">${escapeHTML(wine.anada)} | ${escapeHTML(wine.alcohol)}º</span>
      </a>
    `
    )
    .join("");

  setupCarousel(grid);
}

async function renderDetail() {
  const root = document.getElementById("detail-root");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  let wines;
  try {
    wines = await fetchWines();
  } catch (err) {
    root.innerHTML = `<p class="not-found">No se pudo cargar el catálogo.</p>`;
    return;
  }

  const wine = wines.find((w) => w.id === id);

  if (!wine) {
    root.innerHTML = `
      <p class="not-found">
        No encontramos ese vino.<br />
        <a href="index.html">Volver a la home</a>
      </p>
    `;
    return;
  }

  document.title = `TACHÍN — ${wine.nombre}`;

  root.innerHTML = `
    <img
      class="detail__bottle"
      src="${wine.bottle}"
      alt="Botella de ${escapeHTML(wine.nombre)}"
    />
    <div class="detail__info">
      <h1 class="detail__name">${escapeHTML(wine.nombre)}</h1>
      <p class="detail__description">${escapeHTML(wine.descripcion)}</p>
      <p class="detail__facts">
        <strong>${escapeHTML(wine.tipo)}</strong> ${escapeHTML(wine.uva)}<br />
        ${escapeHTML(BODEGA.embotellador)}<br />
        ${escapeHTML(BODEGA.direccion)}<br />
        ${escapeHTML(BODEGA.origen)} | ${escapeHTML(wine.sulfitos)}
      </p>
      <p class="detail__specs">
        ${escapeHTML(wine.anada)} | ALC ${escapeHTML(wine.alcohol)}% VOL | ${escapeHTML(wine.volumen)} ML
      </p>
    </div>
  `;
}

// Redondea a "decimals" y usa coma decimal (convención española).
function formatNutritionValue(n, decimals) {
  const rounded = Number(n.toFixed(decimals));
  return String(rounded).replace(".", ",");
}

// 1 kcal = 4.184 kJ (factor de conversión físico, no una medida
// aparte): la normativa UE exige declarar la energía en las dos
// unidades a la vez.
const KCAL_TO_KJ = 4.184;
function formatEnergy(kcal) {
  const kj = Math.round(kcal * KCAL_TO_KJ);
  return `${kj} kJ / ${formatNutritionValue(kcal, 0)} kcal`;
}

// Unidades en gramos en todos los campos (obligatorio por el
// Reglamento UE 1169/2011): nada en mg. "calorias" se guarda en Kcal
// pero se muestra como energía en kJ/kcal combinados (fila especial,
// no pasa por el formateador numérico normal).
const NUTRITION_ROWS = [
  { key: "calorias", label: "Valor energético", energy: true },
  { key: "grasas", label: "Grasas (g)", decimals: 1 },
  { key: "saturadas", label: "Saturadas (g)", decimals: 1, sub: true },
  { key: "carbohidratos", label: "Carbohidratos (g)", decimals: 1 },
  { key: "azucar", label: "Azúcar (g)", decimals: 1, sub: true },
  { key: "proteinas", label: "Proteínas (g)", decimals: 2 },
  { key: "sal", label: "Sal (g)", decimals: 2 },
];
// Lista de ingredientes obligatoria (Rgto. UE 1169/2011 + 2021/2117):
// el vino es "Uvas" + aditivos. El único aditivo que registramos hoy
// es el conservante sulfitos, que además es alérgeno de declaración
// obligatoria — por eso va resaltado en negrita/mayúsculas.
function ingredientesLine(wine) {
  const custom = String(wine.ingredientes || "").trim();
  if (custom) return `Ingredientes: ${escapeHTML(custom)}`;
  const containsSulfitos = /CONTIENE SULFITOS/i.test(wine.sulfitos || "");
  return containsSulfitos
    ? `Ingredientes: Uvas, conservante (<strong>SULFITOS</strong>)`
    : `Ingredientes: Uvas`;
}

function wineNutritionTable(wine) {
  const hasData = NUTRITION_ROWS.some((row) => String(wine[row.key] || "").trim() !== "");

  if (!hasData) {
    return `<p class="nutrition__pending">Información nutricional pendiente de confirmar.</p>`;
  }

  const rows = [{ label: "Alcohol (% vol.)", raw: wine.alcohol }, ...NUTRITION_ROWS];

  const rowsHTML = rows
    .map((row) => {
      const trClass = row.sub ? ' class="sub-row"' : "";
      if (row.raw !== undefined) {
        return `
          <tr${trClass}>
            <th scope="row">${escapeHTML(row.label)}</th>
            <td>${escapeHTML(row.raw)}</td>
          </tr>
        `;
      }
      const base = parseFloat(String(wine[row.key]).replace(",", "."));
      if (Number.isNaN(base)) {
        return `
          <tr${trClass}>
            <th scope="row">${escapeHTML(row.label)}</th>
            <td>—</td>
          </tr>
        `;
      }
      const value100 = row.energy ? formatEnergy(base) : formatNutritionValue(base, row.decimals);
      return `
        <tr${trClass}>
          <th scope="row">${escapeHTML(row.label)}</th>
          <td>${escapeHTML(value100)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="nutrition-table">
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col">100 ml</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML}
      </tbody>
    </table>
    <p class="ticket-ingredientes">${ingredientesLine(wine)}</p>
  `;
}

async function renderNutrition() {
  const root = document.getElementById("nutrition-root");
  if (!root) return;

  let wines;
  try {
    wines = await fetchWines();
  } catch (err) {
    root.innerHTML = `<p class="not-found">No se pudo cargar la información nutricional.</p>`;
    return;
  }

  if (!wines.length) {
    root.innerHTML = `<p class="not-found">Todavía no hay vinos en el catálogo.</p>`;
    return;
  }

  document.title = "TACHÍN — Información nutricional";

  const sections = wines
    .map(
      (wine) => `
      <section class="nutrition-entry" id="${wine.id}">
        <img
          class="nutrition__bottle"
          src="${wine.bottle}"
          alt="Botella de ${escapeHTML(wine.nombre)}"
        />
        <div class="ticket-head">
          <h2 class="nutrition__name">${escapeHTML(wine.nombre)}</h2>
          <div class="ticket-annotation">
            <span>[${escapeHTML(wine.tipo.toUpperCase())}]</span>
            <span>${escapeHTML(wine.anada)} · ${escapeHTML(wine.alcohol)}% VOL</span>
          </div>
        </div>
        <div class="ticket-divider"></div>
        ${wineNutritionTable(wine)}
        <p class="ticket-uva">${escapeHTML(wine.uvaCorta)}</p>
      </section>
    `
    )
    .join("");

  root.innerHTML = `
    <div class="nutrition-grid" id="nutrition-grid">${sections}</div>
  `;

  setupCarousel(document.getElementById("nutrition-grid"));

  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  renderDetail();
  renderNutrition();
});
