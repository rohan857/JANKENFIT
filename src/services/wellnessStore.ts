import {
  AppState,
  DailySummary,
  MealEntry,
  PostureLog,
  TaskItem,
  VitalReading,
  WellnessLog,
  WorkoutSession,
} from '../types/wellness';
import {
  buildSevenDayChronicle,
  calculateReadiness,
  calculateTargets,
  formatDateKey,
  rolloverDayIfNeeded,
} from '../utils/calculations';

const LOCAL_STORAGE_KEY = 'jankenfit_wellness_state_v3';
const IDB_NAME = 'jankenfit_offline_store';
const IDB_STORE = 'wellness_state';
const IDB_RECORD_KEY = 'current';
const NATIVE_FILE_PATH = 'jankenfit_state.json';

interface NativeFilesystemBridge {
  writeFile?: (opts: { path: string; data: string; directory: string; encoding: string }) => Promise<void>;
  readFile?: (opts: { path: string; directory: string; encoding: string }) => Promise<{ data: string }>;
}

export interface FirestoreWellnessDocument {
  uid: string;
  activeDateKey: string;
  profile: {
    name: string;
    email: string;
    age: number;
    heightCm: number;
    weightKg: number;
    activityLevel: AppState['profile']['activityLevel'];
    goal: AppState['profile']['goal'];
    dietPreference: AppState['dietPreference'];
    preferredCity: string;
    selectedWorkoutType: AppState['selectedWorkoutType'];
    deskIntervalMinutes: AppState['deskIntervalMinutes'];
    updatedAt: string;
  };
  readiness: {
    sleepHours: number;
    sleepQuality: AppState['readiness']['sleepQuality'];
    fatigueLevel: AppState['readiness']['fatigueLevel'];
    waterGlasses: number;
    score: number;
    date: string;
  };
  vitalsHistory: Array<{
    id: string;
    timestamp: string;
    dateKey: string;
    bpm: number;
    systolic: number;
    diastolic: number;
    recoveryIndex: number;
    status: VitalReading['stressLabel'];
    source: VitalReading['source'];
    confidencePct: number;
  }>;
  nutritionLogs: Array<{
    id: string;
    date: string;
    itemName: string;
    calories: number;
    proteinGrams: number;
    quantity: number;
    loggedAt: string;
    isCustom: boolean;
  }>;
  postureBreaks: {
    completedToday: number;
    streakDays: number;
    lastBreakTimestamp: string | null;
    logs: PostureLog[];
  };
  workoutSessions: Array<{
    id: string;
    date: string;
    exerciseName: string;
    setsCompleted: number;
    totalHoldSeconds: number;
    completedAt: string;
  }>;
  dailyHistory: DailySummary[];
  tasks: TaskItem[];
  wellnessLogs: WellnessLog[];
  dietAdherenceIds: string[];
}

function getNativeFilesystem(): NativeFilesystemBridge | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Filesystem?: NativeFilesystemBridge } };
  }).Capacitor;
  if (cap?.isNativePlatform?.() && cap.Plugins?.Filesystem) {
    return cap.Plugins.Filesystem;
  }
  return null;
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : fallback;
  return str.slice(0, maxLen);
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(min, Math.min(max, num));
}

export function createEmptyState(dateKey = formatDateKey(new Date()), displayName?: string): AppState {
  return {
    activeDateKey: dateKey,
    profile: {
      name: clampString(displayName, 100, 'Student') || 'Student',
      age: 21,
      heightCm: 174,
      weightKg: 68,
      activityLevel: 'Calisthenics / Moderate',
      goal: 'Lean Core & Posture',
    },
    readiness: {
      sleepHours: 7.5,
      sleepQuality: 'Average',
      fatigueLevel: 2,
      hydrationGlasses: 0,
    },
    meals: [],
    vitalsHistory: [],
    workouts: [],
    postureLogs: [],
    dailyHistory: [],
    deskIntervalMinutes: 45,
    tasks: [],
    wellnessLogs: [],
    dietPreference: 'Eggetarian',
    dietAdherenceIds: [],
    preferredCity: 'Bengaluru',
    selectedWorkoutType: 'Outdoor Calisthenics & Run',
  };
}

