const SESSION_TOKEN_KEY = "slow_session_token_v3";

const config = {
  backendBaseUrl: "http://127.0.0.1:3001/api",
};

const state = {
  route: "browse",
  backendReachable: false,
  token: localStorage.getItem(SESSION_TOKEN_KEY) || "",
  user: null,
  resources: [],
  users: [],
  previewUrl: null,
};

const els = {
  backendBadge: document.getElementById("backend-badge"),
  sessionPill: document.getElementById("session-pill"),
  signOutBtn: document.getElementById("btn-sign-out"),
  navAdmin: document.getElementById("nav-admin"),
  navSignin: document.getElementById("nav-signin"),
  routeButtons: Array.from(document.querySelectorAll("[data-route]")),
  routePanels: Array.from(document.querySelectorAll("[data-route-panel]")),
  browseForm: document.getElementById("browse-form"),
  filterQuery: document.getElementById("filter-query"),
  filterCountry: document.getElementById("filter-country"),
  filterCategory: document.getElementById("filter-category"),
  filterType: document.getElementById("filter-type"),
  clearFiltersBtn: document.getElementById("btn-clear-filters"),
  browseStatus: document.getElementById("browse-status"),
  resourceGrid: document.getElementById("resource-grid"),
  uploadForm: document.getElementById("upload-form"),
  uploadTitle: document.getElementById("upload-title"),
  uploadDescription: document.getElementById("upload-description"),
  uploadCountry: document.getElementById("upload-country"),
  uploadCategory: document.getElementById("upload-category"),
  uploadType: document.getElementById("upload-type"),
  uploadKeywords: document.getElementById("upload-keywords"),
  uploadFile: document.getElementById("upload-file"),
  uploadStatus: document.getElementById("upload-status"),
  uploadSubmit: document.getElementById("btn-upload-submit"),
  previewFrame: document.getElementById("upload-preview-frame"),
  previewMeta: document.getElementById("upload-preview-meta"),
  signInForm: document.getElementById("signin-form"),
  signInStatus: document.getElementById("signin-status"),
  adminStatus: document.getElementById("admin-status"),
  usersTableBody: document.getElementById("users-table-body"),
  refreshUsersBtn: document.getElementById("btn-refresh-users"),
  modalRoot: document.getElementById("modal-root"),
  modalTitle: document.getElementById("modal-title"),
  modalBody: document.getElementById("modal-body"),
  toastRoot: document.getElementById("toast-root"),
};

function apiBase() {
  return (config.backendBaseUrl || "").replace(/\/$/, "");
}

const metadataOptions = window.SLOW_UPLOAD_OPTIONS || { countries: [], categories: [], types: [] };

function routeFromHash() {
  return (window.location.hash || "#browse").replace(/^#/, "") || "browse";
}

function setHash(route) {
  if (routeFromHash() === route) {
    applyRoute(route);
    return;
  }
  window.location.hash = route;
}

function backendAssetUrl(path) {
  if (!path) return "";
  return new URL(path, `${apiBase()}/`).toString();
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

function showToast(message, ok = true) {
  if (!els.toastRoot) return;
  const item = document.createElement("div");
  item.className = `toast ${ok ? "ok" : "err"}`;
  item.textContent = message;
  els.toastRoot.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

async function loadConfig() {
  try {
    const res = await fetch("config.local.json", { cache: "no-store" });
    if (!res.ok) return;
    Object.assign(config, await res.json());
  } catch {
    /* optional */
  }
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  const res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  return res;
}

async function parseErrorMessage(res, fallback) {
  try {
    const text = (await res.text()).trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

function fillSelect(selectEl, values, placeholder) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  selectEl.appendChild(placeholderOption);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });
}

function initBrowseFilters() {
  fillSelect(els.filterCountry, metadataOptions.countries, "Any country");
  fillSelect(els.filterCategory, metadataOptions.categories, "Any category");
  fillSelect(els.filterType, metadataOptions.types, "Any type");
}

function initUploadFields() {
  fillSelect(els.uploadCountry, metadataOptions.countries, "Select country");
  fillSelect(els.uploadCategory, metadataOptions.categories, "Select category");
  fillSelect(els.uploadType, metadataOptions.types, "Select type");
  if (metadataOptions.types.includes("Icon")) {
    els.uploadType.value = "Icon";
  }
}

function initMetadataOptions() {
  initBrowseFilters();
  initUploadFields();
}

function isAdmin() {
  return state.user?.role === "admin";
}

function canUpload() {
  return Boolean(state.user && state.user.status !== "disabled" && state.user.role !== "guest");
}

function updateSessionUi() {
  if (els.backendBadge) {
    els.backendBadge.textContent = state.backendReachable ? "Backend connected" : "Backend offline";
    els.backendBadge.classList.toggle("is-live", state.backendReachable);
  }

  if (els.sessionPill) {
    els.sessionPill.textContent = state.user
      ? `${state.user.name} · ${state.user.role}`
      : "Not signed in";
  }

  if (els.signOutBtn) els.signOutBtn.hidden = !state.user;
  if (els.navSignin) els.navSignin.hidden = Boolean(state.user);
  if (els.navAdmin) els.navAdmin.hidden = !isAdmin();
}

function applyRoute(rawRoute) {
  const route = rawRoute || "browse";
  let safeRoute = route;
  if (safeRoute === "admin" && !isAdmin()) safeRoute = state.user ? "browse" : "signin";
  if (safeRoute === "upload" && !canUpload()) safeRoute = state.user ? "browse" : "signin";
  if (!["browse", "upload", "admin", "signin"].includes(safeRoute)) safeRoute = "browse";
  state.route = safeRoute;

  els.routeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.route === safeRoute));
  els.routePanels.forEach((panel) => {
    const on = panel.dataset.routePanel === safeRoute;
    panel.hidden = !on;
    panel.classList.toggle("is-active", on);
  });

  if (safeRoute === "admin" && isAdmin()) {
    loadUsers().catch((error) => {
      setStatus(els.adminStatus, error.message || "Could not load users.", false);
    });
  }
}

