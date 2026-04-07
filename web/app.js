const config = {
  apiBaseUrl: "",
  apiTokenId: "",
  apiTokenSecret: "",
  defaultBookId: 1,
};

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
const filePreview = document.getElementById("file-preview");
const tagsPreview = document.getElementById("tags-preview");
const statusEl = document.getElementById("status");
const openUploadBtn = document.getElementById("btn-open-upload");
const btnDownload = document.getElementById("btn-download");

/** Last file from a successful submit (same browser session). */
let lastUploadedFile = null;

const DOWNLOAD_META_KEY = "slow_download_meta";

function setLastUploadedFile(file) {
  lastUploadedFile = file && file instanceof File ? file : null;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function triggerFileDownload(file) {
  if (!file) return;
  triggerBlobDownload(file, file.name || "download");
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
    /* ignore quota */
  }
}

function loadDownloadMeta() {
  try {
    return JSON.parse(localStorage.getItem(DOWNLOAD_META_KEY) || "null");
  } catch {
    return null;
  }
}

async function downloadFromBookStack(meta) {
  if (!config.apiBaseUrl || !config.apiTokenId || !config.apiTokenSecret) {
    throw new Error("Configure API credentials in app.js to download from BookStack.");
  }
  const base = config.apiBaseUrl.replace(/\/$/, "");
  const auth = {
    Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}`,
  };

  const tryFile = await fetch(`${base}/api/attachments/${meta.attachmentId}/file`, {
    headers: auth,
  });
  if (tryFile.ok) {
    const blob = await tryFile.blob();
    triggerBlobDownload(blob, meta.filename || "download");
    return;
  }

  const metaRes = await fetch(`${base}/api/attachments/${meta.attachmentId}`, {
    headers: { ...auth, Accept: "application/json" },
  });
  if (!metaRes.ok) {
    throw new Error(`Could not load attachment (${metaRes.status}).`);
  }
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
    throw new Error("Opened the BookStack page in a new tab; use the page to download the attachment if the API file link was unavailable.");
  }

  throw new Error("BookStack did not return a downloadable link for this attachment.");
}

function updateDownloadHint() {
  if (!btnDownload) return;
  const meta = loadDownloadMeta();
  const ready = Boolean(lastUploadedFile || meta?.attachmentId);
  btnDownload.disabled = !ready;
  btnDownload.title = ready
    ? lastUploadedFile
      ? `Download ${lastUploadedFile.name}`
      : `Download last BookStack attachment (#${meta.attachmentId})`
    : "Upload a file first, then download";
}

async function handleDownloadClick() {
  if (lastUploadedFile) {
    triggerFileDownload(lastUploadedFile);
    setStatus(`Downloaded ${lastUploadedFile.name}`, true);
    return;
  }
  const meta = loadDownloadMeta();
  if (meta?.attachmentId) {
    try {
      await downloadFromBookStack(meta);
      setStatus(`Download started (${meta.filename || "file"})`, true);
    } catch (err) {
      setStatus(err.message || "Download failed", false);
    }
    return;
  }
  setStatus("Upload a file first, then use Download.", false);
}

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
  if (o.categories.length) {
    categoryInput.value = o.categories[0];
  }
  if (o.countries.length) {
    countryInput.value = o.countries[0];
  }
  typeInput.value = "document";
}

function buildSearchQuery(payload) {
  const parts = [];
  if (payload.country) parts.push(`country:"${payload.country}"`);
  if (payload.category) parts.push(`category:${payload.category}`);
  if (payload.type) parts.push(`type:${payload.type}`);
  if (payload.productDetail) parts.push(`product_detail:${payload.productDetail}`);
  if (payload.crossCutting) parts.push(`cross_cutting:${payload.crossCutting}`);
  if (payload.institution) parts.push(`institution:${payload.institution}`);
  if (payload.keywords) parts.push(payload.keywords);
  return parts.join(" ").trim() || "(add metadata to build query)";
}

function updateTagsPreview() {
  const o = getOptions();
  const country = countryInput.value.trim();
  const category = categoryInput.value.trim();
  const type = typeInput.value.trim();
  const productDetail = productDetailInput.value.trim();
  const crossCutting = crossCuttingInput.value.trim();
  const institution = institutionInput.value.trim();
  const keywords = keywordsInput.value.trim();
  const file = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "(none)";

  const payload = {
    country,
    category,
    type,
    productDetail,
    crossCutting,
    institution,
    keywords,
  };

  const lines = [
    `country: ${country || "—"}`,
    `category: ${category || "—"}`,
    `type: ${type || "—"}`,
    `product_detail: ${productDetail || "—"}`,
    `cross_cutting: ${crossCutting || "—"}`,
    `institution: ${institution || "—"}`,
    `keywords: ${keywords || "—"}`,
    `file: ${file}`,
    "",
    "Search-style query:",
    buildSearchQuery(payload),
  ];

  if (o.countries.length === 0) {
    lines.unshift("(Load metadata.js so dropdowns match Android.)");
  }

  tagsPreview.textContent = lines.join("\n");
}

