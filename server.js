const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'super_secret_movie_key_123'; // In a real app, use environment variables
const HIANIME_LOCAL_PORT = Number(process.env.HIANIME_LOCAL_PORT || 4444);
const HIANIME_PROXY_BASE = process.env.HIANIME_PROXY_BASE || `http://127.0.0.1:${HIANIME_LOCAL_PORT}/api`;
const COMPLETE_PERCENT_THRESHOLD = 95;
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'database.sqlite');

// If no explicit upstream is configured, run the JustAnimeCore API locally.
let hianimeSidecar = null;
function startLocalHiAnimeApi() {
  if (process.env.HIANIME_PROXY_BASE) return;

  const sidecarPath = path.join(__dirname, 'node_modules', 'HiAnime-Api', 'server.js');
  if (!fs.existsSync(sidecarPath)) {
    console.warn('HiAnime sidecar not found at node_modules/HiAnime-Api/server.js; anime proxy may be unavailable.');
    return;
  }

  hianimeSidecar = spawn(process.execPath, [sidecarPath], {
    env: {
      ...process.env,
      PORT: String(HIANIME_LOCAL_PORT),
      ALLOWED_ORIGINS: '*'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  hianimeSidecar.stdout.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) console.log(`[HiAnime] ${text}`);
  });

  hianimeSidecar.stderr.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) console.error(`[HiAnime] ${text}`);
  });

  hianimeSidecar.on('exit', (code) => {
    console.warn(`HiAnime sidecar exited with code ${code}`);
  });
}

function normalizeProgressPayload(body = {}) {
  const mediaId = Number(body.media_id);
  const type = String(body.type || '').toLowerCase();
  const rawSeason = body.season;
  const rawEpisode = body.episode;
  let season = rawSeason == null || rawSeason === '' ? null : Number(rawSeason);
  let episode = rawEpisode == null || rawEpisode === '' ? null : Number(rawEpisode);
  const position = Math.max(0, Number(body.position || 0));

  // Keep a stable conflict key in SQLite: avoid NULLs in unique columns.
  if (type === 'tv') {
    season = Number.isFinite(season) && season > 0 ? season : 1;
    episode = Number.isFinite(episode) && episode > 0 ? episode : 1;
  } else {
    season = 0;
    episode = 0;
  }

  const durationRaw = Number(body.duration_seconds ?? body.durationSeconds ?? body.duration ?? 0);
  const durationSeconds = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : null;

  let progressPercent = Number(body.progress_percent ?? body.progressPercent);
  if (!Number.isFinite(progressPercent) && durationSeconds && durationSeconds > 0) {
    progressPercent = Math.round((position / durationSeconds) * 100);
  }
  if (Number.isFinite(progressPercent)) {
    progressPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));
  } else {
    progressPercent = null;
  }

  const completed = body.completed != null
    ? Number(!!body.completed)
    : Number((progressPercent ?? 0) >= COMPLETE_PERCENT_THRESHOLD);

  return {
    mediaId,
    type,
    season,
    episode,
    position: Math.round(position),
    durationSeconds,
    progressPercent,
    completed,
    title: typeof body.title === 'string' ? body.title.trim() : '',
    posterPath: typeof body.poster_path === 'string' ? body.poster_path : null,
    releaseDate: typeof body.release_date === 'string' ? body.release_date : null,
  };
}

function withOptionalTvFilters(baseQuery, params, season, episode) {
  let query = baseQuery;

  if (season != null && season !== '') {
    query += ' AND season = ?';
    params.push(Number(season));
  }

  if (episode != null && episode !== '') {
    query += ' AND episode = ?';
    params.push(Number(episode));
  }

  return query;
}

// Middleware
app.use(express.json());
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '')));

