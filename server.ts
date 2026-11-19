import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve real persistent SQLite storage directory:
 * - Windows: C:\jankenfit\jankenfit.db
 * - Android Capacitor APK (native layer): Android/data/com.janken.fit/files/jankenfit.db
 * - Linux/macOS/Container: ./data/jankenfit/jankenfit.db (or JANKENFIT_DATA_DIR)
 */
function resolveDataDirectory(): string {
  if (process.env.JANKENFIT_DATA_DIR) {
    return path.resolve(process.env.JANKENFIT_DATA_DIR);
  }
  if (process.platform === 'win32') {
    return path.join('C:\\', 'jankenfit');
  }
  return path.resolve(__dirname, 'data', 'jankenfit');
}

const dataDir = resolveDataDirectory();
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'jankenfit.db');

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS app_state (
    state_key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    due_time TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wellness_logs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    mood TEXT,
    note TEXT,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    date_key TEXT NOT NULL,
    logged_at TEXT NOT NULL
  );
`);

function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code >= 1 && code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Light Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mild Conditions';
}

async function fetchLiveWeather(params: { lat?: number; lon?: number; city?: string }) {
  let latitude = params.lat;
  let longitude = params.lon;
  let cityLabel = params.city?.trim() || 'Local Area';
  let countryLabel = '';

  if ((latitude === undefined || longitude === undefined) && params.city) {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      params.city.trim()
    )}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      throw new Error(`Geocoding request failed (${geoRes.status})`);
    }
    const geoJson = (await geoRes.json()) as {
      results?: Array<{ name: string; country?: string; latitude: number; longitude: number }>;
    };
    const match = geoJson.results?.[0];
    if (!match) {
      throw new Error(`Location "${params.city}" not found.`);
    }
    latitude = match.latitude;
    longitude = match.longitude;
    cityLabel = match.name;
    countryLabel = match.country ?? '';
  }

  if (latitude === undefined || longitude === undefined) {
    throw new Error('Provide either city or lat/lon coordinates.');
  }

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
    String(latitude)
  )}&longitude=${encodeURIComponent(
    String(longitude)
  )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;

  const wxRes = await fetch(forecastUrl);
  if (!wxRes.ok) {
    throw new Error(`Weather forecast request failed (${wxRes.status})`);
  }
  const wxJson = (await wxRes.json()) as {
    current?: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      precipitation: number;
      weather_code: number;
      wind_speed_10m: number;
    };
  };

  if (!wxJson.current) {
    throw new Error('Weather provider returned empty current conditions.');
  }

  return {
    city: cityLabel,
    country: countryLabel,
    latitude,
    longitude,
    temperatureC: Math.round(wxJson.current.temperature_2m * 10) / 10,
    apparentTempC: Math.round(wxJson.current.apparent_temperature * 10) / 10,
    humidityPct: Math.round(wxJson.current.relative_humidity_2m),
    windKmh: Math.round(wxJson.current.wind_speed_10m * 10) / 10,
    precipitationMm: Math.round(wxJson.current.precipitation * 10) / 10,
    weatherCode: wxJson.current.weather_code,
    conditionLabel: describeWeatherCode(wxJson.current.weather_code),
    observedAt: wxJson.current.time,
    provider: 'Open-Meteo Live API',
  };
}

function getStorageMetadata() {
  return {
    appName: 'JANKENFIT',
    engine: 'SQLite (node:sqlite)',
    platform: process.platform,
    activeDbPath: dbPath,
    windowsTargetPath: 'C:\\jankenfit\\jankenfit.db',
    androidTargetPath: 'Android/data/com.janken.fit/files/jankenfit.db',
    connected: true,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/storage-info', (_req, res) => {
    res.json(getStorageMetadata());
  });

  app.get('/api/state', (_req, res) => {
    try {
      const row = db
        .prepare('SELECT payload, updated_at FROM app_state WHERE state_key = ?')
        .get('primary_state') as { payload: string; updated_at: string } | undefined;

      if (!row) {
        res.json({ exists: false, state: null, storage: getStorageMetadata() });
        return;
      }
      res.json({
        exists: true,
        state: JSON.parse(row.payload),
        updatedAt: row.updated_at,
        storage: getStorageMetadata(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'SQLite read failed' });
    }
  });

  app.put('/api/state', (req, res) => {
    try {
      const incoming = req.body?.state;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ error: 'Invalid state payload' });
        return;
      }
      const nowIso = new Date().toISOString();
      const serialized = JSON.stringify(incoming);

      db.exec('BEGIN');
      try {
        db.prepare(
          `INSERT INTO app_state (state_key, payload, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(state_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
        ).run('primary_state', serialized, nowIso);

        // Mirror tasks cleanly into normalized SQLite tasks table
        db.prepare('DELETE FROM tasks').run();
        if (Array.isArray(incoming.tasks)) {
          const insertTask = db.prepare(
            `INSERT INTO tasks (id, title, category, due_time, completed, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          );
          for (const task of incoming.tasks) {
            if (task && typeof task.id === 'string' && typeof task.title === 'string') {
              insertTask.run(
                task.id,
                task.title,
                String(task.category ?? 'Wellness'),
                task.dueTime ? String(task.dueTime) : null,
                task.completed ? 1 : 0,
                String(task.createdAt ?? nowIso)
              );
            }
          }
        }

        // Mirror wellness check-ins into normalized SQLite wellness_logs table
        db.prepare('DELETE FROM wellness_logs').run();
        if (Array.isArray(incoming.wellnessLogs)) {
          const insertLog = db.prepare(
            `INSERT INTO wellness_logs (id, kind, mood, note, duration_sec, date_key, logged_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          );
          for (const log of incoming.wellnessLogs) {
            if (log && typeof log.id === 'string') {
              insertLog.run(
                log.id,
                String(log.kind ?? 'mood'),
                log.mood ? String(log.mood) : null,
                log.note ? String(log.note) : null,
                Number(log.durationSeconds ?? 0),
                String(log.dateKey ?? ''),
                String(log.loggedAt ?? nowIso)
              );
            }
          }
        }
        db.exec('COMMIT');
      } catch (innerErr) {
        db.exec('ROLLBACK');
        throw innerErr;
      }

      res.json({ ok: true, updatedAt: nowIso, storage: getStorageMetadata() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'SQLite write failed' });
    }
  });

  app.delete('/api/state', (_req, res) => {
    try {
      db.exec('DELETE FROM app_state; DELETE FROM tasks; DELETE FROM wellness_logs;');
      res.json({ ok: true, storage: getStorageMetadata() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'SQLite reset failed' });
    }
  });

  app.get('/api/weather', async (req, res) => {
    try {
      const city = typeof req.query.city === 'string' ? req.query.city : undefined;
      const latRaw = typeof req.query.lat === 'string' ? Number(req.query.lat) : undefined;
      const lonRaw = typeof req.query.lon === 'string' ? Number(req.query.lon) : undefined;
      const lat = latRaw !== undefined && Number.isFinite(latRaw) ? latRaw : undefined;
      const lon = lonRaw !== undefined && Number.isFinite(lonRaw) ? lonRaw : undefined;

      const weather = await fetchLiveWeather({
        city: city ?? (lat === undefined ? 'Bengaluru' : undefined),
        lat,
        lon,
      });
      res.json(weather);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Unable to fetch live weather',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`JANKENFIT server running on http://0.0.0.0:${port}`);
    console.log(`SQLite database active at: ${dbPath}`);
  });
}

startServer();
