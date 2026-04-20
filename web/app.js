const SESSION_TOKEN_KEY = "slow_session_token_v4";
const PROFILE_STORE_KEY = "slow_profile_store_v1";
const COMMENT_STORE_KEY = "slow_comment_store_v1";
const RECOMMEND_STORE_KEY = "slow_recommend_store_v1";

const PRODUCTION_API = "https://slow-57j2.onrender.com/api";
const LOCAL_API = "http://127.0.0.1:3001/api";

const config = {
  backendBaseUrl: location.hostname === "127.0.0.1" || location.hostname === "localhost" ? LOCAL_API : PRODUCTION_API,
};

const metadata = window.SLOW_UPLOAD_OPTIONS || {
  countries: [],
  mainCategories: [],
  crossCuttingCategories: [],
  productDetails: [],
  institutions: [],
  types: [],
  sampleResources: [],
};

const ROLE_OPTIONS = ["owner", "admin", "vip", "specialist", "member", "none"];
const STATUS_OPTIONS = ["active", "invited", "disabled"];
const ALL_PERMISSIONS = [
  "view_content",
  "search_resources",
  "download_content",
  "complete_profile",
  "upload_resources",
  "comment_resources",
  "recommend_content",
  "message_users",
  "create_discussions",
  "enable_notifications",
  "request_notifications",
  "edit_resources",
  "edit_tags",
  "initiate_comment_thread",
  "link_discussion",
  "conduct_poll",
  "certify_resources",
  "manage_categories",
  "manage_users",
  "manage_permissions",
  "approve_resources",
  "remove_comments",
  "disable_resources",
  "send_notifications",
  "manage_site",
  "manage_all_users",
];

const ROLE_PERMISSIONS = {
  owner: [...ALL_PERMISSIONS],
  admin: ALL_PERMISSIONS.filter((p) => p !== "manage_site" && p !== "manage_all_users"),
  vip: [
    "view_content","search_resources","download_content","complete_profile",
    "upload_resources","comment_resources","recommend_content","message_users",
    "create_discussions","enable_notifications","request_notifications",
    "edit_resources","edit_tags","initiate_comment_thread","link_discussion",
    "conduct_poll","certify_resources",
  ],
  specialist: [
    "view_content","search_resources","download_content","complete_profile",
    "upload_resources","comment_resources","recommend_content","message_users",
    "create_discussions","enable_notifications","request_notifications",
    "edit_resources","edit_tags","initiate_comment_thread","link_discussion",
    "conduct_poll",
  ],
  member: [
    "view_content","search_resources","download_content","complete_profile",
    "upload_resources","comment_resources","recommend_content","message_users",
    "create_discussions","enable_notifications","request_notifications",
  ],
  none: ["view_content","search_resources","download_content"],
};

function roleLabel(role) {
  const labels = { owner: "Owner", admin: "Admin", vip: "VIP", specialist: "Specialist", member: "Member", none: "None" };
  return labels[role] || role;
}

const state = {
  route: "home",
  backendReachable: false,
  token: localStorage.getItem(SESSION_TOKEN_KEY) || "",
  user: null,
  resources: [],
  filteredResources: [],
  users: [],
  commentsByResource: {},
  activeDetailId: null,
  editingResourceId: null,
  uploadPreviewUrl: null,
  searchTimer: null,
  profileStoreCache: readJsonStore(PROFILE_STORE_KEY),
  commentStoreCache: readJsonStore(COMMENT_STORE_KEY),
  recommendStoreCache: readJsonStore(RECOMMEND_STORE_KEY),
};

const els = {
  backendBadge: document.getElementById("backend-badge"),
  btnOpenUpload: document.getElementById("btn-open-upload"),
  btnHomeUpload: document.getElementById("btn-home-upload"),
  btnTopSignin: document.getElementById("btn-top-signin"),
  mainCategoryGrid: document.getElementById("main-category-grid"),
  crossCategoryGrid: document.getElementById("cross-category-grid"),
  searchForm: document.getElementById("search-form"),
  searchQuery: document.getElementById("search-query"),
  filterCountry: document.getElementById("filter-country"),
  filterProductDetail: document.getElementById("filter-product-detail"),
  filterCrossCutting: document.getElementById("filter-cross-cutting"),
  filterInstitution: document.getElementById("filter-institution"),
  filterKeywords: document.getElementById("filter-keywords"),
  btnClearSearch: document.getElementById("btn-clear-search"),
  btnRefreshLibrary: document.getElementById("btn-refresh-library"),
  browseStatus: document.getElementById("browse-status"),
  resourceGrid: document.getElementById("resource-grid"),
  routePanels: Array.from(document.querySelectorAll("[data-route-panel]")),
  bottomNavButtons: Array.from(document.querySelectorAll(".bottom-nav-btn")),
  messagesList: document.getElementById("messages-list"),
  notificationsList: document.getElementById("notifications-list"),
  authPanels: document.getElementById("auth-panels"),
  signInForm: document.getElementById("signin-form"),
  signInName: document.getElementById("signin-name"),
  signInEmail: document.getElementById("signin-email"),
  signInPassword: document.getElementById("signin-password"),
  signInStatus: document.getElementById("signin-status"),
  signupForm: document.getElementById("signup-form"),
  signupName: document.getElementById("signup-name"),
  signupEmail: document.getElementById("signup-email"),
  signupPassword: document.getElementById("signup-password"),
  signupCountry: document.getElementById("signup-country"),
  signupInterest: document.getElementById("signup-interest"),
  signupStatus: document.getElementById("signup-status"),
  profileEditor: document.getElementById("profile-editor"),
  profileForm: document.getElementById("profile-form"),
  profileSummary: document.getElementById("profile-summary"),
  profilePermissionSummary: document.getElementById("profile-permission-summary"),
  profileName: document.getElementById("profile-name"),
  profileEmail: document.getElementById("profile-email"),
  profileAvatar: document.getElementById("profile-avatar"),
  profileWhatsapp: document.getElementById("profile-whatsapp"),
  profileBiodata: document.getElementById("profile-biodata"),
  profileCountry: document.getElementById("profile-country"),
  profileInterest: document.getElementById("profile-interest"),
  profileSocials: document.getElementById("profile-socials"),
  profileStatus: document.getElementById("profile-status"),
  btnSignout: document.getElementById("btn-signout"),
  adminPanel: document.getElementById("admin-panel"),
  adminStatus: document.getElementById("admin-status"),
  btnRefreshUsers: document.getElementById("btn-refresh-users"),
  usersPermissionList: document.getElementById("users-permission-list"),
  adminRoleList: document.getElementById("admin-role-list"),
  adminPermissionList: document.getElementById("admin-permission-list"),
  adminCategoryList: document.getElementById("admin-category-list"),
  adminResourceList: document.getElementById("admin-resource-list"),
  detailModal: document.getElementById("detail-modal"),
  detailTitle: document.getElementById("detail-title"),
  detailBody: document.getElementById("detail-body"),
  uploadModal: document.getElementById("upload-modal"),
  uploadForm: document.getElementById("upload-form"),
  uploadTitle: document.getElementById("upload-title"),
  uploadDescription: document.getElementById("upload-description"),
  uploadCountry: document.getElementById("upload-country"),
  uploadCategory: document.getElementById("upload-category"),
  uploadType: document.getElementById("upload-type"),
  uploadProductDetail: document.getElementById("upload-product-detail"),
  uploadCrossCutting: document.getElementById("upload-cross-cutting"),
  uploadInstitution: document.getElementById("upload-institution"),
  uploadKeywords: document.getElementById("upload-keywords"),
  uploadFile: document.getElementById("upload-file"),
  uploadStatus: document.getElementById("upload-status"),
  uploadPreviewFrame: document.getElementById("upload-preview-frame"),
  uploadPreviewMeta: document.getElementById("upload-preview-meta"),
  uploadSubmit: document.getElementById("btn-upload-submit"),
  toastRoot: document.getElementById("toast-root"),
};