function resourceImageUrl(resource) {
  return resource?.file?.thumbnailUrl ? backendAssetUrl(resource.file.thumbnailUrl) : "";
}

function resourceFileUrl(resource, download = false) {
  if (!resource?.file?.url) return "";
  const url = backendAssetUrl(resource.file.url);
  return download ? `${url}?download=1` : url;
}

function tagsHtml(resource) {
  const tags = [resource.country, resource.category, resource.type].filter(Boolean);
  return tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
}

function resourceCardHtml(resource) {
  const imageUrl = resourceImageUrl(resource);
  const uploader = resource.uploaded_by?.name ? `<span class="card-owner">By ${escapeHtml(resource.uploaded_by.name)}</span>` : "";
  return `
    <article class="resource-card" data-resource-id="${escapeHtml(resource.id)}">
      <button type="button" class="resource-card-hit" data-action="open-preview" data-id="${escapeHtml(resource.id)}">
        <div class="resource-thumb">
          ${
            imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(resource.title)}" loading="lazy" />`
              : `<div class="thumb-fallback"><span>Visual</span></div>`
          }
        </div>
        <div class="resource-body">
          <div class="resource-meta">${tagsHtml(resource)}</div>
          <h3>${escapeHtml(resource.title)}</h3>
          <p>${escapeHtml(resource.description || "")}</p>
          <div class="resource-footer">
            ${uploader}
            <span class="card-date">${escapeHtml(formatDate(resource.created_at))}</span>
          </div>
        </div>
      </button>
      <div class="resource-actions">
        <button type="button" class="btn btn-ghost" data-action="open-preview" data-id="${escapeHtml(resource.id)}">Preview</button>
        <button type="button" class="btn btn-ghost" data-action="download-resource" data-id="${escapeHtml(resource.id)}">Download</button>
      </div>
    </article>
  `;
}

function renderResources() {
  if (!els.resourceGrid) return;
  if (!state.resources.length) {
    els.resourceGrid.innerHTML = `
      <div class="empty-card">
        <p class="empty-card-title">No resources yet</p>
        <p class="empty-card-copy">Upload the first icon or visual template to populate the library.</p>
      </div>
    `;
    return;
  }
  els.resourceGrid.innerHTML = state.resources.map(resourceCardHtml).join("");
}

function renderUsers() {
  if (!els.usersTableBody) return;
  if (!state.users.length) {
    els.usersTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">No users found.</td>
      </tr>
    `;
    return;
  }

  els.usersTableBody.innerHTML = state.users
    .map(
      (user) => `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td><span class="role-pill role-${escapeHtml(user.role)}">${escapeHtml(user.role)}</span></td>
          <td>${escapeHtml(user.status)}</td>
          <td>${escapeHtml(formatDate(user.created_at))}</td>
        </tr>
      `,
    )
    .join("");
}

function setStatus(target, message, ok = true) {
  if (!target) return;
  target.textContent = message || "";
  target.className = `status-text ${message ? (ok ? "ok" : "err") : ""}`;
}