// Anime API proxy to avoid route collision with local /api auth routes and CORS issues.
async function proxyHiAnime(req, res, suffix = '') {
  try {
    const upstreamUrl = new URL(`${HIANIME_PROXY_BASE}${suffix}`);
    Object.entries(req.query || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((item) => upstreamUrl.searchParams.append(k, item));
      } else if (v != null) {
        upstreamUrl.searchParams.set(k, String(v));
      }
    });

    const upstreamResp = await fetch(upstreamUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });

    const bodyText = await upstreamResp.text();
    const contentType = upstreamResp.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(upstreamResp.status);
    res.setHeader('content-type', contentType);
    res.send(bodyText);
  } catch (err) {
    console.error('Anime proxy error:', err);
    res.status(502).json({ success: false, message: 'Anime proxy unavailable' });
  }
}

app.get(/^\/api\/anime(?:\/(.*))?$/, (req, res) => {
  const suffix = req.params[0] ? `/${req.params[0]}` : '';
  proxyHiAnime(req, res, suffix);
});

// Database Setup
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log(`Connected to SQLite database at ${DB_PATH}.`);
});

// Initialize Tables
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA busy_timeout = 5000');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      theme TEXT NOT NULL DEFAULT 'cinematic',
      preferred_source TEXT NOT NULL DEFAULT 'meowtv',
      autoplay_next INTEGER NOT NULL DEFAULT 1,
      auto_open_servers INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      media_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_path TEXT,
      vote_average REAL,
      release_date TEXT,
      UNIQUE(user_id, media_id, type),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      media_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_path TEXT,
      season INTEGER,
      episode INTEGER,
      last_position INTEGER,
      duration_seconds INTEGER,
      progress_percent INTEGER,
      watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Progress table for tracking playback position
  db.run(`
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      media_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      season INTEGER,
      episode INTEGER,
      last_position INTEGER NOT NULL,
      duration_seconds INTEGER,
      progress_percent INTEGER,
      completed INTEGER NOT NULL DEFAULT 0,
      title TEXT,
      poster_path TEXT,
      release_date TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, media_id, type, season, episode),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Lightweight schema migration for existing installs.
  db.all('PRAGMA table_info(progress)', (err, cols) => {
    if (err || !Array.isArray(cols)) return;
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has('duration_seconds')) {
      db.run('ALTER TABLE progress ADD COLUMN duration_seconds INTEGER');
    }
    if (!colNames.has('progress_percent')) {
      db.run('ALTER TABLE progress ADD COLUMN progress_percent INTEGER');
    }
    if (!colNames.has('completed')) {
      db.run('ALTER TABLE progress ADD COLUMN completed INTEGER NOT NULL DEFAULT 0');
    }
    if (!colNames.has('title')) {
      db.run('ALTER TABLE progress ADD COLUMN title TEXT');
    }
    if (!colNames.has('poster_path')) {
      db.run('ALTER TABLE progress ADD COLUMN poster_path TEXT');
    }
    if (!colNames.has('release_date')) {
      db.run('ALTER TABLE progress ADD COLUMN release_date TEXT');
    }
  });

  db.all('PRAGMA table_info(history)', (err, cols) => {
    if (err || !Array.isArray(cols)) return;
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has('season')) {
      db.run('ALTER TABLE history ADD COLUMN season INTEGER');
    }
    if (!colNames.has('episode')) {
      db.run('ALTER TABLE history ADD COLUMN episode INTEGER');
    }
    if (!colNames.has('last_position')) {
      db.run('ALTER TABLE history ADD COLUMN last_position INTEGER');
    }
    if (!colNames.has('duration_seconds')) {
      db.run('ALTER TABLE history ADD COLUMN duration_seconds INTEGER');
    }
    if (!colNames.has('progress_percent')) {
      db.run('ALTER TABLE history ADD COLUMN progress_percent INTEGER');
    }
  });

  db.run('CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_history_user_watched_at ON history(user_id, watched_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_progress_user_updated_at ON progress(user_id, updated_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_progress_user_media_type ON progress(user_id, media_id, type)');
});

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ==== ROUTES ====

// 1. Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
    if (row) return res.status(400).json({ error: 'Username already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      const token = jwt.sign({ id: this.lastID, username }, SECRET_KEY, { expiresIn: '7d' });
      res.json({ token, username });
    });
  });
});

// 2. Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (!user) return res.status(400).json({ error: 'Invalid username or password' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid username or password' });
    
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  });
});

// 3. User Info
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ username: req.user.username });
});

// 4. User Settings
app.get('/api/settings', authenticateToken, (req, res) => {
  const defaults = {
    theme: 'cinematic',
    preferred_source: 'meowtv',
    autoplay_next: 1,
    auto_open_servers: 0,
  };

  db.get('SELECT theme, preferred_source, autoplay_next, auto_open_servers FROM user_settings WHERE user_id = ?', [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (row) {
      return res.json({
        theme: row.theme,
        preferred_source: row.preferred_source,
        autoplay_next: !!row.autoplay_next,
        auto_open_servers: !!row.auto_open_servers,
      });
    }

    db.run(
      'INSERT INTO user_settings (user_id, theme, preferred_source, autoplay_next, auto_open_servers) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, defaults.theme, defaults.preferred_source, defaults.autoplay_next, defaults.auto_open_servers],
      (insertErr) => {
        if (insertErr) return res.status(500).json({ error: 'Database error' });
        res.json({
          theme: defaults.theme,
          preferred_source: defaults.preferred_source,
          autoplay_next: !!defaults.autoplay_next,
          auto_open_servers: !!defaults.auto_open_servers,
        });
      }
    );
  });
});

app.patch('/api/settings', authenticateToken, (req, res) => {
  const allowedThemes = new Set(['cinematic', 'midnight', 'light']);
  const allowedSources = new Set(['meowtv', 'mappl', 'embedmaster', 'vidking', 'videasy', 'cinezo', 'vidplus', '111movies']);

  const inputTheme = req.body.theme;
  const inputPreferredSource = req.body.preferred_source;
  const inputAutoplayNext = req.body.autoplay_next;
  const inputAutoOpenServers = req.body.auto_open_servers;

  const theme = allowedThemes.has(inputTheme) ? inputTheme : 'cinematic';
  const preferredSource = allowedSources.has(inputPreferredSource) ? inputPreferredSource : 'meowtv';
  const autoplayNext = inputAutoplayNext ? 1 : 0;
  const autoOpenServers = inputAutoOpenServers ? 1 : 0;

  const stmt = `
    INSERT INTO user_settings (user_id, theme, preferred_source, autoplay_next, auto_open_servers)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      theme = excluded.theme,
      preferred_source = excluded.preferred_source,
      autoplay_next = excluded.autoplay_next,
      auto_open_servers = excluded.auto_open_servers,
      updated_at = CURRENT_TIMESTAMP
  `;

  db.run(stmt, [req.user.id, theme, preferredSource, autoplayNext, autoOpenServers], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({
      success: true,
      settings: {
        theme,
        preferred_source: preferredSource,
        autoplay_next: !!autoplayNext,
        auto_open_servers: !!autoOpenServers,
      }
    });
  });
});

// ==== WATCHLIST ====

// Get Watchlist
app.get('/api/watchlist', authenticateToken, (req, res) => {
  db.all('SELECT * FROM watchlist WHERE user_id = ? ORDER BY id DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Add to Watchlist
app.post('/api/watchlist', authenticateToken, (req, res) => {
  const { media_id, type, title, poster_path, vote_average, release_date } = req.body;
  if (!media_id || !type || !title) return res.status(400).json({ error: 'Missing required fields' });

  db.run(
    'INSERT OR IGNORE INTO watchlist (user_id, media_id, type, title, poster_path, vote_average, release_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, media_id, type, title, poster_path, vote_average, release_date],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, message: 'Added to watchlist' });
    }
  );
});

// Remove from Watchlist
app.delete('/api/watchlist/:id/:type', authenticateToken, (req, res) => {
  const { id, type } = req.params;
  db.run('DELETE FROM watchlist WHERE user_id = ? AND media_id = ? AND type = ?', [req.user.id, id, type], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, message: 'Removed from watchlist' });
  });
});

// Check if in Watchlist
app.get('/api/watchlist/:id/:type', authenticateToken, (req, res) => {
  const { id, type } = req.params;
  db.get('SELECT id FROM watchlist WHERE user_id = ? AND media_id = ? AND type = ?', [req.user.id, id, type], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ inWatchlist: !!row });
  });
});

// ==== HISTORY ====

// Get History
app.get('/api/history', authenticateToken, (req, res) => {
  db.all(
    'SELECT media_id, type, title, poster_path, MAX(watched_at) as watched_at FROM history WHERE user_id = ? GROUP BY media_id, type ORDER BY watched_at DESC LIMIT 50', 
    [req.user.id], 
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

// Log History
app.post('/api/history', authenticateToken, (req, res) => {
  const { media_id, type, title, poster_path, season, episode, position, duration_seconds, progress_percent } = req.body;
  if (!media_id || !type || !title) return res.status(400).json({ error: 'Missing required fields' });

  db.run(
    'INSERT INTO history (user_id, media_id, type, title, poster_path, season, episode, last_position, duration_seconds, progress_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, media_id, type, title, poster_path, season || null, episode || null, Number(position || 0) || null, Number(duration_seconds || 0) || null, Number(progress_percent || 0) || null],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, message: 'History logged' });
    }
  );
});

// ==== PROGRESS ==== //
// Save or update playback progress (heartbeat style: periodic writes during playback).
app.post('/api/progress', authenticateToken, (req, res) => {
  const payload = normalizeProgressPayload(req.body);
  if (!payload.mediaId || !payload.type || payload.position == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const stmt = `INSERT INTO progress (user_id, media_id, type, season, episode, last_position, duration_seconds, progress_percent, completed, title, poster_path, release_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, media_id, type, season, episode) DO UPDATE SET
                  last_position=excluded.last_position,
                  duration_seconds=excluded.duration_seconds,
                  progress_percent=excluded.progress_percent,
                  completed=excluded.completed,
                  title=COALESCE(excluded.title, progress.title),
                  poster_path=COALESCE(excluded.poster_path, progress.poster_path),
                  release_date=COALESCE(excluded.release_date, progress.release_date),
                  updated_at=CURRENT_TIMESTAMP`;

  db.run(
    stmt,
    [
      req.user.id,
      payload.mediaId,
      payload.type,
      payload.season,
      payload.episode,
      payload.position,
      payload.durationSeconds,
      payload.progressPercent,
      payload.completed,
      payload.title || null,
      payload.posterPath,
      payload.releaseDate,
    ],
    function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
      res.json({
        success: true,
        message: 'Progress saved',
        progress: {
          media_id: payload.mediaId,
          type: payload.type,
          season: payload.season,
          episode: payload.episode,
          position: payload.position,
          duration_seconds: payload.durationSeconds,
          progress_percent: payload.progressPercent,
          completed: !!payload.completed,
          title: payload.title || '',
          poster_path: payload.posterPath,
          release_date: payload.releaseDate,
        }
      });
    }
  );
});

// Retrieve all progress for the user
app.get('/api/progress', authenticateToken, (req, res) => {
  db.all('SELECT * FROM progress WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json((rows || []).map((row) => ({
      ...row,
      position: row.last_position,
      completed: !!row.completed,
    })));
  });
});

// Retrieve latest progress for a media item
app.get('/api/progress/:media_id/:type', authenticateToken, (req, res) => {
  const { media_id, type } = req.params;
  const { season, episode } = req.query;

  const params = [req.user.id, media_id, type];
  const baseQuery = 'SELECT * FROM progress WHERE user_id = ? AND media_id = ? AND type = ?';
  const query = `${withOptionalTvFilters(baseQuery, params, season, episode)} ORDER BY updated_at DESC LIMIT 1`;

  db.get(query, params, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) {
      return res.json({
        position: 0,
        season: type === 'tv' ? (season != null ? Number(season) : 1) : null,
        episode: type === 'tv' ? (episode != null ? Number(episode) : 1) : null,
        duration_seconds: null,
        progress_percent: 0,
        completed: false,
      });
    }

    res.json({
      position: row.last_position,
      season: row.type === 'tv' ? row.season : null,
      episode: row.type === 'tv' ? row.episode : null,
      duration_seconds: row.duration_seconds,
      progress_percent: row.progress_percent ?? 0,
      completed: !!row.completed,
      title: row.title || '',
      poster_path: row.poster_path,
      release_date: row.release_date,
      updated_at: row.updated_at,
    });
  });
});

// Retrieve resume target for a title (latest episode for TV or movie position).
app.get('/api/progress/resume/:media_id/:type', authenticateToken, (req, res) => {
  const { media_id, type } = req.params;
  const mediaType = String(type || '').toLowerCase();
  if (!media_id || !['movie', 'tv'].includes(mediaType)) {
    return res.status(400).json({ error: 'Invalid media id or type' });
  }

  const query = `
    SELECT *
    FROM progress
    WHERE user_id = ? AND media_id = ? AND type = ?
    ORDER BY datetime(updated_at) DESC, season DESC, episode DESC, last_position DESC
    LIMIT 1
  `;

  db.get(query, [req.user.id, media_id, mediaType], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) {
      return res.json({
        media_id: Number(media_id),
        type: mediaType,
        season: mediaType === 'tv' ? 1 : null,
        episode: mediaType === 'tv' ? 1 : null,
        position: 0,
        progress_percent: 0,
        completed: false,
      });
    }

    res.json({
      media_id: row.media_id,
      type: row.type,
      season: row.type === 'tv' ? row.season : null,
      episode: row.type === 'tv' ? row.episode : null,
      position: row.last_position,
      duration_seconds: row.duration_seconds,
      progress_percent: row.progress_percent ?? 0,
      completed: !!row.completed,
      title: row.title || '',
      poster_path: row.poster_path,
      release_date: row.release_date,
      updated_at: row.updated_at,
    });
  });
});

// Continue Watching feed: latest in-progress entry per title.
app.get('/api/continue-watching', authenticateToken, (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 24)));
  const query = `
    SELECT p.media_id, p.type, p.season, p.episode, p.last_position,
           p.duration_seconds, p.progress_percent, p.completed, p.updated_at,
           COALESCE(NULLIF(p.title, ''), h.title, '') AS title,
           COALESCE(p.poster_path, h.poster_path) AS poster_path,
           p.release_date
    FROM progress p
    LEFT JOIN history h
      ON h.user_id = p.user_id AND h.media_id = p.media_id AND h.type = p.type
     AND h.watched_at = (
       SELECT MAX(h2.watched_at)
       FROM history h2
       WHERE h2.user_id = p.user_id AND h2.media_id = p.media_id AND h2.type = p.type
     )
    WHERE p.user_id = ?
      AND COALESCE(p.completed, 0) = 0
      AND p.updated_at = (
        SELECT MAX(p2.updated_at)
        FROM progress p2
        WHERE p2.user_id = p.user_id
          AND p2.media_id = p.media_id
          AND p2.type = p.type
      )
    ORDER BY datetime(p.updated_at) DESC
    LIMIT ?
  `;

  db.all(query, [req.user.id, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json((rows || []).map((row) => ({
      media_id: row.media_id,
      type: row.type,
      season: row.season,
      episode: row.episode,
      position: row.last_position,
      duration_seconds: row.duration_seconds,
      progress_percent: row.progress_percent ?? 0,
      completed: !!row.completed,
      updated_at: row.updated_at,
      title: row.title,
      poster_path: row.poster_path,
      release_date: row.release_date,
    })));
  });
});


// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  startLocalHiAnimeApi();
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Anime proxy base: ${HIANIME_PROXY_BASE}`);
});

function shutdownSidecar() {
  if (hianimeSidecar && !hianimeSidecar.killed) {
    hianimeSidecar.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  shutdownSidecar();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdownSidecar();
  process.exit(0);
});
