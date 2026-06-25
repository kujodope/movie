// GedaTv Supabase Cloud Database & Auth Integration Layer
(function() {
  let supabase = null;
  let syncTimeout = null;
  let authSubscription = null;
  let lastSyncResult = null;

  const SUPABASE_URL = 'https://legcqcbgrveypwgfsmaf.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CCgGgqrboF9q29is1VCUgw_jatWsNgI';
  const AUTH_SESSION_KEY = 'gedatv_auth_session';
  const USER_DATA_PREFIX = 'gedatv_userdata_';
  const DATA_KEYS = ['gedatv_profile', 'gedatv_wishlist', 'gedatv_history', 'gedatv_progress'];
  const DEFAULT_AVATAR_COLOR = '#e50914';

  let onSyncErrorCallback = null;

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeAuthSession(user) {
    if (!user?.id) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    const session = {
      id: user.id,
      email: normalizeEmail(user.email),
      profileName: user.user_metadata?.display_name || user.user_metadata?.name || '',
      signedInAt: user.last_sign_in_at || new Date().toISOString(),
    };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearAuthSession() {
    localStorage.removeItem(AUTH_SESSION_KEY);
  }

  function getSessionIdentity() {
    const session = readJson(AUTH_SESSION_KEY, null);
    return session?.id ? session : null;
  }

  function requireEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('Email is required');
    return normalized;
  }

  function getUserDataStorageKey(userId) {
    if (!userId) throw new Error('User id is required');
    return USER_DATA_PREFIX + userId;
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

  function snapshotActiveUserData(userId = getSessionIdentity()?.id) {
    if (!userId) return;
    localStorage.setItem(getUserDataStorageKey(userId), JSON.stringify(readBundleFromActiveKeys()));
  }

  function restoreUserDataFromLocal(userId) {
    if (!userId) return false;
    const bundle = readJson(getUserDataStorageKey(userId), null);
    if (!bundle || typeof bundle !== 'object') return false;
    for (const key of DATA_KEYS) {
      if (bundle[key] !== undefined && bundle[key] !== null) {
        localStorage.setItem(key, JSON.stringify(bundle[key]));
      } else {
        localStorage.removeItem(key);
      }
    }
    return true;
  }

  function clearActiveUserData() {
    for (const key of DATA_KEYS) {
      localStorage.removeItem(key);
    }
  }

  function buildDefaultProfile(identity, existing = null) {
    const fallbackName = identity?.profileName || (identity?.email ? identity.email.split('@')[0] : 'Guest') || 'Guest';
    return {
      ...(existing && typeof existing === 'object' ? existing : {}),
      name: existing?.name || fallbackName,
      color: existing?.color || DEFAULT_AVATAR_COLOR,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
  }

  function sanitizeCloudProfile(profile, identity) {
    const safeProfile = profile && typeof profile === 'object' ? { ...profile } : {};
    delete safeProfile._account_email;
    delete safeProfile._account_name;
    return buildDefaultProfile(identity, safeProfile);
  }

  function ensureLocalDefaults(identity) {
    const profile = readJson('gedatv_profile', null);
    localStorage.setItem('gedatv_profile', JSON.stringify(buildDefaultProfile(identity, profile)));
    localStorage.setItem('gedatv_wishlist', JSON.stringify(readJson('gedatv_wishlist', [])));
    localStorage.setItem('gedatv_history', JSON.stringify(readJson('gedatv_history', [])));
    localStorage.setItem('gedatv_progress', JSON.stringify(readJson('gedatv_progress', {})));
  }

  function applyCloudDataToActiveKeys(data, identity) {
    localStorage.setItem('gedatv_profile', JSON.stringify(sanitizeCloudProfile(data?.profile, identity)));
    localStorage.setItem('gedatv_wishlist', JSON.stringify(Array.isArray(data?.wishlist) ? data.wishlist : []));
    localStorage.setItem('gedatv_history', JSON.stringify(Array.isArray(data?.history) ? data.history : []));
    localStorage.setItem('gedatv_progress', JSON.stringify(data?.progress && typeof data.progress === 'object' ? data.progress : {}));
  }

  function mapUser(user) {
    if (!user?.id) return null;
    return {
      id: user.id,
      email: normalizeEmail(user.email),
      username: normalizeEmail(user.email),
      signedInAt: user.last_sign_in_at || new Date().toISOString(),
      displayName: user.user_metadata?.display_name || user.user_metadata?.name || '',
    };
  }

  function normalizeAuthError(error, { isSignup = false } = {}) {
    const message = String(error?.message || '').trim();
    const lower = message.toLowerCase();
    if (!message) {
      return isSignup ? 'Could not create your account right now.' : 'Could not sign you in right now.';
    }
    if (lower.includes('user already registered')) return 'An account with this email already exists.';
    if (lower.includes('invalid login credentials')) return 'Invalid email or password.';
    if (lower.includes('email not confirmed')) return 'Email not confirmed. Check your inbox (and spam) for the confirmation link, then try again.';
    if (lower.includes('password should be at least')) return 'Password must be at least 6 characters.';
    if (lower.includes('unable to validate email address')) return 'Enter a valid email address.';
    return message;
  }

  async function getAuthUser() {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const user = data.session?.user || null;
      if (user) {
        writeAuthSession(user);
      }
      return user;
    } catch (err) {
      console.warn('[GedaTv] Could not read auth session:', err);
      return null;
    }
  }

  function initSupabase() {
    if (supabase) return true;
    if (!window.supabase) return false;
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }
      });
      if (!authSubscription) {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            writeAuthSession(session.user);
          } else {
            clearAuthSession();
          }
        });
        authSubscription = data.subscription;
      }
      return true;
    } catch (err) {
      console.error('Failed to initialize Supabase:', err);
      return false;
    }
  }

  async function fetchCloudUserData(userId) {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('gedatv_sync')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('[GedaTv Sync] Cloud download error:', error);
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return null;
        }
        return null;
      }
      return data || null;
    } catch (err) {
      console.error('[GedaTv Sync] Error during download:', err);
      return null;
    }
  }

  async function uploadUserData() {
    const identity = getSessionIdentity();
    if (!identity?.id || !supabase) return false;
    snapshotActiveUserData(identity.id);
    try {
      const localProfile = readJson('gedatv_profile', {});
      const wishlist = readJson('gedatv_wishlist', []);
      const history = readJson('gedatv_history', []);
      const progress = readJson('gedatv_progress', {});
      const profile = {
        ...buildDefaultProfile(identity, localProfile),
        _account_email: identity.email,
        _account_name: identity.profileName || buildDefaultProfile(identity, localProfile).name,
      };
      const { error } = await supabase.from('gedatv_sync').upsert({
        id: identity.id,
        profile,
        wishlist: Array.isArray(wishlist) ? wishlist : [],
        history: Array.isArray(history) ? history : [],
        progress: progress && typeof progress === 'object' ? progress : {},
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error('[GedaTv Sync] Cloud upload error:', error);
        if (onSyncErrorCallback) onSyncErrorCallback(error.message);
        return false;
      }
      lastSyncResult = 'ok';
      return true;
    } catch (err) {
      console.error('[GedaTv Sync] Error during upload:', err);
      if (onSyncErrorCallback) onSyncErrorCallback(err.message);
      return false;
    }
  }

  async function syncNow() {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    return await uploadUserData();
  }

  async function restoreSessionData() {
    const user = await getAuthUser();
    if (!user) {
      const identity = getSessionIdentity();
      if (!identity) {
        clearActiveUserData();
      }
      return null;
    }
    const identity = getSessionIdentity();
    if (!identity?.id) return null;

    // Try cloud first, fall back to local backup, then defaults
    const existingData = readBundleFromActiveKeys();
    const hasLocalData = Object.keys(existingData).length > 0;

    const cloudData = await fetchCloudUserData(identity.id);

    if (cloudData) {
      applyCloudDataToActiveKeys(cloudData, identity);
    } else if (hasLocalData) {
      // Keep existing local data, upload it to cloud
      snapshotActiveUserData(identity.id);
      await uploadUserData();
    } else {
      const hadLocalBundle = restoreUserDataFromLocal(identity.id);
      if (!hadLocalBundle) {
        ensureLocalDefaults(identity);
      }
    }
    if (!cloudData && !hasLocalData) {
      snapshotActiveUserData(identity.id);
      await uploadUserData();
    }
    return readBundleFromActiveKeys();
  }

  window.Cloud = {
    get client() { return supabase; },
    init() { return initSupabase(); },
    isConnected() { return !!supabase; },

    onSyncError(callback) {
      onSyncErrorCallback = callback;
    },

    async getCurrentUser() {
      const user = await getAuthUser();
      return mapUser(user);
    },

    async resendConfirmation(email) {
      const normalizedEmail = requireEmail(email);
      if (!supabase && !initSupabase()) {
        throw new Error('Authentication is unavailable right now.');
      }
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
      });
      if (error) throw new Error(normalizeAuthError(error, { isSignup: true }));
    },

    async register(email, password, profileName) {
      const normalizedEmail = requireEmail(email);
      const displayName = String(profileName || normalizedEmail.split('@')[0] || 'Guest').trim();
      if (!supabase && !initSupabase()) {
        throw new Error('Authentication is unavailable right now.');
      }

      // Save current local data before overriding
      const existingProfile = readJson('gedatv_profile', null);

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) throw new Error(normalizeAuthError(error, { isSignup: true }));
      if (!data?.user) throw new Error('Could not create your account right now.');

      if (!data.session) {
        throw new Error('Account created! Check your email for a confirmation link, then sign in. (Check spam too.)');
      }

      // Restore any existing local profile data
      if (existingProfile) {
        localStorage.setItem('gedatv_profile', JSON.stringify(existingProfile));
      }
      writeAuthSession(data.user);
      await restoreSessionData();
      await syncNow();
      return mapUser(data.user);
    },

    async login(email, password) {
      const normalizedEmail = requireEmail(email);
      if (!supabase && !initSupabase()) {
        throw new Error('Authentication is unavailable right now.');
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw new Error(normalizeAuthError(error));
      if (!data?.user) throw new Error('Could not sign you in right now.');

      writeAuthSession(data.user);
      await restoreSessionData();
      return mapUser(data.user);
    },

    async logout() {
      await syncNow();
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw new Error(normalizeAuthError(error));
        }
      }
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
      await restoreSessionData();
      return readBundleFromActiveKeys();
    },

    restoreSession: restoreSessionData,
  };

  initSupabase();
})();