function apiBase() {
  return (config.backendBaseUrl || "").replace(/\/$/, "");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return "No date";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "No date";
  }
}

function showToast(message, ok = true) {
  if (!els.toastRoot) return;
  const node = document.createElement("div");
  node.className = `toast ${ok ? "ok" : "err"}`;
  node.textContent = message;
  els.toastRoot.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function showStatus(target, message, ok = true) {
  if (!target) return;
  target.textContent = message || "";
  target.className = `small-note ${message ? (ok ? "ok" : "err") : ""}`;
}

function routeFromHash() {
  return (window.location.hash || "#home").replace(/^#/, "") || "home";
}

function setRoute(route) {
  if (routeFromHash() !== route) {
    window.location.hash = route;
    return;
  }
  applyRoute(route);
}

function readJsonStore(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeJsonStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function profileStore() {
  return state.profileStoreCache;
}

function saveProfile(email, data) {
  const store = { ...profileStore() };
  store[email.toLowerCase()] = data;
  state.profileStoreCache = store;
  writeJsonStore(PROFILE_STORE_KEY, store);
}

function getSavedProfile(email) {
  if (!email) return null;
  return profileStore()[email.toLowerCase()] || null;
}

function commentsStore() {
  return state.commentStoreCache;
}

function recommendationsStore() {
  return state.recommendStoreCache;
}

function commentsForResource(id) {
  return state.commentsByResource[id] || commentsStore()[id] || [];
}

function saveComment(resourceId, comment) {
  const store = { ...commentsStore() };
  store[resourceId] = [...(store[resourceId] || []), comment];
  state.commentStoreCache = store;
  writeJsonStore(COMMENT_STORE_KEY, store);
}

function recommendResource(resourceId) {
  const store = { ...recommendationsStore() };
  store[resourceId] = Number(store[resourceId] || 0) + 1;
  state.recommendStoreCache = store;
  writeJsonStore(RECOMMEND_STORE_KEY, store);
}

function recommendationCount(resourceId) {
  return Number(recommendationsStore()[resourceId] || 0);
}

function userPermissions(user = state.user) {
  return Array.isArray(user?.permissions) ? user.permissions : [];
}

function hasPermission(permission, user = state.user) {
  return userPermissions(user).includes(permission);
}

async function loadConfig() {
  try {
    const res = await fetch("config.local.json", { cache: "no-store" });
    if (res.ok) Object.assign(config, await res.json());
  } catch {
    /* optional */
  }
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  return await fetch(`${apiBase()}${path}`, { ...options, headers });
}

async function errorText(res, fallback) {
  try {
    const text = (await res.text()).trim();
    if (!text) return fallback;
    try {
      const json = JSON.parse(text);
      return json.message || json.error || fallback;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

function fillSelect(selectEl, values, placeholder) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  selectEl.appendChild(first);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });
}

function initFields() {
  fillSelect(els.filterCountry, metadata.countries, "All countries");
  fillSelect(els.filterProductDetail, metadata.productDetails, "All product details");
  fillSelect(els.filterCrossCutting, metadata.crossCuttingCategories, "All cross-cutting");
  fillSelect(els.filterInstitution, metadata.institutions, "All institutions");
  fillSelect(els.signupCountry, metadata.countries, "Choose country");
  fillSelect(els.profileCountry, metadata.countries, "Choose country");
  fillSelect(els.uploadCountry, metadata.countries, "Choose country");
  fillSelect(els.uploadCategory, [...metadata.mainCategories, ...metadata.crossCuttingCategories], "Choose category");
  fillSelect(els.uploadType, metadata.types, "Choose type");
  fillSelect(els.uploadProductDetail, metadata.productDetails, "Choose detail");
  fillSelect(els.uploadCrossCutting, metadata.crossCuttingCategories, "Choose cross-cutting");
  fillSelect(els.uploadInstitution, metadata.institutions, "Choose institution");
  if (metadata.types.includes("Icon")) {
    els.uploadType.value = "Icon";
  }
}

function tileButtonHtml(label, kind) {
  return `<button type="button" class="category-tile" data-category-kind="${escapeHtml(kind)}" data-category-value="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
}

function renderCategoryTiles() {
  if (els.mainCategoryGrid) {
    els.mainCategoryGrid.innerHTML = metadata.mainCategories.map((label) => tileButtonHtml(label, "main")).join("");
  }
  if (els.crossCategoryGrid) {
    els.crossCategoryGrid.innerHTML = metadata.crossCuttingCategories.map((label) => tileButtonHtml(label, "cross")).join("");
  }
}

function colorForText(text) {
  const colors = ["#e7f3ea", "#f7eadf", "#e6eef8", "#f7e5e9", "#ece7f6", "#edf3de"];
  let total = 0;
  for (const char of String(text || "")) total += char.charCodeAt(0);
  return colors[total % colors.length];
}

function fallbackThumb(resource) {
  const typeInitial = escapeHtml((resource.type || "Item").slice(0, 1).toUpperCase());
  return `
    <div class="thumb-fallback" style="background:${colorForText(resource.category || resource.title)}">
      <span>${typeInitial}</span>
      <p>${escapeHtml(resource.title)}</p>
    </div>
  `;
}

function backendAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return new URL(path, `${apiBase()}/`).toString();
}

function resourceImageUrl(resource) {
  return resource?.file?.thumbnailUrl ? backendAssetUrl(resource.file.thumbnailUrl) : "";
}

function resourceDownloadUrl(resource) {
  if (!resource?.file?.url) return "";
  const url = backendAssetUrl(resource.file.url);
  if (url.startsWith("http") && !url.includes("/api/")) return url;
  return `${url}?download=1`;
}

function normalizeResource(resource) {
  return {
    id: resource.id,
    title: resource.title || "Untitled",
    description: resource.description || "",
    country: resource.country || "",
    category: resource.category || "",
    type: resource.type || "",
    keywords: Array.isArray(resource.keywords) ? resource.keywords : [],
    productDetail: resource.productDetail || resource.product_detail || "",
    crossCutting: resource.crossCutting || resource.cross_cutting || "",
    institution: resource.institution || "",
    created_at: resource.created_at || new Date().toISOString(),
    uploaded_by: resource.uploaded_by || null,
    file: resource.file || null,
  };
}

function cardTags(resource) {
  return [resource.category, resource.country, resource.type].filter(Boolean).slice(0, 3);
}

function resourceCardHtml(resource) {
  const imageUrl = resourceImageUrl(resource);
  const desc = (resource.description || "").slice(0, 60);
  return `
    <article class="resource-card">
      <button type="button" class="resource-card-hit" data-open-detail="${escapeHtml(resource.id)}">
        <div class="resource-thumb">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(resource.title)}" loading="lazy" />` : fallbackThumb(resource)}
        </div>
        <div class="resource-card-body">
          <h3>${escapeHtml(resource.title)}</h3>
          <p class="resource-type">${escapeHtml(resource.type || "Resource")}${resource.country ? ` · ${escapeHtml(resource.country)}` : ""}</p>
          <div class="tag-row">
            ${cardTags(resource)
              .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
              .join("")}
          </div>
        </div>
      </button>
    </article>
  `;
}

function filterResources(resources) {
  const query = (els.searchQuery?.value || "").trim().toLowerCase();
  const country = els.filterCountry?.value || "";
  const productDetail = els.filterProductDetail?.value || "";
  const crossCutting = els.filterCrossCutting?.value || "";
  const institution = els.filterInstitution?.value || "";
  const keywords = (els.filterKeywords?.value || "").trim().toLowerCase();

  return resources.filter((resource) => {
    const textBlob = [
      resource.title,
      resource.description,
      resource.category,
      resource.type,
      resource.country,
      resource.productDetail,
      resource.crossCutting,
      resource.institution,
      ...(resource.keywords || []),
    ]
      .join(" ")
      .toLowerCase();

    if (query && !textBlob.includes(query)) return false;
    if (country && resource.country !== country) return false;
    if (productDetail && resource.productDetail !== productDetail) return false;
    if (crossCutting && resource.crossCutting !== crossCutting) return false;
    if (institution && resource.institution !== institution) return false;
    if (keywords) {
      const bits = keywords.split(/[,\s]+/).filter(Boolean);
      if (!bits.every((bit) => textBlob.includes(bit))) return false;
    }
    return true;
  });
}

function renderResources() {
  const resources = state.filteredResources;
  if (!els.resourceGrid) return;
  if (!resources.length) {
    const canUpload = hasPermission("upload_resources");
    const hasFilter = (els.searchQuery?.value || "").trim() || els.filterCountry?.value || els.filterCrossCutting?.value;
    els.resourceGrid.innerHTML = `
      <div class="empty-card">
        <div class="empty-card-icon" aria-hidden="true">${hasFilter ? "🔍" : "📂"}</div>
        <p class="empty-card-title">${hasFilter ? "No matching resources" : "No resources yet"}</p>
        <p>${hasFilter ? "Try a different search or clear your filters." : "Browse a category above or upload the first icon or template."}</p>
        ${hasFilter ? `<button type="button" class="secondary-btn" onclick="document.getElementById('btn-clear-search')?.click()">Clear filters</button>` : ""}
        ${canUpload && !hasFilter ? `<button type="button" class="primary-btn" onclick="document.getElementById('btn-home-upload')?.click()">Upload a resource</button>` : ""}
      </div>
    `;
    return;
  }
  els.resourceGrid.innerHTML = resources.map(resourceCardHtml).join("");
}

function renderAdmin() {
  if (!els.adminCategoryList) return;
  if (els.adminRoleList) {
    els.adminRoleList.innerHTML = ["Owner", "Admin", "VIP", "Specialist", "Member", "None"]
      .map((item) => `<span class="chip">${escapeHtml(item)}</span>`)
      .join("");
  }
  if (els.adminPermissionList) {
    els.adminPermissionList.innerHTML = ALL_PERMISSIONS.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  }
  els.adminCategoryList.innerHTML = [...metadata.mainCategories, ...metadata.crossCuttingCategories]
    .map((item) => `<span class="chip">${escapeHtml(item)}</span>`)
    .join("");

  if (els.adminResourceList) {
    const rows = state.resources.slice(0, 8);
    els.adminResourceList.innerHTML = rows.length
      ? rows
          .map(
            (resource) => `
              <div class="simple-item">
                <strong>${escapeHtml(resource.title)}</strong>
                <span>${escapeHtml(resource.category || resource.type || "Resource")}</span>
              </div>
            `,
          )
          .join("")
      : `<div class="simple-item"><span>No resources yet</span></div>`;
  }
}

function renderUsers() {
  if (!els.usersPermissionList) return;
  const canManagePermissions = hasPermission("manage_permissions");
  const isOwner = state.user?.role === "owner";

  const searchEl = document.getElementById("admin-user-search");
  const query = (searchEl?.value || "").trim().toLowerCase();

  const filtered = state.users.filter((user) => {
    if (!query) return true;
    return [user.name, user.email, user.role, user.country].join(" ").toLowerCase().includes(query);
  });

  if (!filtered.length) {
    els.usersPermissionList.innerHTML = `<div class="simple-item"><span>${state.users.length ? "No users match the filter" : "No users found"}</span></div>`;
    return;
  }
  els.usersPermissionList.innerHTML = filtered
    .map(
      (user) => {
        const ownerLocked = !isOwner && user.role === "owner";
        const memberSince = formatDate(user.created_at);
        return `
        <article class="user-permission-card" data-user-card="${escapeHtml(user.id)}" ${ownerLocked ? `data-owner-locked="1"` : ""}>
          <div class="user-permission-head">
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <p>${escapeHtml(user.email)}</p>
              <p class="small-note">${escapeHtml(user.country || "No country")} · ${escapeHtml(String(user.uploaded_resource_count || 0))} uploads · Joined ${escapeHtml(memberSince)}</p>
              ${user.why_interested ? `<p class="small-note">${escapeHtml(user.why_interested)}</p>` : ""}
            </div>
            <div class="tag-row">
              <span class="tag role-tag role-${escapeHtml(user.role)}">${escapeHtml(roleLabel(user.role))}</span>
              <span class="tag">${escapeHtml(user.status)}</span>
            </div>
          </div>
          <div class="user-permission-grid">
            <label class="field">
              <span>Role</span>
              <select data-user-role="${escapeHtml(user.id)}" ${!canManagePermissions || ownerLocked ? "disabled" : ""}>
                ${ROLE_OPTIONS.map((role) => `<option value="${escapeHtml(role)}" ${user.role === role ? "selected" : ""} ${!isOwner && role === "owner" ? "disabled" : ""}>${escapeHtml(roleLabel(role))}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>Status</span>
              <select data-user-status="${escapeHtml(user.id)}" ${!canManagePermissions || ownerLocked ? "disabled" : ""}>
                ${STATUS_OPTIONS.map((status) => `<option value="${escapeHtml(status)}" ${user.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
              </select>
            </label>
          </div>
          <details class="permission-details">
            <summary class="permission-toggle">Permission grants (${(user.permission_grants || []).length} extra)</summary>
            <div class="permission-checklist">
              ${ALL_PERMISSIONS.map((permission) => {
                const fromRole = (ROLE_PERMISSIONS[user.role] || []).includes(permission);
                const isGrant = Array.isArray(user.permission_grants) && user.permission_grants.includes(permission);
                return `
                <label class="permission-option ${fromRole ? "from-role" : ""}">
                  <input type="checkbox" data-user-permission="${escapeHtml(user.id)}" value="${escapeHtml(permission)}" ${isGrant ? "checked" : ""} ${!canManagePermissions || ownerLocked || (!isOwner && permission === "manage_site") ? "disabled" : ""} />
                  <span>${escapeHtml(permission)}${fromRole ? " ✓" : ""}</span>
                </label>
              `;
              }).join("")}
            </div>
          </details>
          <div class="user-permission-actions">
            <button type="button" class="primary-btn" data-save-user="${escapeHtml(user.id)}" ${!canManagePermissions || ownerLocked ? "disabled" : ""}>Save</button>
            ${ownerLocked ? `<p class="small-note">Only an owner can change this user.</p>` : ""}
          </div>
        </article>
      `;
      },
    )
    .join("");
}

function renderMessages() {
  if (!state.user) {
    els.messagesList.innerHTML = `<div class="simple-item"><span>Sign in to see messages.</span></div>`;
    return;
  }
  if (!hasPermission("message_users")) {
    els.messagesList.innerHTML = `<div class="simple-item"><span>Your role does not include messaging.</span></div>`;
    return;
  }
  const allComments = Object.values(state.commentsByResource).flat();
  els.messagesList.innerHTML = allComments.length
    ? allComments
        .slice()
        .reverse()
        .slice(0, 8)
        .map(
          (comment) => `
            <div class="simple-item">
              <strong>${escapeHtml(comment.user?.name || comment.name || "Member")}</strong>
              <span>${escapeHtml(comment.body || comment.message || "")}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="simple-item"><span>No messages yet</span></div>`;
}

function renderNotifications() {
  if (!state.user) {
    els.notificationsList.innerHTML = `<div class="simple-item"><span>Sign in to see notifications.</span></div>`;
    return;
  }
  const items = state.resources
    .map((resource) => ({
      title: resource.title,
      count: recommendationCount(resource.id),
    }))
    .filter((item) => item.count > 0)
    .slice(0, 8);

  els.notificationsList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <div class="simple-item">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(String(item.count))} recommendations</span>
            </div>
          `,
        )
        .join("")
    : `<div class="simple-item"><span>No notifications yet</span></div>`;
}

function applyRoute(route) {
  let next = ["home", "messages", "notifications", "profile"].includes(route) ? route : "home";
  if ((next === "messages" || next === "notifications") && !state.user) {
    next = "profile";
    showToast("Sign in to access this section", false);
  }
  state.route = next;
  els.routePanels.forEach((panel) => {
    const on = panel.dataset.routePanel === next;
    panel.hidden = !on;
    panel.classList.toggle("is-active", on);
  });
  els.bottomNavButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.route === next));
}

function updateTopButtons() {
  if (els.btnTopSignin) {
    els.btnTopSignin.textContent = state.user ? state.user.name || "Profile" : "Sign in";
  }
  const canUpload = hasPermission("upload_resources");
  if (els.btnOpenUpload) els.btnOpenUpload.hidden = !canUpload;
  if (els.btnHomeUpload) els.btnHomeUpload.hidden = !canUpload;
  if (els.backendBadge) {
    els.backendBadge.textContent = state.backendReachable ? "Library connected" : "Offline sample library";
    els.backendBadge.classList.toggle("ok", state.backendReachable);
  }
}

function updateProfileUi() {
  const profile = getSavedProfile(state.user?.email || "");
  const signedIn = Boolean(state.user);

  if (els.authPanels) els.authPanels.hidden = signedIn;
  if (els.profileEditor) els.profileEditor.hidden = !signedIn;
  if (els.btnSignout) els.btnSignout.hidden = !signedIn;
  if (els.adminPanel) els.adminPanel.hidden = !hasPermission("manage_users");

  if (!signedIn) {
    if (els.profileSummary) els.profileSummary.textContent = "";
    if (els.profilePermissionSummary) els.profilePermissionSummary.textContent = "";
    return;
  }

  els.profileSummary.innerHTML = `${escapeHtml(state.user.name)} · <span class="tag role-tag role-${escapeHtml(state.user.role)}" style="vertical-align:middle">${escapeHtml(roleLabel(state.user.role))}</span>`;
  if (els.profilePermissionSummary) {
    const perms = userPermissions();
    els.profilePermissionSummary.textContent = perms.length ? `${perms.length} permissions active` : "No permissions assigned";
  }
  els.profileName.value = state.user.name || profile?.name || "";
  els.profileEmail.value = state.user.email || profile?.email || "";
  els.profileWhatsapp.value = state.user.whatsapp_phone || profile?.whatsapp || "";
  els.profileBiodata.value = state.user.biodata || profile?.biodata || "";
  els.profileCountry.value = state.user.country || profile?.country || "";
  els.profileInterest.value = state.user.why_interested || profile?.interest || "";
  els.profileSocials.value = state.user.social_handles || profile?.socials || "";
}

async function restoreSession() {
  if (!state.token) return;
  let attempts = 0;
  while (attempts < 2) {
    try {
      const res = await apiFetch("/auth/me");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          state.token = "";
          state.user = null;
          localStorage.removeItem(SESSION_TOKEN_KEY);
          return;
        }
        throw new Error("Session check failed");
      }
      const json = await res.json();
      state.user = json.user;
      return;
    } catch {
      attempts++;
      if (attempts < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function loadResources() {
  try {
    const res = await apiFetch("/resources?limit=100&offset=0");
    if (!res.ok) throw new Error(await errorText(res, "Could not load resources"));
    const json = await res.json();
    state.resources = (Array.isArray(json.rows) ? json.rows : []).map(normalizeResource);
    state.backendReachable = true;
  } catch {
    if (!state.backendReachable && !state.resources.length) {
      state.resources = metadata.sampleResources.map(normalizeResource);
    }
    state.backendReachable = false;
  }
  state.filteredResources = filterResources(state.resources);
  showStatus(els.browseStatus, `${state.filteredResources.length} resources`, true);
  updateTopButtons();
  renderResources();
  renderNotifications();
  renderAdmin();
}

async function loadUsers() {
  if (!hasPermission("manage_users")) return;
  showStatus(els.adminStatus, "Loading users", true);
  const res = await apiFetch("/users");
  if (!res.ok) {
    showStatus(els.adminStatus, await errorText(res, "Could not load users"), false);
    return;
  }
  const json = await res.json();
  state.users = json.rows || [];
  renderUsers();
  showStatus(els.adminStatus, `${state.users.length} users`, true);
}

function openUploadModal() {
  if (!hasPermission("upload_resources")) {
    showToast("Sign in with an account that can upload.", false);
    return;
  }
  showStatus(els.uploadStatus, "", true);
  if (!state.editingResourceId) {
    els.uploadForm.reset();
    renderUploadPreview();
    if (metadata.types.includes("Icon")) els.uploadType.value = "Icon";
  }
  els.uploadSubmit.disabled = false;
  els.uploadModal.hidden = false;
}

function prefillUploadFromResource(resource) {
  if (!resource) return;
  els.uploadTitle.value = resource.title || "";
  els.uploadDescription.value = resource.description || "";
  els.uploadCountry.value = resource.country || "";
  els.uploadCategory.value = resource.category || "";
  els.uploadType.value = resource.type || "";
  if (els.uploadProductDetail) els.uploadProductDetail.value = resource.productDetail || "";
  if (els.uploadCrossCutting) els.uploadCrossCutting.value = resource.crossCutting || "";
  if (els.uploadInstitution) els.uploadInstitution.value = resource.institution || "";
  els.uploadKeywords.value = Array.isArray(resource.keywords) ? resource.keywords.join(", ") : "";
}

function closeUploadModal() {
  els.uploadModal.hidden = true;
  state.editingResourceId = null;
}

function closeDetailModal() {
  els.detailModal.hidden = true;
  state.activeDetailId = null;
}

function clearUploadPreview() {
  if (state.uploadPreviewUrl) {
    URL.revokeObjectURL(state.uploadPreviewUrl);
    state.uploadPreviewUrl = null;
  }
}

function renderUploadPreview() {
  clearUploadPreview();
  const file = els.uploadFile?.files?.[0];
  if (!file) {
    els.uploadPreviewFrame.innerHTML = `<div class="preview-placeholder"><p>Select an image or file to see a preview here</p></div>`;
    els.uploadPreviewMeta.textContent = "No file selected";
    return;
  }

  const canPreview = file.type.startsWith("image/") || /\.svg$/i.test(file.name);
  if (canPreview) {
    state.uploadPreviewUrl = URL.createObjectURL(file);
    els.uploadPreviewFrame.innerHTML = `<img src="${escapeHtml(state.uploadPreviewUrl)}" alt="Upload preview" class="preview-image" />`;
  } else {
    els.uploadPreviewFrame.innerHTML = `<div class="preview-placeholder"><p>Preview not available for this file type</p></div>`;
  }
  els.uploadPreviewMeta.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
}

function detailHtml(resource) {
  const imageUrl = resourceImageUrl(resource);
  const comments = commentsForResource(resource.id);
  const canDownload = true;
  const canUpload = hasPermission("upload_resources");
  const canRecommend = state.user ? hasPermission("recommend_content") : false;
  const canComment = state.user ? hasPermission("comment_resources") : false;
  const canEditResource = Boolean(state.user && (resource.uploaded_by?.id === state.user.id || hasPermission("edit_resources")));

  const allTags = [resource.category, resource.country, resource.type].filter(Boolean);
  if (resource.productDetail) allTags.push(resource.productDetail);
  if (resource.crossCutting) allTags.push(resource.crossCutting);
  if (resource.institution) allTags.push(resource.institution);

  const keywordTags = (resource.keywords || []).filter((k) => !allTags.includes(k));

  const uploaderLine = resource.uploaded_by?.name
    ? `<p class="detail-meta">Uploaded by ${escapeHtml(resource.uploaded_by.name)} · ${formatDate(resource.created_at)}</p>`
    : `<p class="detail-meta">${formatDate(resource.created_at)}</p>`;

  const fileMeta = resource.file
    ? `<p class="detail-meta">${escapeHtml(resource.file.originalFilename || "")}${resource.file.sizeBytes ? ` · ${(Number(resource.file.sizeBytes) / 1024).toFixed(0)} KB` : ""}</p>`
    : "";

  return `
    <div class="detail-hero">
      <div class="detail-side">
        <div class="detail-category">${escapeHtml(resource.category || "Resource")}</div>
        <div class="detail-side-actions">
          <button type="button" class="secondary-btn detail-side-btn" data-download-resource="${escapeHtml(resource.id)}" ${canDownload ? "" : "disabled"}>Download</button>
          <button type="button" class="secondary-btn detail-side-btn" data-recommend-resource="${escapeHtml(resource.id)}" ${canRecommend ? "" : "disabled"}>Recommend</button>
        </div>
      </div>
      <div class="detail-preview-wrap">
        <div class="detail-preview">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(resource.title)}" />` : fallbackThumb(resource)}
        </div>
      </div>
      <div class="detail-copy">
        <p class="detail-type">${escapeHtml(resource.type || "Resource")}</p>
        <h3>${escapeHtml(resource.title)}</h3>
        <p class="detail-text">${escapeHtml(resource.description || "")}</p>
        ${uploaderLine}
        ${fileMeta}
        <div class="tag-row">
          ${allTags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        ${keywordTags.length ? `<div class="tag-row" style="margin-top:4px">${keywordTags.map((k) => `<span class="tag tag-keyword">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
        <div class="detail-actions">
          <button type="button" class="primary-btn" data-download-resource="${escapeHtml(resource.id)}" ${canDownload ? "" : "disabled"}>Download${resource.file?.sizeBytes ? ` (${(Number(resource.file.sizeBytes) / 1024).toFixed(0)} KB)` : ""}</button>
          <button type="button" class="secondary-btn" data-recommend-resource="${escapeHtml(resource.id)}" ${canRecommend ? "" : "disabled"}>Recommend (${recommendationCount(resource.id)})</button>
          ${canUpload ? `<button type="button" class="secondary-btn" data-open-upload-inline="1">Upload similar</button>` : ""}
          ${canEditResource ? `<button type="button" class="secondary-btn" data-edit-resource="${escapeHtml(resource.id)}">Edit</button>` : ""}
          ${canEditResource ? `<button type="button" class="secondary-btn" data-delete-resource="${escapeHtml(resource.id)}">Delete</button>` : ""}
        </div>
      </div>
    </div>

    <section class="discussion-section">
      <div class="section-head">
        <h3>Comments (${comments.length})</h3>
      </div>
      <div class="simple-list" id="detail-comments-list">
        ${
          comments.length
            ? comments
                .map(
                  (c) => `
                    <div class="simple-item">
                      <strong>${escapeHtml(c.user?.name || c.name || "Member")}</strong>
                      <span>${escapeHtml(c.body || c.message || "")}</span>
                      ${c.created_at ? `<span class="small-note">${formatDate(c.created_at)}</span>` : ""}
                    </div>
                  `,
                )
                .join("")
            : `<div class="simple-item"><span>${state.user ? "Be the first to comment on this resource." : "Sign in to see and add comments."}</span></div>`
        }
      </div>
      ${
        state.user
          ? `
            <form class="comment-form" data-comment-form="${escapeHtml(resource.id)}">
              <label class="field">
                <span>Add comment</span>
                <textarea name="message" rows="3" placeholder="${canComment ? "Write a short comment" : "Your role does not allow commenting"}" ${canComment ? "" : "disabled"}></textarea>
              </label>
              <button type="submit" class="primary-btn" data-comment-submit ${canComment ? "" : "disabled"}>Post comment</button>
            </form>
          `
          : `<p class="small-note" style="padding:8px 0"><a href="#profile" style="color:var(--accent);font-weight:700">Sign in</a> to leave a comment.</p>`
      }
    </section>
  `;
}

async function loadResourceComments(resourceId) {
  try {
    const res = await apiFetch(`/resources/${encodeURIComponent(resourceId)}/comments`);
    if (!res.ok) throw new Error(await errorText(res, "Could not load comments"));
    const json = await res.json();
    state.commentsByResource[resourceId] = Array.isArray(json.rows) ? json.rows : [];
  } catch {
    state.commentsByResource[resourceId] = commentsStore()[resourceId] || [];
  }
}

async function openDetail(resourceId) {
  const current = state.resources.find((item) => item.id === resourceId);
  els.detailTitle.textContent = current?.title || "Resource";
  els.detailBody.innerHTML = `<div class="simple-item"><span>Loading resource</span></div>`;
  els.detailModal.hidden = false;
  state.activeDetailId = resourceId;

  try {
    const [resourceRes] = await Promise.all([apiFetch(`/resources/${encodeURIComponent(resourceId)}`), loadResourceComments(resourceId)]);
    if (resourceRes.ok) {
      const fresh = normalizeResource(await resourceRes.json());
      state.resources = state.resources.map((item) => (item.id === resourceId ? fresh : item));
    }
  } catch {
    /* keep current resource */
  }

  const resource = state.resources.find((item) => item.id === resourceId);
  if (!resource) return;
  els.detailTitle.textContent = resource.title;
  els.detailBody.innerHTML = detailHtml(resource);
}

function applySearch() {
  state.filteredResources = filterResources(state.resources);
  showStatus(els.browseStatus, `${state.filteredResources.length} resources`, true);
  renderResources();
}

function scheduleApplySearch() {
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => {
    applySearch();
  }, 120);
}

function clearSearch() {
  els.searchForm.reset();
  fillSelect(els.filterCountry, metadata.countries, "All countries");
  fillSelect(els.filterProductDetail, metadata.productDetails, "All product details");
  fillSelect(els.filterCrossCutting, metadata.crossCuttingCategories, "All cross-cutting");
  fillSelect(els.filterInstitution, metadata.institutions, "All institutions");
  document.querySelectorAll(".category-tile.is-selected").forEach((t) => t.classList.remove("is-selected"));
  applySearch();
}

async function doAuth(name, email, statusEl) {
  return await doAuthRequest("/auth/login", { name, email, password: els.signInPassword?.value.trim() || "" }, statusEl);
}

async function doAuthRequest(path, payload, statusEl) {
  try {
    const res = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      showStatus(statusEl, await errorText(res, "Could not sign in"), false);
      return null;
    }
    const json = await res.json();
    state.token = json.token;
    state.user = json.user;
    localStorage.setItem(SESSION_TOKEN_KEY, state.token);
    updateTopButtons();
    updateProfileUi();
    renderResources();
    renderMessages();
    renderNotifications();
    await loadUsers();
    return json;
  } catch (error) {
    showStatus(statusEl, error.message || "Could not reach the server", false);
    return null;
  }
}

async function saveUserPermissions(userId) {
  if (!hasPermission("manage_permissions")) {
    showToast("You do not have permission to change user access.", false);
    return;
  }
  const roleEl = document.querySelector(`[data-user-role="${userId}"]`);
  const statusEl = document.querySelector(`[data-user-status="${userId}"]`);
  const permissionEls = Array.from(document.querySelectorAll(`[data-user-permission="${userId}"]`));
  const permission_grants = permissionEls.filter((el) => el.checked).map((el) => el.value);

  const res = await apiFetch(`/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: roleEl?.value,
      status: statusEl?.value,
      permission_grants,
    }),
  });

  if (!res.ok) {
    showToast(await errorText(res, "Could not save user"), false);
    return;
  }

  await loadUsers();
  if (state.user?.id === userId) {
    await restoreSession();
    updateTopButtons();
    updateProfileUi();
    renderMessages();
    renderNotifications();
  }
  showToast("User permissions updated", true);
}

async function handleSignIn(event) {
  event.preventDefault();
  showStatus(els.signupStatus, "", true);
  const name = els.signInName.value.trim();
  const email = els.signInEmail.value.trim();
  const password = els.signInPassword.value.trim();
  if (!email) {
    showStatus(els.signInStatus, "Enter your email address", false);
    els.signInEmail.focus();
    return;
  }
  if (!password) {
    showStatus(els.signInStatus, "Enter your password", false);
    els.signInPassword.focus();
    return;
  }
  showStatus(els.signInStatus, "Signing in…", true);
  const result = await doAuth(name, email, els.signInStatus);
  if (!result) return;
  showStatus(els.signInStatus, "", true);
  showToast(`Welcome back, ${result.user?.name || ""}`, true);
  setRoute("profile");
}

async function handleSignUp(event) {
  event.preventDefault();
  showStatus(els.signInStatus, "", true);
  const name = els.signupName.value.trim();
  const email = els.signupEmail.value.trim();
  const password = els.signupPassword.value.trim();
  const country = els.signupCountry.value;
  const interest = els.signupInterest.value.trim();
  if (!name) {
    showStatus(els.signupStatus, "Enter your name", false);
    els.signupName.focus();
    return;
  }
  if (!email) {
    showStatus(els.signupStatus, "Enter your email address", false);
    els.signupEmail.focus();
    return;
  }
  if (!password) {
    showStatus(els.signupStatus, "Create a password", false);
    els.signupPassword.focus();
    return;
  }
  showStatus(els.signupStatus, "Creating account…", true);
  const result = await doAuthRequest(
    "/auth/signup",
    { name, email, password, country, whyInterested: interest },
    els.signupStatus,
  );
  if (!result) return;
  saveProfile(email, {
    name,
    email,
    country,
    interest,
    biodata: "",
    whatsapp: "",
    socials: "",
    avatarName: "",
  });
  els.signupForm.reset();
  if (els.signupCountry) els.signupCountry.value = country;
  updateProfileUi();
  showStatus(els.signupStatus, "", true);
  showToast(`Welcome, ${name}! Account created.`, true);
  setRoute("profile");
}

async function handleSignOut() {
  try {
    await apiFetch("/auth/sign-out", { method: "POST" });
  } catch {
    /* ignore */
  }
  state.token = "";
  state.user = null;
  state.users = [];
  localStorage.removeItem(SESSION_TOKEN_KEY);
  updateTopButtons();
  updateProfileUi();
  renderResources();
  renderMessages();
  renderNotifications();
  renderAdmin();
  showToast("Signed out", true);
}

function handleProfileSave(event) {
  event.preventDefault();
  const email = (els.profileEmail.value || state.user?.email || "").trim();
  if (!email) {
    showStatus(els.profileStatus, "Email is required", false);
    return;
  }
  const payload = {
    name: els.profileName.value.trim(),
    country: els.profileCountry.value,
    whyInterested: els.profileInterest.value.trim(),
    whatsappPhone: els.profileWhatsapp.value.trim(),
    biodata: els.profileBiodata.value.trim(),
    socialHandles: els.profileSocials.value.trim(),
    avatarName: els.profileAvatar.files?.[0]?.name || getSavedProfile(email)?.avatarName || "",
  };
  apiFetch("/auth/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(await errorText(res, "Could not save profile"));
      const json = await res.json();
      state.user = json.user;
      saveProfile(email, {
        name: els.profileName.value.trim(),
        email,
        whatsapp: els.profileWhatsapp.value.trim(),
        biodata: els.profileBiodata.value.trim(),
        country: els.profileCountry.value,
        interest: els.profileInterest.value.trim(),
        socials: els.profileSocials.value.trim(),
        avatarName: payload.avatarName,
      });
      showStatus(els.profileStatus, "Profile saved", true);
      updateTopButtons();
      updateProfileUi();
      showToast("Profile saved", true);
    })
    .catch((error) => {
      showStatus(els.profileStatus, error.message || "Could not save profile", false);
    });
}

