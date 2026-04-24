const PROFILE_STORE_KEY = "slow_profile_store_v1";
const COMMENT_STORE_KEY = "slow_comment_store_v1";
const RECOMMEND_STORE_KEY = "slow_recommend_store_v1";
const RESOURCE_CACHE_KEY = "slow_resource_cache_v1";
const USERS_CACHE_KEY = "slow_users_cache_v1";
const NOTIFICATIONS_CACHE_KEY = "slow_notifications_cache_v1";
const RESOURCE_CACHE_TTL_MS = 5 * 60 * 1000;
const USERS_CACHE_TTL_MS = 2 * 60 * 1000;
const NOTIFICATIONS_CACHE_TTL_MS = 30 * 1000;

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

const auth = window.SlowAuth;

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
  token: auth?.getToken?.() || "",
  user: auth?.getCurrentUser?.() || null,
  authLoading: auth?.isLoading?.() || false,
  authError: auth?.getError?.() || "",
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
  authFormMode: "signin",
  /** When set, show reset-password card (signed out). */
  pendingPasswordResetToken: auth?.getPendingResetToken?.() || null,
  messageConversations: [],
  messageRecipients: [],
  activeConversationId: null,
  activeConversation: null,
  activeConversationMessages: [],
  messagesPollTimer: null,
  messageUserSearchTimer: null,
  shareResourceSearchTimer: null,
  selectedMessageUser: null,
  pendingSharedResource: null,
  messageMobileThreadOpen: false,
  resourcesLoading: false,
  usersLoading: false,
  resourcesPromise: null,
  usersPromise: null,
  notifications: [],
  notificationsUnreadCount: 0,
  notificationsPollTimer: null,
  notificationsLoading: false,
  notificationsPromise: null,
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
  notificationsStatus: document.getElementById("notifications-status"),
  btnNotificationsReadAll: document.getElementById("btn-notifications-read-all"),
  notificationsBadge: document.getElementById("notifications-badge"),
  authLoadingCard: document.getElementById("auth-loading-card"),
  authStateNote: document.getElementById("auth-state-note"),
  authStateActions: document.getElementById("auth-state-actions"),
  btnAuthRetrySession: document.getElementById("btn-auth-retry-session"),
  authPanels: document.getElementById("auth-panels"),
  signInForm: document.getElementById("signin-form"),
  signInName: document.getElementById("signin-name"),
  signInEmail: document.getElementById("signin-email"),
  signInPassword: document.getElementById("signin-password"),
  signInStatus: document.getElementById("signin-status"),
  btnSigninSubmit: document.getElementById("btn-signin-submit"),
  signupForm: document.getElementById("signup-form"),
  signupName: document.getElementById("signup-name"),
  signupEmail: document.getElementById("signup-email"),
  signupPassword: document.getElementById("signup-password"),
  signupCountry: document.getElementById("signup-country"),
  signupInterest: document.getElementById("signup-interest"),
  signupStatus: document.getElementById("signup-status"),
  btnSignupSubmit: document.getElementById("btn-signup-submit"),
  profileEditor: document.getElementById("profile-editor"),
  profileForm: document.getElementById("profile-form"),
  profileSummary: document.getElementById("profile-summary"),
  profileEmailLine: document.getElementById("profile-email-line"),
  profileJoinedLine: document.getElementById("profile-joined-line"),
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
  btnProfileSave: document.getElementById("btn-profile-save"),
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
  profileEmailStatus: document.getElementById("profile-email-status"),
  profileAvatarPreview: document.getElementById("profile-avatar-preview"),
  profileAvatarWrap: document.getElementById("profile-avatar-wrap"),
  btnRequestVerification: document.getElementById("btn-request-verification"),
  btnRefreshVerification: document.getElementById("btn-refresh-verification"),
  btnRequestVerificationP: document.getElementById("btn-request-verification-p"),
  btnGotoHome: document.getElementById("btn-goto-home"),
  appHomeLink: document.getElementById("app-home-link"),
  messageToUserSearch: document.getElementById("message-to-user-search"),
  messageToUserId: document.getElementById("message-to-user-id"),
  messageUserResults: document.getElementById("message-user-results"),
  messageBody: document.getElementById("message-body"),
  messageReplyBody: document.getElementById("message-reply-body"),
  btnSendMessage: document.getElementById("btn-send-message"),
  btnSendReply: document.getElementById("btn-send-reply"),
  messagesSendStatus: document.getElementById("messages-send-status"),
  messagesComposeNote: document.getElementById("messages-compose-note"),
  messagesComposeWrap: document.getElementById("messages-compose-wrap"),
  messagesThreadWrap: document.getElementById("messages-thread-wrap"),
  messagesThreadList: document.getElementById("messages-thread-list"),
  messagesThreadTitle: document.getElementById("messages-thread-title"),
  messagesShareBanner: document.getElementById("messages-share-banner"),
  messagesLayout: document.querySelector(".messages-layout"),
  messagesConversationsPanel: document.getElementById("messages-conversations-panel"),
  messagesThreadPanel: document.getElementById("messages-thread-panel"),
  messagesThreadTopbar: document.getElementById("messages-thread-topbar"),
  messagesThreadAvatar: document.getElementById("messages-thread-avatar"),
  messagesThreadName: document.getElementById("messages-thread-name"),
  messagesThreadStatus: document.getElementById("messages-thread-status"),
  btnMessagesBack: document.getElementById("btn-messages-back"),
  btnShareResourceInline: document.getElementById("btn-share-resource-inline"),
  shareResourceModal: document.getElementById("share-resource-modal"),
  shareResourcePreview: document.getElementById("share-resource-preview"),
  shareResourceSearch: document.getElementById("share-resource-search"),
  shareResourceResults: document.getElementById("share-resource-results"),
  shareResourceRecentList: document.getElementById("share-resource-recent-list"),
  shareResourceMessage: document.getElementById("share-resource-message"),
  shareResourceStatus: document.getElementById("share-resource-status"),
  signinMainBlock: document.getElementById("signin-main-block"),
  forgotPasswordBlock: document.getElementById("forgot-password-block"),
  resetPasswordCard: document.getElementById("reset-password-card"),
  forgotEmail: document.getElementById("forgot-email"),
  forgotStatus: document.getElementById("forgot-status"),
  btnShowForgot: document.getElementById("btn-show-forgot"),
  btnCancelForgot: document.getElementById("btn-cancel-forgot"),
  btnSendReset: document.getElementById("btn-send-reset"),
  resetTokenStore: document.getElementById("reset-token-store"),
  resetNewPassword: document.getElementById("reset-new-password"),
  resetConfirmPassword: document.getElementById("reset-confirm-password"),
  resetPasswordStatus: document.getElementById("reset-password-status"),
  btnApplyPasswordReset: document.getElementById("btn-apply-password-reset"),
  linkResetToSignin: document.getElementById("link-reset-to-signin"),
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