function setStatus(message, ok) {
  statusEl.textContent = message;
  statusEl.className = ok ? "status ok" : "status err";
}

function appendUploadHistory(payload) {
  const key = "slow_upload_history";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  existing.unshift(payload);
  localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
}

function saveMockLocally(payload) {
  localStorage.setItem("slow_latest_submission", JSON.stringify(payload));
  appendUploadHistory(payload);
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

function parsePageIdFromJson(data) {
  if (!data || typeof data !== "object") return null;
  if (typeof data.id === "number") return data.id;
  if (data.data && typeof data.data.id === "number") return data.data.id;
  return null;
}

async function createBookStackPage(payload) {
  const base = config.apiBaseUrl.replace(/\/$/, "");
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
        <p><strong>Selected file:</strong> ${escapeHtml(payload.filename || "none")} (attached via API after page create)</p>
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

  const pageId = parsePageIdFromJson(json);
  return { ok: true, message: "Page created.", pageId };
}

async function uploadBookStackAttachment(pageId, file) {
  const base = config.apiBaseUrl.replace(/\/$/, "");
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
    /* non-JSON success body */
  }
  return { ok: true, message: "Attachment uploaded.", attachmentId };
}

async function tryBookStackSubmit(payload) {
  if (!config.apiBaseUrl || !config.apiTokenId || !config.apiTokenSecret) {
    return { success: false, message: "No API credentials configured." };
  }

  const created = await createBookStackPage(payload);
  if (!created.ok) {
    return { success: false, message: created.message };
  }

  const file = fileInput.files && fileInput.files[0];
  if (!file || created.pageId == null) {
    return {
      success: true,
      message: created.pageId == null
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
    message: "Page and file uploaded to BookStack.",
    pageId: created.pageId,
    attachmentId: attached.attachmentId,
    filename: file.name,
  };
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
].forEach((el) => el.addEventListener("input", updateTagsPreview));
fileInput.addEventListener("change", () => {
  const name = selectedFilename();
  filePreview.textContent = `Selected file: ${name || "none"}`;
  updateTagsPreview();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

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
    setStatus(validationError, false);
    return;
  }

  saveMockLocally(payload);
  const fileForDownload = fileInput.files && fileInput.files[0];
  setLastUploadedFile(fileForDownload);
  updateDownloadHint();

  setStatus("Saved locally. Attempting BookStack upload if configured...", true);

  try {
    const result = await tryBookStackSubmit(payload);
    if (result.success) {
      if (result.attachmentId) {
        saveDownloadMeta({
          attachmentId: result.attachmentId,
          pageId: result.pageId,
          filename: result.filename || payload.filename,
        });
      }
      setStatus(result.message, true);
      form.reset();
      initDropdowns();
      filePreview.textContent = "Selected file: none";
      updateTagsPreview();
      renderBrowse();
      updateDownloadHint();
      return;
    }
    setStatus(`Mock save complete. ${result.message}`, false);
    updateDownloadHint();
  } catch (error) {
    setStatus(`Mock save complete. Upload failed: ${error.message}`, false);
    updateDownloadHint();
  }
});

openUploadBtn.addEventListener("click", () => {
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  titleInput.focus();
});

const browseListEl = document.getElementById("browse-list");
const btnRefreshBrowse = document.getElementById("btn-refresh-browse");

function renderLocalBrowseCards() {
  const hist = JSON.parse(localStorage.getItem("slow_upload_history") || "[]");
  return hist.map((h) => ({
    title: h.title || "Untitled",
    meta: `${h.country || "—"} · ${h.category || "—"} · ${h.type || "—"} · ${h.submittedAt || ""}`,
    badge: "Saved locally",
  }));
}

async function fetchBookStackPages() {
  if (!config.apiBaseUrl || !config.apiTokenId || !config.apiTokenSecret) {
    return [];
  }
  const base = config.apiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/api/pages?count=20`, {
    headers: {
      Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) return [];
  const json = await response.json();
  const rows = json.data || [];
  return rows.map((p) => ({
    title: p.name || "Untitled",
    meta: `BookStack page #${p.id}`,
    badge: "BookStack",
  }));
}

