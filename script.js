/* ========================================
   GedaTV — Movie Streaming App (TMDB)
   v5 — Cinematic Dark Theme Upgrade
   ======================================== */

const CONFIG = {
  TMDB_BASE: 'https://api.themoviedb.org/3',
  // ⚠️ Paste your TMDB API key below. Get one free: https://www.themoviedb.org/settings/api
  TMDB_API_KEY: '52ca5807708b5d42671f7276e4649a2a',
  IMG_BASE: 'https://image.tmdb.org/t/p/',
  // Embed providers
  EMBED_VIDPLUS: {
    MOVIE: (id) => `https://player.vidplus.to/embed/movie/${id}?autoplay=false&poster=true&title=true`,
    TV: (id, s, e) => `https://player.vidplus.to/embed/tv/${id}/${s}/${e}?autoplay=false&poster=true&title=true`
  },
  EMBED_111MOVIES: {
    MOVIE: (id) => `https://111movies.net/movie/${id}`,
    TV: (id, s, e) => `https://111movies.net/tv/${id}/${s}/${e}`
  },
  EMBED_CINEZO: {
    MOVIE: (id) => `https://player.cinezo.live/embed/movie/${id}?autoplay=true&poster=true&chromecast=true&servericon=true&setting=true&pip=true&download=true&font=Roboto&fontcolor=6f63ff&fontsize=20&opacity=0.5&primarycolor=e8b86d&secondarycolor=0a0a12&iconcolor=ffffff`,
    TV: (id, s, e) => `https://player.cinezo.live/embed/tv/${id}/${s}/${e}?autoplay=true&poster=true&chromecast=true&servericon=true&setting=true&pip=true&download=true&font=Roboto&fontcolor=6f63ff&fontsize=20&opacity=0.5&primarycolor=e8b86d&secondarycolor=0a0a12&iconcolor=ffffff`
  },
  EMBED_EMBEDMASTER: {
    MOVIE: (id) => `https://embedmaster.link/movie/${id}`,
    TV: (id, s, e) => `https://embedmaster.link/tv/${id}/${s}/${e}`
  },
  VIDKING_TV_PARAMS: 'autoPlay=true&nextEpisode=true&episodeSelector=true&color=8B5CF6',
  VIDKING_MOVIE_PARAMS: 'autoPlay=true&color=8B5CF6',
  EMBED_VIDKING: {
    MOVIE: (id) => `https://www.vidking.net/embed/movie/${id}?${CONFIG.VIDKING_MOVIE_PARAMS}`,
    TV: (id, s, e) => `https://www.vidking.net/embed/tv/${id}/${s}/${e}?${CONFIG.VIDKING_TV_PARAMS}`
  },
  // Keep only officially documented Videasy flags for stability.
  VIDEASY_TV_PARAMS: 'nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true&color=8B5CF6',
  VIDEASY_MOVIE_PARAMS: 'overlay=true&color=8B5CF6',
  EMBED_VIDEASY: {
    MOVIE: (id) => `https://player.videasy.net/movie/${id}?${CONFIG.VIDEASY_MOVIE_PARAMS}`,
    TV: (id, s, e) => `https://player.videasy.net/tv/${id}/${s}/${e}?${CONFIG.VIDEASY_TV_PARAMS}`
  },
  // Mappl.tv - direct ID mapping, no embed path needed
  EMBED_MAPPL: {
    MOVIE: (id) => `https://mappl.tv/watch/movie/${id}`,
    TV: (id, s, e) => `https://mappl.tv/watch/tv/${id}/${s}/${e}`
  },
  // Default embed functions (Vidking globally)
  EMBED_MOVIE: (id) => `https://www.vidking.net/embed/movie/${id}?${CONFIG.VIDKING_MOVIE_PARAMS}`,
  EMBED_TV: (id, s, e) => `https://www.vidking.net/embed/tv/${id}/${s}/${e}?${CONFIG.VIDKING_TV_PARAMS}`,
  POSTER: (path) => path ? `https://image.tmdb.org/t/p/w500${path}` : '',
  BACKDROP: (path) => path ? `https://image.tmdb.org/t/p/original${path}` : '',
  PROFILE: (path) => path ? `https://image.tmdb.org/t/p/w185${path}` : '',
};

const savedHiAnimeBase = localStorage.getItem('hianimeBase');
const HIANIME = {
  BASE: !savedHiAnimeBase || savedHiAnimeBase === '/api' ? '/api/anime' : savedHiAnimeBase
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const requestCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/* ---------- Toast Notifications ---------- */
function showToast(message, type = 'info') {
  const container = $('#toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ---------- Dynamic Page Title ---------- */
function setPageTitle(sub) {
  document.title = sub ? `${sub} — GedaTV` : 'GedaTV — Stream Movies & TV Shows Free';
}

/* ---------- Skeleton Grid Helper ---------- */
function showGridSkeleton(container, count = 12) {
  container.innerHTML = Array.from({length: count}, () =>
    `<div class="card skeleton-card" style="width:100%"><div class="skeleton" style="width:100%;aspect-ratio:2/3;border-radius:10px;"></div><div style="padding:10px"><div class="skeleton" style="height:14px;width:80%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:40%;"></div></div></div>`
  ).join('');
}

/* ---------- API ---------- */
async function tmdb(endpoint, params = {}) {
  const url = new URL(`${CONFIG.TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', CONFIG.TMDB_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const key = url.toString();
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  requestCache.set(key, { data, ts: Date.now() });
  return data;
}

/* ---------- AniList API ---------- */
async function fetchAnilist(query, variables = {}) {
  const url = 'https://graphql.anilist.co';
  const key = `${url}:${query}:${JSON.stringify(variables)}`;
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables })
  };
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors ? data.errors[0].message : 'AniList API Error');
  requestCache.set(key, { data: data.data, ts: Date.now() });
  return data.data;
}

async function fetchHianime(endpoint) {
  const url = `${HIANIME.BASE}${endpoint}`;
  const cached = requestCache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`HiAnime ${res.status}`);
  const data = await res.json();
  requestCache.set(url, { data, ts: Date.now() });
  return data;
}

function unwrapApiData(payload) {
  if (payload && typeof payload === 'object') {
    if ('results' in payload) return payload.results;
    if ('data' in payload) return payload.data;
  }
  return payload;
}

function getAnimeTvInfo(item = {}) {
  const info = item.tvInfo || item.tv_info || {};
  const epInfo = info.episodeInfo || info.episode_info || {};
  return {
    showType: info.showType || info.type || item.type || null,
    duration: info.duration || item.duration || null,
    quality: info.quality || item.quality || null,
    releaseDate: info.releaseDate || item.release || item.aired || null,
    sub: epInfo.sub ?? info.sub ?? item.sub ?? null,
    dub: epInfo.dub ?? info.dub ?? item.dub ?? null,
    eps: epInfo.eps ?? info.eps ?? item.eps ?? null,
  };
}

function getAnimeId(item = {}) {
  return item.id || item.idX || item.idani || item.idanime || item.iD || item.animeId || item.xid || item.idd || null;
}

function getAnimeTitle(item = {}) {
  return item.title || item.name || item.japanese_title || item.jname || item.japanese || item.animeTitle || item.anime_name || getAnimeId(item) || 'Anime';
}

function getAnimePoster(item = {}) {
  return item.poster || item.imageAnime || item.imgAni || item.img || item.imageX || item.image || item.animeImg || '';
}

function getAnimeEpisodesLabel(item = {}) {
  const info = getAnimeTvInfo(item);
  const episodes = item.episodes || {};
  const sub = episodes.sub ?? info.sub;
  const dub = episodes.dub ?? info.dub;
  const eps = episodes.eps ?? info.eps;

  return [
    sub != null ? `Sub ${sub}` : '',
    dub != null ? `Dub ${dub}` : '',
    eps != null ? `Ep ${eps}` : '',
  ].filter(Boolean).join(' • ');
}

function getAnimeMeta(item = {}) {
  const info = getAnimeTvInfo(item);
  return [item.number ? `#${item.number}` : '', item.rank ? `#${item.rank}` : '', info.showType, info.duration, info.releaseDate, info.quality, item.rating, getAnimeEpisodesLabel(item)]
    .filter(Boolean)
    .join(' • ');
}

function toAnimeCard(item, sourceLabel = '') {
  const info = getAnimeTvInfo(item);
  return {
    id: getAnimeId(item),
    title: getAnimeTitle(item),
    poster_path: getAnimePoster(item),
    vote_average: Number.parseFloat(item.rating || item.score || item.malscore || item.pg || item.MAL_score || item.malScore || 0) || 0,
    release_date: info.releaseDate || null,
    sourceLabel,
    meta: getAnimeMeta(item),
    raw: item,
  };
}

function createAnimeCard(item, isLandscape = false) {
  const mediaId = item.id;
  const title = item.title || item.name || 'Anime';
  const poster = item.poster_path || '';
  const meta = item.meta || '';
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
  const cardClassName = isLandscape ? 'card-horizontal' : 'card';
  const card = document.createElement('div');
  card.className = cardClassName;
  card.style.animationDelay = `${Math.random() * 0.2}s`;
  card.innerHTML = `
    ${poster ? `<img class="card-poster" src="${poster}" alt="${title.replace(/"/g, '&quot;')}" loading="lazy" />` : `<div class="card-poster" style="display:flex;align-items:center;justify-content:center;background:var(--bg-card);color:var(--text-muted);font-size:12px">No Image</div>`}
    <div class="card-rating">⭐ ${rating}</div>
    <div class="card-type-badge">ANIME</div>
    <div class="card-overlay">
      <div class="card-title">${title}</div>
      ${meta ? `<div class="card-year">${meta}</div>` : ''}
      ${item.sourceLabel ? `<div class="continue-btn" style="margin: 8px auto 0 auto; padding: 6px 12px; font-size:11px;">${item.sourceLabel}</div>` : ''}
    </div>
    ${!isLandscape ? `
    <div class="card-info">
      <div class="card-title">${title}</div>
      <div class="card-year">${meta || ''}</div>
    </div>` : ''}
  `;
  card.addEventListener('click', () => {
    if (mediaId) {
      window.location.hash = `#/anime/${mediaId}`;
    }
  });
  return card;
}

function renderAnimeCards(container, items, append = false, isLandscape = false) {
  if (!append) container.innerHTML = '';
  items.forEach(item => container.appendChild(createAnimeCard(item, isLandscape)));
  assignTileAnimations(container);
}

/* ---------- State ---------- */
const state = {
  heroItems: [],
  heroIndex: 0,
  heroInterval: null,
  homeGenre: null,
  homeGenreLabel: '',
  movieGenres: [],
  tvGenres: [],
  moviesPage: 1,
  moviesFilter: 'popular',
  moviesGenre: null,
  tvPage: 1,
  tvFilter: 'popular',
  tvGenre: null,
  animePage: 1,
  animeFilter: 'featured',
  animeQuery: '',
  kdramaPage: 1,
  kdramaFilter: 'popular',
  kdramaGenre: null,
  marvelTab: 'browse',
  marvelFilter: 'movie',
  marvelOrder: 'chronological',
  marvelPage: 1,
  bollywoodPage: 1,
  bollywoodFilter: 'popular',
  bollywoodGenre: null,
  searchPage: 1,
  searchQuery: '',
  auth: {
    token: localStorage.getItem('token') || null,
    username: localStorage.getItem('username') || null
  },
  settings: {
    theme: 'cinematic',
    preferred_source: 'vidking',
    autoplay_next: true,
    auto_open_servers: false,
  },
  watchlist: [],
  progress: [],
  moviesHasMore: false,
  moviesLoading: false,
  tvHasMore: false,
  tvLoading: false,
  kdramaHasMore: false,
  kdramaLoading: false,
  motionIndex: 0,
  lastNonWatchHash: '#/home',
  lastPaginationCheck: 0
};

let revealObserver = null;

function assignTileAnimations(scope = document) {
  const scopedTiles = scope.matches?.('.card, .card-horizontal')
    ? [scope]
    : Array.from(scope.querySelectorAll('.card, .card-horizontal'));
  const rootTiles = scope === document
    ? Array.from(document.querySelectorAll('.content-grid .card, .scroll-container .card, .scroll-container .card-horizontal'))
    : [];
  const tiles = scopedTiles.length ? scopedTiles : rootTiles;
  let i = 0;
  tiles.forEach((el) => {
    el.style.setProperty('--tile-index', String(i % 12));
    i += 1;
  });
}

function setupRevealObserver() {
  if (revealObserver) revealObserver.disconnect();

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));
}

function refreshDynamicUI() {
  document.querySelectorAll('.content-row, .page-header, .detail-main, .cast-section, .trailer-section, .similar-section, .empty-state')
    .forEach((el) => el.setAttribute('data-reveal', ''));

  assignTileAnimations();
  setupRevealObserver();
}

function setupHeroParallax() {
  const hero = $('#heroBanner');
  const backdrop = $('#heroBackdrop');
  if (!hero || !backdrop || hero.dataset.parallaxBound === '1') return;

  const onMove = (e) => {
    const rect = hero.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const py = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
    backdrop.style.transform = `scale(1.04) translate(${px}px, ${py}px)`;
  };

  const onLeave = () => {
    backdrop.style.transform = 'scale(1.02) translate(0, 0)';
  };

  hero.addEventListener('mousemove', onMove);
  hero.addEventListener('mouseleave', onLeave);
  hero.dataset.parallaxBound = '1';
}

function getRecentViewed() {
  try {
    const raw = localStorage.getItem('recentViewed');
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveRecentViewed(items) {
  localStorage.setItem('recentViewed', JSON.stringify(items.slice(0, 18)));
}

function stripHtml(value = '') {
  const tmp = document.createElement('div');
  tmp.innerHTML = value;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function formatAiringCountdown(seconds) {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) return '';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pushRecentViewed(item) {
  if (!item?.id || !item?.type) return;
  const existing = getRecentViewed().filter((x) => !(x.id == item.id && x.type === item.type));
  existing.unshift({
    id: item.id,
    type: item.type,
    title: item.title || item.name,
    name: item.name,
    poster_path: item.poster_path || null,
    vote_average: item.vote_average || 0,
    release_date: item.release_date || item.first_air_date || null,
    first_air_date: item.first_air_date || null,
  });
  saveRecentViewed(existing);
}

function renderRecentlyViewed() {
  const row = $('#recentlyViewedRow');
  const scroller = $('#recentlyViewedScroll');
  if (!row || !scroller) return;

  const items = getRecentViewed();
  if (!items.length) {
    row.style.display = 'none';
    return;
  }

  row.style.display = 'block';
  scroller.innerHTML = '';
  items.slice(0, 12).forEach((item) => {
    scroller.appendChild(createCard(item, item.type, true));
  });
}

/* ---------- Auth & Data ---------- */
const API_BASE = (() => {
  const override = localStorage.getItem('apiBase');
  if (override) return override.replace(/\/$/, '');

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }

  // Production/default: same-origin API path.
  return '/api';
})();

const LOCAL_AUTH_USERS_KEY = 'localAuthUsers';
const LOCAL_WATCHLIST_PREFIX = 'localWatchlist:';
const LOCAL_HISTORY_PREFIX = 'localHistory:';
const LOCAL_PROGRESS_PREFIX = 'localProgress:';

function getLocalAuthUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAuthUsers(users) {
  localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
}

function registerLocalUser(username, password) {
  const users = getLocalAuthUsers();
  const exists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());
  if (exists) throw new Error('Username already exists');
  users.push({ username, password });
  saveLocalAuthUsers(users);
  return { token: `local-${Date.now()}`, username };
}

function loginLocalUser(username, password) {
  const users = getLocalAuthUsers();
  const found = users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!found) throw new Error('Invalid username or password');
  return { token: `local-${Date.now()}`, username: found.username };
}

