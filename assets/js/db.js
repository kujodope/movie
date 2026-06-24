// GedaTv Supabase Cloud Database & Auth Integration Layer
(function() {
  let supabase = null;
  let syncTimeout = null;

  const SUPABASE_URL = 'https://legcqcbgrveypwgfsmaf.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CCgGgqrboF9q29is1VCUgw_jatWsNgI';
  const AUTH_USERS_KEY = 'gedatv_accounts_local';
  const AUTH_SESSION_KEY = 'gedatv_auth_session';
  const USER_DATA_PREFIX = 'gedatv_userdata_';
  const DATA_KEYS = ['gedatv_profile', 'gedatv_wishlist', 'gedatv_history', 'gedatv_progress'];

  function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
  }

  function getAuthSession() {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setAuthSession(username) {
    const session = {
      username: normalizeUsername(username),
      token: `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      signedInAt: new Date().toISOString(),
    };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearAuthSession() {
    localStorage.removeItem(AUTH_SESSION_KEY);
  }

  function getSessionUsername() {
    return normalizeUsername(getAuthSession()?.username || '');
  }

  function getStoredAccounts() {
    try {
      const raw = localStorage.getItem(AUTH_USERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveStoredAccounts(accounts) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(accounts));
  }

  async function hashPassword(password) {
    const bytes = new TextEncoder().encode(String(password || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
  }

  function getAccountRow(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) return null;
    return getStoredAccounts().find((account) => account.username === normalized) || null;
  }

  function usernameToKey(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) throw new Error('Username is required');
    return normalized;
  }

  function getUserDataStorageKey(username) {
    return USER_DATA_PREFIX + normalizeUsername(username);
  }

  function readBundleFromActiveKeys() {
    const bundle = {};
    for (const key of DATA_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        bundle[key] = JSON.parse(raw);
      } catch {
        bundle[key] = raw;
      }
    }
    return bundle;
  }

  function persistAccountProfile(username) {
    const target = normalizeUsername(username);
    if (!target) return;
    let profile = null;
    try {
      profile = JSON.parse(localStorage.getItem('gedatv_profile') || 'null');
    } catch {
      profile = null;
    }
    if (!profile?.name) return;
    const accounts = getStoredAccounts();
    const idx = accounts.findIndex((account) => account.username === target);
    if (idx < 0) return;
    accounts[idx].profile = { name: profile.name, color: profile.color };
    saveStoredAccounts(accounts);
  }

  // ── Cloud account helpers (stored inside profile JSONB — no schema change) ──
  async function uploadAccountCredentials(username) {
    if (!supabase) return;
    const account = getAccountRow(username);
    if (!account?.password_hash) return;
    try {
      const { data, error } = await supabase
        .from('gedatv_sync')
        .select('profile')
        .eq('id', username)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') return;
      const cloudProfile = (data?.profile) || {};
      cloudProfile._password_hash = account.password_hash;
      await supabase.from('gedatv_sync').upsert({
        id: username,
        profile: cloudProfile,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[GedaTv] Could not upload account credentials:', err);
    }
  }

  async function downloadAccountCredentials(username) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('gedatv_sync')
        .select('id, profile')
        .eq('id', username)
        .maybeSingle();
      if (error || !data?.profile?._password_hash) return null;
      return {
        username: data.id,
        password_hash: data.profile._password_hash,
        profile: (() => { const p = { ...data.profile }; delete p._password_hash; return p; })(),
      };
    } catch (err) {
      return null;
    }
  }
  // ── end cloud account helpers ──

  function snapshotActiveUserData(username) {
    const target = normalizeUsername(username || getSessionUsername());
    if (!target) return;
    const bundle = readBundleFromActiveKeys();
    localStorage.setItem(getUserDataStorageKey(target), JSON.stringify(bundle));
    persistAccountProfile(target);
  }

  function restoreUserDataFromLocal(username) {
    const raw = localStorage.getItem(getUserDataStorageKey(username));
    if (!raw) return false;
    try {
      const bundle = JSON.parse(raw);
      for (const key of DATA_KEYS) {
        if (bundle[key] !== undefined && bundle[key] !== null) {
          localStorage.setItem(key, JSON.stringify(bundle[key]));
        } else {
          localStorage.removeItem(key);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  function restoreProfileFromAccount(username) {
    const row = getAccountRow(username);
    if (!row?.profile?.name) return false;
    let existing = null;
    try {
      existing = JSON.parse(localStorage.getItem('gedatv_profile') || 'null');
    } catch {
      existing = null;
    }
    if (existing?.name) return false;
    const profile = {
      name: row.profile.name,
      color: row.profile.color || '#e50914',
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    localStorage.setItem('gedatv_profile', JSON.stringify(profile));
    return true;
  }

  function clearActiveUserData() {
    for (const key of DATA_KEYS) {
      localStorage.removeItem(key);
    }
  }

  function hasMeaningfulProfile(profile) {
    return profile && typeof profile === 'object' && !!profile.name;
  }

  function hasMeaningfulList(list) {
    return Array.isArray(list) && list.length > 0;
  }

  function hasMeaningfulProgress(progress) {
    return progress && typeof progress === 'object' && Object.keys(progress).length > 0;
  }

  function initSupabase() {
    if (!window.supabase) return false;
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      return true;
    } catch (e) {
      console.error("Failed to initialize Supabase:", e);
      return false;
    }
  }

  async function uploadUserData() {
    const username = getSessionUsername();
    if (!username) return;

    snapshotActiveUserData(username);
    if (!supabase) return;

    try {
      const localProfile = JSON.parse(localStorage.getItem('gedatv_profile') || '{}');
      const wishlist = JSON.parse(localStorage.getItem('gedatv_wishlist') || '[]');
      const history = JSON.parse(localStorage.getItem('gedatv_history') || '[]');
      const progress = JSON.parse(localStorage.getItem('gedatv_progress') || '{}');

      const profile = { ...(Object.keys(localProfile).length ? localProfile : {}) };
      // Embed password hash in profile for cross-browser auth
      const account = getAccountRow(username);
      if (account?.password_hash) profile._password_hash = account.password_hash;

      const { error } = await supabase.from('gedatv_sync').upsert({
        id: username,
        profile,
        wishlist,
        history,
        progress,
        updated_at: new Date().toISOString()
      });
      if (error) console.error("[GedaTv Sync] Cloud upload error:", error);
    } catch (err) {
      console.error("[GedaTv Sync] Error fetching user for upload:", err);
    }
  }

  async function syncNow() {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    await uploadUserData();
  }

  async function restoreSessionData(username, { forceReload = false } = {}) {
    const normalized = normalizeUsername(username);
    if (!normalized) return;

    const activeBundle = readBundleFromActiveKeys();
    const hasActiveData = Object.keys(activeBundle).length > 0;

    if (forceReload || !hasActiveData) {
      if (hasActiveData) snapshotActiveUserData(normalized);
      clearActiveUserData();
      restoreUserDataFromLocal(normalized);
    }

    restoreProfileFromAccount(normalized);

    if (supabase) {
      await downloadUserData();
    }

    snapshotActiveUserData(normalized);
  }

  async function downloadUserData() {
    if (!supabase) return null;
    try {
      const username = getSessionUsername();
      if (!username) return null;

      const { data, error } = await supabase
        .from('gedatv_sync')
        .select('*')
        .eq('id', username)
        .maybeSingle();

      if (error) {
        console.error("[GedaTv Sync] Cloud download error:", error);
        return null;
      }

      if (data) {
        // Extract password hash from profile and cache the account locally
        const passwordHash = data.profile?._password_hash || null;
        const cleanProfile = data.profile ? { ...data.profile } : null;
        if (cleanProfile) delete cleanProfile._password_hash;

        if (passwordHash && !getAccountRow(username)) {
          const accounts = getStoredAccounts();
          accounts.push({
            username,
            password_hash: passwordHash,
            profile: cleanProfile ? { name: cleanProfile.name, color: cleanProfile.color } : { name: username },
          });
          saveStoredAccounts(accounts);
        }

        if (hasMeaningfulProfile(cleanProfile)) {
          localStorage.setItem('gedatv_profile', JSON.stringify(cleanProfile));
        }
        if (hasMeaningfulList(data.wishlist)) {
          localStorage.setItem('gedatv_wishlist', JSON.stringify(data.wishlist));
        }
        if (hasMeaningfulList(data.history)) {
          localStorage.setItem('gedatv_history', JSON.stringify(data.history));
        }
        if (hasMeaningfulProgress(data.progress)) {
          localStorage.setItem('gedatv_progress', JSON.stringify(data.progress));
        }
        snapshotActiveUserData(username);
        return data;
      }
    } catch (err) {
      console.error("[GedaTv Sync] Error during download:", err);
    }
    return null;
  }

  // Export globally as window.Cloud
  window.Cloud = {
    get client() { return supabase; },
    init() { return initSupabase(); },
    isConnected() { return !!supabase; },
    
    async getCurrentUser() {
      const session = getAuthSession();
      if (!session?.username) return null;
      return {
        username: session.username,
        token: session.token,
        signedInAt: session.signedInAt,
      };
    },
    
    async register(username, password, profileName) {
      const normalized = usernameToKey(username);
      const password_hash = await hashPassword(password);
      const existing = await getAccountRow(normalized);
      if (existing) throw new Error('Username already exists');

      const record = {
        username: normalized,
        password_hash,
        profile: { name: profileName || normalized },
      };

      const accounts = getStoredAccounts();
      accounts.push(record);
      saveStoredAccounts(accounts);

      setAuthSession(normalized);
      await restoreSessionData(normalized, { forceReload: true });
      uploadAccountCredentials(normalized); // push to cloud for cross-browser
      return { username: normalized };
    },
    
    async login(username, password) {
      const normalized = usernameToKey(username);
      let row = getAccountRow(normalized);

      // Not found locally → try cloud (cross-browser support)
      if (!row) {
        const cloud = await downloadAccountCredentials(normalized);
        if (cloud) {
          const accounts = getStoredAccounts();
          accounts.push({
            username: normalized,
            password_hash: cloud.password_hash,
            profile: cloud.profile ? { name: cloud.profile.name, color: cloud.profile.color } : { name: normalized },
          });
          saveStoredAccounts(accounts);
          row = { username: normalized, password_hash: cloud.password_hash };
        }
      }

      if (!row) throw new Error('Invalid username or password');

      const password_hash = await hashPassword(password);
      if (row.password_hash !== password_hash) throw new Error('Invalid username or password');

      setAuthSession(normalized);
      await restoreSessionData(normalized, { forceReload: true });
      return { username: normalized };
    },
    
    async logout() {
      await syncNow();
      snapshotActiveUserData();
      clearAuthSession();
      clearActiveUserData();
    },
    
    sync() {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(async () => {
        syncTimeout = null;
        await uploadUserData();
      }, 1200);
    },

    syncNow,

    pull: async () => {
      const username = getSessionUsername();
      if (!username) return null;
      await restoreSessionData(username);
      return readBundleFromActiveKeys();
    },

    restoreSession: restoreSessionData,
  };

  // Run initial configuration checks on load
  initSupabase();
})();