export function normalizeState(candidate: unknown, fallbackDateKey: string): AppState | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const s = candidate as Partial<AppState>;
  if (
    typeof s.activeDateKey !== 'string' ||
    !s.profile ||
    !s.readiness ||
    !Array.isArray(s.meals) ||
    !Array.isArray(s.vitalsHistory) ||
    !Array.isArray(s.workouts) ||
    !Array.isArray(s.postureLogs) ||
    !Array.isArray(s.dailyHistory)
  ) {
    return null;
  }
  const base = createEmptyState(fallbackDateKey);
  const merged: AppState = {
    ...base,
    ...s,
    tasks: Array.isArray(s.tasks) ? s.tasks : [],
    wellnessLogs: Array.isArray(s.wellnessLogs) ? s.wellnessLogs : [],
    dietPreference: s.dietPreference ?? base.dietPreference,
    dietAdherenceIds: Array.isArray(s.dietAdherenceIds) ? s.dietAdherenceIds : [],
    preferredCity: s.preferredCity ?? base.preferredCity,
    selectedWorkoutType: s.selectedWorkoutType ?? base.selectedWorkoutType,
  };
  return rolloverDayIfNeeded(merged, fallbackDateKey);
}

export function hasLocalActivity(state: AppState): boolean {
  return (
    state.meals.length > 0 ||
    state.vitalsHistory.length > 0 ||
    state.workouts.length > 0 ||
    state.postureLogs.length > 0 ||
    state.dailyHistory.length > 0 ||
    state.tasks.length > 0 ||
    state.wellnessLogs.length > 0 ||
    state.dietAdherenceIds.length > 0 ||
    state.readiness.hydrationGlasses > 0
  );
}

function dedupeById<T extends { id: string }>(primary: T[], secondary: T[], limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...primary, ...secondary]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

export function mergeLocalAndCloudState(
  localState: AppState,
  cloudState: AppState | null,
  accountName?: string | null
): AppState {
  const todayKey = formatDateKey(new Date());
  const normalizedLocal = rolloverDayIfNeeded(localState, todayKey);
  const resolvedName = clampString(accountName, 100) || normalizedLocal.profile.name || 'Student';

  if (!cloudState) {
    return {
      ...normalizedLocal,
      profile: {
        ...normalizedLocal.profile,
        name: resolvedName,
      },
    };
  }

  const normalizedCloud = rolloverDayIfNeeded(cloudState, todayKey);
  const sameDay = normalizedLocal.activeDateKey === normalizedCloud.activeDateKey;

  const historyMap = new Map<string, DailySummary>();
  for (const d of normalizedCloud.dailyHistory) historyMap.set(d.dateKey, d);
  for (const d of normalizedLocal.dailyHistory) {
    if (!historyMap.has(d.dateKey)) historyMap.set(d.dateKey, d);
  }
  const mergedHistory = Array.from(historyMap.values())
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-14);

  const mergedAdherence = Array.from(
    new Set([...normalizedCloud.dietAdherenceIds, ...(sameDay ? normalizedLocal.dietAdherenceIds : [])])
  ).slice(0, 10);

  return {
    ...normalizedCloud,
    activeDateKey: todayKey,
    profile: {
      ...normalizedCloud.profile,
      name:
        normalizedCloud.profile.name && normalizedCloud.profile.name !== 'Student'
          ? normalizedCloud.profile.name
          : resolvedName,
    },
    readiness: sameDay
      ? {
          ...normalizedCloud.readiness,
          hydrationGlasses: Math.max(
            normalizedCloud.readiness.hydrationGlasses,
            normalizedLocal.readiness.hydrationGlasses
          ),
        }
      : normalizedCloud.readiness,
    meals: sameDay ? dedupeById(normalizedCloud.meals, normalizedLocal.meals, 100) : normalizedCloud.meals,
    vitalsHistory: dedupeById(normalizedCloud.vitalsHistory, normalizedLocal.vitalsHistory, 50),
    workouts: dedupeById(normalizedCloud.workouts, normalizedLocal.workouts, 50),
    postureLogs: dedupeById(normalizedCloud.postureLogs, normalizedLocal.postureLogs, 50),
    dailyHistory: mergedHistory,
    tasks: dedupeById(normalizedCloud.tasks, normalizedLocal.tasks, 100),
    wellnessLogs: dedupeById(normalizedCloud.wellnessLogs, normalizedLocal.wellnessLogs, 60),
    dietAdherenceIds: mergedAdherence,
  };
}