function isLocalAuthToken(token = state.auth.token) {
  return typeof token === 'string' && token.startsWith('local-');
}

function localWatchlistKey() {
  const username = (state.auth.username || 'guest').trim().toLowerCase();
  return `${LOCAL_WATCHLIST_PREFIX}${username}`;
}

function getLocalWatchlist() {
  try {
    const raw = localStorage.getItem(localWatchlistKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalWatchlist(items) {
  localStorage.setItem(localWatchlistKey(), JSON.stringify(items));
}

function localHistoryKey() {
  const username = (state.auth.username || 'guest').trim().toLowerCase();
  return `${LOCAL_HISTORY_PREFIX}${username}`;
}

function getLocalHistory() {
  try {
    const raw = localStorage.getItem(localHistoryKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(items) {
  localStorage.setItem(localHistoryKey(), JSON.stringify(items.slice(0, 120)));
}

function localProgressKey() {
  const username = (state.auth.username || 'guest').trim().toLowerCase();
  return `${LOCAL_PROGRESS_PREFIX}${username}`;
}

function getLocalProgress() {
  try {
    const raw = localStorage.getItem(localProgressKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalProgress(items) {
  localStorage.setItem(localProgressKey(), JSON.stringify(items));
}

function upsertProgressItem(items, payload) {
  const next = Array.isArray(items) ? [...items] : [];
  const idx = next.findIndex((p) =>
    p.media_id == payload.media_id &&
    p.type === payload.type &&
    (payload.type === 'movie' || (Number(p.season || 1) === Number(payload.season || 1) && Number(p.episode || 1) === Number(payload.episode || 1)))
  );

  if (idx >= 0) {
    next[idx] = { ...next[idx], ...payload, updated_at: Date.now() };
  } else {
    next.unshift({ ...payload, updated_at: Date.now() });
  }

  return next.sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
}

function getProgressPosition(progress = {}) {
  return Number(progress.position ?? progress.last_position ?? 0) || 0;
}

function getProgressPercent(progress = {}) {
  const position = getProgressPosition(progress);
  if (position <= 0) return 0;

  const durationSeconds = Number(
    progress.duration_seconds ??
    progress.durationSeconds ??
    progress.duration ??
    0
  );

  // If total duration is unknown, show a small confidence bar once playback exists.
  if (!durationSeconds || durationSeconds <= 0) {
    return Math.min(90, Math.max(8, Math.round(position / 120)));
  }

  return Math.min(100, Math.max(0, Math.round((position / durationSeconds) * 100)));
}

function getProgressSortKey(progress = {}) {
  const rawUpdated = progress.updated_at ?? progress.updatedAt ?? progress.created_at ?? progress.createdAt ?? 0;
  const numericUpdated = Number(rawUpdated);
  const parsedUpdated = Number.isFinite(numericUpdated) && numericUpdated > 0
    ? numericUpdated
    : (Date.parse(String(rawUpdated)) || 0);

  const season = Number(progress.season || 1);
  const episode = Number(progress.episode || 1);
  const position = getProgressPosition(progress);
  return { updatedAt: parsedUpdated, season, episode, position };
}

function getWatchStartHash(type, mediaId) {
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  if (mediaType !== 'tv') {
    return `#/watch/${mediaType}/${mediaId}`;
  }

  const progress = getLatestProgressForMedia(mediaId, mediaType);
  const season = Number(progress?.season || 1);
  const episode = Number(progress?.episode || 1);
  return `#/watch/tv/${mediaId}/${season}/${episode}`;
}

function addHistoryItem(entry) {
  const base = {
    media_id: entry.media_id,
    id: entry.media_id,
    type: entry.type,
    title: entry.title || '',
    poster_path: entry.poster_path || null,
    season: entry.type === 'tv' ? Number(entry.season || 1) : null,
    episode: entry.type === 'tv' ? Number(entry.episode || 1) : null,
    position: Math.max(0, Number(entry.position || 0)),
    duration_seconds: Math.max(0, Number(entry.duration_seconds || 0)) || null,
    progress_percent: Number.isFinite(Number(entry.progress_percent)) ? Math.max(0, Math.min(100, Math.round(Number(entry.progress_percent)))) : null,
    viewed_at: Date.now(),
  };

  if (isLocalAuthToken()) {
    const current = getLocalHistory();
    const deduped = current.filter((h) => !(h.media_id == base.media_id && h.type === base.type));
    saveLocalHistory([base, ...deduped]);
    return;
  }

  fetch(API_BASE + '/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.auth.token}` },
    body: JSON.stringify(base)
  }).catch(e => console.error('History log error:', e));
}

function saveProgressRecord(payload, options = {}) {
  if (!state.auth.token) return;
  const urgent = !!options.urgent;

  const normalized = {
    media_id: payload.media_id,
    type: payload.type,
    season: payload.type === 'tv' ? Number(payload.season || 1) : null,
    episode: payload.type === 'tv' ? Number(payload.episode || 1) : null,
    position: Math.max(0, Number(payload.position || 0)),
    duration_seconds: Math.max(0, Number(payload.duration_seconds || 0)) || null,
    title: payload.title || '',
    poster_path: payload.poster_path || null,
    release_date: payload.release_date || null,
  };

  state.progress = upsertProgressItem(state.progress, normalized);
  // Keep a local backup so abrupt closes do not lose recent progress.
  saveLocalProgress(upsertProgressItem(getLocalProgress(), normalized));

  if (isLocalAuthToken()) {
    return;
  }

  fetch(API_BASE + '/progress', {
    method: 'POST',
    keepalive: urgent,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.auth.token}` },
    body: JSON.stringify(normalized)
  }).catch(e => console.error('Save progress error:', e));
}

function flushActiveWatchProgress(options = {}) {
  const s = window.activeWatchSession;
  if (!s || !state.auth.token) return;
  const urgent = !!options.urgent;

  const elapsed = Math.floor((Date.now() - Number(s.startedAt || Date.now())) / 1000);
  const currentPos = Math.max(0, Number(s.basePosition || 0) + elapsed);

  saveProgressRecord({
    media_id: s.media_id,
    type: s.type,
    season: s.season,
    episode: s.episode,
    position: currentPos,
    duration_seconds: s.duration_seconds,
    title: s.title,
    poster_path: s.poster_path,
    release_date: s.release_date,
  }, { urgent });
}

function markTvEpisodeSelection(mediaId, season, episode, options = {}) {
  if (!state.auth.token) return;

  const normalizedSeason = Number(season || 1);
  const normalizedEpisode = Number(episode || 1);
  const existing = getMediaProgress(mediaId, 'tv', normalizedSeason, normalizedEpisode);

  saveProgressRecord({
    media_id: mediaId,
    type: 'tv',
    season: normalizedSeason,
    episode: normalizedEpisode,
    position: getProgressPosition(existing || {}),
    duration_seconds: window.activeWatchSession?.duration_seconds || null,
    title: window.activeWatchSession?.title || '',
    poster_path: window.activeWatchSession?.poster_path || null,
    release_date: window.activeWatchSession?.release_date || null,
  }, options);
}

async function fetchContinueWatching(limit = 24) {
  if (!state.auth.token) return [];
  if (isLocalAuthToken()) {
    return state.progress.slice(0, limit);
  }

  try {
    const res = await fetch(`${API_BASE}/continue-watching?limit=${encodeURIComponent(limit)}`, {
      headers: { 'Authorization': `Bearer ${state.auth.token}` }
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

window.goToTvEpisodeFromWatch = function(id, season, episode) {
  flushActiveWatchProgress({ urgent: true });
  markTvEpisodeSelection(id, season, episode, { urgent: true });
  window.location.hash = `#/watch/tv/${id}/${season}/${episode}`;
};
const DEFAULT_SETTINGS = {
  theme: 'cinematic',
  preferred_source: 'mappl',
  autoplay_next: true,
  auto_open_servers: false,
};

function normalizeSettings(input = {}) {
  const allowedThemes = new Set(['cinematic', 'midnight', 'light']);
  const allowedSources = new Set(['mappl', 'embedmaster', 'vidking', 'videasy', 'cinezo', 'vidplus', '111movies']);
  return {
    theme: allowedThemes.has(input.theme) ? input.theme : DEFAULT_SETTINGS.theme,
    preferred_source: allowedSources.has(input.preferred_source) ? input.preferred_source : DEFAULT_SETTINGS.preferred_source,
    autoplay_next: input.autoplay_next == null ? DEFAULT_SETTINGS.autoplay_next : !!input.autoplay_next,
    auto_open_servers: input.auto_open_servers == null ? DEFAULT_SETTINGS.auto_open_servers : !!input.auto_open_servers,
  };
}

function applyTheme(theme) {
  const normalized = normalizeSettings({ theme }).theme;
  if (normalized === 'cinematic') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', normalized);
  }

  const themeColor = normalized === 'light' ? '#f3f6fc' : normalized === 'midnight' ? '#060915' : '#0a0a0f';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColor);
}

function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem('userSettings');
    const parsed = raw ? JSON.parse(raw) : {};
    state.settings = normalizeSettings(parsed);
  } catch {
    state.settings = { ...DEFAULT_SETTINGS };
  }
  applyTheme(state.settings.theme);
}

function persistSettingsToStorage() {
  localStorage.setItem('userSettings', JSON.stringify(state.settings));
}

function getEmbedUrlForSource(source, type, id, season = 1, episode = 1) {
  switch (source) {
    case 'embedmaster':
      return type === 'tv' ? CONFIG.EMBED_EMBEDMASTER.TV(id, season, episode) : CONFIG.EMBED_EMBEDMASTER.MOVIE(id);
    case 'vidking':
      return type === 'tv' ? CONFIG.EMBED_VIDKING.TV(id, season, episode) : CONFIG.EMBED_VIDKING.MOVIE(id);
    case 'videasy':
      return type === 'tv' ? CONFIG.EMBED_VIDEASY.TV(id, season, episode) : CONFIG.EMBED_VIDEASY.MOVIE(id);
    case 'vidplus':
      return type === 'tv' ? CONFIG.EMBED_VIDPLUS.TV(id, season, episode) : CONFIG.EMBED_VIDPLUS.MOVIE(id);
    case '111movies':
      return type === 'tv' ? CONFIG.EMBED_111MOVIES.TV(id, season, episode) : CONFIG.EMBED_111MOVIES.MOVIE(id);
    case 'cinezo':
      return type === 'tv' ? CONFIG.EMBED_CINEZO.TV(id, season, episode) : CONFIG.EMBED_CINEZO.MOVIE(id);
    case 'mappl':
      return type === 'tv' ? CONFIG.EMBED_MAPPL.TV(id, season, episode) : CONFIG.EMBED_MAPPL.MOVIE(id);
    default:
      return type === 'tv' ? CONFIG.EMBED_VIDKING.TV(id, season, episode) : CONFIG.EMBED_VIDKING.MOVIE(id);
  }
}

function getEmbedSandboxForSource(source) {
  // Restrictive sandbox for Vidking to reduce popup/redirect behavior.
  if (source === 'vidking') {
    return 'allow-scripts allow-same-origin allow-presentation';
  }
  return '';
}

function escapeAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildWatchPlayerHtml({ url, sandbox = '' }) {
  const safeUrl = escapeAttr(url || 'about:blank');
  // Add broad allow attributes and vendor fullscreen flags to maximize provider compatibility
  const allowList = 'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; geolocation';
  return `<iframe class="watch-player" id="watchPlayer" src="${safeUrl}" ${sandbox ? `sandbox="${sandbox}"` : ''} allow="${allowList}" allowfullscreen webkitallowfullscreen mozallowfullscreen referrerpolicy="origin"></iframe>`;
}

async function fetchUserSettings() {
  if (!state.auth.token) return;
  try {
    const res = await fetch(API_BASE + '/settings', {
      headers: { 'Authorization': `Bearer ${state.auth.token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    state.settings = normalizeSettings(data);
    persistSettingsToStorage();
    applyTheme(state.settings.theme);
  } catch (e) {
    console.error(e);
  }
}

async function saveUserSettings(partial, syncServer = true) {
  state.settings = normalizeSettings({ ...state.settings, ...partial });
  persistSettingsToStorage();
  applyTheme(state.settings.theme);

  if (!syncServer || !state.auth.token) return true;
  try {
    const res = await fetch(API_BASE + '/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.auth.token}`,
      },
      body: JSON.stringify(state.settings),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function openAuthModal() {
  window.isLoginMode = true;
  $('#authTitle').textContent = 'Sign In';
  $('#authSwitchText').textContent = "Don't have an account?";
  $('#authSwitchBtn').textContent = 'Register';
  $('#authError').style.display = 'none';
  $('#authModal').classList.remove('hidden');
}

function closeAuthModal() {
  $('#authModal').classList.add('hidden');
}

function openSettingsModal() {
  $('#settingsTheme').value = state.settings.theme;
  $('#settingsSource').value = state.settings.preferred_source;
  $('#settingsAutoplayNext').checked = !!state.settings.autoplay_next;
  $('#settingsAutoOpenServers').checked = !!state.settings.auto_open_servers;
  $('#settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
  $('#settingsModal').classList.add('hidden');
}

async function handleSettingsSave() {
  const next = {
    theme: $('#settingsTheme').value,
    preferred_source: $('#settingsSource').value,
    autoplay_next: $('#settingsAutoplayNext').checked,
    auto_open_servers: $('#settingsAutoOpenServers').checked,
  };

  const ok = await saveUserSettings(next, true);
  if (!ok) {
    showToast('Saved locally. Could not sync account settings now.', 'info');
  } else {
    showToast('Settings saved', 'success');
  }
  closeSettingsModal();
}

window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;

function toggleAuthMode() {
  window.isLoginMode = !window.isLoginMode;
  $('#authTitle').textContent = window.isLoginMode ? 'Sign In' : 'Register';
  $('#authSwitchText').textContent = window.isLoginMode ? "Don't have an account?" : "Already have an account?";
  $('#authSwitchBtn').textContent = window.isLoginMode ? 'Register' : 'Sign In';
}

// Toggle the floating watch controls (show/hide Back and Server buttons)
window.toggleWatchControls = function(btn) {
  try {
    const wrapper = btn.closest('.watch-floating-controls');
    if (!wrapper) return;
    const expanded = wrapper.getAttribute('data-expanded') === 'true';
    wrapper.setAttribute('data-expanded', String(!expanded));
    btn.setAttribute('aria-expanded', String(!expanded));
    const icon = btn.querySelector('.toggle-icon');
    if (icon) icon.textContent = !expanded ? '‹' : '›';
    // Update title for clarity
    btn.title = !expanded ? 'Hide controls' : 'Show controls';
  } catch (e) {
    console.error('toggleWatchControls error', e);
  }
};

// Toggle controls from the left-middle handle (moves/animates the floating controls)
window.toggleLeftControls = function(btn) {
  try {
    const wrapper = document.querySelector('.watch-floating-controls');
    if (!wrapper) return;
    const isVisible = wrapper.classList.toggle('visible');
    btn.setAttribute('aria-expanded', String(isVisible));
    btn.title = isVisible ? 'Hide controls' : 'Show controls';
  } catch (e) {
    console.error('toggleLeftControls error', e);
  }
};

// Helper: force the watch iframe into fullscreen from parent (works around some embed issues)
window.enterWatchFullscreen = function() {
  try {
    const iframe = document.getElementById('watchPlayer');
    if (!iframe) return showToast && showToast('Player not found', 'error');
    if (iframe.requestFullscreen) return iframe.requestFullscreen();
    if (iframe.webkitRequestFullscreen) return iframe.webkitRequestFullscreen();
    if (iframe.mozRequestFullScreen) return iframe.mozRequestFullScreen();
    if (iframe.msRequestFullscreen) return iframe.msRequestFullscreen();
    showToast && showToast('Fullscreen not supported', 'error');
  } catch (e) {
    console.error('enterWatchFullscreen error', e);
    showToast && showToast('Fullscreen failed: ' + (e.message || e), 'error');
  }
};

async function handleAuth(e) {
  e.preventDefault();
  const username = $('#authUsername').value.trim();
  const password = $('#authPassword').value;
  if (!username || !password) {
    $('#authError').textContent = 'Username and password are required';
    $('#authError').style.display = 'block';
    return;
  }

  const endpoint = window.isLoginMode ? '/login' : '/register';
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Auth service unavailable');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');
    state.auth.token = data.token;
    state.auth.username = data.username;
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    closeAuthModal();
    initUser();
    showToast(window.isLoginMode ? 'Signed in successfully' : 'Account created successfully', 'success');
  } catch(err) {
    const msg = String(err?.message || 'Authentication failed');
    const likelyNetwork = /failed to fetch|networkerror|auth service unavailable|load failed/i.test(msg);

    if (likelyNetwork) {
      try {
        const localUser = window.isLoginMode
          ? loginLocalUser(username, password)
          : registerLocalUser(username, password);
        state.auth.token = localUser.token;
        state.auth.username = localUser.username;
        localStorage.setItem('token', localUser.token);
        localStorage.setItem('username', localUser.username);
        closeAuthModal();
        initUser();
        showToast('Auth server unavailable, using local account mode', 'info');
        return;
      } catch (localErr) {
        $('#authError').textContent = localErr.message;
        $('#authError').style.display = 'block';
        return;
      }
    }

    $('#authError').textContent = msg;
    $('#authError').style.display = 'block';
  }
}

function logout() {
  state.auth.token = null;
  state.auth.username = null;
  state.watchlist = [];
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  updateNavUI();
  if (location.hash.includes('watchlist') || location.hash.includes('history')) {
    location.hash = '#/';
  }
  if ($('#view-home').classList.contains('active')) renderHero();
  else if ($('#view-detail').classList.contains('active')) {
    const btn = $('#detailWLBtn');
    if (btn) btn.textContent = '+ Watchlist';
  }
}

function updateNavUI() {
  const container = $('#navAuthContainer');
  const historyLink = $('#navHistory');
  if (state.auth.token) {
    container.innerHTML = `<span style="font-size:13px; margin: 0 12px; color:var(--text-secondary);">Hi, <b style="color:#fff;">${state.auth.username}</b></span><button class="btn-secondary" id="btnLogout" style="padding: 6px 16px; font-size:12px;">Logout</button>`;
    if (historyLink) historyLink.style.display = 'block';
    $('#btnLogout').addEventListener('click', logout);
  } else {
    container.innerHTML = `<button class="btn-primary" id="btnLogin" style="padding: 6px 16px; margin-left:8px; font-size:12px;">Sign In</button>`;
    if (historyLink) historyLink.style.display = 'none';
    $('#btnLogin').addEventListener('click', (e) => { e.preventDefault(); openAuthModal(); });
  }
}

async function fetchWatchlist() {
  if (!state.auth.token) { state.watchlist = []; return; }

  if (isLocalAuthToken()) {
    state.watchlist = getLocalWatchlist();
    return;
  }

  try {
    const res = await fetch(API_BASE + '/watchlist', { headers: { 'Authorization': `Bearer ${state.auth.token}` } });
    if (res.ok) state.watchlist = await res.json();
  } catch(e) { console.error(e); }
}

function isInWatchlist(id, type) {
  return state.watchlist.some(i => i.media_id == id && i.type === type);
}

async function fetchProgress() {
  if (!state.auth.token) { state.progress = []; return; }

  if (isLocalAuthToken()) {
    state.progress = getLocalProgress();
    return;
  }

  try {
    const res = await fetch(API_BASE + '/progress', { headers: { 'Authorization': `Bearer ${state.auth.token}` } });
    if (res.ok) {
      const serverProgress = await res.json();
      const localBackup = getLocalProgress();
      let merged = Array.isArray(serverProgress) ? [...serverProgress] : [];
      localBackup.forEach((item) => {
        merged = upsertProgressItem(merged, item);
      });
      state.progress = merged;
    } else {
      state.progress = getLocalProgress();
    }
  } catch(e) {
    console.error(e);
    state.progress = getLocalProgress();
  }
}

function getLatestProgressForMedia(id, type) {
  const candidates = state.progress.filter((p) => p.media_id == id && p.type === type);
  if (!candidates.length) return null;
  if (type === 'movie') return candidates[0];

  return [...candidates].sort((a, b) => {
    const sortA = getProgressSortKey(a);
    const sortB = getProgressSortKey(b);

    if (sortB.updatedAt !== sortA.updatedAt) return sortB.updatedAt - sortA.updatedAt;
    if (sortB.season !== sortA.season) return sortB.season - sortA.season;
    if (sortB.episode !== sortA.episode) return sortB.episode - sortA.episode;
    return sortB.position - sortA.position;
  })[0] || candidates[0];
}

function getMediaProgress(id, type, season = null, episode = null) {
  if (type === 'movie') {
    return state.progress.find((p) => p.media_id == id && p.type === type) || null;
  }

  if (season != null && episode != null) {
    return state.progress.find((p) =>
      p.media_id == id &&
      p.type === type &&
      Number(p.season || 1) === Number(season) &&
      Number(p.episode || 1) === Number(episode)
    ) || null;
  }

  return getLatestProgressForMedia(id, type);
}

async function toggleWatchlist(item) {
  if (!state.auth.token) { 
    // Show a more informative prompt for watchlist
    const confirmed = confirm('📌 Sign in to save your watchlist\n\nYour watchlist will be saved to your account and synced across all devices.\n\nDo you want to sign in now?');
    if (confirmed) openAuthModal();
    return false; 
  }
  const mediaId = item.media_id || item.id;
  if (isLocalAuthToken()) {
    const localItems = getLocalWatchlist();
    const exists = localItems.some(i => i.media_id == mediaId && i.type === item.type);
    let nextItems;
    if (exists) {
      nextItems = localItems.filter(i => !(i.media_id == mediaId && i.type === item.type));
      showToast('Removed from watchlist', 'info');
    } else {
      const payload = { ...item, media_id: mediaId };
      nextItems = [payload, ...localItems];
      showToast('Added to watchlist', 'success');
    }
    saveLocalWatchlist(nextItems);
    state.watchlist = nextItems;
    return true;
  }

  const inWL = isInWatchlist(mediaId, item.type);
  const endpoint = inWL ? `/watchlist/${mediaId}/${item.type}` : '/watchlist';
  const method = inWL ? 'DELETE' : 'POST';
  try {
    const payload = { ...item, media_id: mediaId };
    const res = await fetch(API_BASE + endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.auth.token}` },
      body: inWL ? null : JSON.stringify(payload)
    });
    if (res.ok) {
      if (inWL) {
        state.watchlist = state.watchlist.filter(i => !(i.media_id == mediaId && i.type === item.type));
        showToast('Removed from watchlist', 'info');
      } else {
        state.watchlist.unshift(payload);
        showToast('Added to watchlist', 'success');
      }
      return true;
    }
  } catch(e) { console.error(e); showToast('Watchlist error', 'error'); }
  return false;
}

async function initUser() {
  updateNavUI();
  await Promise.all([fetchWatchlist(), fetchProgress(), fetchUserSettings()]);
  if (window.location.hash.includes('watchlist') && state.auth.token) {
    loadWatchlist();
  }
}

/* ---------- Card Builder ---------- */
function createCard(item, type, isLandscape = false) {
  const mediaId = item.id || item.media_id;
  const title = item.title || item.name;
  const date = item.release_date || item.first_air_date || '';
  const year = date ? date.split('-')[0] : '';
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
  
  let imagePath = item.poster_path;
  if (isLandscape && item.backdrop_path) {
    imagePath = item.backdrop_path;
  }
  const poster = CONFIG.POSTER(imagePath);
  
  // Check for progress
  const progressItem = getLatestProgressForMedia(mediaId, type);
  const progressPercent = getProgressPercent(progressItem || {});
  let progressHtml = '';
  if (progressItem && progressPercent > 0) {
    progressHtml = `<div class="card-progress-bar" style="width: ${progressPercent}%"></div>`;
  }

  const cardClassName = isLandscape ? 'card-horizontal' : 'card';
  const card = document.createElement('div');
  card.className = cardClassName;
  card.style.animationDelay = `${Math.random() * 0.2}s`;
  const typeLabel = type === 'tv' ? 'TV' : '';
  
  let continueLabel = 'Continue';
  if (type === 'tv' && progressItem) continueLabel = `Continue S${progressItem.season}E${progressItem.episode}`;

  card.innerHTML = `
    ${poster ? `<img class="card-poster" src="${poster}" alt="${title}" loading="lazy" />` : `<div class="card-poster" style="display:flex;align-items:center;justify-content:center;background:var(--bg-card);color:var(--text-muted);font-size:12px">No Image</div>`}
    <div class="card-rating">⭐ ${rating}</div>
    ${typeLabel ? `<div class="card-type-badge">${typeLabel}</div>` : ''}
    ${progressHtml}
    <div class="card-overlay">
      <div class="card-title">${title}</div>
      ${!isLandscape || progressItem ? `<div class="card-year">${year}</div>` : ''}
      ${progressItem ? `<div class="continue-btn" style="margin: 8px auto 0 auto; padding: 6px 12px; font-size:11px;">
        ▶ 
        ${continueLabel}
      </div>` : ''}
    </div>
    ${!isLandscape ? `
    <div class="card-info">
      <div class="card-title">${title}</div>
      <div class="card-year">${year}</div>
    </div>` : ''}
  `;
  
  card.addEventListener('click', () => {
    window.location.hash = `#/${type}/${mediaId}`;
  });
  
  // Add hover preview for non-landscape cards
  if (!isLandscape) {
    card.addEventListener('mouseenter', () => {
      currentPreviewCard = card;
      showCardPreview(card, item, type, mediaId);
    });
    card.addEventListener('mouseleave', (e) => {
      // Keep the preview visible when pointer moves from the card into the preview popup.
      if (isHoveringPreviewOrCard(e.relatedTarget)) return;
      hideCardPreview();
    });
  }

  // Handle Continue button click
  const contBtn = card.querySelector('.continue-btn');
  if (contBtn) {
    contBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (type === 'tv' && progressItem.season && progressItem.episode) {
        window.location.hash = `#/watch/tv/${mediaId}/${progressItem.season}/${progressItem.episode}`;
      } else {
        window.location.hash = `#/watch/${type}/${mediaId}`;
      }
    });
  }

  return card;
}

/* ---------- Card Preview Hover ---------- */
let currentPreviewTimeout = null;
let currentPreviewCard = null;

function isHoveringPreviewOrCard(target) {
  if (!target) return false;
  const preview = document.querySelector('.card-preview-popup');
  if (currentPreviewCard && currentPreviewCard.contains(target)) return true;
  if (preview && preview.contains(target)) return true;
  return false;
}

function showCardPreview(card, item, type, mediaId) {
  // Clear any existing timeout
  if (currentPreviewTimeout) clearTimeout(currentPreviewTimeout);
  
  // Remove old preview if exists
  const oldPreview = document.querySelector('.card-preview-popup');
  if (oldPreview) oldPreview.remove();
  
  currentPreviewTimeout = setTimeout(() => {
    const title = item.title || item.name || '';
    const year = item.release_date ? item.release_date.split('-')[0] : item.first_air_date ? item.first_air_date.split('-')[0] : '';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const overview = item.overview || 'No description available';
    const backdrop = CONFIG.BACKDROP(item.backdrop_path);
    const inWL = isInWatchlist(mediaId, type);
    
    const preview = document.createElement('div');
    preview.className = 'card-preview-popup';
    preview.innerHTML = `
      <div class="preview-backdrop" style="background-image: url('${backdrop}')"></div>
      <div class="preview-content">
        <h3 class="preview-title">${title}</h3>
        <div class="preview-meta">
          <span class="preview-rating">⭐ ${rating}</span>
          <span>${year}</span>
          <span>${type === 'tv' ? 'TV Show' : 'Movie'}</span>
        </div>
        <p class="preview-overview">${overview.substring(0, 150)}${overview.length > 150 ? '...' : ''}</p>
        <div class="preview-actions">
            <button class="btn-primary btn-sm" onclick="window.location.hash='${getWatchStartHash(type, mediaId)}'">▶ Watch</button>
          <button class="btn-secondary btn-sm" onclick="window.location.hash='#/${type}/${mediaId}'">ℹ Info</button>
          <button class="btn-secondary btn-sm" onclick="toggleWatchlist({ media_id: ${mediaId}, type: '${type}', title: \`${title}\`, poster_path: '${item.poster_path}', vote_average: ${item.vote_average || 0}, release_date: '${item.release_date || item.first_air_date || ''}' }); event.target.textContent = event.target.textContent === '✓ In Watchlist' ? '+ Watchlist' : '✓ In Watchlist';" id="previewWLBtn">${inWL ? '✓ In Watchlist' : '+ Watchlist'}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(preview);
    
    // Position preview near the card using real popup size with viewport clamping.
    const rect = card.getBoundingClientRect();
    const popupWidth = preview.offsetWidth || 340;
    const popupHeight = preview.offsetHeight || 260;
    const gap = 10;
    const viewportPadding = 10;

    // Keep preview above the card; if space is tight, clamp to below navbar/top padding.
    const navBottom = $('#navbar')?.getBoundingClientRect?.().bottom || 0;
    const safeTop = Math.max(viewportPadding, navBottom + 8);
    let top = rect.top - popupHeight - gap;
    top = Math.max(safeTop, top);

    let left = rect.left + rect.width / 2;
    const minCenter = viewportPadding + popupWidth / 2;
    const maxCenter = window.innerWidth - viewportPadding - popupWidth / 2;
    left = Math.max(minCenter, Math.min(left, maxCenter));

    preview.style.top = `${top}px`;
    preview.style.left = `${left}px`;
    
    // Add hover listeners to keep preview open
    preview.addEventListener('mouseenter', () => {
      if (currentPreviewTimeout) clearTimeout(currentPreviewTimeout);
    });
    preview.addEventListener('mouseleave', (e) => {
      // Keep it open while moving back to the card.
      if (currentPreviewCard && currentPreviewCard.contains(e.relatedTarget)) return;
      hideCardPreview();
    });
  }, 300);
}

function hideCardPreview() {
  if (currentPreviewTimeout) clearTimeout(currentPreviewTimeout);
  currentPreviewTimeout = null;
  currentPreviewCard = null;
  const preview = document.querySelector('.card-preview-popup');
  if (preview) {
    preview.classList.add('fade-out');
    setTimeout(() => preview.remove(), 200);
  }
}

function showEmptyState(container, message = 'No content found', icon = '📭') {
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
      <div style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
      <h3 style="color: var(--text-primary); margin-bottom: 8px;">${message}</h3>
      <p style="font-size: 13px;">Try adjusting your search or filters</p>
    </div>
  `;
}

function showErrorState(container, message = 'Something went wrong') {
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h3 style="color: var(--text-primary); margin-bottom: 8px;">${message}</h3>
      <p style="font-size: 13px;">Please try refreshing the page or come back later</p>
      <button class="btn-secondary" style="margin-top: 16px;" onclick="location.reload()">Refresh Page</button>
    </div>
  `;
}

/* ---------- Icon Helper ---------- */
function getIcon(type) {
  const icons = {
    trending: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 17"/><polyline points="17 6 23 6 23 12"/></svg>',
    popular: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    toprated: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    tvshow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    continue: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    recent: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    watchlist: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10l7 7v11a2 2 0 0 1-2 2z"/></svg>',
    kdrama: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    bollywood: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>',
    marvel: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9.5 5.5v9L12 22l-9.5-5.5v-9L12 2z"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  };
  return icons[type] || icons.popular;
}

function createSectionHeader(title, icon = 'popular', seeAllLink = null) {
  return `
    <div class="row-header">
      <div class="row-title-wrapper">
        <span class="row-icon">${getIcon(icon)}</span>
        <h2>${title}</h2>
      </div>
      ${seeAllLink ? `<a href="${seeAllLink}" class="see-all">See All →</a>` : ''}
    </div>
  `;
}

/* ---------- Render Helpers ---------- */
function renderCards(container, items, type, append = false, isLandscape = false) {
  if (!append) container.innerHTML = '';
  
  // Use DocumentFragment to batch DOM operations and prevent multiple reflows
  const fragment = document.createDocumentFragment();
  items.forEach(item => fragment.appendChild(createCard(item, type, isLandscape)));
  container.appendChild(fragment);
  
  assignTileAnimations(container);
}

function showView(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  const view = $(`#view-${viewId}`);
  if (view) view.classList.add('active');

  // Hide top chrome during playback so it never covers the player.
  document.body.classList.toggle('watch-mode', viewId === 'watch');

  // Update nav
  $$('.nav-link').forEach(l => l.classList.remove('active'));
  const link = $(`.nav-link[data-page="${viewId}"]`);
  if (link) link.classList.add('active');

  window.scrollTo({ top: 0 });
  requestAnimationFrame(refreshDynamicUI);
}

function stopWatchPlayback() {
  flushActiveWatchProgress();

  if (window.watchInterval) {
    clearInterval(window.watchInterval);
    window.watchInterval = null;
  }
  window.activeWatchSession = null;

  if (window.animeHls) {
    window.animeHls.destroy();
    window.animeHls = null;
  }

  const animePlayer = $('#animeVideoPlayer');
  if (animePlayer) {
    try {
      animePlayer.pause();
      animePlayer.removeAttribute('src');
      animePlayer.load();
    } catch (e) {
      console.error('Anime player cleanup error:', e);
    }
  }

  const watchIframe = $('#watchPlayer');
  if (watchIframe) {
    // about:blank reliably stops cross-origin iframe playback.
    watchIframe.src = 'about:blank';
  }

  const watchContainer = $('#watchContainer');
  if (watchContainer) {
    watchContainer.innerHTML = '';
  }
}

/* ---------- Hero Banner ---------- */
async function loadHero() {
  try {
    const data = await tmdb('/trending/movie/week');
    state.heroItems = data.results.slice(0, 7);
    renderHero();
    startHeroRotation();
  } catch (e) {
    console.error('Hero load failed:', e);
    $('#heroContent').innerHTML = '<h1 class="hero-title">Welcome to GedaTV</h1><p class="hero-overview">Browse movies and TV shows below.</p>';
  }
}

function renderHero() {
  const item = state.heroItems[state.heroIndex];
  if (!item) return;
  const backdrop = CONFIG.BACKDROP(item.backdrop_path);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
  const year = item.release_date ? item.release_date.split('-')[0] : '';
  const inWL = isInWatchlist(item.id, 'movie');
  const progress = getMediaProgress(item.id, 'movie');

  $('#heroBackdrop').style.backgroundImage = `url(${backdrop})`;
  $('#heroContent').innerHTML = `
    <h1 class="hero-title">${item.title}</h1>
    <div class="hero-meta">
      <span class="hero-rating">⭐ ${rating}</span>
      <span>${year}</span>
      <span>${item.original_language?.toUpperCase()}</span>
    </div>
    <p class="hero-overview">${item.overview}</p>
    <div class="hero-actions">
      <button class="btn-primary" onclick="window.location.hash='#/watch/movie/${item.id}'">
        ${progress ? '▶ Continue Watching' : '▶ Watch Now'}
      </button>
      <button class="btn-secondary" onclick="window.location.hash='#/movie/${item.id}'">ℹ More Info</button>
      <button class="btn-secondary" onclick="heroRandomPick()">🎲 Random Pick</button>
      <button class="btn-secondary" onclick="heroToggleWL(${item.id})" id="heroWLBtn">${inWL ? '✓ In Watchlist' : '+ Watchlist'}</button>
    </div>
  `;

  // Indicators
  $('#heroIndicators').innerHTML = state.heroItems.map((_, i) =>
    `<div class="hero-dot ${i === state.heroIndex ? 'active' : ''}" onclick="goHero(${i})"></div>`
  ).join('');

  setupHeroParallax();
}

window.goHero = function(i) {
  state.heroIndex = i;
  renderHero();
  startHeroRotation();
};

window.heroToggleWL = async function(id) {
  const item = state.heroItems.find(h => h.id === id);
  if (!item) return;
  const success = await toggleWatchlist({ media_id: item.id, type: 'movie', title: item.title, poster_path: item.poster_path, vote_average: item.vote_average, release_date: item.release_date });
  if (success) renderHero();
};

window.heroRandomPick = function() {
  if (!state.heroItems.length) return;
  if (state.heroItems.length === 1) {
    window.location.hash = `#/movie/${state.heroItems[0].id}`;
    return;
  }
  const choices = state.heroItems.filter((_, idx) => idx !== state.heroIndex);
  const pick = choices[Math.floor(Math.random() * choices.length)];
  if (pick?.id) {
    window.location.hash = `#/movie/${pick.id}`;
  }
};

function startHeroRotation() {
  clearInterval(state.heroInterval);
  state.heroInterval = setInterval(() => {
    state.heroIndex = (state.heroIndex + 1) % state.heroItems.length;
    renderHero();
  }, 8000);
}

/* ---------- Home Page ---------- */
async function loadHome() {
  showView('home');
  renderRecentlyViewed();

  const trendingTitle = document.querySelector('#trendingRow h2');
  if (trendingTitle) {
    trendingTitle.textContent = state.homeGenreLabel ? `Genre Picks: ${state.homeGenreLabel}` : 'Trending Now';
  }

  const clearRecentBtn = $('#clearRecentBtn');
  if (clearRecentBtn) {
    clearRecentBtn.onclick = (e) => {
      e.preventDefault();
      saveRecentViewed([]);
      renderRecentlyViewed();
      showToast('Recently viewed cleared', 'info');
    };
  }
  
  // Render Continue Watching if logged in
  const continueRow = $('#continueWatchingRow');
  const continueScroll = $('#continueWatchingScroll');
  if (state.auth.token) {
    await fetchProgress(); // Refresh progress
    const continueItems = await fetchContinueWatching(12);
    if (continueItems.length > 0) {
      continueRow.style.display = 'block';
      continueScroll.innerHTML = '';

      // Ensure progress state is warm so cards show accurate continue labels/progress bars.
      continueItems.forEach((item) => {
        if (item?.media_id && item?.type) {
          state.progress = upsertProgressItem(state.progress, item);
        }
      });

      const cards = await Promise.allSettled(
        continueItems.map(async (item) => {
          if (item.type === 'anime') return null;
          let detail = null;
          try {
            detail = await tmdb(`/${item.type}/${item.media_id}`);
          } catch {
            detail = {
              id: item.media_id,
              media_id: item.media_id,
              type: item.type,
              title: item.title || 'Untitled',
              name: item.title || 'Untitled',
              poster_path: item.poster_path || null,
              release_date: item.release_date || null,
              first_air_date: item.release_date || null,
              vote_average: 0,
            };
          }
          return createCard(detail, item.type, true);
        })
      );

      cards.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          continueScroll.appendChild(result.value);
        }
      });
    } else {
      continueRow.style.display = 'none';
    }
  } else {
    continueRow.style.display = 'none';
  }

  // Load and render genres
  if (!state.movieGenres.length) {
    try {
      const g = await tmdb('/genre/movie/list');
      state.movieGenres = g.genres;
    } catch (e) {
      console.error('Failed to load genres:', e);
    }
  }
  renderHomeGenres(state.movieGenres);

  try {
    const [trending, popular, topRated, tvPop, homeGenreFeed] = await Promise.all([
      tmdb('/trending/all/day'),
      tmdb('/movie/popular'),
      tmdb('/movie/top_rated'),
      tmdb('/tv/popular'),
      state.homeGenre
        ? tmdb('/discover/movie', { with_genres: state.homeGenre, page: 1, sort_by: 'popularity.desc' })
        : Promise.resolve(null),
    ]);

    if (state.homeGenre) {
      const filtered = homeGenreFeed?.results || [];
      if (filtered.length) {
        renderCards($('#trendingScroll'), filtered.slice(0, 20), 'movie', false, true);
      } else {
        showEmptyState($('#trendingScroll'), 'No movies found for this genre', '🎬');
      }
    } else {
      renderCards($('#trendingScroll'), trending.results.slice(0, 20), 'movie', false, true);
      // Fix: trending contains both movie and tv
      trending.results.forEach((item, idx) => {
        const cards = $('#trendingScroll').children;
        if (cards[idx]) {
          cards[idx].onclick = () => {
            const t = item.media_type || 'movie';
            window.location.hash = `#/${t}/${item.id}`;
          };
        }
      });
    }

    renderCards($('#popularScroll'), popular.results.slice(0, 20), 'movie', false, true);
    renderCards($('#topRatedScroll'), topRated.results.slice(0, 20), 'movie', false, true);
    renderCards($('#tvPopularScroll'), tvPop.results.slice(0, 20), 'tv', false, true);
  } catch (e) {
    console.error('Home load failed:', e);
    showToast('Could not load content. Please refresh the page.', 'error');
  }
}

/* ---------- Movies Page ---------- */
async function loadMovies(append = false) {
  if (state.moviesLoading) return;
  state.moviesLoading = true;
  if (!append) showView('movies');
  if (!append) showGridSkeleton($('#moviesGrid'));
  const params = { page: state.moviesPage };
  if (state.moviesGenre) params.with_genres = state.moviesGenre;
  let endpoint = `/movie/${state.moviesFilter}`;
  if (state.moviesGenre) endpoint = '/discover/movie';

  try {
    const data = await tmdb(endpoint, params);
    if (!data.results || data.results.length === 0) {
      state.moviesHasMore = false;
      showEmptyState($('#moviesGrid'), 'No movies found', '🎬');
      $('#loadMoreMovies').style.display = 'none';
    } else {
      renderCards($('#moviesGrid'), data.results, 'movie', append);
      state.moviesHasMore = state.moviesPage < data.total_pages;
      $('#loadMoreMovies').style.display = 'none';
    }
  } catch (e) {
    state.moviesHasMore = false;
    console.error('Movies load failed:', e);
    showErrorState($('#moviesGrid'), 'Failed to load movies');
    $('#loadMoreMovies').style.display = 'none';
  } finally {
    state.moviesLoading = false;
  }

  // Genres
  if (!state.movieGenres.length) {
    try {
      const g = await tmdb('/genre/movie/list');
      state.movieGenres = g.genres;
    } catch (e) {
      console.error('Failed to load genres:', e);
    }
  }
  if (state.movieGenres.length) {
    renderGenreBar($('#movieGenres'), state.movieGenres, state.moviesGenre, 'movie');
  }
}

/* ---------- TV Page ---------- */
async function loadTV(append = false) {
  if (state.tvLoading) return;
  state.tvLoading = true;
  if (!append) showView('tv');
  if (!append) showGridSkeleton($('#tvGrid'));
  const params = { page: state.tvPage };
  if (state.tvGenre) params.with_genres = state.tvGenre;
  let endpoint = `/tv/${state.tvFilter}`;
  if (state.tvGenre) endpoint = '/discover/tv';

  try {
    const data = await tmdb(endpoint, params);
    if (!data.results || data.results.length === 0) {
      state.tvHasMore = false;
      showEmptyState($('#tvGrid'), 'No TV shows found', '📺');
      $('#loadMoreTV').style.display = 'none';
    } else {
      renderCards($('#tvGrid'), data.results, 'tv', append);
      state.tvHasMore = state.tvPage < data.total_pages;
      $('#loadMoreTV').style.display = 'none';
    }
  } catch (e) {
    state.tvHasMore = false;
    console.error('TV load failed:', e);
    showErrorState($('#tvGrid'), 'Failed to load TV shows');
    $('#loadMoreTV').style.display = 'none';
  } finally {
    state.tvLoading = false;
  }

  if (!state.tvGenres.length) {
    try {
      const g = await tmdb('/genre/tv/list');
      state.tvGenres = g.genres;
    } catch (e) {
      console.error('Failed to load TV genres:', e);
    }
  }
  if (state.tvGenres.length) {
    renderGenreBar($('#tvGenres'), state.tvGenres, state.tvGenre, 'tv');
  }
}

/* ---------- Anime Page ---------- */
async function loadAnime(append = false) {
  if (!append) showView('anime');
  const grid = $('#animeGrid');
  if (!append) showGridSkeleton(grid);

  const searchInput = $('#animeSearchInput');
  const searchQuery = (searchInput?.value || state.animeQuery || '').trim();
  if (searchQuery !== state.animeQuery) {
    state.animeQuery = searchQuery;
    if (searchQuery) state.animeFilter = 'search';
  }

  try {
    let cards = [];
    let nextPageAvailable = false;

    if (state.animeQuery) {
      const data = unwrapApiData(await fetchHianime(`/search?keyword=${encodeURIComponent(state.animeQuery)}&page=${state.animePage}`)) || {};
      const searchItems = Array.isArray(data.data) ? data.data : Array.isArray(data.response) ? data.response : [];
      cards = searchItems.map((item) => toAnimeCard(item, 'Search'));
      nextPageAvailable = Number(data.totalPages || 1) > Number(state.animePage || 1);
    } else if (state.animeFilter === 'popular') {
      const data = unwrapApiData(await fetchHianime(`/most-popular?page=${state.animePage}`)) || {};
      const popularItems = Array.isArray(data.data) ? data.data : [];
      cards = popularItems.filter((item) => getAnimeId(item)).map((item) => toAnimeCard(item, 'Popular'));
      nextPageAvailable = Number(data.totalPages || 1) > Number(state.animePage || 1);
    } else if (state.animeFilter === 'random') {
      const randomData = unwrapApiData(await fetchHianime('/random')) || {};
      const randomInfo = randomData.data || randomData;
      const randomId = randomInfo.id || randomInfo.animeId || null;
      if (randomId) {
        const detail = unwrapApiData(await fetchHianime(`/info?id=${encodeURIComponent(randomId)}`)) || {};
        cards = [toAnimeCard(detail, 'Random')];
      }
      nextPageAvailable = false;
    } else {
      const data = unwrapApiData(await fetchHianime('/')) || {};
      const sections = [
        ['Spotlight', data.spotlights],
        ['Trending', data.trending],
        ['Top Airing', data.topAiring],
        ['Popular', data.mostPopular],
        ['Favorites', data.mostFavorite],
        ['Latest Completed', data.latestCompleted],
        ['Latest Episodes', data.latestEpisode],
        ['New Added', data.newAdded],
        ['Top Upcoming', data.topUpcoming],
      ];
      cards = sections.flatMap(([label, items]) => Array.isArray(items) ? items.map((item) => toAnimeCard(item, label)) : []);
      nextPageAvailable = false;
    }

    renderAnimeCards(grid, cards, append);
    $('#loadMoreAnime').style.display = nextPageAvailable ? 'block' : 'none';
  } catch (error) {
    console.error('Anime page error:', error);
    if (!append) {
      grid.innerHTML = '<div class="empty-state">Failed to load anime right now.</div>';
    }
    $('#loadMoreAnime').style.display = 'none';
  }
}

async function loadAnimeDetail(id) {
  showView('detail');
  $('#detailContent').innerHTML = '<div style="padding:40px;text-align:center;">Loading anime...</div>';

  try {
    const data = unwrapApiData(await fetchHianime(`/info?id=${encodeURIComponent(id)}`)) || {};
    const detailData = data.data || data;
    const related = Array.isArray(data.related_data) ? data.related_data.flat() : [];
    const recommended = Array.isArray(data.recommended_data) ? data.recommended_data.flat() : [];
    const mostPopular = Array.isArray(data.mostPopular) ? data.mostPopular : [];
    const recommendations = [
      ...recommended,
      ...related,
      ...mostPopular,
    ];
    const title = detailData.title || id;
    const poster = detailData.poster || '';
    const animeInfo = detailData.animeInfo || {};
    const desc = animeInfo.Overview || detailData.description || 'No overview available.';
    const genreNames = Array.isArray(animeInfo.Genres) ? animeInfo.Genres.map((g) => typeof g === 'string' ? g : (g?.name || g?.title || '')).filter(Boolean) : [];
    const producerNames = Array.isArray(animeInfo.Producers) ? animeInfo.Producers.map((p) => typeof p === 'string' ? p : (p?.name || p?.title || '')).filter(Boolean) : [];
    const extras = [
      detailData.japanese_title ? `<div class="detail-extra-item"><span>Japanese</span>${detailData.japanese_title}</div>` : '',
      detailData.showType ? `<div class="detail-extra-item"><span>Type</span>${detailData.showType}</div>` : '',
      animeInfo.Status ? `<div class="detail-extra-item"><span>Status</span>${animeInfo.Status}</div>` : '',
      animeInfo['MAL Score'] ? `<div class="detail-extra-item"><span>MAL Score</span>${animeInfo['MAL Score']}</div>` : '',
      genreNames.length ? `<div class="detail-extra-item"><span>Genres</span>${genreNames.join(', ')}</div>` : '',
      animeInfo.Studios ? `<div class="detail-extra-item"><span>Studio</span>${animeInfo.Studios}</div>` : '',
      producerNames.length ? `<div class="detail-extra-item"><span>Producer</span>${producerNames.join(', ')}</div>` : '',
      animeInfo.Duration ? `<div class="detail-extra-item"><span>Duration</span>${animeInfo.Duration}</div>` : '',
      animeInfo.Premiered ? `<div class="detail-extra-item"><span>Premiered</span>${animeInfo.Premiered}</div>` : '',
    ].filter(Boolean).join('');

    $('#detailContent').innerHTML = `
      <div class="detail-backdrop" style="background-image: url(${poster})">
        <div class="detail-backdrop-overlay"></div>
      </div>
      <div class="container detail-content">
        <img class="detail-poster" src="${poster}" alt="${title}" />
        <div class="detail-info">
          <h1 class="detail-title">${title}</h1>
          <p class="detail-overview">${desc}</p>
          <div class="detail-extra">${extras}</div>
          <div style="margin-top:24px; display:flex; gap:16px; flex-wrap:wrap;">
            <button class="btn-primary" onclick="window.location.hash='#/watch/anime/${encodeURIComponent(id)}/1'">▶ Watch Now</button>
            <button class="btn-secondary" onclick="window.goBackFromWatch()">Back</button>
          </div>
        </div>
      </div>
      <div class="container" style="padding-top:0;">
        <div class="content-row">
          <div class="row-header"><h2>Recommended</h2></div>
          <div class="content-grid" id="animeRecommendations"></div>
        </div>
      </div>
    `;

    const recGrid = $('#animeRecommendations');
    if (recGrid) {
      renderAnimeCards(recGrid, recommendations.map((item) => toAnimeCard(item, 'Rec')));
    }
  } catch (error) {
    console.error('Anime detail error:', error);
    $('#detailContent').innerHTML = '<div style="padding:40px;text-align:center;color:red;">Error loading anime details</div>';
  }
}

function animePickEpisode(episodes, requestedEpisode) {
  const current = String(requestedEpisode || '1');
  return episodes.find((episode) => String(episode.episode_no || episode.episodeNumber || episode.order) === current) || episodes[0] || null;
}

function animeEpisodeDataId(episode = {}) {
  if (episode.data_id != null) return episode.data_id;
  const id = String(episode.id || '');
  const match = id.match(/[?&]ep=(\d+)/);
  return match ? Number(match[1]) : null;
}

function animePickServer(servers = [], preferredType = 'sub', serverIndex = 0) {
  const typed = servers.filter((server) => (server.type || '').toLowerCase() === preferredType);
  const pool = typed.length ? typed : servers;
  return pool[serverIndex] || pool[0] || null;
}

function animeAttachSource(player, sourceUrl, sourceType = '') {
  if (window.animeHls) {
    window.animeHls.destroy();
    window.animeHls = null;
  }

    const isHls = sourceType === 'hls' || /\.m3u8(\?|$)/i.test(sourceUrl) || sourceUrl.includes('hls');
  if (isHls && window.Hls && Hls.isSupported()) {
    window.animeHls = new Hls();
    window.animeHls.loadSource(sourceUrl);
    window.animeHls.attachMedia(player);
  } else {
    player.src = sourceUrl;
  }
}

async function loadAnimeWatch(id, episodeNum = 1) {
  const animeId = decodeURIComponent(String(id || ''));
  showView('watch');
  const watchContainer = $('#watchContainer');
  watchContainer.innerHTML = '<div style="padding:40px;text-align:center;">Loading Player...</div>';

  try {
    const [detailRaw, episodesRaw] = await Promise.all([
      fetchHianime(`/info?id=${encodeURIComponent(animeId)}`),
      fetchHianime(`/episodes/${encodeURIComponent(animeId)}`),
    ]);

    const detail = unwrapApiData(detailRaw) || {};
    const detailData = detail.data || detail;
    const title = detailData?.title || animeId;

    const episodesData = unwrapApiData(episodesRaw) || {};
    const episodes = Array.isArray(episodesData?.episodes) ? episodesData.episodes : Array.isArray(episodesData?.data?.episodes) ? episodesData.data.episodes : [];
    const currentEpisode = animePickEpisode(episodes, episodeNum);
    if (!currentEpisode) throw new Error('No episodes available');

    const epDataId = animeEpisodeDataId(currentEpisode);
    if (!epDataId) throw new Error('Episode source not found');

    const serverPayload = unwrapApiData(await fetchHianime(`/servers/${encodeURIComponent(animeId)}?ep=${epDataId}`)) || [];
    const allServers = Array.isArray(serverPayload) ? serverPayload : (Array.isArray(serverPayload.servers) ? serverPayload.servers : []);
    const preferredType = (localStorage.getItem('animeStreamType') || 'sub').toLowerCase();
    const selectedServer = animePickServer(allServers, preferredType, window.animeServerIndex || 0);
    if (!selectedServer) throw new Error('No servers available');

    const serverName = selectedServer.serverName || selectedServer.server_name || selectedServer.server || '';
    const streamType = (selectedServer.type || preferredType || 'sub').toLowerCase();
    const streamPayload = unwrapApiData(await fetchHianime(`/stream?id=${encodeURIComponent(currentEpisode.id)}&server=${encodeURIComponent(serverName)}&type=${encodeURIComponent(streamType)}`)) || {};
    const streamList = Array.isArray(streamPayload.streamingLink) ? streamPayload.streamingLink : [];
    const activeStream = streamList.find((entry) => (entry.type || '').toLowerCase() === streamType) || streamList[0] || null;
    const sourceUrl = activeStream?.link?.file || activeStream?.file || '';
    const sourceType = activeStream?.link?.type || activeStream?.type || '';

    const serverButtons = allServers.map((server, index) => {
      const label = server.serverName || server.server_name || `Server ${index + 1}`;
      return `<button class="server-btn ${index === (window.animeServerIndex || 0) ? 'active' : ''}" onclick="setAnimeServer(${index}, '${encodeURIComponent(animeId)}', ${episodeNum})">${label}</button>`;
    }).join('');

    const episodeButtons = episodes.map((episode) => {
      const epNumber = Number(episode.episode_no || episode.episodeNumber || episode.order) || 1;
      return `<button class="ep-btn ${String(epNumber) === String(episodeNum) ? 'active' : ''}" onclick="window.location.hash='#/watch/anime/${encodeURIComponent(animeId)}/${epNumber}'">
        <span class="ep-num">${String(epNumber).padStart(2, '0')}</span>
        <span class="ep-meta">
          <span class="ep-title">${episode.title || `Episode ${epNumber}`}</span>
          <span class="ep-sub">${episode.japanese_title || episode.alternativeTitle || 'HiAnime'}</span>
        </span>
      </button>`;
    }).join('');

    watchContainer.innerHTML = `
      <div class="watch-layout">
        <div class="watch-main">
          <button class="watch-left-handle" aria-expanded="false" onclick="toggleLeftControls(this)" title="Show controls" style="border-radius:999px; padding:10px; background:rgba(0,0,0,0.6);backdrop-filter:blur(10px); position:absolute; left:18px; top:50%; transform:translateY(-50%); z-index:110;">
            <span class="left-icon">≡</span>
          </button>
          <div class="watch-floating-controls" data-expanded="true">
            <button class="btn-secondary" onclick="window.goBackFromWatch()" style="border-radius:999px; padding: 10px 16px; background:rgba(0,0,0,0.6);backdrop-filter:blur(10px)">← Back</button>
            <button class="btn-secondary" onclick="enterWatchFullscreen()" title="Fullscreen" style="border-radius:999px; padding: 10px 12px; background:rgba(0,0,0,0.6);backdrop-filter:blur(10px)">⤢</button>
            <button class="btn-secondary" onclick="document.querySelector('.watch-sidebar')?.classList.toggle('open')" style="border-radius:999px; padding: 10px 16px; background:rgba(0,0,0,0.6);backdrop-filter:blur(10px)">☰ Servers & Episodes</button>
          </div>
          <div id="playerWrap" style="position:relative; width: 100vw; height: 100vh; background:#000;">
            <video id="animeVideoPlayer" class="watch-player" controls playsinline crossorigin="anonymous"></video>
          </div>
        </div>
        <div class="watch-sidebar">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1)">
            <div>
              <h1 class="watch-title">${title}</h1>
              <div class="watch-meta">Episode ${currentEpisode.episode_no || currentEpisode.episodeNumber || currentEpisode.order || episodeNum}${detailData?.animeInfo?.Status ? ` • ${detailData.animeInfo.Status}` : ''}</div>
            </div>
            <button onclick="document.querySelector('.watch-sidebar').classList.remove('open')" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
          </div>
          <div class="sidebar-scroll">
            <section class="watch-panel-section">
              <div class="watch-panel-head">
                <h3 class="watch-panel-title">JustAnimeCore Playback</h3>
                <span class="watch-panel-sub">${streamType.toUpperCase()} • ${serverName || 'default server'}</span>
              </div>
              <div class="server-grid" style="margin-top:8px;">
                <button class="server-btn" onclick="localStorage.setItem('animeStreamType', localStorage.getItem('animeStreamType') === 'dub' ? 'sub' : 'dub'); window.animeServerIndex = 0; loadAnimeWatch('${encodeURIComponent(animeId)}', ${episodeNum});">Toggle ${preferredType === 'dub' ? 'Sub' : 'Dub'}</button>
                <button class="server-btn" onclick="window.location.hash='#/anime/${encodeURIComponent(animeId)}'">Details</button>
              </div>
              <div class="server-grid" style="margin-top:8px;">${serverButtons}</div>
            </section>
            <section class="watch-panel-section">
              <div class="watch-panel-head">
                <h3 class="watch-panel-title">Episodes</h3>
                <span class="watch-panel-sub">Pick an episode</span>
              </div>
              <div class="episode-grid">${episodeButtons}</div>
            </section>
          </div>
        </div>
      </div>
    `;

    const player = $('#animeVideoPlayer');
    if (!player || !sourceUrl) throw new Error('No streaming source found');
    if (detailData?.poster) player.poster = detailData.poster;
    animeAttachSource(player, sourceUrl, sourceType);
  } catch (error) {
    console.error('Anime watch error:', error);
    watchContainer.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Error loading anime player</div>';
  }
}

window.openAnimeEpisode = function(id, episodeNum) {
  loadAnimeWatch(decodeURIComponent(id), episodeNum);
};

window.setAnimeServer = function(index, id, episodeNum) {
  loadAnimeWatch(decodeURIComponent(id), episodeNum);
};

/* ---------- K-Drama Page ---------- */
async function loadKDrama(append = false) {
  if (state.kdramaLoading) return;
  state.kdramaLoading = true;
  if (!append) showView('kdrama');
  if (!append) showGridSkeleton($('#kdramaGrid'));
  const params = { page: state.kdramaPage, with_origin_country: 'KR', with_original_language: 'ko' };
  if (state.kdramaGenre) params.with_genres = state.kdramaGenre;
  
  // Custom filters logic mimicking tv
  let endpoint = '/discover/tv';
  if (state.kdramaFilter === 'movies') {
    endpoint = '/discover/movie';
  } else if (state.kdramaFilter === 'airing_today') {
    endpoint = '/discover/tv'; // TMDB discover doesn't map perfectly to airing today with origin_country directly without dates, but let's just stick to default discover or use tv/airing_today with language
    // Actually simpler to just use discover with sort_by
  }
  
  if (state.kdramaFilter === 'popular') params.sort_by = 'popularity.desc';
  if (state.kdramaFilter === 'top_rated') params.sort_by = 'vote_average.desc';
  if (state.kdramaFilter === 'airing_today') params.sort_by = 'popularity.desc'; // Close enough for discover

  try {
    const data = await tmdb(endpoint, params);
    const type = state.kdramaFilter === 'movies' ? 'movie' : 'tv';
    if (!data.results || data.results.length === 0) {
      state.kdramaHasMore = false;
      showEmptyState($('#kdramaGrid'), 'No K-Drama titles found', '🇰🇷');
      $('#loadMoreKDrama').style.display = 'none';
    } else {
      renderCards($('#kdramaGrid'), data.results, type, append);
      state.kdramaHasMore = state.kdramaPage < data.total_pages;
      $('#loadMoreKDrama').style.display = 'none';
    }

    if (!state.tvGenres.length) {
      const g = await tmdb('/genre/tv/list');
      state.tvGenres = g.genres;
    }
    renderGenreBar($('#kdramaGenres'), state.tvGenres, state.kdramaGenre, 'kdrama');
  } catch (e) {
    state.kdramaHasMore = false;
    console.error('K-Drama load failed:', e);
    showErrorState($('#kdramaGrid'), 'Failed to load K-Drama titles');
    $('#loadMoreKDrama').style.display = 'none';
  } finally {
    state.kdramaLoading = false;
  }
}

async function handleInfinitePagination() {
  // Throttle scroll checks to max once per 500ms to prevent layout thrashing on fast scroll
  const now = Date.now();
  if (now - state.lastPaginationCheck < 500) return;
  state.lastPaginationCheck = now;

  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 900;
  if (!nearBottom) return;

  if ($('#view-movies')?.classList.contains('active') && state.moviesHasMore && !state.moviesLoading) {
    state.moviesPage += 1;
    await loadMovies(true);
    return;
  }

  if ($('#view-tv')?.classList.contains('active') && state.tvHasMore && !state.tvLoading) {
    state.tvPage += 1;
    await loadTV(true);
    return;
  }

  if ($('#view-kdrama')?.classList.contains('active') && state.kdramaHasMore && !state.kdramaLoading) {
    state.kdramaPage += 1;
    await loadKDrama(true);
  }
}

/* ---------- Bollywood Page ---------- */
async function loadBollywood(append = false) {
  if (!append) showView('bollywood');
  if (!append) showGridSkeleton($('#bollywoodGrid'));
  const params = { page: state.bollywoodPage, with_origin_country: 'IN', with_original_language: 'hi' };
  if (state.bollywoodGenre) params.with_genres = state.bollywoodGenre;
  
  let endpoint = '/discover/movie';
  let type = 'movie';
  if (state.bollywoodFilter === 'tv') {
    endpoint = '/discover/tv';
    type = 'tv';
  }

  if (state.bollywoodFilter === 'popular') params.sort_by = 'popularity.desc';
  if (state.bollywoodFilter === 'top_rated') params.sort_by = 'vote_average.desc';
  if (state.bollywoodFilter === 'upcoming') { params.sort_by = 'popularity.desc'; params.primary_release_date_gte = new Date().toISOString().split('T')[0]; }

  const data = await tmdb(endpoint, params);
  renderCards($('#bollywoodGrid'), data.results, type, append);
  $('#loadMoreBollywood').style.display = state.bollywoodPage < data.total_pages ? 'block' : 'none';

  if (!state.movieGenres.length) {
    const g = await tmdb('/genre/movie/list');
    state.movieGenres = g.genres;
  }
  renderGenreBar($('#bollywoodGenres'), state.movieGenres, state.bollywoodGenre, 'bollywood');
}

/* ---------- Marvel Page ---------- */
async function loadMarvel(append = false) {
  if (!append) showView('marvel');
  
  if (state.marvelTab === 'timeline') {
    $('#loadMoreMarvel').style.display = 'none';
    if (!append) $('#marvelGrid').innerHTML = '<div style="padding:40px;text-align:center;">Loading MCU Timeline...</div>';
    
    const [mov1, mov2, mov3, mov4, tv1, tv2] = await Promise.all([
      tmdb('/discover/movie', { with_companies: '420|7505', page: 1 }),
      tmdb('/discover/movie', { with_companies: '420|7505', page: 2 }),
      tmdb('/discover/movie', { with_companies: '420|7505', page: 3 }),
      tmdb('/discover/movie', { with_companies: '420|7505', page: 4 }),
      tmdb('/discover/tv', { with_companies: '420', page: 1 }), // Only 420 for TV to limit to MCU canon
      tmdb('/discover/tv', { with_companies: '420', page: 2 })
    ]);
    
    const combined = [];
    if(mov1.results) combined.push(...mov1.results.map(item => ({ ...item, isMultiSyncType: 'movie', dateValue: new Date(item.release_date || '0').getTime() })));
    if(mov2.results) combined.push(...mov2.results.map(item => ({ ...item, isMultiSyncType: 'movie', dateValue: new Date(item.release_date || '0').getTime() })));
    if(mov3.results) combined.push(...mov3.results.map(item => ({ ...item, isMultiSyncType: 'movie', dateValue: new Date(item.release_date || '0').getTime() })));
    if(mov4.results) combined.push(...mov4.results.map(item => ({ ...item, isMultiSyncType: 'movie', dateValue: new Date(item.release_date || '0').getTime() })));
    if(tv1.results) combined.push(...tv1.results.map(item => ({ ...item, isMultiSyncType: 'tv', dateValue: new Date(item.first_air_date || '0').getTime() })));
    if(tv2.results) combined.push(...tv2.results.map(item => ({ ...item, isMultiSyncType: 'tv', dateValue: new Date(item.first_air_date || '0').getTime() })));

    let sorted = [];
    if (state.marvelOrder === 'release') {
      sorted = combined.sort((a,b) => a.dateValue - b.dateValue);
      sorted = sorted.filter(i => new Date(i.release_date || i.first_air_date).getFullYear() >= 2008);
    } else {
      if (typeof MCU_CHRONO_MAP !== 'undefined') {
        for (const mcu of MCU_CHRONO_MAP) {
          const found = combined.find(item => item.id == mcu.id && item.isMultiSyncType === mcu.type);
          if (found) sorted.push(found);
        }
      }
    }

    $('#marvelGrid').innerHTML = '';
    sorted.forEach(item => {
      const type = item.isMultiSyncType;
      const title = item.title || item.name;
      const date = item.release_date || item.first_air_date || '';
      const year = date ? date.split('-')[0] : '';
      const poster = CONFIG.POSTER(item.poster_path);
      const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
      
      const card = document.createElement('div');
      card.className = 'card';
      card.onclick = () => window.location.hash = '#/' + type + '/' + item.id;
      card.innerHTML = `
        <img src="${poster}" class="card-poster" alt="${title}" loading="lazy" onerror="this.src='';this.style.background='#333';" />
        <div class="card-overlay">
          <div class="card-type-badge">${type === 'movie' ? 'Movie' : 'TV'}</div>
          <div class="card-rating">⭐ ${rating}</div>
          <div class="card-title">${title}</div>
          <div class="card-year">${year}</div>
        </div>
      `;
      $('#marvelGrid').appendChild(card);
    });

  } else {
    // Browse
    const type = state.marvelFilter;
    const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv';
    const params = { page: state.marvelPage, with_companies: '420|7505', sort_by: 'popularity.desc' };
    
    const data = await tmdb(endpoint, params);
    renderCards($('#marvelGrid'), data.results, type, append);
    $('#loadMoreMarvel').style.display = state.marvelPage < data.total_pages ? 'block' : 'none';
  }
}

/* ---------- Genre Bar ---------- */
function renderGenreBar(container, genres, activeId, type) {
  container.innerHTML = `<button class="genre-chip ${!activeId ? 'active' : ''}" data-genre="">All</button>` +
    genres.map(g => `<button class="genre-chip ${g.id == activeId ? 'active' : ''}" data-genre="${g.id}">${g.name}</button>`).join('');

  container.querySelectorAll('.genre-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const gid = btn.dataset.genre || null;
      if (type === 'movie') { state.moviesGenre = gid; state.moviesPage = 1; loadMovies(); }
      else if (type === 'tv') { state.tvGenre = gid; state.tvPage = 1; loadTV(); }
      else if (type === 'kdrama') { state.kdramaGenre = gid; state.kdramaPage = 1; loadKDrama(); }
      else if (type === 'bollywood') { state.bollywoodGenre = gid; state.bollywoodPage = 1; loadBollywood(); }
    });
  });
}

function renderHomeGenres(genres) {
  const container = $('#homeGenres');
  if (!container) return;
  
  container.innerHTML = `<button class="genre-chip ${!state.homeGenre ? 'active' : ''}" data-home-genre="">All Genres</button>` +
    genres.slice(0, 12).map(g => `<button class="genre-chip ${String(g.id) === String(state.homeGenre || '') ? 'active' : ''}" data-home-genre="${g.id}">${g.name}</button>`).join('');

  container.querySelectorAll('.genre-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      const genreId = btn.dataset.homeGenre;
      
      // Update active state
      container.querySelectorAll('.genre-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.homeGenre = genreId || null;
      state.homeGenreLabel = genreId ? btn.textContent.trim() : '';
      loadHome();
    });
  });
}

