(function attachSlowAuth(global) {
  const SESSION_TOKEN_KEY = "slow_session_token_v4";
  const PENDING_RESET_TOKEN_KEY = "slow_pending_reset_token_v1";
  const AUTH_CHECK_TIMEOUT_MS = 7000;

  const state = {
    token: "",
    currentUser: null,
    authLoading: false,
    authError: "",
    pendingResetToken: null,
  };

  const listeners = new Set();

  function safeGet(key) {
    try {
      return String(global.localStorage.getItem(key) || "");
    } catch {
      return "";
    }
  }

  function safeSet(key, value) {
    try {
      if (value) {
        global.localStorage.setItem(key, value);
      } else {
        global.localStorage.removeItem(key);
      }
    } catch {
      /* ignore storage failures */
    }
  }

  function emit() {
    const snapshot = api.getSnapshot();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        /* ignore subscriber errors */
      }
    });
  }

  function syncFromStorage() {
    state.token = safeGet(SESSION_TOKEN_KEY).trim();
    state.pendingResetToken = safeGet(PENDING_RESET_TOKEN_KEY).trim() || null;
    state.authLoading = Boolean(state.token);
    state.authError = "";
  }

  function setState(next, shouldEmit = true) {
    Object.assign(state, next);
    if (shouldEmit) emit();
  }

  function persistSession(token) {
    const normalized = String(token || "").trim();
    state.token = normalized;
    safeSet(SESSION_TOKEN_KEY, normalized);
  }

  function persistPendingReset(token) {
    const normalized = String(token || "").trim() || null;
    state.pendingResetToken = normalized;
    safeSet(PENDING_RESET_TOKEN_KEY, normalized || "");
  }

  async function readResponseMessage(res) {
    try {
      const text = (await res.text()).trim();
      if (!text) return "";
      try {
        const json = JSON.parse(text);
        return String(json.message || json.error || text).trim();
      } catch {
        return text;
      }
    } catch {
      return "";
    }
  }

  syncFromStorage();

  const api = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return {
        token: state.token,
        currentUser: state.currentUser,
        authLoading: state.authLoading,
        authError: state.authError,
        pendingResetToken: state.pendingResetToken,
        signedIn: Boolean(state.currentUser),
        ready: !state.authLoading,
      };
    },

    getToken() {
      return state.token;
    },

    getCurrentUser() {
      return state.currentUser;
    },

    getPendingResetToken() {
      return state.pendingResetToken;
    },

    isLoading() {
      return state.authLoading;
    },

    getError() {
      return state.authError;
    },

    isReady() {
      return !state.authLoading;
    },

    isSignedIn() {
      return Boolean(state.currentUser);
    },

    clearAuthError() {
      setState({ authError: "" });
    },

    setCurrentUser(user) {
      setState({
        currentUser: user || null,
        authLoading: false,
        authError: "",
      });
    },

    setPendingResetToken(token) {
      persistPendingReset(token);
      emit();
    },

    clearSession(options = {}) {
      const preservePendingReset = Boolean(options.preservePendingReset);
      persistSession("");
      if (!preservePendingReset) {
        persistPendingReset(null);
      }
      setState({
        currentUser: null,
        authLoading: false,
        authError: String(options.error || "").trim(),
      });
    },

    setSession(token, user) {
      persistSession(token);
      persistPendingReset(null);
      setState({
        currentUser: user || null,
        authLoading: false,
        authError: "",
      });
    },

    consumeResetLinkFromUrl() {
      const url = new URL(global.location.href);
      const rootToken = url.searchParams.get("reset_password");
      const pageToken = url.pathname.endsWith("/reset-password")
        ? url.searchParams.get("token")
        : "";
      const token = String(rootToken || pageToken || "").trim();
      if (!token) return null;

      persistSession("");
      persistPendingReset(token);
      setState({
        currentUser: null,
        authLoading: false,
        authError: "",
      });

      if (rootToken) url.searchParams.delete("reset_password");
      if (pageToken) url.searchParams.delete("token");
      global.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return token;
    },

    async restoreSession(apiFetch) {
      if (!state.token) {
        setState({
          currentUser: null,
          authLoading: false,
          authError: "",
        });
        return null;
      }

      setState({ authLoading: true, authError: "" });

      try {
        const res = await apiFetch("/auth/me", {
          timeoutMs: AUTH_CHECK_TIMEOUT_MS,
          clearSessionOnAuthFailure: false,
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            api.clearSession({
              preservePendingReset: true,
              error: "Your session expired. Please sign in again.",
            });
            return null;
          }

          const detail = await readResponseMessage(res);
          api.clearSession({
            preservePendingReset: true,
            error: detail || "Could not restore your session. Please sign in again.",
          });
          return null;
        }

        const json = await res.json();
        setState({
          currentUser: json.user || null,
          authLoading: false,
          authError: "",
        });
        return state.currentUser;
      } catch (error) {
        api.clearSession({
          preservePendingReset: true,
          error: error?.message || "Could not restore your session. Please sign in again.",
        });
        return null;
      }
    },

    async login(apiFetch, payload) {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: AUTH_CHECK_TIMEOUT_MS,
      });
      if (!res.ok) return { ok: false, response: res };
      const json = await res.json();
      api.setSession(json.token, json.user);
      return { ok: true, data: json };
    },

    async signup(apiFetch, payload) {
      const res = await apiFetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: AUTH_CHECK_TIMEOUT_MS,
      });
      if (!res.ok) return { ok: false, response: res };
      const json = await res.json();
      api.setSession(json.token, json.user);
      return { ok: true, data: json };
    },

    async logout(apiFetch) {
      try {
        await apiFetch("/auth/sign-out", {
          method: "POST",
          timeoutMs: AUTH_CHECK_TIMEOUT_MS,
          clearSessionOnAuthFailure: false,
        });
      } catch {
        /* ignore logout network failure */
      }
      api.clearSession();
      return { ok: true };
    },

    async forgotPassword(apiFetch, email) {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        timeoutMs: AUTH_CHECK_TIMEOUT_MS,
      });
      const json = res.ok ? await res.json() : null;
      return { ok: res.ok, response: res, data: json };
    },

    async resetPassword(apiFetch, token, password) {
      const res = await apiFetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        timeoutMs: AUTH_CHECK_TIMEOUT_MS,
      });
      const json = res.ok ? await res.json() : null;
      if (res.ok) {
        persistPendingReset(null);
        emit();
      }
      return { ok: res.ok, response: res, data: json };
    },
  };

  global.SlowAuth = api;
})(window);