function cardHtml(card) {
  return `<article class="browse-card"><span class="meta">${card.badge}</span><h4>${escapeHtml(card.title)}</h4><p class="meta">${escapeHtml(card.meta)}</p></article>`;
}

async function renderBrowse() {
  if (!browseListEl) return;
  browseListEl.innerHTML = "<p class=\"meta\">Loading…</p>";
  let apiCards = [];
  try {
    apiCards = await fetchBookStackPages();
  } catch {
    apiCards = [];
  }
  const localCards = renderLocalBrowseCards();
  const parts = [];
  if (apiCards.length) {
    parts.push("<p class=\"meta\"><strong>From BookStack</strong></p>");
    parts.push(...apiCards.map(cardHtml));
  }
  if (localCards.length) {
    parts.push("<p class=\"meta\"><strong>From this device</strong></p>");
    parts.push(...localCards.map(cardHtml));
  }
  if (!parts.length) {
    browseListEl.innerHTML = "<p class=\"meta\">No items yet. Submit an upload or configure API keys.</p>";
    return;
  }
  browseListEl.innerHTML = parts.join("");
}

if (btnRefreshBrowse) {
  btnRefreshBrowse.addEventListener("click", () => renderBrowse());
}

const sfCountry = document.getElementById("sf_country");
const sfCategory = document.getElementById("sf_category");
const sfType = document.getElementById("sf_type");
const sfKeywords = document.getElementById("sf_keywords");
const topSearchInput = document.getElementById("search");
const btnApplySearch = document.getElementById("btn-apply-search");
const btnApiSearch = document.getElementById("btn-api-search");
const searchApiResults = document.getElementById("search-api-results");

function initSearchFilters() {
  const o = getOptions();
  if (sfCountry) fillSelect(sfCountry, o.countries, "Any country");
  if (sfCategory) fillSelect(sfCategory, o.categories, "Any category");
  if (sfType) fillSelect(sfType, o.types, "Any type");
}

function buildFilterSearchQuery() {
  const parts = [];
  if (sfCountry?.value) parts.push(`country:"${sfCountry.value}"`);
  if (sfCategory?.value) parts.push(`category:${sfCategory.value}`);
  if (sfType?.value) parts.push(`type:${sfType.value}`);
  const kw = (sfKeywords?.value || "").trim() || (topSearchInput?.value || "").trim();
  if (kw) parts.push(kw);
  return parts.join(" ").trim() || "resource";
}

function bookStackOrigin() {
  if (!config.apiBaseUrl) return null;
  try {
    return new URL(config.apiBaseUrl).origin;
  } catch {
    return null;
  }
}

if (btnApplySearch) {
  btnApplySearch.addEventListener("click", () => {
    const origin = bookStackOrigin();
    if (!origin) {
      alert("Set config.apiBaseUrl in app.js to open BookStack search.");
      return;
    }
    const q = buildFilterSearchQuery();
    window.open(`${origin}/search?term=${encodeURIComponent(q)}`, "_blank", "noopener");
  });
}

if (btnApiSearch) {
  btnApiSearch.addEventListener("click", async () => {
    if (!config.apiBaseUrl || !config.apiTokenId || !config.apiTokenSecret) {
      if (searchApiResults) {
        searchApiResults.innerHTML = "<p class=\"meta\">Configure API credentials in app.js.</p>";
      }
      return;
    }
    const base = config.apiBaseUrl.replace(/\/$/, "");
    const q = buildFilterSearchQuery();
    if (searchApiResults) searchApiResults.innerHTML = "<p class=\"meta\">Searching…</p>";
    try {
      const url = `${base}/api/search?query=${encodeURIComponent(q)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}`,
          Accept: "application/json",
        },
      });
      const json = await response.json();
      const rows = json.data || [];
      if (!searchApiResults) return;
      if (!rows.length) {
        searchApiResults.innerHTML = "<p class=\"meta\">No results.</p>";
        return;
      }
      const cards = rows.slice(0, 15).map((item) => {
        const name = item.name || item.title || "Result";
        const id = item.id || "";
        return `<article class="browse-card"><h4>${escapeHtml(String(name))}</h4><p class="meta">id: ${escapeHtml(String(id))} · type: ${escapeHtml(String(item.type || ""))}</p></article>`;
      });
      searchApiResults.innerHTML = cards.join("");
    } catch (err) {
      if (searchApiResults) {
        searchApiResults.innerHTML = `<p class="meta">Search failed: ${escapeHtml(err.message)}</p>`;
      }
    }
  });
}

if (btnDownload) {
  btnDownload.addEventListener("click", () => {
    handleDownloadClick();
  });
}

initDropdowns();
initSearchFilters();
updateTagsPreview();
renderBrowse();
updateDownloadHint();