async function restoreSession() {
  if (!state.token) return;
  try {
    const res = await apiFetch("/auth/session");
    if (!res.ok) throw new Error("Session expired.");
    const json = await res.json();
    state.user = json.user;
  } catch {
    state.token = "";
    state.user = null;
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

async function loadResources() {
  const params = new URLSearchParams();
  const query = (els.filterQuery?.value || "").trim();
  const country = els.filterCountry?.value || "";
  const category = els.filterCategory?.value || "";
  const type = els.filterType?.value || "";

  if (query) {
    params.set("query", query);
    params.set("keywords", query);
  }
  if (country) params.set("country", country);
  if (category) params.set("category", category);
  if (type) params.set("type", type);

  const path = params.toString() ? `/resources/search?${params.toString()}` : "/resources?limit=48&offset=0";
  try {
    const res = await apiFetch(path);
    if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not load resources."));
    const json = await res.json();
    state.backendReachable = true;
    state.resources = json.rows || [];
    setStatus(els.browseStatus, `${state.resources.length} resource${state.resources.length === 1 ? "" : "s"} loaded`, true);
  } catch (error) {
    state.backendReachable = false;
    state.resources = [];
    setStatus(els.browseStatus, error.message || "Backend unavailable.", false);
  }

  updateSessionUi();
  renderResources();
}

async function loadUsers() {
  if (!isAdmin()) return;
  setStatus(els.adminStatus, "Loading users…", true);
  const res = await apiFetch("/users");
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Could not load users."));
  }
  const json = await res.json();
  state.users = json.rows || [];
  renderUsers();
  setStatus(els.adminStatus, `${state.users.length} user${state.users.length === 1 ? "" : "s"} loaded`, true);
}

async function handleSignIn(event) {
  event.preventDefault();
  const form = new FormData(els.signInForm);
  const payload = {
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").trim(),
  };

  if (!payload.email) {
    setStatus(els.signInStatus, "Enter your email address.", false);
    return;
  }

  setStatus(els.signInStatus, "Signing in…", true);
  const res = await apiFetch("/auth/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    setStatus(els.signInStatus, await parseErrorMessage(res, "Could not sign in."), false);
    return;
  }

  const json = await res.json();
  state.token = json.token;
  state.user = json.user;
  localStorage.setItem(SESSION_TOKEN_KEY, state.token);
  updateSessionUi();
  setStatus(els.signInStatus, "Signed in successfully.", true);
  showToast(`Signed in as ${state.user.name}`, true);
  setHash(canUpload() ? "upload" : "browse");
}

async function handleSignOut() {
  try {
    await apiFetch("/auth/sign-out", { method: "POST" });
  } catch {
    /* ignore */
  }
  state.token = "";
  state.user = null;
  localStorage.removeItem(SESSION_TOKEN_KEY);
  updateSessionUi();
  showToast("Signed out.", true);
  setHash("browse");
}

function clearPreview() {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
}

function renderUploadPreview() {
  if (!els.previewFrame || !els.previewMeta) return;
  const file = els.uploadFile?.files?.[0];
  clearPreview();

  if (!file) {
    els.previewFrame.innerHTML = `
      <div class="preview-placeholder">
        <span class="preview-placeholder-icon">◌</span>
        <p>Choose an image, icon, or visual asset to preview it here.</p>
      </div>
    `;
    els.previewMeta.innerHTML = `
      <p class="preview-meta-title">No file selected</p>
      <p class="preview-meta-copy">Image-based resources will display inline after upload.</p>
    `;
    return;
  }

  const imageLike = file.type.startsWith("image/") || /\.svg$/i.test(file.name);
  if (imageLike) {
    state.previewUrl = URL.createObjectURL(file);
    els.previewFrame.innerHTML = `<img src="${escapeHtml(state.previewUrl)}" alt="Upload preview" class="preview-image" />`;
  } else {
    els.previewFrame.innerHTML = `
      <div class="preview-placeholder">
        <span class="preview-placeholder-icon">FILE</span>
        <p>This file type will upload correctly, but it does not have an inline image preview.</p>
      </div>
    `;
  }

  els.previewMeta.innerHTML = `
    <p class="preview-meta-title">${escapeHtml(file.name)}</p>
    <p class="preview-meta-copy">${escapeHtml((file.type || "Unknown type"))} · ${escapeHtml((file.size / 1024).toFixed(1))} KB</p>
  `;
}

async function handleUpload(event) {
  event.preventDefault();
  if (!canUpload()) {
    showToast("Sign in before uploading.", false);
    setHash("signin");
    return;
  }

  const file = els.uploadFile?.files?.[0];
  const payload = {
    title: String(els.uploadTitle?.value || "").trim(),
    description: String(els.uploadDescription?.value || "").trim(),
    country: String(els.uploadCountry?.value || "").trim(),
    category: String(els.uploadCategory?.value || "").trim(),
    type: String(els.uploadType?.value || "").trim(),
    keywords: String(els.uploadKeywords?.value || "").trim(),
  };

  if (!payload.title || !payload.description || !payload.country || !payload.category || !payload.type || !file) {
    setStatus(els.uploadStatus, "Complete all required fields and choose a file.", false);
    return;
  }

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
  formData.append("file", file, file.name);

  if (els.uploadSubmit) {
    els.uploadSubmit.disabled = true;
    els.uploadSubmit.textContent = "Uploading…";
  }
  setStatus(els.uploadStatus, "Uploading resource…", true);

  try {
    const res = await apiFetch("/resources/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Upload failed."));
    }
    await res.json();
    showToast("Visual resource uploaded.", true);
    setStatus(els.uploadStatus, "Upload complete.", true);
    els.uploadForm.reset();
    initUploadFields();
    renderUploadPreview();
    await loadResources();
    setHash("browse");
  } catch (error) {
    setStatus(els.uploadStatus, error.message || "Upload failed.", false);
  } finally {
    if (els.uploadSubmit) {
      els.uploadSubmit.disabled = false;
      els.uploadSubmit.textContent = "Upload Resource";
    }
  }
}

