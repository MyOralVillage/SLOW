/**
 * Salone OIM Library — browse, search, upload state and BookStack integration.
 */

const LIBRARY_STORAGE_KEY = "slow_library_v1";
const LEGACY_HISTORY_KEY = "slow_upload_history";
const DOWNLOAD_META_KEY = "slow_download_meta";

const DB_NAME = "slow_oim_library";
const DB_VERSION = 1;
const IDB_STORE = "blobs";

const config = {
  apiBaseUrl: "",
  bookStackPublicUrl: "",
  useBookStackProxy: false,
  apiTokenId: "",
  apiTokenSecret: "",
  defaultBookId: 1,
};

let lastSearchRowCount = 0;
let highlightResourceId = null;
let modalObjectUrl = null;

function cssEscapeSelector(s) {
  const str = String(s);
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(str);
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function apiBase() {
  return (config.apiBaseUrl || "").replace(/\/$/, "");
}

function hasBookStackApiConfig() {
  return Boolean(
    apiBase() && (config.apiTokenId || "").trim() && (config.apiTokenSecret || "").trim(),
  );
}

function isBookStackFullyConnected() {
  if (!hasBookStackApiConfig()) return false;
  if (config.useBookStackProxy && !(config.bookStackPublicUrl || "").trim()) return false;
  return true;
}

async function loadLocalConfig() {
  try {
    const res = await fetch("config.local.json", { cache: "no-store" });
    if (!res.ok) return;
    Object.assign(config, await res.json());
  } catch {
    /* optional */
  }
  if (config.useBookStackProxy && typeof window !== "undefined" && window.location?.origin) {
    config.apiBaseUrl = `${window.location.origin.replace(/\/$/, "")}/bookstack-proxy`;
  }
}

function bookStackOrigin() {
  const pub = (config.bookStackPublicUrl || "").trim();
  if (pub) {
    try {
      return new URL(pub).origin;
    } catch {
      return null;
    }
  }
  const base = apiBase();
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/* ---------- IndexedDB (local file blobs) ---------- */

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbPutBlob(id, blob) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetBlob(id) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

/* ---------- Library index (metadata in localStorage) ---------- */

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLibrary(items) {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
}

function migrateLegacyHistory() {
  if (loadLibrary().length > 0) return;
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || "[]");
    if (!Array.isArray(legacy) || !legacy.length) return;
    const migrated = legacy.map((h, i) => ({
      id: `legacy_${Date.now()}_${i}`,
      title: h.title || "Untitled",
      description: h.description || "",
      country: h.country || "",
      category: h.category || "",
      type: h.type || "document",
      productDetail: h.productDetail || h.product_detail || "",
      crossCutting: h.crossCutting || "",
      institution: h.institution || "",
      keywords: h.keywords || "",
      filename: h.filename || "",
      size: null,
      ext: fileExt(h.filename || ""),
      submittedAt: h.submittedAt || new Date().toISOString(),
      source: "local",
      pageId: null,
      attachmentId: null,
      hasBlob: false,
    }));
    saveLibrary(migrated);
  } catch {
    /* ignore */
  }
}

function fileExt(name) {
  if (!name || typeof name !== "string") return "";
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function prependLibraryRecord(record, file) {
  const list = loadLibrary();
  list.unshift(record);
  saveLibrary(list);
  if (file && record.hasBlob) {
    idbPutBlob(record.id, file).catch(() => {
      showToast("Could not store file locally for preview.", false);
    });
  }
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || "[]");
    legacy.unshift({
      title: record.title,
      description: record.description,
      country: record.country,
      category: record.category,
      type: record.type,
      productDetail: record.productDetail,
      crossCutting: record.crossCutting,
      institution: record.institution,
      keywords: record.keywords,
      filename: record.filename,
      submittedAt: record.submittedAt,
    });
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify(legacy.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

function updateLibraryRecord(id, patch) {
  const list = loadLibrary();
  const i = list.findIndex((r) => r.id === id);
  if (i === -1) return false;
  list[i] = { ...list[i], ...patch };
  saveLibrary(list);
  return true;
}

/* ---------- UI: connection banner & badge ---------- */

function updateConnectionUi() {
  const banner = document.getElementById("connection-banner");
  const badge = document.getElementById("connection-badge");
  const connected = isBookStackFullyConnected();
  const hasToken = hasBookStackApiConfig();

  if (badge) {
    badge.textContent = connected ? "BookStack connected" : "Local mode only";
    badge.classList.toggle("is-live", connected);
  }

  if (!banner) return;

  if (connected) {
    banner.className = "connection-banner is-connected";
    banner.innerHTML = `
      <p class="connection-banner-main">Connected to BookStack. Uploaded resources can be published and browsed from the shared library.</p>
      <details>
        <summary>Developer details</summary>
        <div class="dev-hint">
          Book id <code>${config.defaultBookId ?? 1}</code>.
          Proxy: <code>${config.useBookStackProxy ? "on" : "off"}</code>.
          Public URL: <code>${escapeHtml((config.bookStackPublicUrl || "—").toString())}</code>.
        </div>
      </details>`;
    return;
  }

  banner.className = "connection-banner";
  let main =
    "BookStack is not connected. Uploaded resources will be saved locally in this browser until API settings are configured.";
  if (hasToken && config.useBookStackProxy && !(config.bookStackPublicUrl || "").trim()) {
    main =
      "Add <code>bookStackPublicUrl</code> in <code>web/config.local.json</code> (e.g. your BookStack site URL) to finish setup.";
  }
  banner.innerHTML = `
    <p class="connection-banner-main">${main}</p>
    <details>
      <summary>Developer details</summary>
      <div class="dev-hint">
        Copy <code>web/config.local.json.example</code> to <code>web/config.local.json</code> with API token and <code>defaultBookId</code>.
        From the repo root run: <code>BOOKSTACK_URL=http://localhost:6875 python3 web/server.py</code>
        (avoids browser CORS). Plain <code>python -m http.server</code> cannot call the BookStack API from the page.
      </div>
    </details>`;
}

/* ---------- Tabs ---------- */

function setActiveTab(name) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const on = panel.dataset.tabPanel === name;
    panel.classList.toggle("is-active", on);
    panel.hidden = !on;
  });
  document.querySelectorAll(".bottom-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === name);
  });
}