function formatTimeAgo(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    const diff = Date.now() - d.getTime();
    if (diff < 60 * 1000) return "now";
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h`;
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function avatarLetter(name) {
  const c = String(name || "?").trim().charAt(0).toUpperCase();
  return c || "?";
}

function conversationCounterpart(conversation) {
  if (!conversation) return null;
  return conversation.counterpart || conversation.participants?.find((p) => p.id !== state.user?.id) || null;
}

function userAvailability(user) {
  const active = user?.status === "active";
  return {
    active,
    label: active ? "Available" : user?.status === "invited" ? "Invited" : "Unavailable",
  };
}

function statusDotHtml(active) {
  return `<span class="messages-status-dot ${active ? "is-active" : ""}" aria-hidden="true"></span>`;
}

function messageUserSubtitle(user) {
  return [user?.country, user?.email].filter(Boolean).join(" · ");
}

function formatMessageTimestamp(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function findConversationByUserId(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  return (state.messageConversations || []).find((conversation) =>
    (conversation.participants || []).some((participant) => participant.id === id),
  ) || null;
}

function findResourceById(resourceId) {
  const id = String(resourceId || "").trim();
  if (!id) return null;
  return state.resources.find((resource) => resource.id === id) || null;
}

function pendingSharedResourceRecord() {
  if (!state.pendingSharedResource?.id) return null;
  return findResourceById(state.pendingSharedResource.id) || state.pendingSharedResource;
}

function isMobileMessagesViewport() {
  return window.matchMedia("(max-width: 759px)").matches;
}

function updateMessagesLayoutMode() {
  if (!els.messagesLayout) return;
  els.messagesLayout.classList.toggle("mobile-thread-open", Boolean(state.messageMobileThreadOpen));
}

function syncAuthState(snapshot = auth?.getSnapshot?.()) {
  if (!snapshot) return;
  const hadUser = Boolean(state.user?.id);
  state.token = snapshot.token || "";
  state.user = snapshot.currentUser || null;
  state.authLoading = Boolean(snapshot.authLoading);
  state.authError = String(snapshot.authError || "");
  state.pendingPasswordResetToken = snapshot.pendingResetToken || null;
  if (hadUser && !state.user) {
    clearNotificationState();
    stopNotificationsPolling();
    updateNotificationBadge();
  }
}

async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = 0, ...fetchOptions } = options;
  if (!timeoutMs) return await fetch(url, fetchOptions);

  let timer = null;
  try {
    return await Promise.race([
      fetch(url, fetchOptions),
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("Request timed out. Please try again.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
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

function goHome() {
  setRoute("home");
}

async function loadProfileAvatar() {
  if (!els.profileAvatarPreview || !state.token) {
    if (els.profileAvatarWrap) els.profileAvatarWrap.hidden = true;
    return;
  }
  if (!state.user?.has_avatar) {
    if (els.profileAvatarWrap) els.profileAvatarWrap.hidden = true;
    return;
  }
  try {
    const res = await apiFetch("/auth/avatar", { cache: "no-store" });
    if (!res.ok) throw new Error("no avatar");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (els.profileAvatarPreview.dataset.blobUrl) {
      URL.revokeObjectURL(els.profileAvatarPreview.dataset.blobUrl);
    }
    els.profileAvatarPreview.dataset.blobUrl = url;
    els.profileAvatarPreview.src = url;
    if (els.profileAvatarWrap) els.profileAvatarWrap.hidden = false;
  } catch {
    if (els.profileAvatarWrap) els.profileAvatarWrap.hidden = true;
  }
}

function processPasswordResetFromQuery() {
  const tok = auth?.consumeResetLinkFromUrl?.();
  if (!tok) return;
  syncAuthState();
  if (els.resetTokenStore) els.resetTokenStore.value = tok;
  if (els.resetNewPassword) els.resetNewPassword.value = "";
  if (els.resetConfirmPassword) els.resetConfirmPassword.value = "";
  if (els.resetPasswordStatus) els.resetPasswordStatus.textContent = "";
  setRoute("profile");
  showToast("Enter a new password below.", true);
  updateTopButtons();
  renderProfilePage();
}

function showSigninForgotMode(show) {
  state.authFormMode = show ? "forgot" : "signin";
  if (els.signinMainBlock) els.signinMainBlock.hidden = Boolean(show);
  if (els.forgotPasswordBlock) els.forgotPasswordBlock.hidden = !show;
  if (show) {
    const em = (els.signInEmail?.value || "").trim();
    if (els.forgotEmail && em) els.forgotEmail.value = em;
    if (els.forgotStatus) els.forgotStatus.textContent = "";
  }
}

async function handleSendPasswordReset() {
  const email = (els.forgotEmail?.value || "").trim();
  if (!email) {
    showStatus(els.forgotStatus, "Enter your account email", false);
    return;
  }
  auth.clearAuthError?.();
  showStatus(els.forgotStatus, "Sending…", true);
  try {
    const result = await auth.forgotPassword(apiFetch, email);
    if (!result.ok) {
      showStatus(els.forgotStatus, await errorText(result.response, "Could not send request"), false);
      return;
    }
    const msg = result.data?.previewUrl
      ? `${result.data.message} Preview: ${result.data.previewUrl}`
      : result.data?.message || "If an account exists for that email, you will receive a reset link.";
    showStatus(els.forgotStatus, msg, true);
    showToast(result.data?.message || "If an account exists, we sent a reset link.", true);
  } catch (e) {
    showStatus(els.forgotStatus, e.message || "Could not send", false);
  }
}

async function handleApplyPasswordReset() {
  const tok = state.pendingPasswordResetToken || (els.resetTokenStore?.value || "").trim();
  if (!tok) {
    showStatus(els.resetPasswordStatus, "This page is missing a valid reset link. Open the link from your email again.", false);
    return;
  }
  const a = (els.resetNewPassword?.value || "").trim();
  const b = (els.resetConfirmPassword?.value || "").trim();
  if (a.length < 6) {
    showStatus(els.resetPasswordStatus, "Use at least 6 characters", false);
    return;
  }
  if (a !== b) {
    showStatus(els.resetPasswordStatus, "Passwords do not match", false);
    return;
  }
  showStatus(els.resetPasswordStatus, "Saving…", true);
  try {
    const result = await auth.resetPassword(apiFetch, tok, a);
    syncAuthState();
    if (!result.ok) {
      showStatus(els.resetPasswordStatus, await errorText(result.response, "Could not update password"), false);
      return;
    }
    const json = result.data || {};
    if (els.resetTokenStore) els.resetTokenStore.value = "";
    if (els.resetNewPassword) els.resetNewPassword.value = "";
    if (els.resetConfirmPassword) els.resetConfirmPassword.value = "";
    if (els.resetPasswordStatus) els.resetPasswordStatus.textContent = "";
    showStatus(els.resetPasswordStatus, json.message || "Done", true);
    showToast(json.message || "Password updated. Sign in with your new password.", true);
    renderProfilePage();
    showSigninForgotMode(false);
    els.signInEmail?.focus();
  } catch (e) {
    showStatus(els.resetPasswordStatus, e.message || "Error", false);
  }
}

async function processEmailVerifyFromQuery() {
  const p = new URLSearchParams(window.location.search);
  const tok = p.get("email_verify");
  if (!tok) return;
  try {
    const res = await apiFetch("/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tok }),
      timeoutMs: 7000,
    });
    const clean = new URL(window.location.href);
    clean.searchParams.delete("email_verify");
    window.history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
    if (!res.ok) {
      showToast(await errorText(res, "Email verification failed"), false);
      return;
    }
    const json = await res.json();
    if (state.user && json.user && state.user.id === json.user.id) {
      auth.setCurrentUser({ ...state.user, ...json.user });
      syncAuthState();
    }
    showToast("Email verified", true);
    renderProfilePage();
  } catch {
    showToast("Could not verify email", false);
  }
}

function messageUserCardHtml(user, mode = "pick") {
  const { active, label } = userAvailability(user);
  const subtitle = messageUserSubtitle(user) || roleLabel(user?.role || "member");
  const attr =
    mode === "share"
      ? `data-share-user="${escapeHtml(user.id)}"`
      : `data-pick-user="${escapeHtml(user.id)}" data-pick-user-name="${escapeHtml(user.name || "")}" data-pick-user-email="${escapeHtml(user.email || "")}"`;
  return `
    <button type="button" class="${mode === "share" ? "share-target-row" : "message-user-result"}" ${attr}>
      <div class="message-user-row">
        <span class="messages-avatar small">${escapeHtml(avatarLetter(user.name))}</span>
        <div class="message-user-main">
          <span class="message-user-name">${escapeHtml(user.name || "Member")}</span>
          <span class="message-user-subtitle">${escapeHtml(subtitle)}</span>
        </div>
        <span class="message-user-status">${statusDotHtml(active)}${escapeHtml(label)}</span>
      </div>
    </button>
  `;
}

function renderMessageSearchResults(target, rows, query, mode = "pick") {
  if (!target) return;
  if (!Array.isArray(rows) || !rows.length) {
    target.hidden = false;
    target.innerHTML = `<div class="simple-item"><span>${query ? `No users found for “${escapeHtml(query)}”.` : "No users found."}</span></div>`;
    return;
  }
  target.hidden = false;
  target.innerHTML = rows.map((user) => messageUserCardHtml(user, mode)).join("");
}

function sharedResourceCardHtml(resourceLike, options = {}) {
  const mine = Boolean(options.mine);
  const resource = findResourceById(resourceLike?.id) || resourceLike;
  const liveResource = resource?.id ? findResourceById(resource.id) : null;
  const isUnavailable = !liveResource || isFileUnavailable(liveResource);
  const thumbSource = liveResource || resource;
  const thumb = thumbSource?.file
    ? resourcePreviewHtml(thumbSource, "card")
    : fallbackThumb({ title: thumbSource?.title || "Resource", category: thumbSource?.category || "", type: thumbSource?.type || "Resource" }, fileLabel(thumbSource));
  const meta = [thumbSource?.country, thumbSource?.category, thumbSource?.type].filter(Boolean).join(" · ");
  return `
    <div class="message-shared-resource-card ${isUnavailable ? "is-unavailable" : ""}">
      <div class="message-shared-resource-thumb">${thumb}</div>
      <div class="message-shared-resource-copy">
        <span class="message-shared-resource-title">${escapeHtml(thumbSource?.title || "Shared resource")}</span>
        <span class="message-shared-resource-meta">${escapeHtml(meta || "Resource")}</span>
        ${
          !isUnavailable && thumbSource?.id
            ? `<button type="button" class="${mine ? "secondary-btn" : "primary-btn"}" data-open-shared-resource="${escapeHtml(thumbSource.id)}">Open resource</button>`
            : `<span class="small-note">This resource is unavailable right now.</span>`
        }
      </div>
    </div>
  `;
}

function groupConversationMessages(rows) {
  const groups = [];
  for (const row of rows || []) {
    const previous = groups[groups.length - 1];
    if (previous && previous.senderId === row.sender?.id) {
      previous.messages.push(row);
      continue;
    }
    groups.push({
      senderId: row.sender?.id || "",
      sender: row.sender || null,
      mine: row.sender?.id === state.user?.id,
      messages: [row],
    });
  }
  return groups;
}

function shareResourcePreviewCardHtml(resource) {
  if (!resource) return `<div class="simple-item"><span>Select a resource to share.</span></div>`;
  const live = findResourceById(resource.id) || resource;
  const meta = [live.country, live.category, live.type].filter(Boolean).join(" · ");
  const thumb = live.file ? resourcePreviewHtml(live, "card") : fallbackThumb(live, fileLabel(live));
  return `
    <div class="share-resource-summary-card">
      <div class="message-shared-resource-thumb">${thumb}</div>
      <div class="share-resource-summary-copy">
        <strong>${escapeHtml(live.title || "Resource")}</strong>
        <span class="small-note">${escapeHtml(meta || "Resource")}</span>
      </div>
    </div>
  `;
}

function renderShareResourceModal() {
  if (!els.shareResourceModal) return;
  const resource = pendingSharedResourceRecord();
  if (els.shareResourcePreview) {
    els.shareResourcePreview.innerHTML = shareResourcePreviewCardHtml(resource);
  }
  if (els.shareResourceRecentList) {
    const recentRows = (state.messageConversations || []).slice(0, 8);
    els.shareResourceRecentList.innerHTML = recentRows.length
      ? recentRows
          .map((conversation) => {
            const counterpart = conversationCounterpart(conversation);
            const { active, label } = userAvailability(counterpart);
            return `
              <button type="button" class="share-target-row" data-share-conversation="${escapeHtml(conversation.id)}">
                <div class="message-conversation-row">
                  <span class="messages-avatar small">${escapeHtml(avatarLetter(counterpart?.name || "Conversation"))}</span>
                  <div class="message-conversation-main">
                    <span class="message-conversation-name">${escapeHtml(counterpart?.name || "Conversation")}</span>
                    <span class="message-conversation-preview">${escapeHtml(conversation.last_message?.body || "Share this resource in chat")}</span>
                  </div>
                  <span class="message-user-status">${statusDotHtml(active)}${escapeHtml(label)}</span>
                </div>
              </button>
            `;
          })
          .join("")
      : `<div class="simple-item"><span>No chats yet. Search for a user above.</span></div>`;
  }
}

function openShareResourceModal(resource) {
  if (!state.user || !hasPermission("message_users")) {
    showToast("Sign in to share resources.", false);
    setRoute("profile");
    return;
  }
  state.pendingSharedResource = resource ? { ...resource } : state.pendingSharedResource;
  renderShareResourceModal();
  if (!state.messageConversations.length) {
    void refreshConversations();
  }
  if (els.shareResourceSearch) els.shareResourceSearch.value = "";
  if (els.shareResourceResults) {
    els.shareResourceResults.hidden = true;
    els.shareResourceResults.innerHTML = "";
  }
  if (els.shareResourceMessage) els.shareResourceMessage.value = "";
  showStatus(els.shareResourceStatus, "", true);
  if (els.shareResourceModal) els.shareResourceModal.hidden = false;
}

function closeShareResourceModal() {
  if (els.shareResourceModal) els.shareResourceModal.hidden = true;
  if (els.shareResourceSearch) els.shareResourceSearch.value = "";
  if (els.shareResourceResults) {
    els.shareResourceResults.hidden = true;
    els.shareResourceResults.innerHTML = "";
  }
  showStatus(els.shareResourceStatus, "", true);
}

async function loadMessages() {
  if (!els.messagesList) return;
  stopMessagesPolling();
  if (!state.user) {
    els.messagesList.innerHTML = `<div class="simple-item"><span>Sign in to see messages.</span></div>`;
    if (els.messagesComposeWrap) els.messagesComposeWrap.hidden = true;
    if (els.messagesThreadWrap) els.messagesThreadWrap.hidden = true;
    state.messageMobileThreadOpen = false;
    updateMessagesLayoutMode();
    return;
  }
  if (!hasPermission("message_users")) {
    els.messagesList.innerHTML = `<div class="simple-item"><span>Your role does not include messaging yet.</span></div>`;
    if (els.messagesComposeWrap) els.messagesComposeWrap.hidden = true;
    if (els.messagesThreadWrap) els.messagesThreadWrap.hidden = true;
    state.messageMobileThreadOpen = false;
    updateMessagesLayoutMode();
    return;
  }
  if (els.messagesComposeWrap) els.messagesComposeWrap.hidden = false;
  if (els.messagesThreadWrap) els.messagesThreadWrap.hidden = true;
  if (els.messagesSendStatus) els.messagesSendStatus.textContent = "";
  els.messagesList.innerHTML = `<div class="simple-item"><span>Loading conversations…</span></div>`;

  const [conversationsRes] = await Promise.all([
    apiFetch("/messages/conversations", { timeoutMs: 6000 }),
  ]);
  if (!conversationsRes.ok) {
    els.messagesList.innerHTML = `<div class="simple-item"><span>Could not load conversations.</span></div>`;
    return;
  }

  const conversationsJson = await conversationsRes.json();
  state.messageConversations = Array.isArray(conversationsJson.rows) ? conversationsJson.rows : [];
  renderConversationList();
  clearMessageRecipientSelection();
  renderMessageShareBanner();
  state.messageMobileThreadOpen = false;
  updateMessagesLayoutMode();

  if (!isMobileMessagesViewport() && state.messageConversations.length && !state.activeConversationId) {
    await openConversation(state.messageConversations[0].id);
  } else if (!state.messageConversations.length) {
    state.activeConversationId = null;
    state.activeConversation = null;
    state.activeConversationMessages = [];
    renderConversationThread();
  } else if (state.activeConversationId && (!isMobileMessagesViewport() || state.messageMobileThreadOpen)) {
    await openConversation(state.activeConversationId);
  }
  startMessagesPolling();
}

function clearMessageRecipientSelection() {
  state.selectedMessageUser = null;
  if (els.messageToUserId) els.messageToUserId.value = "";
  if (els.messageToUserSearch) els.messageToUserSearch.value = "";
  if (els.messageUserResults) {
    els.messageUserResults.hidden = true;
    els.messageUserResults.innerHTML = "";
  }
}

async function searchMessageRecipients(query, target = els.messageUserResults, mode = "pick") {
  const q = String(query || "").trim();
  if (!target) return;
  if (q.length < 2) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  target.innerHTML = `<div class="simple-item"><span>Searching…</span></div>`;
  const res = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`, { timeoutMs: 5000 });
  if (!res.ok) {
    target.innerHTML = `<div class="simple-item"><span>Could not search users.</span></div>`;
    return;
  }
  const json = await res.json();
  const rows = Array.isArray(json.rows) ? json.rows : [];
  renderMessageSearchResults(target, rows, q, mode);
}