async function handleUpload(event) {
  event.preventDefault();
  if (!hasPermission("upload_resources")) {
    showStatus(els.uploadStatus, "You do not have upload permission", false);
    setRoute("profile");
    return;
  }

  const file = els.uploadFile.files?.[0];
  const payload = {
    title: els.uploadTitle.value.trim(),
    description: els.uploadDescription.value.trim(),
    country: els.uploadCountry.value,
    category: els.uploadCategory.value,
    type: els.uploadType.value,
    productDetail: els.uploadProductDetail?.value || "",
    crossCuttingCategory: els.uploadCrossCutting?.value || "",
    institution: els.uploadInstitution?.value || "",
    keywords: els.uploadKeywords.value.trim(),
  };

  if (!payload.title || !payload.description || !payload.country || !payload.category || !payload.type || (!file && !state.editingResourceId)) {
    showStatus(els.uploadStatus, state.editingResourceId ? "Complete all required fields" : "Complete all fields and choose a file", false);
    return;
  }

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
  if (file) formData.append("file", file, file.name);
  const isEditing = Boolean(state.editingResourceId);

  els.uploadSubmit.disabled = true;
  showStatus(els.uploadStatus, isEditing ? "Saving changes" : "Uploading", true);

  try {
    const path = isEditing ? `/resources/${encodeURIComponent(state.editingResourceId)}` : "/resources";
    const method = isEditing ? "PUT" : "POST";
    const res = await apiFetch(path, { method, body: formData });
    if (!res.ok) throw new Error(await errorText(res, isEditing ? "Update failed" : "Upload failed"));
    closeUploadModal();
    els.uploadForm.reset();
    renderUploadPreview();
    await loadResources();
    showToast(isEditing ? "Resource updated" : "Resource uploaded", true);
  } catch (error) {
    showStatus(els.uploadStatus, error.message || (isEditing ? "Update failed" : "Upload failed"), false);
  } finally {
    state.editingResourceId = null;
    els.uploadSubmit.disabled = false;
  }
}