/* ---------- Detail Page ---------- */
async function loadDetail(type, id) {
  showView('detail');
  
  // Show skeleton loading state for detail page
  $('#detailContent').innerHTML = `
    <div class="detail-backdrop-wrap">
      <div class="detail-backdrop skeleton" style="background: var(--bg-secondary);"></div>
      <div class="detail-backdrop-overlay"></div>
    </div>
    <div class="detail-main">
      <div class="detail-flex">
        <div class="detail-poster">
          <div class="skeleton" style="width:100%;aspect-ratio:2/3;border-radius:10px;"></div>
        </div>
        <div class="detail-info">
          <div class="skeleton" style="height:32px;width:70%;margin-bottom:16px;"></div>
          <div class="skeleton" style="height:16px;width:30%;margin-bottom:12px;"></div>
          <div class="skeleton" style="height:60px;width:100%;margin-bottom:20px;"></div>
          <div class="skeleton" style="height:40px;width:40%;margin-bottom:20px;"></div>
        </div>
      </div>
    </div>
  `;
  
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const [detail, credits, similar, videos] = await Promise.all([
    tmdb(`/${mediaType}/${id}`),
    tmdb(`/${mediaType}/${id}/credits`),
    tmdb(`/${mediaType}/${id}/similar`),
    tmdb(`/${mediaType}/${id}/videos`),
  ]);

  const title = detail.title || detail.name;
  pushRecentViewed({
    id: detail.id,
    type: mediaType,
    title: detail.title,
    name: detail.name,
    poster_path: detail.poster_path,
    vote_average: detail.vote_average,
    release_date: detail.release_date,
    first_air_date: detail.first_air_date,
  });

  setPageTitle(title);
  const date = detail.release_date || detail.first_air_date || '';
  const year = date ? date.split('-')[0] : '';
  const durationSeconds = detail
    ? Math.max(
        0,
        Number(mediaType === 'movie'
          ? (detail.runtime || 0) * 60
          : ((detail.episode_run_time?.[0] || 0) * 60))
      )
    : 0;
  const rating = detail.vote_average ? detail.vote_average.toFixed(1) : 'N/A';
  const runtime = detail.runtime ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m` : (detail.episode_run_time?.[0] ? `${detail.episode_run_time[0]}m/ep` : '');
  const backdrop = CONFIG.BACKDROP(detail.backdrop_path);
  const poster = CONFIG.POSTER(detail.poster_path);
  const inWL = isInWatchlist(detail.id, mediaType);
  const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');

  let html = `
    <div class="detail-backdrop-wrap">
      <div class="detail-backdrop" style="background-image:url(${backdrop})"></div>
      <div class="detail-backdrop-overlay"></div>
    </div>
    <div class="detail-main">
      <div class="detail-flex">
        <div class="detail-poster">
          ${poster ? `<img src="${poster}" alt="${title}" />` : ''}
        </div>
        <div class="detail-info">
          <h1 class="detail-title">${title}</h1>
          <div class="detail-meta">
            <span class="detail-rating">⭐ ${rating}</span>
            <span>${year}</span>
            ${runtime ? `<span>${runtime}</span>` : ''}
            ${detail.status ? `<span>${detail.status}</span>` : ''}
          </div>
          <div class="detail-genres">
            ${(detail.genres || []).map(g => `<span class="detail-genre-tag">${g.name}</span>`).join('')}
          </div>
          <p class="detail-overview">${detail.overview || 'No overview available.'}</p>
          <div class="detail-actions">
            ${(() => {
              const progress = getMediaProgress(id, mediaType);
              let label = '▶ Watch Now';
              let link = `#/watch/${mediaType}/${id}`;
              if (progress) {
                label = type === 'tv' ? `▶ Continue S${progress.season}E${progress.episode}` : '▶ Continue Watching';
                if (type === 'tv' && progress.season && progress.episode) {
                   link = `#/watch/tv/${id}/${progress.season}/${progress.episode}`;
                }
              }
              return `<button class="btn-primary" onclick="window.location.hash='${link}'">${label}</button>`;
            })()}
            <button class="btn-secondary" id="detailWLBtn" onclick="detailToggleWL(${detail.id}, '${mediaType}')">
              ${inWL ? '✓ In Watchlist' : '+ Watchlist'}
            </button>
          </div>
          <div class="detail-extra">
            ${detail.spoken_languages?.length ? `<div class="detail-extra-item"><span>Language</span>${detail.spoken_languages[0].english_name}</div>` : ''}
            ${detail.budget ? `<div class="detail-extra-item"><span>Budget</span>$${(detail.budget / 1e6).toFixed(0)}M</div>` : ''}
            ${detail.revenue ? `<div class="detail-extra-item"><span>Revenue</span>$${(detail.revenue / 1e6).toFixed(0)}M</div>` : ''}
            ${detail.number_of_seasons ? `<div class="detail-extra-item"><span>Seasons</span>${detail.number_of_seasons}</div>` : ''}
            ${detail.number_of_episodes ? `<div class="detail-extra-item"><span>Episodes</span>${detail.number_of_episodes}</div>` : ''}
            ${detail.vote_count ? `<div class="detail-extra-item"><span>Votes</span>${detail.vote_count.toLocaleString()}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Cast
  const cast = credits.cast?.slice(0, 15) || [];
  if (cast.length) {
    html += `
      <div class="cast-section">
        <h2 class="section-title">Cast</h2>
        <div class="cast-scroll">
          ${cast.map(c => `
            <div class="cast-card">
              <img src="${CONFIG.PROFILE(c.profile_path)}" alt="${c.name}" onerror="this.style.background='var(--bg-card)'" loading="lazy" />
              <div class="cast-name">${c.name}</div>
              <div class="cast-character">${c.character || ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Trailer
  if (trailer) {
    html += `
      <div class="trailer-section">
        <h2 class="section-title">Trailer</h2>
        <iframe class="trailer-frame" src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen allow="autoplay; encrypted-media; fullscreen"></iframe>
      </div>
    `;
  }

  // Similar
  if (similar.results?.length) {
    html += `
      <div class="similar-section">
        <h2 class="section-title">You May Also Like</h2>
        <div class="similar-scroll" id="similarScroll"></div>
      </div>
    `;
  }

  $('#detailContent').innerHTML = html;

  // Render similar cards
  if (similar.results?.length) {
    renderCards($('#similarScroll'), similar.results.slice(0, 15), mediaType);
  }

  // Store detail for watchlist toggle
  window._curDetail = detail;
  window._curType = mediaType;
}

window.detailToggleWL = async function(id, type) {
  const d = window._curDetail;
  if (!d) return;
  const success = await toggleWatchlist({
    media_id: d.id,
    type: type,
    title: d.title || d.name,
    poster_path: d.poster_path,
    vote_average: d.vote_average,
    release_date: d.release_date || d.first_air_date
  });
  if (success) {
    const btn = $('#detailWLBtn');
    if (btn) btn.textContent = isInWatchlist(id, type) ? '✓ In Watchlist' : '+ Watchlist';
  }
};

/* ---------- Watch Page ---------- */
async function loadWatch(type, id, season = 1, episode = 1) {
  showView('watch');
  flushActiveWatchProgress();
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  let activeSeason = Number(season || 0);
  let activeEpisode = Number(episode || 0);

  // Resolve TV resume target from server first for logged-in cloud accounts.
  if (mediaType === 'tv' && (!activeSeason || !activeEpisode) && state.auth.token && !isLocalAuthToken()) {
    try {
      const resumeRes = await fetch(`${API_BASE}/progress/resume/${id}/tv`, {
        headers: { 'Authorization': `Bearer ${state.auth.token}` }
      });
      if (resumeRes.ok) {
        const resume = await resumeRes.json();
        activeSeason = Number(resume?.season || activeSeason || 1);
        activeEpisode = Number(resume?.episode || activeEpisode || 1);
      }
    } catch (e) {
      console.error('Resume lookup error:', e);
    }
  }

  // If season/episode are missing in the route, resume from latest saved TV progress.
  if (mediaType === 'tv' && (!activeSeason || !activeEpisode)) {
    const latest = getLatestProgressForMedia(id, 'tv');
    activeSeason = Number(latest?.season || 1);
    activeEpisode = Number(latest?.episode || 1);
  }

  if (mediaType === 'tv') {
    if (!activeSeason || Number.isNaN(activeSeason)) activeSeason = 1;
    if (!activeEpisode || Number.isNaN(activeEpisode)) activeEpisode = 1;
  }

  let detail, external;
  try { 
    [detail, external] = await Promise.all([
      tmdb(`/${mediaType}/${id}`),
      tmdb(`/${mediaType}/${id}/external_ids`)
    ]);
  } catch { 
    detail = null; 
    external = {};
  }
  const imdbId = external?.imdb_id || '';
  const title = detail ? (detail.title || detail.name) : 'Loading...';
  const overview = detail?.overview || '';
  const date = detail?.release_date || detail?.first_air_date || '';
  const year = date ? date.split('-')[0] : '';
  const durationSeconds = detail
    ? Math.max(
        0,
        Number(mediaType === 'movie'
          ? (detail.runtime || 0) * 60
          : ((detail.episode_run_time?.[0] || 0) * 60))
      )
    : 0;

  if (detail) {
    pushRecentViewed({
      id: detail.id,
      type: mediaType,
      title: detail.title,
      name: detail.name,
      poster_path: detail.poster_path,
      vote_average: detail.vote_average,
      release_date: detail.release_date,
      first_air_date: detail.first_air_date,
    });
  }

  // Check saved progress
  let savedPos = 0;
  if (state.auth.token) {
    if (isLocalAuthToken()) {
      const local = getLocalProgress().find((p) =>
        p.media_id == id &&
        p.type === mediaType &&
        (mediaType === 'movie' || (Number(p.season || 1) === Number(activeSeason || 1) && Number(p.episode || 1) === Number(activeEpisode || 1)))
      );
      savedPos = getProgressPosition(local || {});
    } else {
      try {
        const progressQuery = mediaType === 'tv'
          ? `?season=${activeSeason || 1}&episode=${activeEpisode || 1}`
          : '';
        const res = await fetch(`${API_BASE}/progress/${id}/${mediaType}${progressQuery}`, {
          headers: { 'Authorization': `Bearer ${state.auth.token}` }
        });
        const pData = await res.json();
        savedPos = pData.position || 0;
      } catch(e) { console.error(e); }
    }
  }

  const selectedSource = state.settings.preferred_source || 'videasy';
  const embedUrl = getEmbedUrlForSource(selectedSource, mediaType, id, activeSeason || 1, activeEpisode || 1);
  const embedSandbox = getEmbedSandboxForSource(selectedSource);

  if (window.watchInterval) clearInterval(window.watchInterval);
  window.activeWatchSession = {
    media_id: id,
    type: mediaType,
    season: mediaType === 'tv' ? Number(activeSeason || 1) : null,
    episode: mediaType === 'tv' ? Number(activeEpisode || 1) : null,
    basePosition: Number(savedPos || 0),
    duration_seconds: durationSeconds || null,
    title,
    poster_path: detail?.poster_path || null,
    release_date: detail?.release_date || detail?.first_air_date || null,
    startedAt: Date.now(),
  };

  if (state.auth.token) {
    window.watchInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - Number(window.activeWatchSession?.startedAt || Date.now())) / 1000);
      const currentPos = Number(window.activeWatchSession?.basePosition || 0) + elapsed;

      saveProgressRecord({
        media_id: id,
        type: mediaType,
        season: mediaType === 'tv' ? activeSeason : null,
        episode: mediaType === 'tv' ? activeEpisode : null,
        position: currentPos,
        duration_seconds: durationSeconds || null,
        title,
        poster_path: detail?.poster_path || null,
        release_date: detail?.release_date || detail?.first_air_date || null,
      });
    }, 15000);
  }

  let serverHtml = `
    <section class="watch-panel-section">
      <div class="watch-panel-head">
        <h3 class="watch-panel-title">Servers</h3>
        <span class="watch-panel-sub">select provider</span>
      </div>
      <div class="server-grid">
        <button class="server-btn server-option ${selectedSource === 'mappl' ? 'active' : ''}" onclick="switchServer(this, '${id}', '${mediaType}', 'mappl', ${activeSeason || 1}, ${activeEpisode || 1}, '${imdbId}')">Mappl.tv</button>
        <button class="server-btn server-option ${selectedSource === 'embedmaster' ? 'active' : ''}" onclick="switchServer(this, '${id}', '${mediaType}', 'embedmaster', ${activeSeason || 1}, ${activeEpisode || 1}, '${imdbId}')">EmbedMaster</button>
        <button class="server-btn server-option ${selectedSource === 'vidking' ? 'active' : ''}" onclick="switchServer(this, '${id}', '${mediaType}', 'vidking', ${activeSeason || 1}, ${activeEpisode || 1}, '${imdbId}')">VidKing</button>
        <button class="server-btn server-option ${selectedSource === 'videasy' ? 'active' : ''}" onclick="switchServer(this, '${id}', '${mediaType}', 'videasy', ${activeSeason || 1}, ${activeEpisode || 1}, '${imdbId}')">Videasy</button>
        <button class="server-btn server-option ${selectedSource === 'vidplus' ? 'active' : ''}" onclick="switchServer(this, '${id}', '${mediaType}', 'vidplus', ${activeSeason || 1}, ${activeEpisode || 1}, '${imdbId}')">VidPlus</button>
        <button class="server-btn server-option ${selectedSource === '111movies' ? 'active' : ''}" onclick="switchServer(this, '${id}', '${mediaType}', '111movies', ${activeSeason || 1}, ${activeEpisode || 1}, '${imdbId}')">111Movies</button>
        <button class="server-btn server-option ${selectedSource === 'cinezo' ? 'active' : ''}" onclick="switchServer(this, '${id}', '${mediaType}', 'cinezo', ${activeSeason || 1}, ${activeEpisode || 1}, '${imdbId}')">Cinezo</button>
      </div>
    </section>
  `;

  let tvControls = '';
  if (mediaType === 'tv' && detail) {
    const totalSeasons = detail.number_of_seasons || 1;
    tvControls = `
      <section class="watch-panel-section">
        <div class="watch-panel-head">
          <h3 class="watch-panel-title">Episodes</h3>
          <span class="watch-panel-sub">Season controls</span>
        </div>
        <select class="season-select" id="seasonSelect" onchange="changeSeason('${id}', this.value)">
          ${Array.from({ length: totalSeasons }, (_, i) => `<option value="${i + 1}" ${i + 1 == activeSeason ? 'selected' : ''}>Season ${i + 1}</option>`).join('')}
        </select>
        <div class="episode-grid" id="episodeGrid"></div>
      </section>
    `;
  }

  $('#watchContainer').innerHTML = `
    <div class="watch-layout">
      <div class="watch-main">
        <button class="watch-left-handle" aria-expanded="false" onclick="toggleLeftControls(this)" title="Show controls" style="border-radius:999px; padding:10px; background:rgba(0,0,0,0.6);backdrop-filter:blur(10px); position:absolute; left:18px; top:50%; transform:translateY(-50%); z-index:110;">
          <span class="left-icon">≡</span>
        </button>
        <div class="watch-floating-controls" data-expanded="true">
          <button class="btn-secondary" onclick="window.goBackFromWatch()" style="border-radius:999px; padding: 10px 16px; background:rgba(0,0,0,0.6);backdrop-filter:blur(10px)">← Back</button>
          <button class="btn-secondary" onclick="enterWatchFullscreen()" title="Fullscreen" style="border-radius:999px; padding: 10px 12px; background:rgba(0,0,0,0.6);backdrop-filter:blur(10px)">⤢</button>
          <button class="btn-secondary" onclick="document.querySelector('.watch-sidebar').classList.toggle('open')" style="border-radius:999px; padding: 10px 16px; background:rgba(0,0,0,0.6);backdrop-filter:blur(10px)">☰ ${mediaType === 'tv' ? 'Servers & Episodes' : 'Servers'}</button>
        </div>
        <div id="playerWrap" style="position:relative; width: 100vw; height: 100vh;">
          ${savedPos > 0 ? `<div id="resumeToast" style="position:absolute; bottom:20px; right:20px; background:rgba(0,0,0,0.8); color:white; padding:12px 20px; border-radius:8px; z-index:100; font-size:13px; border-left:4px solid var(--accent); display:flex; align-items:center; gap:12px; animation: slideIn 0.3s ease-out;">
            <span>Resuming from ${Math.floor(savedPos/60)}m ${savedPos%60}s</span>
            <button onclick="this.parentElement.remove()" style="color:var(--text-secondary); font-size:16px;">&times;</button>
          </div>` : ''}
          <div id="watchPlayerMount">${buildWatchPlayerHtml({ url: embedUrl, sandbox: embedSandbox })}</div>
        </div>
      </div>
      <div class="watch-sidebar">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1)">
          <div>
            <h1 class="watch-title">${title}</h1>
            <div class="watch-meta">${year}${mediaType === 'tv' ? ` • Season ${activeSeason} Episode ${activeEpisode}` : ''}</div>
          </div>
          <button onclick="document.querySelector('.watch-sidebar').classList.remove('open')" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
        </div>
        <div class="sidebar-scroll">
          ${mediaType === 'tv' ? tvControls : ''}
          ${serverHtml}
        </div>
      </div>
    </div>
  `;

  // Track History
  if (state.auth.token && detail) {
    const progressPercent = durationSeconds > 0 ? Math.round((savedPos / durationSeconds) * 100) : null;
    addHistoryItem({
      media_id: detail.id,
      type: mediaType,
      title,
      poster_path: detail.poster_path,
      season: mediaType === 'tv' ? activeSeason : null,
      episode: mediaType === 'tv' ? activeEpisode : null,
      position: savedPos,
      duration_seconds: durationSeconds || null,
      progress_percent: Number.isFinite(progressPercent) ? Math.max(0, Math.min(100, progressPercent)) : null,
    });
  }

  if (mediaType === 'tv') {
    markTvEpisodeSelection(id, activeSeason, activeEpisode);
    loadEpisodes(id, activeSeason, activeEpisode);
  }

  if (state.settings.auto_open_servers) {
    const sidebar = document.querySelector('.watch-sidebar');
    if (sidebar) sidebar.classList.add('open');
  }
}

async function loadEpisodes(id, season, currentEp) {
  try {
    const data = await tmdb(`/tv/${id}/season/${season}`);
    const grid = $('#episodeGrid');
    if (!grid) return;
    grid.innerHTML = (data.episodes || []).map(ep =>
      `<button class="ep-btn ${ep.episode_number == currentEp ? 'active' : ''}" onclick="window.goToTvEpisodeFromWatch('${id}', ${season}, ${ep.episode_number})">
         <span class="ep-num">${String(ep.episode_number).padStart(2, '0')}</span>
         <span class="ep-meta">
           <span class="ep-title">${ep.name || `Episode ${ep.episode_number}`}</span>
           <span class="ep-sub">Episode ${ep.episode_number}</span>
         </span>
       </button>`
    ).join('');
  } catch (e) { console.error(e); }
}

window.changeSeason = function(id, season) {
  window.goToTvEpisodeFromWatch(id, season, 1);
};

window.switchServer = function(btn, id, type, server, season, episode, imdbId = '') {
  $$('.server-option').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  saveUserSettings({ preferred_source: server }, true);
  const mount = $('#watchPlayerMount');
  if (!mount) return;
  const url = getEmbedUrlForSource(server, type, id, season, episode);
  const sandbox = getEmbedSandboxForSource(server);
  mount.innerHTML = buildWatchPlayerHtml({ url, sandbox });

  if (type === 'tv') {
    markTvEpisodeSelection(id, season, episode);
  }
};

/* ---------- Watchlist Page ---------- */
async function loadWatchlist() {
  showView('watchlist');
  const grid = $('#watchlistGrid');
  const empty = $('#emptyWatchlist');

  if (!state.auth.token) {
    grid.innerHTML = '';
    $('#emptyWLTitle').textContent = 'Sign in to see your watchlist';
    $('#emptyWLDesc').textContent = 'Create an account to save movies and shows for later.';
    $('#emptyWLBtn').textContent = 'Sign In';
    $('#emptyWLBtn').onclick = (e) => { e.preventDefault(); openAuthModal(); };
    empty.style.display = 'block';
    return;
  }
  
  await fetchWatchlist();
  if (!state.watchlist.length) {
    grid.innerHTML = '';
    $('#emptyWLTitle').textContent = 'Your watchlist is empty';
    $('#emptyWLDesc').textContent = 'Start adding movies and TV shows to keep track of what you want to watch.';
    $('#emptyWLBtn').textContent = 'Browse Content';
    $('#emptyWLBtn').onclick = () => { window.location.hash = '#/'; };
    empty.style.display = 'block';
    return;
  }
  
  empty.style.display = 'none';
  grid.innerHTML = '';
  state.watchlist.forEach(item => {
    grid.appendChild(createCard(item, item.type));
  });
}

/* ---------- History Page ---------- */
async function loadHistory() {
  showView('history');
  const grid = $('#historyGrid');
  const empty = $('#emptyHistory');

  if (!state.auth.token) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  
  try {
    await fetchProgress(); // Refresh progress to show continue states in cards
    let history = [];
    if (isLocalAuthToken()) {
      history = getLocalHistory();
    } else {
      const hRes = await fetch(API_BASE + '/history', { headers: { 'Authorization': `Bearer ${state.auth.token}` } });
      history = await hRes.json();
    }

    if (!history || !history.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    // History payloads can be minimal; hydrate with TMDB details for rich cards/previews.
    const hydrated = await Promise.allSettled(
      history.map(async (entry) => {
        const mediaType = entry.type === 'tv' ? 'tv' : 'movie';
        const mediaId = entry.media_id || entry.id;
        if (!mediaId) return entry;
        try {
          const detail = await tmdb(`/${mediaType}/${mediaId}`);
          return {
            ...entry,
            ...detail,
            id: detail.id || mediaId,
            media_id: mediaId,
            type: mediaType,
          };
        } catch {
          return {
            ...entry,
            id: mediaId,
            media_id: mediaId,
            type: mediaType,
          };
        }
      })
    );

    empty.style.display = 'none';
    grid.innerHTML = '';
    hydrated.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const item = result.value;
        grid.appendChild(createCard(item, item.type));
      }
    });
  } catch(e) {
    grid.innerHTML = '';
    empty.style.display = 'block';
  }
}

/* ---------- Search ---------- */
let searchTimeout;
function setupSearch() {
  const box = $('.search-box');
  const input = $('#searchInput');
  const results = $('#searchResults');

  box.addEventListener('click', (e) => {
    if (e.target !== input) {
      input.focus();
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim() === '') box.classList.remove('has-text');
  });

  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = input.value.trim();
    if (q !== '') box.classList.add('has-text');
    else box.classList.remove('has-text');
    
    if (q.length < 2) { results.classList.remove('active'); return; }
    searchTimeout = setTimeout(async () => {
      const data = await tmdb('/search/multi', { query: q });
      if (!data.results?.length) { results.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">No results</div>'; results.classList.add('active'); return; }
      results.innerHTML = data.results.slice(0, 8).map(item => {
        const title = item.title || item.name || '';
        const type = item.media_type || 'movie';
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const poster = CONFIG.POSTER(item.poster_path);
        if (type === 'person') return '';
        return `
          <div class="search-result-item" data-type="${type}" data-id="${item.id}">
            ${poster ? `<img src="${poster}" alt="" />` : '<div style="width:40px;height:56px;background:var(--bg-card);border-radius:4px"></div>'}
            <div class="search-result-info">
              <h4>${title}</h4>
              <span>${type.toUpperCase()} · ${year}</span>
            </div>
          </div>
        `;
      }).join('');
      results.classList.add('active');

      results.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => {
          window.location.hash = `#/${el.dataset.type}/${el.dataset.id}`;
          results.classList.remove('active');
          input.value = '';
          box.classList.remove('has-text');
        });
      });
    }, 400);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q.length >= 2) {
        window.location.hash = `#/search/${encodeURIComponent(q)}`;
        results.classList.remove('active');
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) results.classList.remove('active');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape') {
      results.classList.remove('active');
      input.blur();
    }
  });
}