function renderConversationList() {
  if (!els.messagesList) return;
  const rows = state.messageConversations || [];
  if (!rows.length) {
    els.messagesList.innerHTML = `<div class="simple-item"><span>No chats yet. Search for someone to start chatting.</span></div>`;
    return;
  }
  els.messagesList.innerHTML = rows
    .map((conv) => {
      const counterpart = conversationCounterpart(conv);
      const name = counterpart?.name || "Conversation";
      const { active, label } = userAvailability(counterpart);
      const preview = conv.last_message?.resource
        ? `Shared ${conv.last_message.resource.title || "a resource"}`
        : conv.last_message?.body || "No messages yet";
      const isActive = conv.id === state.activeConversationId;
      return `
        <button type="button" class="message-inbox-item ${isActive ? "is-active" : ""}" data-open-conversation="${escapeHtml(conv.id)}">
          <div class="message-conversation-row">
            <span class="messages-avatar small">${escapeHtml(avatarLetter(name))}</span>
            <div class="message-conversation-main">
              <span class="message-conversation-name">${escapeHtml(name)}</span>
              <span class="message-user-status">${statusDotHtml(active)}${escapeHtml(label)}</span>
              <span class="message-conversation-preview">${escapeHtml(preview)}</span>
            </div>
            <div class="message-conversation-meta">
              <span class="small-note">${conv.last_message?.created_at ? formatTimeAgo(conv.last_message.created_at) : "New"}</span>
              ${conv.unread_count ? `<span class="message-unread-badge">${escapeHtml(String(conv.unread_count))}</span>` : ""}
            </div>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderConversationThread() {
  if (!els.messagesThreadWrap || !els.messagesThreadList || !els.messagesThreadTitle) return;
  if (!state.activeConversation || !state.activeConversationId) {
    els.messagesThreadWrap.hidden = true;
    if (els.messagesThreadTopbar) els.messagesThreadTopbar.hidden = true;
    if (els.messagesComposeWrap) els.messagesComposeWrap.hidden = false;
    return;
  }
  if (els.messagesComposeWrap) els.messagesComposeWrap.hidden = true;
  const counterpart = conversationCounterpart(state.activeConversation);
  const { active, label } = userAvailability(counterpart);
  els.messagesThreadTitle.textContent = counterpart ? `Conversation with ${counterpart.name}` : "Conversation";
  if (els.messagesThreadTopbar) els.messagesThreadTopbar.hidden = false;
  if (els.messagesThreadAvatar) els.messagesThreadAvatar.textContent = avatarLetter(counterpart?.name || "Conversation");
  if (els.messagesThreadName) els.messagesThreadName.textContent = counterpart?.name || "Conversation";
  if (els.messagesThreadStatus) els.messagesThreadStatus.innerHTML = `${statusDotHtml(active)}${escapeHtml(label)}`;
  els.messagesThreadWrap.hidden = false;
  const rows = state.activeConversationMessages || [];
  els.messagesThreadList.innerHTML = rows.length
    ? groupConversationMessages(rows)
        .map((group) => {
          const senderName = group.mine ? "You" : group.sender?.name || "Member";
          const avatar = group.mine ? "" : `<span class="messages-avatar small">${escapeHtml(avatarLetter(senderName))}</span>`;
          const bubbles = group.messages
            .map((message) => {
              const text = String(message.body || "").trim();
              const body = text ? `<div class="message-bubble-text">${escapeHtml(text)}</div>` : "";
              const resource = message.resource ? sharedResourceCardHtml(message.resource, { mine: group.mine }) : "";
              return `
                <div class="message-bubble">
                  ${body}
                  ${resource}
                  <span class="message-bubble-time">${escapeHtml(formatMessageTimestamp(message.created_at))}</span>
                </div>
              `;
            })
            .join("");
          return `
            <div class="message-group ${group.mine ? "mine" : "theirs"}">
              ${avatar}
              <div class="message-stack">
                <div class="message-group-meta">
                  <span class="small-note">${escapeHtml(senderName)}</span>
                </div>
                ${bubbles}
              </div>
            </div>
          `;
        })
        .join("")
    : `<div class="messages-empty-state"><div class="messages-empty-icon" aria-hidden="true">✉️</div><h3 class="panel-title">No messages yet</h3><p class="panel-subtitle">Say hello or share a resource to get the conversation started.</p></div>`;
  els.messagesThreadList.scrollTop = els.messagesThreadList.scrollHeight;
}

function renderMessageShareBanner() {
  if (!els.messagesShareBanner) return;
  if (!state.pendingSharedResource) {
    els.messagesShareBanner.hidden = true;
    els.messagesShareBanner.textContent = "";
    return;
  }
  const r = pendingSharedResourceRecord();
  els.messagesShareBanner.hidden = false;
  els.messagesShareBanner.innerHTML = `Ready to share <strong>${escapeHtml(r?.title || "Resource")}</strong>. Send it with your next message.`;
}

async function openConversation(conversationId) {
  const id = String(conversationId || "").trim();
  if (!id) return;
  const res = await apiFetch(`/messages/conversations/${encodeURIComponent(id)}`, { timeoutMs: 6000 });
  if (!res.ok) {
    showToast(await errorText(res, "Could not load conversation"), false);
    return;
  }
  const json = await res.json();
  state.activeConversationId = id;
  state.activeConversation = json.conversation || null;
  state.activeConversationMessages = Array.isArray(json.messages) ? json.messages : [];
  state.messageMobileThreadOpen = true;
  updateMessagesLayoutMode();
  renderConversationList();
  renderConversationThread();
  await refreshNotifications({ includeList: state.route === "notifications", force: true });
}

async function ensureConversationForUser(userLike) {
  const userId = typeof userLike === "string" ? userLike : userLike?.id;
  if (!userId) return;
  const existing = findConversationByUserId(userId);
  if (existing) {
    state.activeConversationId = existing.id;
    await openConversation(existing.id);
    if (els.messageReplyBody) els.messageReplyBody.focus();
    return;
  }
  showStatus(els.messagesSendStatus, "Opening chat…", true);
  const res = await apiFetch("/messages/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantUserId: userId }),
    timeoutMs: 6000,
  });
  if (!res.ok) {
    showStatus(els.messagesSendStatus, await errorText(res, "Could not open chat"), false);
    return;
  }
  const json = await res.json();
  state.activeConversationId = json?.conversation?.id || state.activeConversationId;
  await refreshConversations();
  if (state.activeConversationId) {
    await openConversation(state.activeConversationId);
  }
  if (els.messageReplyBody) els.messageReplyBody.focus();
}

async function startConversationFromComposer() {
  const participantUserId = String(els.messageToUserId?.value || state.selectedMessageUser?.id || "").trim();
  const text = String(els.messageBody?.value || "").trim();
  if (!participantUserId) {
    showStatus(els.messagesSendStatus, "Choose a user", false);
    return;
  }
  if (!text && !state.pendingSharedResource?.id) {
    await ensureConversationForUser(participantUserId);
    showStatus(els.messagesSendStatus, "Chat ready", true);
    return;
  }
  showStatus(els.messagesSendStatus, "Starting conversation…", true);
  const res = await apiFetch("/messages/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantUserId, body: text || "Shared a resource", resourceId: state.pendingSharedResource?.id || undefined }),
    timeoutMs: 6000,
  });
  if (!res.ok) {
    showStatus(els.messagesSendStatus, await errorText(res, "Could not start conversation"), false);
    return;
  }
  if (els.messageBody) els.messageBody.value = "";
  state.pendingSharedResource = null;
  renderMessageShareBanner();
  showStatus(els.messagesSendStatus, "Conversation started", true);
  await refreshConversations();
  if (state.activeConversationId) await openConversation(state.activeConversationId);
}

async function sendConversationReply() {
  if (!state.activeConversationId) return;
  const text = String(els.messageReplyBody?.value || "").trim();
  const resourceId = state.pendingSharedResource?.id || undefined;
  if (!text && !resourceId) {
    showStatus(els.messagesSendStatus, "Write a message", false);
    return;
  }
  showStatus(els.messagesSendStatus, "Sending…", true);
  const res = await apiFetch(`/messages/conversations/${encodeURIComponent(state.activeConversationId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: text || "Shared a resource", resourceId }),
    timeoutMs: 6000,
  });
  if (!res.ok) {
    showStatus(els.messagesSendStatus, await errorText(res, "Could not send message"), false);
    return;
  }
  if (els.messageReplyBody) els.messageReplyBody.value = "";
  state.pendingSharedResource = null;
  renderMessageShareBanner();
  showStatus(els.messagesSendStatus, "Sent", true);
  await refreshConversations();
}