function bindEvents() {
  els.bottomNavButtons.forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.route || "home"));
  });

  els.btnOpenUpload?.addEventListener("click", () => openUploadModal());
  els.btnHomeUpload?.addEventListener("click", () => openUploadModal());
  els.btnTopSignin?.addEventListener("click", () => setRoute(state.user ? "profile" : "profile"));
  els.btnClearSearch?.addEventListener("click", clearSearch);
  els.btnRefreshLibrary?.addEventListener("click", () => loadResources().catch(() => undefined));
  els.btnRefreshUsers?.addEventListener("click", () => loadUsers().catch(() => undefined));
  document.getElementById("admin-user-search")?.addEventListener("input", () => renderUsers());
  els.signInForm?.addEventListener("submit", handleSignIn);
  els.signupForm?.addEventListener("submit", handleSignUp);
  els.profileForm?.addEventListener("submit", handleProfileSave);
  els.btnSignout?.addEventListener("click", handleSignOut);
  els.searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch();
  });
  [els.searchQuery, els.filterCountry, els.filterProductDetail, els.filterCrossCutting, els.filterInstitution, els.filterKeywords]
    .filter(Boolean)
    .forEach((field) => {
      field.addEventListener("input", scheduleApplySearch);
      field.addEventListener("change", scheduleApplySearch);
    });
  els.uploadForm?.addEventListener("submit", handleUpload);
  els.uploadFile?.addEventListener("change", renderUploadPreview);

  document.addEventListener("click", (event) => {
      const categoryButton = event.target.closest("[data-category-value]");
    if (categoryButton) {
      document.querySelectorAll(".category-tile.is-selected").forEach((t) => t.classList.remove("is-selected"));
      categoryButton.classList.add("is-selected");
      const kind = categoryButton.getAttribute("data-category-kind");
      const value = categoryButton.getAttribute("data-category-value") || "";
      if (kind === "main") {
        els.searchQuery.value = "";
        state.filteredResources = filterResources(
          state.resources.filter((resource) => resource.category === value),
        );
      } else {
        els.filterCrossCutting.value = value;
        state.filteredResources = filterResources(state.resources);
      }
      showStatus(els.browseStatus, `${state.filteredResources.length} resources · ${value}`, true);
      renderResources();
      document.getElementById("resource-grid")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    const detailButton = event.target.closest("[data-open-detail]");
    if (detailButton) {
      openDetail(detailButton.getAttribute("data-open-detail"));
      return;
    }

    if (event.target.closest("[data-close-detail]")) {
      closeDetailModal();
      return;
    }

    if (event.target.closest("[data-close-upload]")) {
      closeUploadModal();
      return;
    }

    const recommendButton = event.target.closest("[data-recommend-resource]");
    if (recommendButton) {
      if (!hasPermission("recommend_content")) {
        showToast("You do not have permission to recommend.", false);
        return;
      }
      const id = recommendButton.getAttribute("data-recommend-resource");
      recommendResource(id);
      openDetail(id);
      renderNotifications();
      showToast("Recommendation saved", true);
      return;
    }

    const downloadButton = event.target.closest("[data-download-resource]");
    if (downloadButton) {
      const id = downloadButton.getAttribute("data-download-resource");
      const resource = state.resources.find((item) => item.id === id);
      const url = resourceDownloadUrl(resource);
      if (url) {
        window.open(url, "_blank", "noopener");
      } else {
        showToast("No file available for this resource.", false);
      }
      return;
    }

    if (event.target.closest("[data-open-upload-inline]")) {
      closeDetailModal();
      prefillUploadFromResource(state.resources.find((item) => item.id === state.activeDetailId));
      state.editingResourceId = null;
      openUploadModal();
      return;
    }

    const editButton = event.target.closest("[data-edit-resource]");
    if (editButton) {
      const id = editButton.getAttribute("data-edit-resource");
      const resource = state.resources.find((item) => item.id === id);
      state.editingResourceId = id;
      closeDetailModal();
      prefillUploadFromResource(resource);
      openUploadModal();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-resource]");
    if (deleteButton) {
      const id = deleteButton.getAttribute("data-delete-resource");
      apiFetch(`/resources/${encodeURIComponent(id)}`, { method: "DELETE" })
        .then(async (res) => {
          if (!res.ok) throw new Error(await errorText(res, "Could not delete resource"));
          state.resources = state.resources.filter((item) => item.id !== id);
          state.filteredResources = filterResources(state.resources);
          closeDetailModal();
          renderResources();
          renderAdmin();
          showToast("Resource deleted", true);
        })
        .catch((error) => showToast(error.message || "Could not delete resource", false));
      return;
    }

    const saveUserButton = event.target.closest("[data-save-user]");
    if (saveUserButton) {
      saveUserPermissions(saveUserButton.getAttribute("data-save-user"));
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-comment-form]");
    if (!form) return;
    event.preventDefault();
    if (!state.user) {
      showToast("Sign in to comment.", false);
      setRoute("profile");
      return;
    }
    if (!hasPermission("comment_resources")) {
      showToast("Your role does not allow commenting.", false);
      return;
    }
    const resourceId = form.getAttribute("data-comment-form");
    const messageEl = form.querySelector("textarea[name='message']");
    const submitBtn = form.querySelector("[data-comment-submit]");
    const message = messageEl.value.trim();
    if (!message) return;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Posting..."; }
    apiFetch(`/resources/${encodeURIComponent(resourceId)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: message }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorText(res, "Could not save comment"));
        const comment = await res.json();
        state.commentsByResource[resourceId] = [...commentsForResource(resourceId), comment];
        messageEl.value = "";
        openDetail(resourceId);
        renderMessages();
        showToast("Comment added", true);
      })
      .catch((error) => {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Post comment"; }
        showToast(error.message || "Could not save comment", false);
      });
  });

  window.addEventListener("hashchange", () => applyRoute(routeFromHash()));
  window.addEventListener("beforeunload", clearUploadPreview);
}

async function bootstrap() {
  await loadConfig();
  initFields();
  renderCategoryTiles();
  bindEvents();
  await restoreSession();
  updateTopButtons();
  updateProfileUi();
  await loadResources();
  await loadUsers();
  renderMessages();
  renderNotifications();
  renderAdmin();
  applyRoute(routeFromHash());
}

bootstrap().catch((error) => {
  console.error(error);
  showToast(error.message || "Could not load page", false);
});
