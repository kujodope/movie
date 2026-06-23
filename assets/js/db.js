// GedaTv Supabase Cloud Database & Auth Integration Layer
(function() {
  let supabase = null;

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const DEFAULT_URL = "https://legcqcbgrveypwgfsmaf.supabase.co";
  const DEFAULT_KEY = "sb_publishable_CCgGgqrboF9q29is1VCUgw_jatWsNgI";
  const AUTH_USERS_KEY = 'gedatv_accounts_local';
  const AUTH_SESSION_KEY = 'gedatv_auth_session';

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

  function initSupabase() {
    const url = localStorage.getItem('gedatv_supabase_url') || DEFAULT_URL;
    const key = localStorage.getItem('gedatv_supabase_key') || DEFAULT_KEY;
    if (url && key && window.supabase) {
      try {
        supabase = window.supabase.createClient(url, key);
        return true;
      } catch (e) {
        console.error("Failed to initialize Supabase:", e);
      }
    }
    return false;
  }

  async function uploadUserData() {
    if (!supabase) return;
    try {
      const username = getSessionUsername();
      if (!username) return;
      
      const localProfile = JSON.parse(localStorage.getItem('gedatv_profile') || '{}');
      const wishlist = JSON.parse(localStorage.getItem('gedatv_wishlist') || '[]');
      const history = JSON.parse(localStorage.getItem('gedatv_history') || '[]');
      const progress = JSON.parse(localStorage.getItem('gedatv_progress') || '{}');

      const profile = Object.keys(localProfile).length ? localProfile : {};
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
        if (data.profile) localStorage.setItem('gedatv_profile', JSON.stringify(data.profile));
        if (data.wishlist) localStorage.setItem('gedatv_wishlist', JSON.stringify(data.wishlist));
        if (data.history) localStorage.setItem('gedatv_history', JSON.stringify(data.history));
        if (data.progress) localStorage.setItem('gedatv_progress', JSON.stringify(data.progress));
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
      if (supabase) await uploadUserData();
      return { username: normalized };
    },
    
    async login(username, password) {
      const normalized = usernameToKey(username);
      const row = await getAccountRow(normalized);
      if (!row) throw new Error('Invalid username or password');

      const password_hash = await hashPassword(password);
      if (row.password_hash !== password_hash) throw new Error('Invalid username or password');

      setAuthSession(normalized);
      if (supabase) await downloadUserData();
      return { username: normalized };
    },
    
    async logout() {
      clearAuthSession();
      localStorage.removeItem('gedatv_profile');
      localStorage.removeItem('gedatv_wishlist');
      localStorage.removeItem('gedatv_history');
      localStorage.removeItem('gedatv_progress');
    },
    
    sync: debounce(async () => {
      await uploadUserData();
    }, 1200),

    pull: async () => {
      return await downloadUserData();
    }
  };

  // Run initial configuration checks on load
  initSupabase();
})();