async function refreshConversations() {
  const listRes = await apiFetch("/messages/conversations", { timeoutMs: 6000 });
  if (!listRes.ok) return;
  const listJson = await listRes.json();
  state.messageConversations = Array.isArray(listJson.rows) ? listJson.rows : [];
  renderConversationList();
  if (state.activeConversationId && state.route === "messages") {
    const stillThere = state.messageConversations.some((conversation) => conversation.id === state.activeConversationId);
    if (stillThere) {
      if (!isMobileMessagesViewport() || state.messageMobileThreadOpen) {
        await openConversation(state.activeConversationId);
      }
    } else {
      state.activeConversationId = null;
      state.activeConversation = null;
      state.activeConversationMessages = [];
      renderConversationThread();
    }
  }
  renderShareResourceModal();
}

async function sendSharedResourceToConversation(conversationId) {
  const resource = pendingSharedResourceRecord();
  if (!resource?.id) {
    showStatus(els.shareResourceStatus, "Choose a resource to share first.", false);
    return;
  }
  const text = String(els.shareResourceMessage?.value || "").trim() || "Shared a resource";
  showStatus(els.shareResourceStatus, "Sending…", true);
  const res = await apiFetch(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: text, resourceId: resource.id }),
    timeoutMs: 6000,
  });
  if (!res.ok) {
    showStatus(els.shareResourceStatus, await errorText(res, "Could not share resource"), false);
    return;
  }
  closeShareResourceModal();
  showToast("Resource shared", true);
  setRoute("messages");
  state.activeConversationId = String(conversationId);
  state.pendingSharedResource = null;
  await refreshConversations();
}

async function sendSharedResourceToRecipient(recipientId) {
  const resource = pendingSharedResourceRecord();
  if (!resource?.id) {
    showStatus(els.shareResourceStatus, "Choose a resource to share first.", false);
    return;
  }
  const text = String(els.shareResourceMessage?.value || "").trim() || "Shared a resource";
  showStatus(els.shareResourceStatus, "Sending…", true);
  const res = await apiFetch("/messages/share-resource", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientId, resourceId: resource.id, message: text }),
    timeoutMs: 6000,
  });
  if (!res.ok) {
    showStatus(els.shareResourceStatus, await errorText(res, "Could not share resource"), false);
    return;
  }
  const json = await res.json();
  closeShareResourceModal();
  showToast("Resource shared", true);
  setRoute("messages");
  state.activeConversationId = json?.conversation?.id || state.activeConversationId;
  state.pendingSharedResource = null;
  await refreshConversations();
}

function startMessagesPolling() {
  stopMessagesPolling();
  state.messagesPollTimer = window.setInterval(() => {
    if (state.route !== "messages" || !state.user || document.hidden) return;
    void refreshConversations();
  }, 4000);
}

function stopMessagesPolling() {
  if (state.messagesPollTimer) {
    window.clearInterval(state.messagesPollTimer);
    state.messagesPollTimer = null;
  }
}

async function loadNotificationCount(force = false) {
  if (!state.user) {
    clearNotificationState();
    updateNotificationBadge();
    return 0;
  }

  if (!force) {
    const cached = readTimedCache(NOTIFICATIONS_CACHE_KEY, NOTIFICATIONS_CACHE_TTL_MS);
    if (cached && typeof cached.unreadCount === "number") {
      state.notificationsUnreadCount = cached.unreadCount;
      updateNotificationBadge();
    }
  }

  try {
    const res = await apiFetch("/notifications/unread-count", { timeoutMs: 5000 });
    if (!res.ok) throw new Error(await errorText(res, "Could not load notifications"));
    const json = await res.json();
    state.notificationsUnreadCount = Number(json.count || 0);
    writeTimedCache(NOTIFICATIONS_CACHE_KEY, {
      unreadCount: state.notificationsUnreadCount,
      rows: state.notifications,
    });
    updateNotificationBadge();
    return state.notificationsUnreadCount;
  } catch (error) {
    if (els.notificationsStatus && state.route === "notifications") {
      showStatus(els.notificationsStatus, error?.message || "Could not load notifications", false);
    }
    updateNotificationBadge();
    return state.notificationsUnreadCount;
  }
}

async function loadNotifications(force = false) {
  if (!state.user) {
    clearNotificationState();
    updateNotificationBadge();
    renderNotifications();
    return;
  }
  if (state.notificationsPromise && !force) return await state.notificationsPromise;

  const cached = !force ? readTimedCache(NOTIFICATIONS_CACHE_KEY, NOTIFICATIONS_CACHE_TTL_MS) : null;
  if (!force && !state.notifications.length && Array.isArray(cached?.rows) && cached.rows.length) {
    state.notifications = cached.rows.map(normalizeNotification);
    if (typeof cached.unreadCount === "number") {
      state.notificationsUnreadCount = cached.unreadCount;
    }
    updateNotificationBadge();
    renderNotifications();
  }

  state.notificationsLoading = true;
  renderNotifications();
  state.notificationsPromise = (async () => {
    try {
      const res = await apiFetch("/notifications?limit=50", { timeoutMs: 6000 });
      if (!res.ok) throw new Error(await errorText(res, "Could not load notifications"));
      const json = await res.json();
      state.notifications = (Array.isArray(json.rows) ? json.rows : []).map(normalizeNotification);
      state.notificationsUnreadCount = state.notifications.filter((item) => !item.is_read).length;
      writeTimedCache(NOTIFICATIONS_CACHE_KEY, {
        unreadCount: state.notificationsUnreadCount,
        rows: state.notifications,
      });
      updateNotificationBadge();
      if (els.notificationsStatus) {
        showStatus(
          els.notificationsStatus,
          state.notifications.length ? `${state.notifications.length} notifications` : "No notifications yet",
          true,
        );
      }
    } catch (error) {
      if (els.notificationsStatus) {
        showStatus(els.notificationsStatus, error?.message || "Could not load notifications", false);
      }
    } finally {
      state.notificationsLoading = false;
      renderNotifications();
    }
  })();

  try {
    await state.notificationsPromise;
  } finally {
    state.notificationsPromise = null;
  }
}

async function refreshNotifications(options = {}) {
  const { includeList = state.route === "notifications", force = false } = options;
  if (!state.user) {
    clearNotificationState();
    updateNotificationBadge();
    renderNotifications();
    return;
  }
  if (includeList) {
    await loadNotifications(force);
  } else {
    await loadNotificationCount(force);
  }
}

function startNotificationsPolling() {
  stopNotificationsPolling();
  if (!state.user) return;
  state.notificationsPollTimer = window.setInterval(() => {
    if (!state.user || document.hidden) return;
    void refreshNotifications({ includeList: state.route === "notifications", force: true });
  }, 15000);
}

function stopNotificationsPolling() {
  if (state.notificationsPollTimer) {
    window.clearInterval(state.notificationsPollTimer);
    state.notificationsPollTimer = null;
  }
}

function showStatus(target, message, ok = true) {
  if (!target) return;
  target.textContent = message || "";
  target.className = `small-note ${message ? (ok ? "ok" : "err") : ""}`;
}

function setVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.style.display = visible ? "" : "none";
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

function readTimedCache(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.savedAt || Date.now() - Number(parsed.savedAt) > ttlMs) return null;
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

function writeTimedCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    /* ignore cache write failure */
  }
}

function removeTimedCache(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore cache removal failure */
  }
}

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return;
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent || "";
  }
  button.disabled = busy;
  button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
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

function clearNotificationState() {
  state.notifications = [];
  state.notificationsUnreadCount = 0;
  removeTimedCache(NOTIFICATIONS_CACHE_KEY);
}

function normalizeNotification(row) {
  return {
    id: row?.id || "",
    type: row?.type || "notice",
    title: row?.title || "Notification",
    body: row?.body || "",
    data: row?.data || row?.data_json || null,
    is_read: row?.is_read === true,
    read_at: row?.read_at || null,
    created_at: row?.created_at || new Date().toISOString(),
  };
}

function unreadNotificationCountLabel(count) {
  const value = Number(count || 0);
  if (value <= 0) return "";
  return value > 99 ? "99+" : String(value);
}

function updateNotificationBadge() {
  if (!els.notificationsBadge) return;
  const label = unreadNotificationCountLabel(state.notificationsUnreadCount);
  els.notificationsBadge.hidden = !label;
  els.notificationsBadge.textContent = label || "0";
}

function notificationIcon(type) {
  if (type === "message") return "💬";
  return "🔔";
}

function userPermissions(user = state.user) {
  return Array.isArray(user?.permissions) ? user.permissions : [];
}

function hasPermission(permission, user = state.user) {
  return userPermissions(user).includes(permission);
}

async function loadConfig() {
  try {
    const res = await fetchWithTimeout("config.local.json", { cache: "no-store", timeoutMs: 3000 });
    if (res.ok) Object.assign(config, await res.json());
  } catch {
    /* optional */
  }
}

