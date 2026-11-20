const SESSION_KEY = 'gotrue.user';
const REFRESH_MARGIN = 60000;
const RETRY_DELAY = 30000;

function savedSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function tokenExpiry(token) {
  try {
    const payload = token.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).exp * 1000;
  } catch {
    return 0;
  }
}

export function createPersistentIdentity(sdk) {
  let version = 0;
  let timer = null;
  let pendingSession = null;
  let activeUserId = null;
  const renewals = new Map();
  const changedSession = () => new Error('Phiên đăng nhập đã thay đổi.');

  function stop() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function schedule(delay) {
    stop();
    if (!sdk.inBrowser()) return;
    const user = sdk.client().currentUser();
    const token = user?.tokenDetails();
    if (!token?.refresh_token) return;
    const wait = delay ?? Math.max(0, tokenExpiry(token) - Date.now() - REFRESH_MARGIN);
    timer = setTimeout(() => {
      timer = null;
      ensureSession().catch(() => schedule(RETRY_DELAY));
    }, wait);
  }

  function clear(user) {
    version++;
    activeUserId = null;
    pendingSession = null;
    stop();
    if (user) user.clearSession();
    else {
      try { localStorage.removeItem(SESSION_KEY); } catch {}
    }
    sdk.clearCookies();
    sdk.notify('logout', null);
  }

  function renew(user, originalRefreshToken) {
    if (renewals.has(originalRefreshToken)) return renewals.get(originalRefreshToken);
    const started = version;
    const originalSession = savedSession();
    const owner = user.id || originalSession?.id;
    const refresh = async () => {
      if (version !== started) throw changedSession();
      const stored = savedSession();
      if (owner && stored?.id && stored.id !== owner) throw changedSession();
      // Another tab may have rotated this token while we waited for the lock.
      if (stored?.token?.access_token !== user.tokenDetails()?.access_token &&
          tokenExpiry(stored?.token) > Date.now() + REFRESH_MARGIN) {
        user._processTokenResponse(stored.token);
        sdk.writeCookies(stored.token.access_token, stored.token.refresh_token);
        return stored.token.access_token;
      }
      const refreshToken = stored?.token?.refresh_token || originalRefreshToken;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
      try {
        const token = await user.api.request('/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
          signal: controller.signal
        });
        if (version !== started) throw changedSession();
        const current = savedSession();
        if (originalSession && !current) throw changedSession();
        if (owner && current?.id && current.id !== owner) throw changedSession();
        if (current?.token?.refresh_token && current.token.refresh_token !== refreshToken &&
            tokenExpiry(current.token) > Date.now()) {
          user._processTokenResponse(current.token);
          sdk.writeCookies(current.token.access_token, current.token.refresh_token);
          return current.token.access_token;
        }
        if (!token?.access_token || tokenExpiry(token) <= Date.now()) {
          throw new Error('Chưa làm mới được phiên đăng nhập.');
        }
        user._processTokenResponse(token);
        // Publish cookies first so peer tabs always see the renewed session.
        sdk.writeCookies(token.access_token, token.refresh_token);
        user._refreshSavedSession();
        sdk.notify('token_refresh', sdk.view(user));
        return token.access_token;
      } catch (error) {
        const current = savedSession();
        const sameRefreshToken = !current || current.token?.refresh_token === refreshToken;
        if (version === started && sameRefreshToken && [400, 401, 403].includes(error.status)) clear(user);
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    };
    const locks = typeof window === 'undefined' ? null : window.navigator?.locks;
    const task = Promise.resolve().then(() => locks
      ? locks.request('ncn-identity-refresh', { mode: 'exclusive' }, refresh)
      : refresh()).finally(() => {
      if (renewals.get(originalRefreshToken) === task) renewals.delete(originalRefreshToken);
    });
    renewals.set(originalRefreshToken, task);
    return task;
  }

  function ensureSession() {
    if (!sdk.inBrowser()) return sdk.ensureLegacy();
    if (pendingSession) return pendingSession;
    const started = version;
    const task = (async () => {
      const user = sdk.client().currentUser();
      if (!user) return sdk.ensureLegacy();
      activeUserId = user.id;
      const accessToken = await user.jwt();
      if (version !== started) return null;
      sdk.writeCookies(accessToken, user.tokenDetails()?.refresh_token);
      schedule();
      return sdk.view(user);
    })().finally(() => {
      if (pendingSession === task) pendingSession = null;
    });
    pendingSession = task;
    return task;
  }

  async function signIn(...args) {
    version++;
    pendingSession = null;
    stop();
    const user = await sdk.signInLegacy(...args);
    activeUserId = user?.id || null;
    return user;
  }

  async function signOut() {
    if (!sdk.inBrowser()) return sdk.signOutLegacy();
    const user = sdk.client().currentUser();
    const accessToken = user?.tokenDetails()?.access_token;
    clear(user);
    if (!accessToken) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      await user.api.request('/logout', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken }, signal: controller.signal
      });
    } catch {
      // Local logout is complete even while the identity service is offline.
    } finally {
      clearTimeout(timeout);
    }
  }

  function onStorage(event) {
    if (event.key !== SESSION_KEY && event.key !== null) return;
    const previous = activeUserId || sdk.client().currentUser()?.id;
    const stored = savedSession();
    sdk.resetCache();
    if (!stored) {
      clear();
      return;
    }
    if (previous && previous !== stored.id) {
      version++;
      pendingSession = null;
      stop();
    }
    ensureSession().then(user => {
      if (user) sdk.notify('login', user);
    }).catch(() => schedule(RETRY_DELAY));
  }

  return { ensureSession, signIn, signOut, renew, schedule, stop, onStorage };
}