export function serializeToFirestorePayload(
  uid: string,
  email: string,
  state: AppState
): FirestoreWellnessDocument {
  const targets = calculateTargets(state.profile);
  const readinessEval = calculateReadiness(
    state.readiness,
    targets.hydrationTargetGlasses,
    state.vitalsHistory[0]
  );
  const chronicle = buildSevenDayChronicle(state);
  const todaysPosture = state.postureLogs.filter((p) => p.dateKey === state.activeDateKey);
  const latestPosture = todaysPosture[0] ?? state.postureLogs[0];

  return {
    uid: clampString(uid, 128),
    activeDateKey: /^\d{4}-\d{2}-\d{2}$/.test(state.activeDateKey)
      ? state.activeDateKey
      : formatDateKey(new Date()),
    profile: {
      name: clampString(state.profile.name, 100, 'Student') || 'Student',
      email: clampString(email, 200, ''),
      age: clampNum(state.profile.age, 14, 90, 21),
      heightCm: clampNum(state.profile.heightCm, 100, 240, 174),
      weightKg: clampNum(state.profile.weightKg, 30, 220, 68),
      activityLevel: state.profile.activityLevel,
      goal: state.profile.goal,
      dietPreference: state.dietPreference,
      preferredCity: clampString(state.preferredCity, 80, 'Bengaluru') || 'Bengaluru',
      selectedWorkoutType: state.selectedWorkoutType,
      deskIntervalMinutes: state.deskIntervalMinutes,
      updatedAt: new Date().toISOString(),
    },
    readiness: {
      sleepHours: clampNum(state.readiness.sleepHours, 0, 24, 7.5),
      sleepQuality: state.readiness.sleepQuality,
      fatigueLevel: clampNum(state.readiness.fatigueLevel, 1, 5, 2) as 1 | 2 | 3 | 4 | 5,
      waterGlasses: clampNum(state.readiness.hydrationGlasses, 0, 30, 0),
      score: clampNum(readinessEval.score, 0, 100, 70),
      date: /^\d{4}-\d{2}-\d{2}$/.test(state.activeDateKey)
        ? state.activeDateKey
        : formatDateKey(new Date()),
    },
    vitalsHistory: state.vitalsHistory.slice(0, 50).map((v) => ({
      id: clampString(v.id, 80),
      timestamp: clampString(v.timestamp, 64),
      dateKey: clampString(v.dateKey, 10),
      bpm: clampNum(v.bpm, 30, 220, 65),
      systolic: clampNum(v.systolic, 70, 220, 118),
      diastolic: clampNum(v.diastolic, 40, 140, 76),
      recoveryIndex: clampNum(v.recoveryIndex, 0, 100, 80),
      status: v.stressLabel,
      source: v.source,
      confidencePct: clampNum(v.confidencePct, 0, 100, 95),
    })),
    nutritionLogs: state.meals.slice(0, 100).map((m) => ({
      id: clampString(m.id, 80),
      date: state.activeDateKey,
      itemName: clampString(m.name, 120, 'Meal'),
      calories: clampNum(m.caloriesKcal, 0, 5000, 0),
      proteinGrams: clampNum(m.proteinG, 0, 300, 0),
      quantity: 1,
      loggedAt: clampString(m.loggedAt, 64),
      isCustom: Boolean(m.isCustom),
    })),
    postureBreaks: {
      completedToday: Math.min(50, todaysPosture.length),
      streakDays: Math.min(3650, chronicle.streakDays),
      lastBreakTimestamp: latestPosture ? clampString(latestPosture.completedAt, 64) : null,
      logs: state.postureLogs.slice(0, 50),
    },
    workoutSessions: state.workouts.slice(0, 50).map((w) => ({
      id: clampString(w.id, 80),
      date: clampString(w.dateKey, 10, state.activeDateKey),
      exerciseName: clampString(w.routineName, 120, 'Calisthenics'),
      setsCompleted: clampNum(w.setsCompleted, 0, 100, 1),
      totalHoldSeconds: clampNum(w.totalWorkSeconds, 0, 14400, 0),
      completedAt: clampString(w.completedAt, 64),
    })),
    dailyHistory: state.dailyHistory.slice(-14),
    tasks: state.tasks.slice(0, 100),
    wellnessLogs: state.wellnessLogs.slice(0, 60),
    dietAdherenceIds: state.dietAdherenceIds.slice(0, 10),
  };
}

