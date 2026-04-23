(function attachSlowAuth(global) {
  const SESSION_TOKEN_KEY = "slow_session_token_v4";
  const PENDING_RESET_TOKEN_KEY = "slow_pending_reset_token_v1";

  const state = {
    token: "",
    currentUser: null,
    ready: false,
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
  }

  function persistSession(token) {
    state.token = String(token || "").trim();
    safeSet(SESSION_TOKEN_KEY, state.token);
  }

  function persistPendingReset(token) {
    state.pendingResetToken = String(token || "").trim() || null;
    safeSet(PENDING_RESET_TOKEN_KEY, state.pendingResetToken || "");
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
        ready: state.ready,
        pendingResetToken: state.pendingResetToken,
        signedIn: Boolean(state.currentUser),
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

    isReady() {
      return state.ready;
    },

    isSignedIn() {
      return Boolean(state.currentUser);
    },

    markReady(value) {
      state.ready = Boolean(value);
      emit();
    },

    setCurrentUser(user) {
      state.currentUser = user || null;
      emit();
    },

    setPendingResetToken(token) {
      persistPendingReset(token);
      emit();
    },

    clearSession(options = {}) {
      const preservePendingReset = Boolean(options.preservePendingReset);
      state.currentUser = null;
      persistSession("");
      if (!preservePendingReset) {
        persistPendingReset(null);
      }
      emit();
    },

    setSession(token, user) {
      persistSession(token);
      state.currentUser = user || null;
      persistPendingReset(null);
      emit();
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
      state.currentUser = null;
      persistPendingReset(token);

      if (rootToken) {
        url.searchParams.delete("reset_password");
      }
      if (pageToken) {
        url.searchParams.delete("token");
      }
      global.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      emit();
      return token;
    },

    async restoreSession(apiFetch) {
      if (!state.token) {
        state.currentUser = null;
        state.ready = true;
        emit();
        return null;
      }

      let attempts = 0;
      while (attempts < 2) {
        try {
          const res = await apiFetch("/auth/me");
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              api.clearSession({ preservePendingReset: true });
              state.ready = true;
              emit();
              return null;
            }
            throw new Error("Session check failed");
          }
          const json = await res.json();
          state.currentUser = json.user || null;
          state.ready = true;
          emit();
          return state.currentUser;
        } catch (error) {
          attempts += 1;
          if (attempts >= 2) {
            state.ready = true;
            emit();
            throw error;
          }
          await new Promise((resolve) => global.setTimeout(resolve, 1500));
        }
      }

      return null;
    },

    async login(apiFetch, payload) {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      });
      if (!res.ok) return { ok: false, response: res };
      const json = await res.json();
      api.setSession(json.token, json.user);
      return { ok: true, data: json };
    },

    async logout(apiFetch) {
      try {
        await apiFetch("/auth/sign-out", { method: "POST" });
      } catch {
        /* ignore network failure */
      }
      api.clearSession();
      return { ok: true };
    },

    async forgotPassword(apiFetch, email) {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = res.ok ? await res.json() : null;
      return { ok: res.ok, response: res, data: json };
    },

    async resetPassword(apiFetch, token, password) {
      const res = await apiFetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
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