async function loadSearchResults(query, append = false) {
  showView('search');
  $('#searchTitle').textContent = `Results for "${query}"`;
  state.searchQuery = query;
  const data = await tmdb('/search/multi', { query, page: state.searchPage });
  const items = data.results.filter(i => i.media_type !== 'person');
  const grid = $('#searchGrid');
  if (!append) grid.innerHTML = '';
  items.forEach(item => {
    const type = item.media_type || 'movie';
    grid.appendChild(createCard(item, type));
  });
  $('#loadMoreSearch').style.display = state.searchPage < data.total_pages ? 'block' : 'none';
}

/* ---------- Router ---------- */
function route() {
  const hash = window.location.hash || '#/';
  
  // Anti-Adware Defense: if the view is Watch and the hash gets cleared maliciously, ignore it.
  if ((hash === '' || hash === '#' || hash === '#/') && $('#view-watch').classList.contains('active')) {
    // Usually ad-scripts try to clear the hash to trap the user. Ignore this routing event to keep the player open.
    return;
  }

  const parts = hash.replace('#/', '').split('/');
  const page = parts[0] || '';

  const watchWasActive = $('#view-watch')?.classList.contains('active');
  if (page !== 'watch' && watchWasActive) {
    stopWatchPlayback();
  }

  if (page !== 'watch') {
    state.lastNonWatchHash = (hash === '' || hash === '#' || hash === '#/') ? '#/home' : hash;
  }

  // Close mobile nav
  $('#navLinks').classList.remove('open');

  // Update active nav link
  const navLinks = $$('.nav-link');
  navLinks.forEach(link => {
    const linkPage = link.getAttribute('data-page');
    if ((page === '' || page === 'home') && linkPage === 'home') {
      link.classList.add('active');
    } else if (page === linkPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  hideLoader();

  switch (page) {
    case '':
    case 'home':
      setPageTitle();
      loadHome();
      break;
    case 'movies':
      setPageTitle('Movies');
      state.moviesPage = 1;
      state.moviesGenre = null;
      loadMovies();
      break;
    case 'tv':
      if (parts[1]) {
        loadDetail('tv', parts[1]);
      } else {
        setPageTitle('TV Shows');
        state.tvPage = 1;
        state.tvGenre = null;
        loadTV();
      }
      break;
    case 'movie':
      if (parts[1]) loadDetail('movie', parts[1]);
      else { setPageTitle('Movies'); state.moviesPage = 1; loadMovies(); }
      break;
    case 'anime':
      // Anime is temporarily disabled in navigation.
      window.location.hash = '#/home';
      break;
    case 'watch':
      if (parts[1] && parts[2]) {
        const type = parts[1];
        const id = parts[2];
        const season = parts[3] || null;
        const episode = parts[4] || null;
        if (type === 'anime') {
          window.location.hash = '#/home';
        } else {
          loadWatch(type, id, season, episode);
        }
      }
      break;
    case 'watchlist':
      setPageTitle('Watchlist');
      loadWatchlist();
      break;
    case 'history':
      setPageTitle('History');
      loadHistory();
      break;
    case 'search':
      if (parts[1]) {
        setPageTitle('Search');
        state.searchPage = 1;
        loadSearchResults(decodeURIComponent(parts[1]));
      }
      break;
    case 'kdrama':
      setPageTitle('K-Drama');
      state.kdramaPage = 1;
      state.kdramaFilter = 'popular';
      loadKDrama();
      break;
    case 'bollywood':
      setPageTitle('Bollywood');
      state.bollywoodPage = 1;
      state.bollywoodFilter = 'popular';
      loadBollywood();
      break;
    case 'marvel':
      setPageTitle('Marvel');
      state.marvelPage = 1;
      loadMarvel();
      break;
    default:
      setPageTitle('404');
      showView('404');
  }
}

window.goBackFromWatch = function() {
  stopWatchPlayback();
  const fallbackHash = state.lastNonWatchHash || '#/home';
  window.location.hash = fallbackHash;
};

/* ---------- Events ---------- */
function setupEvents() {
  // Navbar scroll + Back to top
  const backBtn = $('#backToTop');
  let lastNavbarScrollCheck = 0;
  
  window.addEventListener('scroll', () => {
    const now = Date.now();
    if (now - lastNavbarScrollCheck < 100) return;
    lastNavbarScrollCheck = now;
    
    const nav = $('#navbar');
    nav.classList.toggle('scrolled', window.scrollY > 50);
    if (backBtn) backBtn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });
  if (backBtn) backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Mobile toggle
  $('#mobileToggle').addEventListener('click', () => {
    $('#navLinks').classList.toggle('open');
  });

  const settingsBtn = $('#navSettingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

  const settingsSaveBtn = $('#settingsSaveBtn');
  if (settingsSaveBtn) settingsSaveBtn.addEventListener('click', handleSettingsSave);

  const settingsOverlay = $('#settingsModal');
  if (settingsOverlay) {
    settingsOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') closeSettingsModal();
    });
  }

  // Filter clicks (Movies)
  $('#movieFilters').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-chip')) return;
    $$('#movieFilters .filter-chip').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.moviesFilter = e.target.dataset.filter;
    state.moviesPage = 1;
    state.moviesGenre = null;
    loadMovies();
  });

  // Filter clicks (TV)
  $('#tvFilters').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-chip')) return;
    $$('#tvFilters .filter-chip').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.tvFilter = e.target.dataset.filter;
    state.tvPage = 1;
    state.tvGenre = null;
    loadTV();
  });

  if ($('#animeFilters')) {
    $('#animeFilters').addEventListener('click', (e) => {
      if (!e.target.classList.contains('filter-chip')) return;
      $$('#animeFilters .filter-chip').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.animeFilter = e.target.dataset.filter;
      state.animePage = 1;
      state.animeQuery = '';
      const searchInput = $('#animeSearchInput');
      if (searchInput) searchInput.value = '';
      loadAnime();
    });
  }

  const animeSearchBtn = $('#animeSearchBtn');
  const animeSearchInput = $('#animeSearchInput');
  if (animeSearchBtn && animeSearchInput) {
    const triggerAnimeSearch = () => {
      state.animeQuery = animeSearchInput.value.trim();
      state.animePage = 1;
      state.animeFilter = state.animeQuery ? 'search' : 'featured';
      loadAnime();
    };
    animeSearchBtn.addEventListener('click', triggerAnimeSearch);
    animeSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerAnimeSearch();
      }
    });
  }

  // Filter clicks (K-Drama)
  $('#kdramaFilters').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-chip')) return;
    $$('#kdramaFilters .filter-chip').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.kdramaFilter = e.target.dataset.filter;
    state.kdramaPage = 1;
    state.kdramaGenre = null;
    loadKDrama();
  });

  // Filter clicks (Bollywood)
  $('#bollywoodFilters').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-chip')) return;
    $$('#bollywoodFilters .filter-chip').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.bollywoodFilter = e.target.dataset.filter;
    state.bollywoodPage = 1;
    state.bollywoodGenre = null;
    loadBollywood();
  });

  // Load More
  const moviesLoadMoreBtn = $('#loadMoreMovies');
  if (moviesLoadMoreBtn) moviesLoadMoreBtn.style.display = 'none';
  const tvLoadMoreBtn = $('#loadMoreTV');
  if (tvLoadMoreBtn) tvLoadMoreBtn.style.display = 'none';
  if ($('#loadMoreAnime')) {
    $('#loadMoreAnime').addEventListener('click', () => {
      state.animePage++;
      loadAnime(true);
    });
  }
  const kdramaLoadMoreBtn = $('#loadMoreKDrama');
  if (kdramaLoadMoreBtn) kdramaLoadMoreBtn.style.display = 'none';
  $('#loadMoreBollywood').addEventListener('click', () => {
    state.bollywoodPage++;
    loadBollywood(true);
  });

  // Infinite pagination scroll (heavily throttled to prevent layout thrashing)
  let lastInfiniteScroll = 0;
  window.addEventListener('scroll', () => {
    const now = Date.now();
    if (now - lastInfiniteScroll < 500) return;
    lastInfiniteScroll = now;
    handleInfinitePagination();
  }, { passive: true });

  // Filter clicks (Marvel Tabs)
  $('#marvelTabs').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-chip')) return;
    $$('#marvelTabs .filter-chip').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.marvelTab = e.target.dataset.tab;
    
    if(state.marvelTab === 'browse') {
      $('#marvelBrowseFilters').style.display = 'flex';
      $('#marvelTimelineFilters').style.display = 'none';
      $('#loadMoreMarvel').style.display = 'block';
    } else {
      $('#marvelBrowseFilters').style.display = 'none';
      $('#marvelTimelineFilters').style.display = 'flex';
      $('#loadMoreMarvel').style.display = 'none';
    }
    state.marvelPage = 1;
    loadMarvel();
  });

  $('#marvelBrowseFilters').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-chip')) return;
    $$('#marvelBrowseFilters .filter-chip').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.marvelFilter = e.target.dataset.filter;
    state.marvelPage = 1;
    loadMarvel();
  });

  $('#marvelTimelineFilters').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-chip')) return;
    $$('#marvelTimelineFilters .filter-chip').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.marvelOrder = e.target.dataset.order;
    loadMarvel();
  });

  // Load More (Marvel)
  $('#loadMoreMarvel').addEventListener('click', () => {
    state.marvelPage++;
    loadMarvel(true);
  });
  $('#loadMoreSearch').addEventListener('click', () => {
    state.searchPage++;
    loadSearchResults(state.searchQuery, true);
  });

  // Hash routing
  window.addEventListener('hashchange', route);

  // Persist latest playback position when tab/app is closed or backgrounded.
  window.addEventListener('beforeunload', () => flushActiveWatchProgress({ urgent: true }));
  window.addEventListener('pagehide', () => flushActiveWatchProgress({ urgent: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushActiveWatchProgress({ urgent: true });
  });
}

/* ---------- Loader ---------- */
function hideLoader() {
  const loader = $('#loader');
  if (loader) loader.classList.add('hidden');
}

/* ---------- Init ---------- */
async function init() {
  try {
    loadSettingsFromStorage();
    setupSearch();
    setupEvents();
    refreshDynamicUI();

    // Pause hero rotation when tab is hidden.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(state.heroInterval);
      } else if (state.heroItems.length) {
        startHeroRotation();
      }
    });

    await initUser();
    await loadHero();
  } catch (e) {
    console.error('Init error:', e);
  } finally {
    hideLoader();
    route();
  }
}

document.addEventListener('DOMContentLoaded', init);
