# JANKENFIT — Smart Fitness & Student Wellness

An offline-first student fitness and mind-body wellness suite built with React, TypeScript, Tailwind CSS, Express, and native SQLite (`node:sqlite`), engineered to run across Desktop Web, Windows local server, GitHub Pages, Android `.apk` (`com.janken.fit`), and iOS via Capacitor.

## Platform Storage Paths (Real SQLite + Local Persistence)
- **Windows Desktop Server (`npm run dev` / `npm start`)**: Automatically creates and persists SQLite database at **`C:\jankenfit\jankenfit.db`**.
- **Android APK (`com.janken.fit`)**: Stores app data under **`Android/data/com.janken.fit/files/`** via Capacitor Filesystem + IndexedDB/localStorage offline cache.
- **Linux / macOS / Cloud Server**: Stores SQLite database at `./data/jankenfit/jankenfit.db` (override via `JANKENFIT_DATA_DIR`).

## Quick Start (Desktop / Windows)
```bash
npm install
npm run dev
```
Open `http://localhost:3000`. On Windows, `C:\jankenfit\jankenfit.db` is created automatically on first launch.

## Deploy to GitHub Pages
1. Push this repository to GitHub on branch `main`.
2. In repository **Settings -> Pages**, set **Source** to **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` runs `npm run lint`, `npm test`, and `npm run build` with relative paths and publishes `dist/` automatically.

## Package Standalone Android `.apk` (`com.janken.fit`) & iOS
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/filesystem
CAPACITOR_BUILD=1 npm run build

# Android APK
npx cap add android
npx cap sync android
npx cap open android   # Build -> Build Bundle(s) / APK(s) -> Build APK(s)

# iOS (macOS + Xcode required)
npx cap add ios
npx cap sync ios
npx cap open ios
```

## Live Weather & Audio Brief
Powered by the real, keyless **Open-Meteo** Forecast & Geocoding API (proxied through `/api/weather` when the Express backend is active, with automatic direct HTTPS client fallback on GitHub Pages and Android/iOS APKs) paired with the browser Web Speech API for spoken workout suitability briefings.