export function deserializeFromFirestorePayload(
  raw: unknown,
  fallbackDateKey = formatDateKey(new Date())
): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Partial<FirestoreWellnessDocument>;
  const base = createEmptyState(fallbackDateKey);
  const activeDateKey =
    typeof doc.activeDateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(doc.activeDateKey)
      ? doc.activeDateKey
      : typeof doc.readiness?.date === 'string'
        ? doc.readiness.date
        : fallbackDateKey;

  const meals: MealEntry[] = Array.isArray(doc.nutritionLogs)
    ? doc.nutritionLogs
        .filter((m) => !m.date || m.date === activeDateKey)
        .map((m) => ({
          id: m.id,
          name: m.itemName,
          caloriesKcal: m.calories,
          proteinG: m.proteinGrams,
          loggedAt: m.loggedAt ?? new Date().toISOString(),
          isCustom: m.isCustom,
        }))
    : [];

  const vitalsHistory: VitalReading[] = Array.isArray(doc.vitalsHistory)
    ? doc.vitalsHistory.map((v) => ({
        id: v.id,
        timestamp: v.timestamp,
        dateKey: v.dateKey || activeDateKey,
        bpm: v.bpm,
        systolic: v.systolic,
        diastolic: v.diastolic,
        recoveryIndex: v.recoveryIndex ?? 80,
        stressLabel: v.status ?? 'Balanced',
        source: v.source ?? 'optical-pad',
        confidencePct: v.confidencePct ?? 95,
      }))
    : [];

  const workouts: WorkoutSession[] = Array.isArray(doc.workoutSessions)
    ? doc.workoutSessions.map((w) => ({
        id: w.id,
        dateKey: w.date || activeDateKey,
        completedAt: w.completedAt ?? new Date().toISOString(),
        routineName: w.exerciseName,
        totalWorkSeconds: w.totalHoldSeconds,
        setsCompleted: w.setsCompleted,
      }))
    : [];

  const postureLogs: PostureLog[] = Array.isArray(doc.postureBreaks?.logs)
    ? doc.postureBreaks.logs
    : [];

  const assembled: AppState = {
    activeDateKey,
    profile: {
      name: doc.profile?.name || base.profile.name,
      age: doc.profile?.age ?? base.profile.age,
      heightCm: doc.profile?.heightCm ?? base.profile.heightCm,
      weightKg: doc.profile?.weightKg ?? base.profile.weightKg,
      activityLevel: doc.profile?.activityLevel ?? base.profile.activityLevel,
      goal: doc.profile?.goal ?? base.profile.goal,
    },
    readiness: {
      sleepHours: doc.readiness?.sleepHours ?? base.readiness.sleepHours,
      sleepQuality: doc.readiness?.sleepQuality ?? base.readiness.sleepQuality,
      fatigueLevel: doc.readiness?.fatigueLevel ?? base.readiness.fatigueLevel,
      hydrationGlasses: doc.readiness?.waterGlasses ?? base.readiness.hydrationGlasses,
    },
    meals,
    vitalsHistory,
    workouts,
    postureLogs,
    dailyHistory: Array.isArray(doc.dailyHistory) ? doc.dailyHistory : [],
    deskIntervalMinutes: doc.profile?.deskIntervalMinutes ?? base.deskIntervalMinutes,
    tasks: Array.isArray(doc.tasks) ? doc.tasks : [],
    wellnessLogs: Array.isArray(doc.wellnessLogs) ? doc.wellnessLogs : [],
    dietPreference: doc.profile?.dietPreference ?? base.dietPreference,
    dietAdherenceIds: Array.isArray(doc.dietAdherenceIds) ? doc.dietAdherenceIds : [],
    preferredCity: doc.profile?.preferredCity ?? base.preferredCity,
    selectedWorkoutType: doc.profile?.selectedWorkoutType ?? base.selectedWorkoutType,
  };

  return rolloverDayIfNeeded(assembled, fallbackDateKey);
}

// Local offline persistence helpers (browser + native mobile)
function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readOfflineDb(): Promise<unknown | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_RECORD_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeOfflineDb(state: AppState): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(state, IDB_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function readNativeFile(): Promise<unknown | null> {
  const fsBridge = getNativeFilesystem();
  if (!fsBridge?.readFile) return null;
  try {
    const res = await fsBridge.readFile({
      path: NATIVE_FILE_PATH,
      directory: 'EXTERNAL',
      encoding: 'utf8',
    });
    return JSON.parse(res.data);
  } catch {
    return null;
  }
}

async function writeNativeFile(state: AppState): Promise<void> {
  const fsBridge = getNativeFilesystem();
  if (!fsBridge?.writeFile) return;
  try {
    await fsBridge.writeFile({
      path: NATIVE_FILE_PATH,
      data: JSON.stringify(state),
      directory: 'EXTERNAL',
      encoding: 'utf8',
    });
  } catch {
    // Graceful fallback when native external filesystem is unavailable
  }
}

export const wellnessStore = {
  loadSyncLocalState(): AppState {
    const todayKey = formatDateKey(new Date());
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = normalizeState(JSON.parse(raw), todayKey);
          if (parsed) return parsed;
        }
      }
    } catch {
      // Fall back cleanly to a fresh personal state
    }
    return createEmptyState(todayKey);
  },

  async hydrateLocalState(): Promise<AppState> {
    const todayKey = formatDateKey(new Date());

    const nativeRaw = await readNativeFile();
    const nativeState = normalizeState(nativeRaw, todayKey);
    if (nativeState) {
      await this.saveLocalState(nativeState);
      return nativeState;
    }

    const dbRaw = await readOfflineDb();
    const dbState = normalizeState(dbRaw, todayKey);
    if (dbState) {
      await this.saveLocalState(dbState);
      return dbState;
    }

    const fallback = this.loadSyncLocalState();
    await this.saveLocalState(fallback);
    return fallback;
  },

  async saveLocalState(state: AppState): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // Handled by secondary offline cache
    }
    await writeOfflineDb(state);
    await writeNativeFile(state);
  },
};