function openModal(title, html) {
  if (!els.modalRoot || !els.modalBody || !els.modalTitle) return;
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = html;
  els.modalRoot.hidden = false;
}

function closeModal() {
  if (!els.modalRoot || !els.modalBody) return;
  els.modalRoot.hidden = true;
  els.modalBody.innerHTML = "";
}

function previewResource(id) {
  const resource = state.resources.find((item) => item.id === id);
  if (!resource) return;
  const imageUrl = resourceImageUrl(resource);
  if (imageUrl) {
    openModal(
      resource.title,
      `
        <div class="modal-visual">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(resource.title)}" />
          <div class="modal-copy">
            <p>${escapeHtml(resource.description || "")}</p>
            <div class="modal-tags">${tagsHtml(resource)}</div>
          </div>
        </div>
      `,
    );
    return;
  }

  const fileUrl = resourceFileUrl(resource, false);
  openModal(
    resource.title,
    `
      <div class="modal-copy">
        <p>${escapeHtml(resource.description || "")}</p>
        <div class="modal-tags">${tagsHtml(resource)}</div>
        <p><a class="btn btn-primary" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Open file</a></p>
      </div>
    `,
  );
}

function downloadResource(id) {
  const resource = state.resources.find((item) => item.id === id);
  if (!resource) return;
  const url = resourceFileUrl(resource, true);
  if (!url) return;
  window.open(url, "_blank", "noopener");
}

function bindEvents() {
  els.routeButtons.forEach((button) => {
    button.addEventListener("click", () => setHash(button.dataset.route || "browse"));
  });

  els.clearFiltersBtn?.addEventListener("click", () => {
    els.browseForm.reset();
    initBrowseFilters();
    loadResources().catch((error) => setStatus(els.browseStatus, error.message || "Could not load resources.", false));
  });

  els.browseForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    loadResources().catch((error) => setStatus(els.browseStatus, error.message || "Could not load resources.", false));
  });

  els.signInForm?.addEventListener("submit", handleSignIn);
  els.signOutBtn?.addEventListener("click", handleSignOut);
  els.uploadFile?.addEventListener("change", renderUploadPreview);
  els.uploadForm?.addEventListener("submit", handleUpload);
  els.refreshUsersBtn?.addEventListener("click", () => {
    loadUsers().catch((error) => setStatus(els.adminStatus, error.message || "Could not load users.", false));
  });

  document.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      const id = actionEl.getAttribute("data-id");
      const action = actionEl.getAttribute("data-action");
      if (action === "open-preview" && id) previewResource(id);
      if (action === "download-resource" && id) downloadResource(id);
    }

    if (event.target.closest("[data-close-modal]")) {
      closeModal();
    }
  });

  window.addEventListener("hashchange", () => applyRoute(routeFromHash()));
  window.addEventListener("beforeunload", clearPreview);
}

async function bootstrap() {
  await loadConfig();
  initMetadataOptions();
  bindEvents();
  await restoreSession();
  updateSessionUi();
  applyRoute(routeFromHash());
  renderUploadPreview();
  await loadResources();
}

bootstrap().catch((error) => {
  console.error(error);
  showToast(error.message || "Failed to load app.", false);
});