/* ---------- Icons (inline SVG) ---------- */

const ICON_SVG = {
  document: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
  audio: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>`,
  book: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`,
  chart: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
};

function iconKeyForResource(item) {
  const type = (item.type || "").toLowerCase();
  const name = `${item.filename || ""} ${item.title || ""}`.toLowerCase();
  if (type === "audio") return "audio";
  if (type === "icon") return "document";
  if (type === "template") return "clipboard";
  if (/\b(sheet|tracker|table|chart)\b/.test(name)) return "chart";
  if (type === "document") return "document";
  const ext = fileExt(item.filename || "");
  if (ext === "pdf" || ext === "doc" || ext === "docx") return "document";
  return "book";
}

function resourceCardHtml(item, options = {}) {
  const { isExample = false, exampleActions = true } = options;
  const idAttr = item.id ? `data-resource-id="${escapeHtml(item.id)}"` : "";
  const exampleAttr = isExample ? `data-example="true"` : "";
  const iconKey = iconKeyForResource(item);
  const iconSvg = ICON_SVG[iconKey] || ICON_SVG.book;
  const chips = [];
  if (item.country) chips.push(`<span class="chip">${escapeHtml(item.country)}</span>`);
  if (item.category) chips.push(`<span class="chip">${escapeHtml(item.category)}</span>`);
  if (item.type) chips.push(`<span class="chip">${escapeHtml(item.type)}</span>`);
  if (item.productDetail) chips.push(`<span class="chip">${escapeHtml(item.productDetail)}</span>`);

  let sourceChip = "";
  if (!isExample) {
    const src = item.source === "bookstack" ? "bookstack" : "local";
    sourceChip = `<span class="chip chip-source ${src === "local" ? "local" : ""}">${src === "bookstack" ? "BookStack" : "Saved locally"}</span>`;
  }

  const desc = item.description || item.meta || "";
  const hl = !isExample && item.id === highlightResourceId ? " is-highlight" : "";
  const ex = isExample ? " is-example" : "";

  let actions = "";
  if (isExample) {
    actions = exampleActions
      ? `<div class="resource-card-actions">
          <button type="button" class="btn btn-secondary btn-small" data-action="preview-example" data-title="${escapeHtml(item.title)}">Preview</button>
          <button type="button" class="btn btn-ghost btn-small" data-action="template" data-title="${escapeHtml(item.title)}" data-desc="${escapeHtml(desc)}" data-country="${escapeHtml(item.country || "")}" data-category="${escapeHtml(item.category || "")}" data-type="${escapeHtml(item.type || "")}">Use as template</button>
        </div>`
      : "";
  } else {
    const previewBtn = `<button type="button" class="btn btn-secondary btn-small" data-action="preview" data-id="${escapeHtml(item.id)}">Preview</button>`;
    const downloadBtn = `<button type="button" class="btn btn-secondary btn-small" data-action="download" data-id="${escapeHtml(item.id)}">Download</button>`;
    const templateBtn = `<button type="button" class="btn btn-ghost btn-small" data-action="template" data-id="${escapeHtml(item.id)}">Use as template</button>`;
    let openBtn = "";
    if (item.pageId && bookStackOrigin()) {
      const href = `${bookStackOrigin().replace(/\/$/, "")}/pages/${item.pageId}`;
      openBtn = `<a class="btn btn-secondary btn-small" href="${escapeHtml(href)}" target="_blank" rel="noopener">Open in BookStack</a>`;
    }
    const editBtn =
      item.source === "local"
        ? `<button type="button" class="btn btn-ghost btn-small" data-action="edit-meta" data-id="${escapeHtml(item.id)}">Edit metadata</button>`
        : "";
    actions = `<div class="resource-card-actions">${previewBtn}${downloadBtn}${templateBtn}${openBtn}${editBtn}</div>`;
  }

  return `<article class="resource-card${hl}${ex}" ${idAttr} ${exampleAttr}>
    <div class="resource-card-top">
      <div class="resource-card-icon" aria-hidden="true">${iconSvg}</div>
      <div>
        <h3 class="resource-card-title">${escapeHtml(item.title || "Untitled")}</h3>
      </div>
    </div>
    <p class="resource-card-desc">${escapeHtml(desc)}</p>
    <div class="resource-card-meta">${sourceChip}${chips.join("")}</div>
    ${actions}
  </article>`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

/* ---------- Example resources ---------- */

function renderExampleResources() {
  const el = document.getElementById("example-resources");
  if (!el) return;
  const examples = [
    {
      title: "Withdrawal slip",
      description: "Template and examples for customer withdrawal slips.",
      country: "Sierra Leone",
      category: "savings",
      type: "template",
      filename: "Cash-Withdrawal-Slip.pdf",
    },
    {
      title: "Savings tracking sheet",
      description: "Track group or individual savings over time.",
      country: "Ghana",
      category: "savings",
      type: "document",
      filename: "savings-tracker.xlsx",
    },
    {
      title: "Group loan template",
      description: "Structured form for group lending workflows.",
      country: "Liberia",
      category: "business",
      type: "template",
      filename: "group-loan-template.pdf",
    },
    {
      title: "Audio guide — savings form",
      description: "Spoken instructions to accompany printed materials.",
      country: "Nigeria",
      category: "literacy",
      type: "audio",
      filename: "savings-form-guide.mp3",
    },
  ];
  el.innerHTML = examples.map((ex) => resourceCardHtml(ex, { isExample: true })).join("");
}

/* ---------- My uploads grid ---------- */

function renderMyUploads() {
  const grid = document.getElementById("my-uploads-grid");
  const empty = document.getElementById("my-uploads-empty");
  if (!grid || !empty) return;
  const items = loadLibrary();
  if (!items.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = items.map((item) => resourceCardHtml(item)).join("");

  if (highlightResourceId) {
    const card = grid.querySelector(`[data-resource-id="${cssEscapeSelector(highlightResourceId)}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        highlightResourceId = null;
        renderMyUploads();
      }, 2000);
    }
  }
}

/* ---------- Toast ---------- */

function showToast(message, ok) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const t = document.createElement("div");
  t.className = `toast ${ok ? "success" : "error"}`;
  t.textContent = message;
  root.appendChild(t);
  setTimeout(() => {
    t.remove();
  }, 4200);
}

/* ---------- Modal ---------- */

function openModal(title, bodyHtml, blobUrlToTrack = null) {
  const root = document.getElementById("modal-root");
  const titleEl = document.getElementById("modal-title");
  const body = document.getElementById("modal-body");
  if (!root || !body) return;
  if (modalObjectUrl) {
    URL.revokeObjectURL(modalObjectUrl);
    modalObjectUrl = null;
  }
  if (titleEl) titleEl.textContent = title;
  body.innerHTML = bodyHtml;
  if (blobUrlToTrack) modalObjectUrl = blobUrlToTrack;
  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const root = document.getElementById("modal-root");
  const body = document.getElementById("modal-body");
  if (body) {
    body.querySelectorAll("iframe").forEach((f) => {
      f.src = "about:blank";
    });
    body.innerHTML = "";
  }
  if (modalObjectUrl) {
    URL.revokeObjectURL(modalObjectUrl);
    modalObjectUrl = null;
  }
  if (root) {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
  }
}

/* ---------- Search ---------- */

function getOptions() {
  return (
    window.SLOW_UPLOAD_OPTIONS || {
      countries: [],
      categories: [],
      types: [],
      productDetails: [],
    }
  );
}

function fillSelect(selectEl, values, placeholderText) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholderText;
  selectEl.appendChild(ph);
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

const sfCountry = document.getElementById("sf_country");
const sfCategory = document.getElementById("sf_category");
const sfType = document.getElementById("sf_type");
const sfProduct = document.getElementById("sf_product");
const sfKeywords = document.getElementById("sf_keywords");
const topSearchInput = document.getElementById("search");
const searchApiResults = document.getElementById("search-api-results");
const searchSummary = document.getElementById("search-summary");

function initSearchFilters() {
  const o = getOptions();
  fillSelect(sfCountry, o.countries, "Any country");
  fillSelect(sfCategory, o.categories, "Any category");
  fillSelect(sfType, o.types, "Any type");
  fillSelect(sfProduct, o.productDetails, "Any");
}

function syncKeywordsFromHeader() {
  if (sfKeywords && topSearchInput && document.activeElement === topSearchInput) {
    sfKeywords.value = topSearchInput.value;
  }
}

function syncHeaderFromKeywords() {
  if (sfKeywords && topSearchInput && document.activeElement === sfKeywords) {
    topSearchInput.value = sfKeywords.value;
  }
}

function buildFilterSearchQuery() {
  const parts = [];
  if (sfCountry?.value) parts.push(`country:"${sfCountry.value}"`);
  if (sfCategory?.value) parts.push(`category:${sfCategory.value}`);
  if (sfType?.value) parts.push(`type:${sfType.value}`);
  if (sfProduct?.value) parts.push(`product_detail:${sfProduct.value}`);
  const kw = (sfKeywords?.value || "").trim() || (topSearchInput?.value || "").trim();
  if (kw) parts.push(kw);
  return parts.join(" ").trim() || "resource";
}

function clearBrowseFilters() {
  if (sfCountry) sfCountry.value = "";
  if (sfCategory) sfCategory.value = "";
  if (sfType) sfType.value = "";
  if (sfProduct) sfProduct.value = "";
  if (sfKeywords) sfKeywords.value = "";
  if (topSearchInput) topSearchInput.value = "";
  if (searchSummary) searchSummary.textContent = "";
  if (searchApiResults) searchApiResults.innerHTML = "";
  lastSearchRowCount = 0;
}

function setSearchSummary(count) {
  if (!searchSummary) return;
  if (count === 0) {
    searchSummary.textContent = "No resources found.";
    return;
  }
  searchSummary.textContent = `Showing ${count} resource${count === 1 ? "" : "s"}`;
}

/* ---------- Form & validation ---------- */

const form = document.getElementById("upload-form");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const countryInput = document.getElementById("country");
const categoryInput = document.getElementById("category");
const typeInput = document.getElementById("type");
const productDetailInput = document.getElementById("product_detail");
const crossCuttingInput = document.getElementById("cross_cutting");
const institutionInput = document.getElementById("institution");
const keywordsInput = document.getElementById("keywords");
const fileInput = document.getElementById("file");
const fileValidationEl = document.getElementById("file-validation");
const chipsPreview = document.getElementById("chips-preview");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("btn-submit-upload");

function initDropdowns() {
  const o = getOptions();
  fillSelect(countryInput, o.countries, "Select country");
  fillSelect(categoryInput, o.categories, "Select category");
  fillSelect(typeInput, o.types, "Select type");
  productDetailInput.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "—";
  productDetailInput.appendChild(empty);
  o.productDetails.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    productDetailInput.appendChild(opt);
  });
  if (o.types.includes("document")) {
    typeInput.value = "document";
  }
}

function buildSearchQueryFromPayload(payload) {
  const parts = [];
  if (payload.country) parts.push(`country:"${payload.country}"`);
  if (payload.category) parts.push(`category:${payload.category}`);
  if (payload.type) parts.push(`type:${payload.type}`);
  if (payload.productDetail) parts.push(`product_detail:${payload.productDetail}`);
  if (payload.crossCutting) parts.push(`cross_cutting:${payload.crossCutting}`);
  if (payload.institution) parts.push(`institution:${payload.institution}`);
  if (payload.keywords) parts.push(payload.keywords);
  return parts.join(" ").trim() || "(add metadata)";
}

function updateChipsPreview() {
  if (!chipsPreview) return;
  const country = countryInput.value.trim();
  const category = categoryInput.value.trim();
  const type = typeInput.value.trim();
  const productDetail = productDetailInput.value.trim();
  const crossCutting = crossCuttingInput.value.trim();
  const institution = institutionInput.value.trim();
  const keywords = keywordsInput.value.trim();
  const chips = [];
  if (country) chips.push(`<span class="chip">${escapeHtml(country)}</span>`);
  if (category) chips.push(`<span class="chip">${escapeHtml(category)}</span>`);
  if (type) chips.push(`<span class="chip">${escapeHtml(type)}</span>`);
  if (productDetail) chips.push(`<span class="chip">${escapeHtml(productDetail)}</span>`);
  if (crossCutting) chips.push(`<span class="chip">${escapeHtml(crossCutting)}</span>`);
  if (institution) chips.push(`<span class="chip">${escapeHtml(institution)}</span>`);
  if (keywords) chips.push(`<span class="chip">${escapeHtml(keywords)}</span>`);
  if (!chips.length) {
    chipsPreview.innerHTML = '<span class="chip empty">Fill fields to see metadata chips</span>';
    return;
  }
  chipsPreview.innerHTML = chips.join("");
}

function updateFileValidation() {
  if (!fileValidationEl) return;
  const f = fileInput.files && fileInput.files[0];
  if (!f) {
    fileValidationEl.innerHTML = "<strong>File:</strong> none selected";
    return;
  }
  const ext = fileExt(f.name);
  fileValidationEl.innerHTML = `<strong>File:</strong> ${escapeHtml(f.name)}<br><strong>Size:</strong> ${formatBytes(f.size)}<br><strong>Extension:</strong> ${escapeHtml(ext || "—")}`;
}

function setFormStatus(message, ok) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.className = `form-status ${ok ? "ok" : "err"}`;
}

function selectedFilename() {
  const file = fileInput.files && fileInput.files[0];
  return file ? file.name : null;
}

function validatePayload(payload) {
  const o = getOptions();
  if (!payload.title) return "Enter a title.";
  if (payload.description.length < 10) return "Short description must be at least 10 characters.";
  if (!payload.country || !o.countries.includes(payload.country)) return "Choose a valid country.";
  if (!payload.category || !o.categories.includes(payload.category)) return "Choose a valid category.";
  if (!payload.type || !o.types.includes(payload.type)) return "Choose a valid type.";
  if (!payload.filename) return "Choose a file to upload.";
  if (payload.productDetail && !o.productDetails.includes(payload.productDetail)) {
    return "Product detail must be one of the listed options or left blank.";
  }
  return null;
}

function buildOptionalTags(payload) {
  const tags = [];
  if (payload.productDetail) tags.push({ name: "product_detail", value: payload.productDetail });
  if (payload.crossCutting) tags.push({ name: "cross_cutting", value: payload.crossCutting });
  if (payload.institution) tags.push({ name: "institution", value: payload.institution });
  if (payload.keywords) tags.push({ name: "keywords", value: payload.keywords });
  return tags;
}

function optionalHtml(payload) {
  let html = "";
  if (payload.productDetail) {
    html += `<p><strong>Product detail:</strong> ${escapeHtml(payload.productDetail)}</p>`;
  }
  if (payload.crossCutting) {
    html += `<p><strong>Cross-cutting:</strong> ${escapeHtml(payload.crossCutting)}</p>`;
  }
  if (payload.institution) {
    html += `<p><strong>Institution:</strong> ${escapeHtml(payload.institution)}</p>`;
  }
  if (payload.keywords) {
    html += `<p><strong>Keywords:</strong> ${escapeHtml(payload.keywords)}</p>`;
  }
  return html;
}

function parsePageIdFromJson(data) {
  if (!data || typeof data !== "object") return null;
  const raw = data.id ?? data.data?.id;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

async function createBookStackPage(payload) {
  const base = apiBase();
  const baseTags = [
    { name: "country", value: payload.country },
    { name: "category", value: payload.category },
    { name: "type", value: payload.type },
    ...buildOptionalTags(payload),
  ];

  const response = await fetch(`${base}/api/pages`, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.title,
      book_id: config.defaultBookId,
      html: `
        <p>${escapeHtml(payload.description)}</p>
        <p><strong>Country:</strong> ${escapeHtml(payload.country)}</p>
        <p><strong>Category:</strong> ${escapeHtml(payload.category)}</p>
        <p><strong>Type:</strong> ${escapeHtml(payload.type)}</p>
        ${optionalHtml(payload)}
        <p><strong>File:</strong> ${escapeHtml(payload.filename || "none")}</p>
      `,
      tags: baseTags,
    }),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!response.ok) {
    return { ok: false, message: `BookStack API failed (${response.status}): ${text.slice(0, 220)}`, pageId: null };
  }

  return { ok: true, message: "Page created.", pageId: parsePageIdFromJson(json) };
}

async function uploadBookStackAttachment(pageId, file) {
  const base = apiBase();
  const fd = new FormData();
  fd.append("uploaded_to", String(pageId));
  fd.append("name", file.name || "upload");
  fd.append("file", file, file.name || "upload");

  const response = await fetch(`${base}/api/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}`,
    },
    body: fd,
  });

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, message: `Attachment failed (${response.status}): ${text.slice(0, 220)}`, attachmentId: null };
  }
  let attachmentId = null;
  try {
    const j = JSON.parse(text);
    const raw = j.id ?? j.data?.id ?? null;
    attachmentId = raw != null ? Number(raw) : null;
    if (Number.isNaN(attachmentId)) attachmentId = null;
  } catch {
    /* ignore */
  }
  return { ok: true, message: "Attachment uploaded.", attachmentId };
}

async function tryBookStackSubmit(payload) {
  if (!hasBookStackApiConfig()) {
    return { success: false, message: "Missing API configuration." };
  }

  const created = await createBookStackPage(payload);
  if (!created.ok) {
    return { success: false, message: created.message };
  }

  const file = fileInput.files && fileInput.files[0];
  if (!file || created.pageId == null) {
    return {
      success: true,
      message:
        created.pageId == null
          ? "Page created but response had no page id; attachment skipped."
          : "Page created (no file to attach).",
      pageId: created.pageId,
      attachmentId: null,
      filename: file?.name ?? null,
    };
  }

  const attached = await uploadBookStackAttachment(created.pageId, file);
  if (!attached.ok) {
    return {
      success: false,
      message: `Page created. ${attached.message}`,
      pageId: created.pageId,
      attachmentId: null,
      filename: file.name,
    };
  }

  return {
    success: true,
    message: "Published to BookStack.",
    pageId: created.pageId,
    attachmentId: attached.attachmentId,
    filename: file.name,
  };
}

function saveDownloadMeta(meta) {
  if (!meta?.attachmentId) return;
  try {
    localStorage.setItem(
      DOWNLOAD_META_KEY,
      JSON.stringify({
        attachmentId: meta.attachmentId,
        pageId: meta.pageId ?? null,
        filename: meta.filename || "download",
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    /* ignore */
  }
}

async function downloadFromBookStack(meta) {
  if (!hasBookStackApiConfig()) {
    throw new Error("BookStack is not configured.");
  }
  const base = apiBase();
  const auth = { Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}` };

  const tryFile = await fetch(`${base}/api/attachments/${meta.attachmentId}/file`, { headers: auth });
  if (tryFile.ok) {
    const blob = await tryFile.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = meta.filename || "download";
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }

  const metaRes = await fetch(`${base}/api/attachments/${meta.attachmentId}`, {
    headers: { ...auth, Accept: "application/json" },
  });
  if (!metaRes.ok) throw new Error(`Could not load attachment (${metaRes.status}).`);
  const json = await metaRes.json();
  const row = json.id != null ? json : json.data || json;
  const link =
    row.url ||
    row.link ||
    row.links?.html ||
    row.links?.raw ||
    (typeof row.path === "string" && row.path.startsWith("http") ? row.path : null);

  if (link) {
    window.open(link, "_blank", "noopener");
    return;
  }

  const origin = bookStackOrigin();
  if (origin && meta.pageId) {
    window.open(`${origin}/pages/${meta.pageId}`, "_blank", "noopener");
  }
  throw new Error("Could not download from BookStack automatically.");
}

/* ---------- Card actions ---------- */

async function handlePreview(id) {
  const items = loadLibrary();
  const item = items.find((r) => r.id === id);
  if (!item) {
    showToast("Resource not found.", false);
    return;
  }
  const ext = fileExt(item.filename);

  if (item.hasBlob) {
    const blob = await idbGetBlob(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      if (ext === "pdf" || (blob.type && blob.type.includes("pdf"))) {
        openModal("Preview", `<iframe title="PDF preview" src="${url}#toolbar=1"></iframe>`, url);
        return;
      }
      openModal(
        "Preview",
        `<p>Preview is not available for this file type. Use Download to open it.</p><p><button type="button" class="btn btn-primary" id="modal-download-blob">Download</button></p>`,
        url,
      );
      document.getElementById("modal-download-blob")?.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = item.filename || "file";
        a.click();
      });
      return;
    }
  }

  if (item.source === "bookstack" && item.attachmentId && hasBookStackApiConfig()) {
    const base = apiBase();
    const res = await fetch(`${base}/api/attachments/${item.attachmentId}/file`, {
      headers: { Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}` },
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (ext === "pdf" || blob.type.includes("pdf")) {
        openModal("Preview", `<iframe title="PDF preview" src="${url}#toolbar=1"></iframe>`, url);
        return;
      }
      openModal(
        "Preview",
        `<p>Preview not available. <button type="button" class="btn btn-primary" id="modal-dl">Download</button></p>`,
        url,
      );
      document.getElementById("modal-dl")?.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = item.filename || "file";
        a.click();
      });
      return;
    }
    showToast(`Could not load file (${res.status}).`, false);
    return;
  }

  openModal("Preview", "<p>No preview available for this item.</p>");
}

async function handleDownload(id) {
  const items = loadLibrary();
  const item = items.find((r) => r.id === id);
  if (!item) {
    showToast("Resource not found.", false);
    return;
  }
  if (item.hasBlob) {
    const blob = await idbGetBlob(id);
    if (blob) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = item.filename || "download";
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Download started.", true);
      return;
    }
  }
  if (item.source === "bookstack" && item.attachmentId) {
    try {
      await downloadFromBookStack({
        attachmentId: item.attachmentId,
        pageId: item.pageId,
        filename: item.filename,
      });
      showToast("Download started.", true);
    } catch (e) {
      showToast(e.message || "Download failed", false);
    }
    return;
  }
  showToast("No file available to download.", false);
}

function applyTemplateFromItem(item) {
  if (!item) return;
  titleInput.value = item.title || "";
  descriptionInput.value = item.description || "";
  if (item.country) countryInput.value = item.country;
  if (item.category) categoryInput.value = item.category;
  if (item.type) typeInput.value = item.type;
  if (item.productDetail) productDetailInput.value = item.productDetail;
  crossCuttingInput.value = item.crossCutting || "";
  institutionInput.value = item.institution || "";
  keywordsInput.value = item.keywords || "";
  updateChipsPreview();
  updateFileValidation();
  setActiveTab("upload");
  titleInput.focus();
}

function handleEditMeta(id) {
  const items = loadLibrary();
  const item = items.find((r) => r.id === id);
  if (!item || item.source !== "local") return;
  openModal(
    "Edit metadata",
    `<form class="modal-form" id="edit-meta-form">
      <div class="field"><label>Title</label><input name="title" type="text" value="${escapeHtml(item.title)}" maxlength="200" /></div>
      <div class="field"><label>Description</label><textarea name="description" rows="3" maxlength="2000">${escapeHtml(item.description)}</textarea></div>
      <div class="field"><label>Keywords</label><input name="keywords" type="text" value="${escapeHtml(item.keywords || "")}" maxlength="200" /></div>
      <button type="submit" class="btn btn-primary">Save</button>
    </form>`,
  );
  document.getElementById("edit-meta-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    updateLibraryRecord(id, {
      title: String(fd.get("title") || "").trim(),
      description: String(fd.get("description") || "").trim(),
      keywords: String(fd.get("keywords") || "").trim(),
    });
    closeModal();
    renderMyUploads();
    showToast("Metadata updated.", true);
  });
}

/* ---------- Delegated clicks ---------- */

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const action = t.dataset.action;
  if (action === "preview") {
    e.preventDefault();
    handlePreview(t.dataset.id);
  } else if (action === "download") {
    e.preventDefault();
    handleDownload(t.dataset.id);
  } else if (action === "template" && t.dataset.id) {
    e.preventDefault();
    const item = loadLibrary().find((r) => r.id === t.dataset.id);
    if (item) applyTemplateFromItem(item);
  } else if (action === "template" && t.dataset.title) {
    e.preventDefault();
    applyTemplateFromItem({
      title: t.dataset.title,
      description: t.dataset.desc || "",
      country: t.dataset.country || "",
      category: t.dataset.category || "",
      type: t.dataset.type || "document",
      productDetail: "",
      crossCutting: "",
      institution: "",
      keywords: "",
    });
  } else if (action === "edit-meta") {
    e.preventDefault();
    handleEditMeta(t.dataset.id);
  } else if (action === "preview-example") {
    e.preventDefault();
    openModal(
      "Preview",
      "<p>This is an example layout. Upload <strong>Cash-Withdrawal-Slip.pdf</strong> (or any PDF) in the <strong>Upload</strong> tab to preview and download your real file under <strong>My uploads</strong>.</p>",
    );
  }
});

document.querySelectorAll("[data-modal-close]").forEach((el) => {
  el.addEventListener("click", () => closeModal());
});

/* ---------- Tabs wiring ---------- */

document.querySelectorAll(".tab-btn, .bottom-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    if (tab) setActiveTab(tab);
  });
});

document.getElementById("empty-goto-upload")?.addEventListener("click", () => setActiveTab("upload"));

/* ---------- Search buttons ---------- */

document.getElementById("btn-clear-filters")?.addEventListener("click", () => clearBrowseFilters());

document.getElementById("btn-apply-search")?.addEventListener("click", () => {
  const origin = bookStackOrigin();
  if (!origin) {
    showToast("Set bookStackPublicUrl in config.local.json to open BookStack search.", false);
    return;
  }
  const q = buildFilterSearchQuery();
  window.open(`${origin}/search?term=${encodeURIComponent(q)}`, "_blank", "noopener");
});

document.getElementById("btn-api-search")?.addEventListener("click", async () => {
  if (!searchApiResults) return;
  if (!hasBookStackApiConfig()) {
    if (searchSummary) searchSummary.textContent = "";
    searchApiResults.innerHTML =
      '<p class="panel-hint" style="margin:0">Connect BookStack to search the shared library. Your own uploads are listed under <strong>My uploads</strong>.</p>';
    return;
  }
  const base = apiBase();
  const q = buildFilterSearchQuery();
  searchApiResults.innerHTML = '<p class="panel-hint">Searching…</p>';
  try {
    const response = await fetch(`${base}/api/search?query=${encodeURIComponent(q)}`, {
      headers: {
        Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const t = await response.text();
      throw new Error(`Search failed (${response.status}): ${t.slice(0, 120)}`);
    }
    const json = await response.json();
    const rows = json.data || [];
    lastSearchRowCount = rows.length;
    setSearchSummary(rows.length);
    if (!rows.length) {
      searchApiResults.innerHTML = "";
      return;
    }
    const origin = bookStackOrigin();
    const cards = rows.slice(0, 24).map((item) => {
      const name = item.name || item.title || "Result";
      const id = item.id || "";
      const typ = String(item.type || "");
      let openBtn = "";
      if (origin && id && typ.toLowerCase() === "page") {
        const href = `${origin.replace(/\/$/, "")}/pages/${id}`;
        openBtn = `<a class="btn btn-secondary btn-small" href="${escapeHtml(href)}" target="_blank" rel="noopener">Open in BookStack</a>`;
      }
      return `<article class="resource-card">
        <div class="resource-card-top">
          <div class="resource-card-icon">${ICON_SVG.book}</div>
          <h3 class="resource-card-title">${escapeHtml(String(name))}</h3>
        </div>
        <p class="resource-card-desc">Type: ${escapeHtml(typ)} · id: ${escapeHtml(String(id))}</p>
        <div class="resource-card-actions">${openBtn}</div>
      </article>`;
    });
    searchApiResults.innerHTML = cards.join("");
  } catch (err) {
    setSearchSummary(0);
    searchApiResults.innerHTML = `<p class="form-status err">Search failed: ${escapeHtml(err.message)}</p>`;
    showToast(err.message || "Search failed", false);
  }
});

/* ---------- Form events ---------- */

[
  countryInput,
  categoryInput,
  typeInput,
  productDetailInput,
  crossCuttingInput,
  institutionInput,
  keywordsInput,
  titleInput,
  descriptionInput,
].forEach((el) => el?.addEventListener("input", updateChipsPreview));
fileInput?.addEventListener("change", () => {
  updateFileValidation();
  updateChipsPreview();
});

topSearchInput?.addEventListener("input", () => {
  if (sfKeywords) sfKeywords.value = topSearchInput.value;
});
sfKeywords?.addEventListener("input", () => {
  if (topSearchInput) topSearchInput.value = sfKeywords.value;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files && fileInput.files[0];
  const payload = {
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    country: countryInput.value.trim(),
    category: categoryInput.value.trim(),
    type: typeInput.value.trim(),
    productDetail: productDetailInput.value.trim(),
    crossCutting: crossCuttingInput.value.trim(),
    institution: institutionInput.value.trim(),
    keywords: keywordsInput.value.trim(),
    filename: selectedFilename(),
    submittedAt: new Date().toISOString(),
  };

  const validationError = validatePayload(payload);
  if (validationError) {
    setFormStatus(validationError, false);
    showToast(validationError, false);
    return;
  }

  const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const recordBase = {
    id,
    title: payload.title,
    description: payload.description,
    country: payload.country,
    category: payload.category,
    type: payload.type,
    productDetail: payload.productDetail,
    crossCutting: payload.crossCutting,
    institution: payload.institution,
    keywords: payload.keywords,
    filename: payload.filename,
    size: file ? file.size : null,
    ext: fileExt(payload.filename || ""),
    submittedAt: payload.submittedAt,
    mimeHint: file?.type || "",
    source: "local",
    pageId: null,
    attachmentId: null,
    hasBlob: true,
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading…";
  }
  setFormStatus("", true);

  await loadLocalConfig();
  updateConnectionUi();

  if (!hasBookStackApiConfig()) {
    prependLibraryRecord(recordBase, file);
    highlightResourceId = id;
    showToast("Saved locally in this browser.", true);
    setFormStatus("Saved locally in this browser.", true);
    form.reset();
    initDropdowns();
    updateFileValidation();
    updateChipsPreview();
    renderMyUploads();
    setActiveTab("my-uploads");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
    return;
  }

  try {
    const result = await tryBookStackSubmit(payload);
    if (result.success) {
      const bsRecord = {
        ...recordBase,
        id: `b_${result.pageId ?? "p"}_${result.attachmentId ?? Date.now()}`,
        source: "bookstack",
        pageId: result.pageId ?? null,
        attachmentId: result.attachmentId ?? null,
        hasBlob: true,
      };
      prependLibraryRecord(bsRecord, file);
      if (result.attachmentId) {
        saveDownloadMeta({
          attachmentId: result.attachmentId,
          pageId: result.pageId,
          filename: result.filename || payload.filename,
        });
      }
      highlightResourceId = bsRecord.id;
      const origin = bookStackOrigin();
      const linkHint =
        origin && result.pageId
          ? ` <a href="${origin}/pages/${result.pageId}" target="_blank" rel="noopener">Open in BookStack</a>`
          : "";
      setFormStatus("", true);
      showToast("Published to BookStack.", true);
      form.reset();
      initDropdowns();
      updateFileValidation();
      updateChipsPreview();
      renderMyUploads();
      setActiveTab("my-uploads");
      if (linkHint && statusEl) {
        statusEl.innerHTML = `Published.${linkHint}`;
        statusEl.className = "form-status ok";
      }
    } else {
      setFormStatus(result.message || "Upload failed", false);
      showToast(result.message || "Upload failed", false);
    }
  } catch (error) {
    setFormStatus(error.message || "Upload failed", false);
    showToast(error.message || "Upload failed", false);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }
});

/* ---------- Bootstrap ---------- */

async function bootstrap() {
  migrateLegacyHistory();
  await loadLocalConfig();
  updateConnectionUi();
  initDropdowns();
  initSearchFilters();
  updateChipsPreview();
  updateFileValidation();
  renderExampleResources();
  renderMyUploads();
  setActiveTab("browse");
}

bootstrap().catch((err) => {
  console.error(err);
  showToast(err.message || "Failed to start", false);
});