async function apiFetch(path, options = {}) {
  const { timeoutMs = 0, clearSessionOnAuthFailure = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  const res = await fetchWithTimeout(`${apiBase()}${path}`, { ...fetchOptions, headers, timeoutMs });
  if (clearSessionOnAuthFailure && (res.status === 401 || res.status === 403) && state.token) {
    auth.clearSession({
      preservePendingReset: true,
      error: "Your session expired. Please sign in again.",
    });
    syncAuthState();
  }
  return res;
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

function fallbackThumb(resource, label = null) {
  const badge = escapeHtml(label || (resource.type || "Item").slice(0, 1).toUpperCase());
  return `
    <div class="thumb-fallback" style="background:${colorForText(resource.category || resource.title)}">
      <span>${badge}</span>
      <p>${escapeHtml(resource.title)}</p>
    </div>
  `;
}

function backendAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return new URL(path, `${apiBase()}/`).toString();
}

function fileNameFromMeta(file) {
  return file?.originalFilename || file?.original_filename || "";
}

function fileMimeFromMeta(file) {
  return (file?.mimeType || file?.mime_type || "").toLowerCase();
}

function extensionFromMime(mime) {
  const value = String(mime || "").toLowerCase();
  if (value === "image/png") return ".png";
  if (value === "image/jpeg") return ".jpg";
  if (value === "image/webp") return ".webp";
  if (value === "image/gif") return ".gif";
  if (value === "image/svg+xml") return ".svg";
  if (value === "image/x-icon") return ".ico";
  if (value === "application/pdf") return ".pdf";
  return "";
}

function inferredDownloadFilename(resource) {
  const raw = fileNameFromMeta(resource?.file) || String(resource?.title || "download").trim() || "download";
  if (/\.[a-z0-9]{2,8}$/i.test(raw)) return raw;
  const ext = extensionFromMime(fileMimeFromMeta(resource?.file));
  return ext ? `${raw}${ext}` : raw;
}

function isImageFileMeta(file) {
  if (!file) return false;
  const m = fileMimeFromMeta(file);
  if (m.startsWith("image/")) return true;
  const n = fileNameFromMeta(file).toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(n);
}

function isPdfFileMeta(file) {
  if (!file) return false;
  const m = fileMimeFromMeta(file);
  if (m === "application/pdf") return true;
  return /\.pdf$/i.test(fileNameFromMeta(file).toLowerCase());
}

function fileLabel(resource) {
  const filename = inferredDownloadFilename(resource);
  if (/\.pdf$/i.test(filename) || isPdfFileMeta(resource?.file)) return "PDF";
  if (isImageFileMeta(resource?.file)) return "Image";
  return (resource?.type || "File").slice(0, 12);
}

function isFileUnavailable(resource) {
  return Boolean(resource?.file) && resource.file.available === false;
}

function resourceImageUrl(resource) {
  const f = resource?.file;
  if (!f) return "";
  if (f.thumbnailUrl) return backendAssetUrl(f.thumbnailUrl);
  if (isImageFileMeta(f) && f.url) return backendAssetUrl(f.url);
  return "";
}

function resourceDownloadUrl(resource) {
  if (!resource?.id) return "";
  return `${apiBase()}/resources/${encodeURIComponent(resource.id)}/download`;
}

function setResourceDownloadBusy(resourceId, busy) {
  if (!resourceId) return;
  document.querySelectorAll(`[data-download-resource="${resourceId}"]`).forEach((button) => {
    const label = button.getAttribute("data-download-label") || button.textContent || "Download";
    if (!button.getAttribute("data-download-label")) {
      button.setAttribute("data-download-label", label);
    }
    button.disabled = busy;
    button.textContent = busy ? "Starting..." : label;
    button.setAttribute("aria-busy", busy ? "true" : "false");
  });
}

function triggerResourceDownload(resource) {
  const url = resourceDownloadUrl(resource);
  if (isFileUnavailable(resource)) {
    showToast(resource.file.unavailableReason || "This file is currently unavailable. Please re-upload it.", false);
    return;
  }
  if (!url) {
    showToast("No file available for this resource.", false);
    return;
  }

  setResourceDownloadBusy(resource.id, true);
  const filename = fileNameFromMeta(resource?.file) || inferredDownloadFilename(resource);
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  if (filename) {
    link.setAttribute("download", filename);
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("Download started", true);
  window.setTimeout(() => setResourceDownloadBusy(resource.id, false), 1600);
}

function resourcePreviewUrl(resource) {
  if (!resource?.file?.url) return "";
  return backendAssetUrl(resource.file.url);
}

function resourcePreviewHtml(resource, mode = "detail") {
  const previewUrl = resourcePreviewUrl(resource);
  if (isImageFileMeta(resource?.file) && previewUrl) {
    const cls = mode === "card" ? "resource-thumb-img" : "detail-preview-img";
    const attr = mode === "card"
      ? `loading="lazy" decoding="async" fetchpriority="low" data-thumb-for="${escapeHtml(resource.id)}"`
      : `loading="eager" decoding="async" data-detail-res="${escapeHtml(resource.id)}"`;
    return `<img class="${cls}" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(resource.title)}" ${attr} />`;
  }
  if (isPdfFileMeta(resource?.file) && previewUrl && mode === "detail") {
    return `<iframe class="detail-preview-frame" src="${escapeHtml(previewUrl)}#view=FitH" title="${escapeHtml(resource.title)}"></iframe>`;
  }
  return fallbackThumb(resource, fileLabel(resource));
}

function normalizeFile(f) {
  if (!f) return null;
  return {
    url: f.url,
    thumbnailUrl: f.thumbnailUrl,
    mimeType: f.mimeType || f.mime_type,
    originalFilename: f.originalFilename || f.original_filename,
    sizeBytes: f.sizeBytes != null ? f.sizeBytes : f.size_bytes,
    available: f.available !== false,
    unavailableReason: f.unavailableReason || f.unavailable_reason || "",
  };
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
    file: normalizeFile(resource.file) || null,
  };
}

function cardTags(resource) {
  return [resource.category, resource.country, resource.type].filter(Boolean).slice(0, 3);
}

function resourceCardHtml(resource) {
  const unavailable = isFileUnavailable(resource);
  const canShare = Boolean(state.user && hasPermission("message_users"));
  return `
    <article class="resource-card">
      <button type="button" class="resource-card-hit" data-open-detail="${escapeHtml(resource.id)}">
        <div class="resource-thumb${resourceImageUrl(resource) ? " resource-thumb--has-image" : ""}">
          ${resourcePreviewHtml(resource, "card")}
        </div>
        <div class="resource-card-body">
          <h3>${escapeHtml(resource.title)}</h3>
          <p class="resource-type">${escapeHtml(resource.type || "Resource")}${resource.country ? ` · ${escapeHtml(resource.country)}` : ""}</p>
          <div class="tag-row">
            ${cardTags(resource)
              .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
              .join("")}
            ${unavailable ? `<span class="tag">File unavailable</span>` : ""}
          </div>
        </div>
      </button>
      <div class="resource-card-actions">
        <button type="button" class="secondary-btn" data-open-detail="${escapeHtml(resource.id)}">Open</button>
        ${canShare ? `<button type="button" class="secondary-btn" data-share-resource="${escapeHtml(resource.id)}">Share</button>` : ""}
      </div>
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
  if (state.resourcesLoading && !resources.length && !state.resources.length) {
    els.resourceGrid.innerHTML = new Array(6)
      .fill(0)
      .map(
        () => `
          <article class="resource-card resource-card-skeleton" aria-hidden="true">
            <div class="resource-card-hit">
              <div class="resource-thumb skeleton-block"></div>
              <div class="resource-card-body">
                <div class="skeleton-line skeleton-title"></div>
                <div class="skeleton-line"></div>
                <div class="tag-row">
                  <span class="tag skeleton-chip"></span>
                  <span class="tag skeleton-chip"></span>
                </div>
              </div>
            </div>
          </article>
        `,
      )
      .join("");
    return;
  }
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
              <p>${escapeHtml(user.email)}${user.email_verified ? " · ✓ verified" : ""}</p>
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
  void loadMessages();
}

function renderNotifications() {
  if (!state.user) {
    updateNotificationBadge();
    if (els.notificationsStatus) showStatus(els.notificationsStatus, "", true);
    if (els.btnNotificationsReadAll) els.btnNotificationsReadAll.disabled = true;
    els.notificationsList.innerHTML = `<div class="simple-item"><span>Sign in to see notifications.</span></div>`;
    return;
  }

  updateNotificationBadge();
  const items = state.notifications || [];
  if (els.btnNotificationsReadAll) {
    els.btnNotificationsReadAll.disabled = !items.some((item) => !item.is_read);
  }
  if (state.notificationsLoading && !items.length) {
    if (els.notificationsStatus) showStatus(els.notificationsStatus, "Loading notifications…", true);
    els.notificationsList.innerHTML = `<div class="simple-item"><span>Loading notifications…</span></div>`;
    return;
  }
  if (els.notificationsStatus && !els.notificationsStatus.textContent) {
    showStatus(els.notificationsStatus, items.length ? `${items.length} notifications` : "No notifications yet", true);
  }
  els.notificationsList.innerHTML = items.length
    ? items
        .map((item) => {
          const preview = item.body || "Open to view this update.";
          return `
            <button type="button" class="simple-item notification-item ${item.is_read ? "" : "is-unread"}" data-open-notification="${escapeHtml(item.id)}">
              <span class="notification-icon" aria-hidden="true">${escapeHtml(notificationIcon(item.type))}</span>
              <span class="notification-main">
                <span class="notification-title-row">
                  ${item.is_read ? "" : `<span class="notification-dot" aria-hidden="true"></span>`}
                  <strong>${escapeHtml(item.title)}</strong>
                </span>
                <span class="notification-preview">${escapeHtml(preview)}</span>
              </span>
              <span class="notification-meta">${escapeHtml(formatTimeAgo(item.created_at))}</span>
            </button>
          `;
        })
        .join("")
    : `<div class="simple-item"><span>No notifications yet</span></div>`;
}

async function markNotificationRead(notificationId, options = {}) {
  const id = String(notificationId || "").trim();
  if (!id || !state.user) return false;
  const { silent = false } = options;
  const current = state.notifications.find((item) => item.id === id);
  if (current && !current.is_read) {
    current.is_read = true;
    state.notificationsUnreadCount = Math.max(0, state.notificationsUnreadCount - 1);
    writeTimedCache(NOTIFICATIONS_CACHE_KEY, {
      unreadCount: state.notificationsUnreadCount,
      rows: state.notifications,
    });
    renderNotifications();
  }
  try {
    const res = await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
      timeoutMs: 5000,
    });
    if (!res.ok) throw new Error(await errorText(res, "Could not mark notification as read"));
    const json = await res.json();
    state.notificationsUnreadCount = Number(json.unread_count || 0);
    writeTimedCache(NOTIFICATIONS_CACHE_KEY, {
      unreadCount: state.notificationsUnreadCount,
      rows: state.notifications,
    });
    updateNotificationBadge();
    return true;
  } catch (error) {
    if (!silent) showToast(error?.message || "Could not update notification", false);
    return false;
  }
}

async function markAllNotificationsRead() {
  if (!state.user) return;
  try {
    const res = await apiFetch("/notifications/read-all", { method: "POST", timeoutMs: 6000 });
    if (!res.ok) throw new Error(await errorText(res, "Could not mark all notifications as read"));
    state.notifications = state.notifications.map((item) => ({ ...item, is_read: true, read_at: item.read_at || new Date().toISOString() }));
    state.notificationsUnreadCount = 0;
    writeTimedCache(NOTIFICATIONS_CACHE_KEY, {
      unreadCount: 0,
      rows: state.notifications,
    });
    renderNotifications();
    if (els.notificationsStatus) showStatus(els.notificationsStatus, "All notifications marked as read", true);
  } catch (error) {
    if (els.notificationsStatus) showStatus(els.notificationsStatus, error?.message || "Could not mark all as read", false);
    showToast(error?.message || "Could not mark all as read", false);
  }
}

async function openNotification(notificationId) {
  const id = String(notificationId || "").trim();
  if (!id) return;
  const item = state.notifications.find((entry) => entry.id === id);
  if (!item) return;
  await markNotificationRead(id, { silent: true });
  const data = item.data || {};
  if (item.type === "message" && data.conversationId) {
    state.activeConversationId = String(data.conversationId);
    setRoute("messages");
    try {
      await openConversation(state.activeConversationId);
      await refreshNotifications({ includeList: state.route === "notifications", force: true });
    } catch (error) {
      showToast(error?.message || "Could not open message", false);
    }
    return;
  }
  setRoute("notifications");
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
  if (next === "messages" && state.user) {
    void loadMessages();
    startNotificationsPolling();
  } else if (next === "notifications" && state.user) {
    void loadNotifications(true);
    startNotificationsPolling();
  } else {
    state.messageMobileThreadOpen = false;
    updateMessagesLayoutMode();
    stopMessagesPolling();
    if (state.user) startNotificationsPolling();
  }
}

function updateTopButtons() {
  if (els.btnTopSignin) {
    els.btnTopSignin.textContent = state.user ? "Edit profile" : "Sign in";
  }
  const canUpload = hasPermission("upload_resources");
  if (els.btnOpenUpload) els.btnOpenUpload.hidden = !canUpload;
  if (els.btnHomeUpload) els.btnHomeUpload.hidden = !canUpload;
  if (els.backendBadge) {
    els.backendBadge.textContent = state.backendReachable ? "Library connected" : "Offline sample library";
    els.backendBadge.classList.toggle("ok", state.backendReachable);
  }
}

function renderLoadingState() {
  setVisible(els.authLoadingCard, true);
  setVisible(els.authStateNote, false);
  setVisible(els.authStateActions, false);
  setVisible(els.authPanels, false);
  setVisible(els.profileEditor, false);
}

function renderSignedOutView() {
  const showResetCard = Boolean(state.pendingPasswordResetToken);
  setVisible(els.authLoadingCard, false);
  setVisible(els.authStateActions, false);
  setVisible(els.authPanels, true);
  setVisible(els.profileEditor, false);
  setVisible(els.btnSignout, false);
  setVisible(els.signInForm, !showResetCard);
  setVisible(els.signupForm, !showResetCard);
  setVisible(els.resetPasswordCard, showResetCard);
  if (els.authStateNote) {
    setVisible(els.authStateNote, Boolean(state.authError));
    els.authStateNote.textContent = state.authError || "";
    els.authStateNote.className = `small-note auth-state-note ${state.authError ? "err" : ""}`;
  }
  setVisible(els.authStateActions, Boolean(state.authError));
  showSigninForgotMode(!showResetCard && state.authFormMode === "forgot");
  if (els.profileSummary) els.profileSummary.textContent = "";
  if (els.profileEmailLine) els.profileEmailLine.textContent = "";
  if (els.profileJoinedLine) els.profileJoinedLine.textContent = "";
  if (els.profilePermissionSummary) els.profilePermissionSummary.textContent = "";
  if (els.profileEmailStatus) {
    els.profileEmailStatus.textContent = "";
    els.profileEmailStatus.hidden = true;
    els.profileEmailStatus.classList.remove("ok", "warn");
  }
  if (els.btnRequestVerificationP) els.btnRequestVerificationP.hidden = true;
  if (els.profileAvatarWrap) els.profileAvatarWrap.hidden = true;
}

function renderSignedInView(currentUser, profile) {
  setVisible(els.authLoadingCard, false);
  if (els.authStateNote) {
    setVisible(els.authStateNote, false);
    els.authStateNote.textContent = "";
  }
  setVisible(els.authStateActions, false);
  setVisible(els.authPanels, false);
  setVisible(els.profileEditor, true);
  setVisible(els.btnSignout, true);
  if (els.profileSummary) {
    els.profileSummary.innerHTML = `${escapeHtml(currentUser.name)} <span class="tag role-tag role-${escapeHtml(currentUser.role)}">${escapeHtml(roleLabel(currentUser.role))}</span>`;
  }
  if (els.profileEmailLine) els.profileEmailLine.textContent = `Email: ${currentUser.email || profile?.email || ""}`;
  if (els.profileJoinedLine) els.profileJoinedLine.textContent = `Joined: ${formatDate(currentUser.created_at)}`;
  if (els.profilePermissionSummary) {
    const perms = userPermissions(currentUser);
    els.profilePermissionSummary.textContent = perms.length ? `${perms.length} permissions active` : "No permissions assigned";
  }
  if (els.profileEmailStatus) {
    const verified = currentUser.email_verified === true;
    els.profileEmailStatus.hidden = false;
    els.profileEmailStatus.textContent = verified ? "Email verified" : "Email not verified";
    els.profileEmailStatus.classList.toggle("ok", verified);
    els.profileEmailStatus.classList.toggle("warn", !verified);
    if (els.btnRequestVerificationP) els.btnRequestVerificationP.hidden = verified;
  }
  void loadProfileAvatar();
  els.profileName.value = currentUser.name || profile?.name || "";
  els.profileEmail.value = currentUser.email || profile?.email || "";
  els.profileWhatsapp.value = currentUser.whatsapp_phone || profile?.whatsapp || "";
  els.profileBiodata.value = currentUser.biodata || profile?.biodata || "";
  els.profileCountry.value = currentUser.country || profile?.country || "";
  els.profileInterest.value = currentUser.why_interested || profile?.interest || "";
  els.profileSocials.value = currentUser.social_handles || profile?.socials || "";
}

function renderProfilePage() {
  const currentUser = state.user;
  const profile = getSavedProfile(currentUser?.email || "");

  if (els.adminPanel) els.adminPanel.hidden = !hasPermission("manage_users");

  if (state.authLoading) {
    renderLoadingState();
    return;
  }

  if (!currentUser) {
    renderSignedOutView();
    return;
  }

  renderSignedInView(currentUser, profile);
}

async function restoreSession() {
  syncAuthState();
  try {
    await Promise.race([
      auth.restoreSession(apiFetch),
      new Promise((_, reject) =>
        window.setTimeout(() => reject(new Error("Session check timed out. Please sign in again.")), 9000),
      ),
    ]);
  } catch (err) {
    auth.clearSession({
      preservePendingReset: true,
      error: err?.message || "Could not restore your session. Please sign in again.",
    });
  }
  syncAuthState();
}

async function loadResources(force = false) {
  if (state.resourcesPromise && !force) return await state.resourcesPromise;

  const cached = !force ? readTimedCache(RESOURCE_CACHE_KEY, RESOURCE_CACHE_TTL_MS) : null;
  if (!force && !state.resources.length && Array.isArray(cached) && cached.length) {
    state.resources = cached.map(normalizeResource);
    state.filteredResources = filterResources(state.resources);
    showStatus(els.browseStatus, `${state.filteredResources.length} resources · showing saved library`, true);
    renderResources();
    renderNotifications();
    renderAdmin();
  }

  state.resourcesLoading = true;
  renderResources();

  state.resourcesPromise = (async () => {
    try {
      const res = await apiFetch("/resources?limit=100&offset=0", { timeoutMs: 7000 });
      if (!res.ok) throw new Error(await errorText(res, "Could not load resources"));
      const json = await res.json();
      const rows = (Array.isArray(json.rows) ? json.rows : []).map(normalizeResource);
      state.resources = rows;
      writeTimedCache(RESOURCE_CACHE_KEY, rows);
      state.backendReachable = true;
    } catch {
      if (!state.backendReachable && !state.resources.length) {
        state.resources = metadata.sampleResources.map(normalizeResource);
      }
      state.backendReachable = false;
    } finally {
      state.resourcesLoading = false;
    }
    state.filteredResources = filterResources(state.resources);
    showStatus(els.browseStatus, `${state.filteredResources.length} resources`, true);
    updateTopButtons();
    renderResources();
    renderNotifications();
    renderAdmin();
  })();

  try {
    await state.resourcesPromise;
  } finally {
    state.resourcesPromise = null;
  }
}

async function loadUsers(force = false) {
  if (!hasPermission("manage_users")) {
    state.users = [];
    removeTimedCache(USERS_CACHE_KEY);
    return;
  }
  if (state.usersPromise && !force) return await state.usersPromise;

  const cached = !force ? readTimedCache(USERS_CACHE_KEY, USERS_CACHE_TTL_MS) : null;
  if (!force && !state.users.length && Array.isArray(cached) && cached.length) {
    state.users = cached;
    renderUsers();
    showStatus(els.adminStatus, `${state.users.length} users · cached`, true);
  }

  state.usersLoading = true;
  showStatus(els.adminStatus, state.users.length ? "Refreshing users" : "Loading users", true);

  state.usersPromise = (async () => {
    try {
      const res = await apiFetch("/users", { timeoutMs: 7000 });
      if (!res.ok) {
        showStatus(els.adminStatus, await errorText(res, "Could not load users"), false);
        return;
      }
      const json = await res.json();
      state.users = json.rows || [];
      writeTimedCache(USERS_CACHE_KEY, state.users);
      renderUsers();
      showStatus(els.adminStatus, `${state.users.length} users`, true);
    } catch (error) {
      showStatus(els.adminStatus, error?.message || "Could not load users", false);
    } finally {
      state.usersLoading = false;
    }
  })();

  try {
    await state.usersPromise;
  } finally {
    state.usersPromise = null;
  }
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
  showStatus(els.uploadStatus, "", true);
  els.uploadForm?.reset();
  renderUploadPreview();
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

  const canPreviewImage = file.type.startsWith("image/") || /\.svg$/i.test(file.name);
  const canPreviewPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (canPreviewImage) {
    state.uploadPreviewUrl = URL.createObjectURL(file);
    els.uploadPreviewFrame.innerHTML = `<img src="${escapeHtml(state.uploadPreviewUrl)}" alt="Upload preview" class="preview-image" />`;
  } else if (canPreviewPdf) {
    state.uploadPreviewUrl = URL.createObjectURL(file);
    els.uploadPreviewFrame.innerHTML = `<iframe src="${escapeHtml(state.uploadPreviewUrl)}#view=FitH" title="Upload preview" class="preview-frame"></iframe>`;
  } else {
    els.uploadPreviewFrame.innerHTML = `<div class="preview-placeholder"><p>Preview not available for this file type</p></div>`;
  }
  els.uploadPreviewMeta.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
}

function detailHtml(resource) {
  const comments = commentsForResource(resource.id);
  const canDownload = Boolean(resource.file?.url) && resource.file?.available !== false;
  const canUpload = hasPermission("upload_resources");
  const canRecommend = state.user ? hasPermission("recommend_content") : false;
  const canComment = state.user ? hasPermission("comment_resources") : false;
  const canEditResource = Boolean(state.user && (resource.uploaded_by?.id === state.user.id || hasPermission("edit_resources")));
  const canShare = Boolean(state.user && hasPermission("message_users"));

  const allTags = [resource.category, resource.country, resource.type].filter(Boolean);
  if (resource.productDetail) allTags.push(resource.productDetail);
  if (resource.crossCutting) allTags.push(resource.crossCutting);
  if (resource.institution) allTags.push(resource.institution);

  const keywordTags = (resource.keywords || []).filter((k) => !allTags.includes(k));

  const uploaderLine = resource.uploaded_by?.name
    ? `<p class="detail-meta">Uploaded by ${escapeHtml(resource.uploaded_by.name)} · ${formatDate(resource.created_at)}</p>`
    : `<p class="detail-meta">${formatDate(resource.created_at)}</p>`;

  const ofn = fileNameFromMeta(resource.file);
  const fileMeta = resource.file
    ? `<p class="detail-meta">${escapeHtml(ofn || fileLabel(resource))}${resource.file.sizeBytes ? ` · ${(Number(resource.file.sizeBytes) / 1024).toFixed(0)} KB` : ""}</p>`
    : "";
  const fileUnavailable = resource.file?.available === false
    ? `<p class="small-note err">This file is currently unavailable. Please re-upload it.</p>`
    : "";

  return `
    <div class="detail-hero">
      <div class="detail-side">
        <div class="detail-category">${escapeHtml(resource.category || "Resource")}</div>
      </div>
      <div class="detail-preview-wrap">
        <div class="detail-preview">
          ${resourcePreviewHtml(resource, "detail")}
        </div>
      </div>
      <div class="detail-copy">
        <p class="detail-type">${escapeHtml(resource.type || "Resource")}</p>
        <h3>${escapeHtml(resource.title)}</h3>
        <p class="detail-text">${escapeHtml(resource.description || "")}</p>
        ${uploaderLine}
        ${fileMeta}
        ${fileUnavailable}
        <div class="tag-row">
          ${allTags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        ${keywordTags.length ? `<div class="tag-row" style="margin-top:4px">${keywordTags.map((k) => `<span class="tag tag-keyword">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
        <div class="detail-actions">
          <button type="button" class="primary-btn" data-download-resource="${escapeHtml(resource.id)}" ${canDownload ? "" : "disabled"}>Download${resource.file?.sizeBytes ? ` (${(Number(resource.file.sizeBytes) / 1024).toFixed(0)} KB)` : ""}</button>
          <button type="button" class="secondary-btn" data-recommend-resource="${escapeHtml(resource.id)}" ${canRecommend ? "" : "disabled"}>Recommend (${recommendationCount(resource.id)})</button>
          ${canShare ? `<button type="button" class="secondary-btn" data-share-resource="${escapeHtml(resource.id)}">Send to someone</button>` : ""}
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
    const res = await apiFetch(`/resources/${encodeURIComponent(resourceId)}/comments`, { timeoutMs: 6000 });
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
    const [resourceRes] = await Promise.all([
      apiFetch(`/resources/${encodeURIComponent(resourceId)}`, { timeoutMs: 7000 }),
      loadResourceComments(resourceId),
    ]);
    if (resourceRes.ok) {
      const fresh = normalizeResource(await resourceRes.json());
      state.resources = state.resources.map((item) => (item.id === resourceId ? fresh : item));
    }
  } catch {
    /* keep current resource */
  }

  const resource = state.resources.find((item) => item.id === resourceId);
  if (!resource) {
    els.detailTitle.textContent = "Resource unavailable";
    els.detailBody.innerHTML = `<div class="simple-item"><span>This resource is no longer available.</span></div>`;
    return;
  }
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
  try {
    const result = await auth.login(apiFetch, { name, email, password: els.signInPassword?.value.trim() || "" });
    if (!result.ok) {
      showStatus(statusEl, await errorText(result.response, "Could not sign in"), false);
      return null;
    }
    syncAuthState();
    updateTopButtons();
    renderProfilePage();
    renderResources();
    renderMessages();
    renderNotifications();
    await loadUsers(true);
    return result.data;
  } catch (error) {
    showStatus(statusEl, error.message || "Could not reach the server", false);
    return null;
  }
}

async function doAuthRequest(path, payload, statusEl) {
  try {
    const action = path.includes("/signup") ? auth.signup : auth.login;
    const result = await action(apiFetch, payload);
    if (!result.ok) {
      showStatus(statusEl, await errorText(result.response, "Could not sign in"), false);
      return null;
    }
    syncAuthState();
    updateTopButtons();
    renderProfilePage();
    renderResources();
    renderMessages();
    renderNotifications();
    await loadUsers(true);
    return result.data;
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

  await loadUsers(true);
  if (state.user?.id === userId) {
    await restoreSession();
    updateTopButtons();
    renderProfilePage();
    renderMessages();
    renderNotifications();
  }
  showToast("User permissions updated", true);
}

async function handleSignIn(event) {
  event.preventDefault();
  auth.clearAuthError?.();
  setButtonBusy(els.btnSigninSubmit, true, "Signing in...");
  showStatus(els.signupStatus, "", true);
  const name = els.signInName.value.trim();
  const email = els.signInEmail.value.trim();
  const password = els.signInPassword.value.trim();
  if (!email) {
    showStatus(els.signInStatus, "Enter your email address", false);
    els.signInEmail.focus();
    setButtonBusy(els.btnSigninSubmit, false);
    return;
  }
  if (!password) {
    showStatus(els.signInStatus, "Enter your password", false);
    els.signInPassword.focus();
    setButtonBusy(els.btnSigninSubmit, false);
    return;
  }
  showStatus(els.signInStatus, "Signing in…", true);
  const result = await doAuth(name, email, els.signInStatus);
  if (!result) {
    setButtonBusy(els.btnSigninSubmit, false);
    return;
  }
  state.authFormMode = "signin";
  showStatus(els.signInStatus, "", true);
  showToast(`Welcome back, ${result.user?.name || ""}`, true);
  setButtonBusy(els.btnSigninSubmit, false);
  setRoute("home");
}

async function handleSignUp(event) {
  event.preventDefault();
  auth.clearAuthError?.();
  setButtonBusy(els.btnSignupSubmit, true, "Creating...");
  showStatus(els.signInStatus, "", true);
  const name = els.signupName.value.trim();
  const email = els.signupEmail.value.trim();
  const password = els.signupPassword.value.trim();
  const country = els.signupCountry.value;
  const interest = els.signupInterest.value.trim();
  if (!name) {
    showStatus(els.signupStatus, "Enter your name", false);
    els.signupName.focus();
    setButtonBusy(els.btnSignupSubmit, false);
    return;
  }
  if (!email) {
    showStatus(els.signupStatus, "Enter your email address", false);
    els.signupEmail.focus();
    setButtonBusy(els.btnSignupSubmit, false);
    return;
  }
  if (!password) {
    showStatus(els.signupStatus, "Create a password", false);
    els.signupPassword.focus();
    setButtonBusy(els.btnSignupSubmit, false);
    return;
  }
  showStatus(els.signupStatus, "Creating account…", true);
  const result = await doAuthRequest(
    "/auth/signup",
    { name, email, password, country, whyInterested: interest },
    els.signupStatus,
  );
  if (!result) {
    setButtonBusy(els.btnSignupSubmit, false);
    return;
  }
  state.authFormMode = "signin";
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
  renderProfilePage();
  const emailNotice = result.email_notice || null;
  if (emailNotice?.message) {
    const detail = emailNotice.previewUrl ? `${emailNotice.message} Preview: ${emailNotice.previewUrl}` : emailNotice.message;
    showStatus(els.signupStatus, detail, emailNotice.ok !== false);
    showToast(emailNotice.message, emailNotice.ok !== false);
  } else {
    showStatus(els.signupStatus, "", true);
    showToast(`Welcome, ${name}! Account created. Check your email to verify.`, true);
  }
  setButtonBusy(els.btnSignupSubmit, false);
  setRoute("home");
}

async function handleSignOut() {
  await auth.logout(apiFetch);
  stopMessagesPolling();
  stopNotificationsPolling();
  syncAuthState();
  state.authFormMode = "signin";
  state.users = [];
  state.messageConversations = [];
  state.messageRecipients = [];
  state.activeConversationId = null;
  state.activeConversation = null;
  state.activeConversationMessages = [];
  clearNotificationState();
  removeTimedCache(USERS_CACHE_KEY);
  updateTopButtons();
  renderProfilePage();
  renderResources();
  renderMessages();
  renderNotifications();
  renderAdmin();
  showToast("Signed out", true);
}

function handleProfileSave(event) {
  event.preventDefault();
  setButtonBusy(els.btnProfileSave, true, "Saving...");
  const email = (els.profileEmail.value || state.user?.email || "").trim();
  if (!email) {
    showStatus(els.profileStatus, "Email is required", false);
    setButtonBusy(els.btnProfileSave, false);
    return;
  }
  const payload = {
    name: els.profileName.value.trim(),
    country: els.profileCountry.value,
    whyInterested: els.profileInterest.value.trim(),
    whatsappPhone: els.profileWhatsapp.value.trim(),
    biodata: els.profileBiodata.value.trim(),
    socialHandles: els.profileSocials.value.trim(),
    avatarName: state.user?.avatar_name || getSavedProfile(email)?.avatarName || "",
  };
  apiFetch("/auth/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(await errorText(res, "Could not save profile"));
      const json = await res.json();
      auth.setCurrentUser(json.user);
      syncAuthState();
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
      renderProfilePage();
      void loadProfileAvatar();
      showToast("Profile saved", true);
    })
    .catch((error) => {
      showStatus(els.profileStatus, error.message || "Could not save profile", false);
    })
    .finally(() => setButtonBusy(els.btnProfileSave, false));
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

  setButtonBusy(els.uploadSubmit, true, isEditing ? "Saving..." : "Uploading...");
  showStatus(els.uploadStatus, isEditing ? "Saving changes" : "Uploading", true);

  try {
    const path = isEditing ? `/resources/${encodeURIComponent(state.editingResourceId)}` : "/resources";
    const method = isEditing ? "PUT" : "POST";
    const res = await apiFetch(path, { method, body: formData });
    if (!res.ok) throw new Error(await errorText(res, isEditing ? "Update failed" : "Upload failed"));
    closeUploadModal();
    await loadResources(true);
    showToast(isEditing ? "Resource updated" : "Resource uploaded", true);
  } catch (error) {
    showStatus(els.uploadStatus, error.message || (isEditing ? "Update failed" : "Upload failed"), false);
  } finally {
    state.editingResourceId = null;
    setButtonBusy(els.uploadSubmit, false);
  }
}

function bindEvents() {
  document.addEventListener(
    "error",
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLImageElement)) return;
      if (t.classList.contains("resource-thumb-img")) {
        const id = t.getAttribute("data-thumb-for");
        const resource = state.resources.find((r) => r.id === id);
        const wrap = t.closest(".resource-thumb");
        if (wrap && resource) wrap.innerHTML = fallbackThumb(resource);
        return;
      }
      if (t.classList.contains("detail-preview-img")) {
        const id = t.getAttribute("data-detail-res");
        const resource = state.resources.find((r) => r.id === id);
        const wrap = t.closest(".detail-preview");
        if (wrap && resource) wrap.innerHTML = fallbackThumb(resource);
      }
    },
    true,
  );

  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".password-toggle");
    if (!btn) return;
    const id = btn.getAttribute("data-password-for");
    const input = id ? document.getElementById(id) : null;
    if (!input) return;
    e.preventDefault();
    const isPw = input.type === "password";
    input.type = isPw ? "text" : "password";
    btn.setAttribute("aria-pressed", isPw ? "true" : "false");
    btn.textContent = isPw ? "Hide" : "Show";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!els.shareResourceModal?.hidden) {
      closeShareResourceModal();
      return;
    }
    if (!els.detailModal?.hidden) {
      closeDetailModal();
      return;
    }
    if (!els.uploadModal?.hidden) {
      closeUploadModal();
    }
  });

  els.appHomeLink?.addEventListener("click", (e) => {
    e.preventDefault();
    goHome();
  });
  els.btnGotoHome?.addEventListener("click", () => goHome());
  document.querySelectorAll('a.back-home-link[href="#home"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      goHome();
    });
  });

  els.btnRequestVerification?.addEventListener("click", () => {
    if (!state.token) return;
    auth.clearAuthError?.();
    showStatus(els.profileStatus, "Sending…", true);
    apiFetch("/auth/request-verification", { method: "POST", timeoutMs: 7000 })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorText(res, "Could not send email"));
        const json = await res.json();
        const ok = json?.ok !== false;
        const detail = json.previewUrl ? `${json.message} Preview: ${json.previewUrl}` : json.message || "Check your inbox for the link.";
        showStatus(els.profileStatus, detail, ok);
        showToast(json.message || (ok ? "Verification email sent" : "Could not send verification email"), ok);
      })
      .catch((err) => {
        showStatus(els.profileStatus, err.message || "Could not send", false);
        showToast(err.message || "Could not send", false);
      });
  });

  els.btnRefreshVerification?.addEventListener("click", async () => {
    if (!state.token) return;
    showStatus(els.profileStatus, "Refreshing…", true);
    try {
      await restoreSession();
      showStatus(els.profileStatus, state.user?.email_verified ? "Email is verified." : "Email is still not verified.", true);
      renderProfilePage();
    } catch (err) {
      showStatus(els.profileStatus, err.message || "Could not refresh", false);
    }
  });

  els.btnShowForgot?.addEventListener("click", () => showSigninForgotMode(true));
  els.btnCancelForgot?.addEventListener("click", () => showSigninForgotMode(false));
  els.btnSendReset?.addEventListener("click", handleSendPasswordReset);
  els.btnAuthRetrySession?.addEventListener("click", async () => {
    showStatus(els.authStateNote, "Retrying session check…", true);
    if (els.authStateActions) els.authStateActions.hidden = true;
    await restoreSession();
    renderProfilePage();
  });
  els.btnApplyPasswordReset?.addEventListener("click", handleApplyPasswordReset);
  els.linkResetToSignin?.addEventListener("click", (e) => {
    e.preventDefault();
    auth.setPendingResetToken(null);
    syncAuthState();
    if (els.resetTokenStore) els.resetTokenStore.value = "";
    if (els.resetNewPassword) els.resetNewPassword.value = "";
    if (els.resetConfirmPassword) els.resetConfirmPassword.value = "";
    if (els.resetPasswordStatus) els.resetPasswordStatus.textContent = "";
    renderProfilePage();
  });

  els.btnSendMessage?.addEventListener("click", () => {
    if (!state.token) return setRoute("profile");
    void startConversationFromComposer();
  });
  els.btnSendReply?.addEventListener("click", () => {
    if (!state.token) return setRoute("profile");
    void sendConversationReply();
  });

  els.messageToUserSearch?.addEventListener("input", () => {
    const q = String(els.messageToUserSearch.value || "");
    window.clearTimeout(state.messageUserSearchTimer);
    state.messageUserSearchTimer = window.setTimeout(() => {
      void searchMessageRecipients(q);
    }, 250);
  });

  els.messageToUserSearch?.addEventListener("focus", () => {
    const q = String(els.messageToUserSearch.value || "");
    if (q.trim().length >= 2) {
      void searchMessageRecipients(q);
    }
  });

  els.shareResourceSearch?.addEventListener("input", () => {
    const q = String(els.shareResourceSearch.value || "");
    window.clearTimeout(state.shareResourceSearchTimer);
    state.shareResourceSearchTimer = window.setTimeout(() => {
      void searchMessageRecipients(q, els.shareResourceResults, "share");
    }, 250);
  });

  els.btnMessagesBack?.addEventListener("click", () => {
    state.messageMobileThreadOpen = false;
    updateMessagesLayoutMode();
  });

  els.btnShareResourceInline?.addEventListener("click", () => {
    if (state.pendingSharedResource) {
      openShareResourceModal(pendingSharedResourceRecord());
      return;
    }
    showToast("Open a resource and tap Share to send it here.", true);
    setRoute("home");
  });

  els.messageBody?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void startConversationFromComposer();
    }
  });

  els.messageReplyBody?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendConversationReply();
    }
  });

  els.profileAvatar?.addEventListener("change", async () => {
    const file = els.profileAvatar?.files?.[0];
    if (!file || !state.token) return;
    const fd = new FormData();
    fd.append("file", file, file.name);
    try {
      const res = await apiFetch("/auth/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await errorText(res, "Upload failed"));
      const json = await res.json();
      auth.setCurrentUser(json.user);
      syncAuthState();
      showToast("Photo saved", true);
      renderProfilePage();
    } catch (e) {
      showToast(e.message || "Photo upload failed", false);
    }
    els.profileAvatar.value = "";
  });

  els.bottomNavButtons.forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.route || "home"));
  });

  els.btnNotificationsReadAll?.addEventListener("click", () => {
    void markAllNotificationsRead();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.user) {
      if (state.route === "messages") {
        void refreshConversations();
      }
      void refreshNotifications({ includeList: state.route === "notifications", force: true });
    }
  });

  els.btnOpenUpload?.addEventListener("click", () => openUploadModal());
  els.btnHomeUpload?.addEventListener("click", () => openUploadModal());
  els.btnTopSignin?.addEventListener("click", () => setRoute("profile"));
  els.btnClearSearch?.addEventListener("click", clearSearch);
  els.btnRefreshLibrary?.addEventListener("click", () => loadResources(true).catch(() => undefined));
  els.btnRefreshUsers?.addEventListener("click", () => loadUsers(true).catch(() => undefined));
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
    const conversationButton = event.target.closest("[data-open-conversation]");
    if (conversationButton) {
      void openConversation(conversationButton.getAttribute("data-open-conversation"));
      return;
    }

    const notificationButton = event.target.closest("[data-open-notification]");
    if (notificationButton) {
      void openNotification(notificationButton.getAttribute("data-open-notification"));
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
      triggerResourceDownload(resource);
      return;
    }

    const shareButton = event.target.closest("[data-share-resource]");
    if (shareButton) {
      const id = shareButton.getAttribute("data-share-resource");
      const resource = state.resources.find((item) => item.id === id);
      if (!resource) return;
      if (!state.user || !hasPermission("message_users")) {
        showToast("Sign in to send resources in messages.", false);
        setRoute("profile");
        return;
      }
      closeDetailModal();
      openShareResourceModal(resource);
      return;
    }

    const openSharedResource = event.target.closest("[data-open-shared-resource]");
    if (openSharedResource) {
      const id = openSharedResource.getAttribute("data-open-shared-resource");
      openDetail(id);
      return;
    }

    const pickUserButton = event.target.closest("[data-pick-user]");
    if (pickUserButton) {
      const id = pickUserButton.getAttribute("data-pick-user");
      const name = pickUserButton.getAttribute("data-pick-user-name") || "";
      const email = pickUserButton.getAttribute("data-pick-user-email") || "";
      state.selectedMessageUser = { id, name, email };
      if (els.messageToUserId) els.messageToUserId.value = id;
      if (els.messageToUserSearch) els.messageToUserSearch.value = name || email;
      if (els.messageUserResults) {
        els.messageUserResults.hidden = true;
        els.messageUserResults.innerHTML = "";
      }
      void ensureConversationForUser(id);
      return;
    }

    const shareUserButton = event.target.closest("[data-share-user]");
    if (shareUserButton) {
      void sendSharedResourceToRecipient(shareUserButton.getAttribute("data-share-user"));
      return;
    }

    const shareConversationButton = event.target.closest("[data-share-conversation]");
    if (shareConversationButton) {
      void sendSharedResourceToConversation(shareConversationButton.getAttribute("data-share-conversation"));
      return;
    }

    if (event.target.closest("[data-close-share-resource]")) {
      closeShareResourceModal();
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
          writeTimedCache(RESOURCE_CACHE_KEY, state.resources);
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
  auth.subscribe((snapshot) => {
    const prevUserId = state.user?.id || "";
    syncAuthState(snapshot);
    updateTopButtons();
    renderProfilePage();
    if (state.user?.id) {
      startNotificationsPolling();
      if (state.user.id !== prevUserId) {
        void refreshNotifications({ includeList: state.route === "notifications", force: true });
      }
    } else {
      stopNotificationsPolling();
      clearNotificationState();
      renderNotifications();
    }
  });
  syncAuthState();
  renderProfilePage();
  updateTopButtons();
  bindEvents();
  processPasswordResetFromQuery();
  await restoreSession();
  await processEmailVerifyFromQuery();
  await loadConfig();
  initFields();
  renderCategoryTiles();
  updateTopButtons();
  renderProfilePage();
  await Promise.allSettled([loadResources(), loadUsers()]);
  renderMessages();
  await refreshNotifications({ includeList: true, force: true });
  startNotificationsPolling();
  renderNotifications();
  renderAdmin();
  applyRoute(routeFromHash());
}

bootstrap().catch((error) => {
  console.error(error);
  auth.clearSession?.({
    preservePendingReset: true,
    error: "Could not finish loading the page. Please sign in again.",
  });
  syncAuthState();
  renderProfilePage();
  showToast(error.message || "Could not load page", false);
});
