import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Dumbbell,
  HeartPulse,
  Sun,
  Utensils,
  Wind,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AuthModal } from './components/AuthModal';
import { ChronicleView } from './components/ChronicleView';
import { PostureAndPacer } from './components/PostureAndPacer';
import { RationsTracker } from './components/RationsTracker';
import { TodayView } from './components/TodayView';
import { UserAvatarMenu } from './components/UserAvatarMenu';
import { VitalsScanner } from './components/VitalsScanner';
import { WellnessHub } from './components/WellnessHub';
import {
  isFirebaseConfigured,
  mergeAndSyncOnLogin,
  pushUserWellnessState,
  signOutUser,
  subscribeAuthState,
  subscribeUserWellnessState,
} from './services/firebaseSync';
import { wellnessStore } from './services/wellnessStore';
import {
  AppState,
  DietMealSlot,
  DietPreference,
  MealEntry,
  NavTab,
  ReadinessState,
  TaskItem,
  UserProfile,
  VitalReading,
  WellnessLog,
  WorkoutTypeOption,
} from './types/wellness';
import { audioService } from './utils/audioService';
import {
  calculateReadiness,
  calculateTargets,
  formatClock,
  formatDateKey,
  rolloverDayIfNeeded,
} from './utils/calculations';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'training', label: 'Fitness', icon: Dumbbell },
  { id: 'wellness', label: 'Wellness', icon: Wind },
  { id: 'vitals', label: 'Vitals', icon: HeartPulse },
  { id: 'rations', label: 'Rations', icon: Utensils },
  { id: 'chronicle', label: 'Chronicle', icon: BarChart3 },
];

export default function App() {
  const [state, setState] = useState<AppState>(() => wellnessStore.loadSyncLocalState());
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Authentication & real-time cloud sync state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const stateRef = useRef<AppState>(state);
  stateRef.current = state;
  const skipNextCloudPushRef = useRef<boolean>(false);
  const cloudReadyRef = useRef<boolean>(false);

  // Lifted Desk-Posture Break Timer state so it runs live across all tabs
  const [deskSecondsLeft, setDeskSecondsLeft] = useState<number>(
    () => state.deskIntervalMinutes * 60
  );
  const [deskRunning, setDeskRunning] = useState<boolean>(false);
  const [spineResetOpen, setSpineResetOpen] = useState<boolean>(false);

  // Track browser online / offline connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hydrate offline-first local state immediately on mount
  useEffect(() => {
    let mounted = true;
    wellnessStore.hydrateLocalState().then((loadedState) => {
      if (mounted) {
        skipNextCloudPushRef.current = true;
        setState(loadedState);
        setDeskSecondsLeft(loadedState.deskIntervalMinutes * 60);
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persistent Firebase Authentication listener + real-time Firestore two-way sync
  useEffect(() => {
    if (!hydrated) return;
    let unsubscribeSnapshot: (() => void) | null = null;
    let active = true;

    const unsubscribeAuth = subscribeAuthState((user) => {
      if (!active) return;
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      cloudReadyRef.current = false;
      setAuthUser(user);

      if (!user) return;

      void mergeAndSyncOnLogin(user, stateRef.current)
        .then(({ mergedState }) => {
          if (!active) return;
          skipNextCloudPushRef.current = true;
          cloudReadyRef.current = true;
          setState(mergedState);
          void wellnessStore.saveLocalState(mergedState);

          unsubscribeSnapshot = subscribeUserWellnessState(
            user.uid,
            (remoteState) => {
              if (!active) return;
              skipNextCloudPushRef.current = true;
              setState(remoteState);
              void wellnessStore.saveLocalState(remoteState);
            },
            () => {
              // Offline or transient permission notice; local cache continues seamlessly
            }
          );
        })
        .catch(() => {
          cloudReadyRef.current = true;
        });
    });

    return () => {
      active = false;
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [hydrated]);

  // Persist every local state change immediately, and merge to Firestore in background
  useEffect(() => {
    if (!hydrated) return;
    void wellnessStore.saveLocalState(state);

    if (skipNextCloudPushRef.current) {
      skipNextCloudPushRef.current = false;
      return;
    }

    if (authUser && cloudReadyRef.current && isFirebaseConfigured) {
      void pushUserWellnessState(authUser.uid, authUser.email || '', state, false).catch(() => {
        // Offline queue or transient error handled gracefully; local cache is already saved
      });
    }
  }, [state, hydrated, authUser]);

  // Automatic midnight rollover check every 60 seconds
  useEffect(() => {
    const interval = window.setInterval(() => {
      const todayKey = formatDateKey(new Date());
      setState((prev) => rolloverDayIfNeeded(prev, todayKey));
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  // Desk-Posture countdown ticker
  useEffect(() => {
    if (!deskRunning) return;
    const id = window.setInterval(() => {
      setDeskSecondsLeft((prev) => {
        if (prev <= 1) {
          setDeskRunning(false);
          setSpineResetOpen(true);
          audioService.playPostureAlert();
          audioService.vibrate([80, 60, 80]);
          return state.deskIntervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [deskRunning, state.deskIntervalMinutes]);

  // Clear ephemeral confirmation notice
  useEffect(() => {
    if (!statusNotice) return;
    const t = window.setTimeout(() => setStatusNotice(null), 3200);
    return () => window.clearTimeout(t);
  }, [statusNotice]);

  const targets = useMemo(() => calculateTargets(state.profile), [state.profile]);
  const latestVital = state.vitalsHistory[0];
  const readinessEval = useMemo(
    () => calculateReadiness(state.readiness, targets.hydrationTargetGlasses, latestVital),
    [state.readiness, targets.hydrationTargetGlasses, latestVital]
  );

  const todaysPostureLogs = useMemo(
    () => state.postureLogs.filter((p) => p.dateKey === state.activeDateKey),
    [state.postureLogs, state.activeDateKey]
  );

  const todaysWorkouts = useMemo(
    () => state.workouts.filter((w) => w.dateKey === state.activeDateKey),
    [state.workouts, state.activeDateKey]
  );

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setStatusNotice('Signed out. Your recent logs remain saved offline on this device.');
    } catch {
      setStatusNotice('Unable to sign out right now. Please try again.');
    }
  };

  // Action Handlers
  const handleUpdateProfile = (profile: UserProfile) => {
    setState((prev) => ({ ...prev, profile }));
    setStatusNotice('Personal targets updated.');
  };

  const handleChangeReadiness = (readiness: ReadinessState) => {
    setState((prev) => ({ ...prev, readiness }));
  };

  const handleAddMeal = (meal: Omit<MealEntry, 'id' | 'loggedAt'>) => {
    const entry: MealEntry = {
      ...meal,
      id: `meal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      loggedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      meals: [entry, ...prev.meals],
    }));
  };

  const handleRemoveMeal = (id: string) => {
    setState((prev) => ({
      ...prev,
      meals: prev.meals.filter((m) => m.id !== id),
    }));
  };

  const handleAddTask = (task: Omit<TaskItem, 'id' | 'completed' | 'createdAt'>) => {
    const item: TaskItem = {
      ...task,
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      tasks: [item, ...prev.tasks],
    }));
  };

  const handleToggleTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    }));
  };

  const handleDeleteTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  };

  const handleAddWellnessLog = (log: Omit<WellnessLog, 'id' | 'dateKey' | 'loggedAt'>) => {
    const entry: WellnessLog = {
      ...log,
      id: `well-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dateKey: state.activeDateKey,
      loggedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      wellnessLogs: [entry, ...prev.wellnessLogs].slice(0, 40),
    }));
    setStatusNotice('Saved wellness check-in.');
  };

  const handleDeleteWellnessLog = (id: string) => {
    setState((prev) => ({
      ...prev,
      wellnessLogs: prev.wellnessLogs.filter((w) => w.id !== id),
    }));
  };

  const handleChangeDietPreference = (dietPreference: DietPreference) => {
    setState((prev) => ({ ...prev, dietPreference }));
  };

  const handleToggleDietAdherence = (slotId: string) => {
    setState((prev) => {
      const exists = prev.dietAdherenceIds.includes(slotId);
      return {
        ...prev,
        dietAdherenceIds: exists
          ? prev.dietAdherenceIds.filter((id) => id !== slotId)
          : [...prev.dietAdherenceIds, slotId],
      };
    });
  };

  const handleResetDietAdherence = () => {
    setState((prev) => ({ ...prev, dietAdherenceIds: [] }));
  };

  const handleLogDietSlot = (slot: DietMealSlot) => {
    const entry: MealEntry = {
      id: `meal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: slot.mealName,
      proteinG: slot.proteinG,
      caloriesKcal: slot.caloriesKcal,
      loggedAt: new Date().toISOString(),
      isCustom: false,
    };
    setState((prev) => ({
      ...prev,
      meals: [entry, ...prev.meals],
      dietAdherenceIds: prev.dietAdherenceIds.includes(slot.id)
        ? prev.dietAdherenceIds
        : [...prev.dietAdherenceIds, slot.id],
    }));
    setStatusNotice(`Logged ${slot.slotLabel} (+${slot.proteinG}g protein).`);
  };

  const handleChangeCity = (preferredCity: string) => {
    setState((prev) => ({ ...prev, preferredCity }));
  };

  const handleChangeWorkoutType = (selectedWorkoutType: WorkoutTypeOption) => {
    setState((prev) => ({ ...prev, selectedWorkoutType }));
  };

  const handleSaveVital = (reading: VitalReading) => {
    setState((prev) => ({
      ...prev,
      vitalsHistory: [reading, ...prev.vitalsHistory].slice(0, 30),
    }));
  };

  const handleDeleteVital = (id: string) => {
    setState((prev) => ({
      ...prev,
      vitalsHistory: prev.vitalsHistory.filter((v) => v.id !== id),
    }));
  };

  const handleSelectDeskInterval = (minutes: 30 | 45 | 60) => {
    setState((prev) => ({ ...prev, deskIntervalMinutes: minutes }));
    setDeskRunning(false);
    setDeskSecondsLeft(minutes * 60);
  };

  const handleCompleteSpineReset = (movements: string[]) => {
    const log = {
      id: `posture-${Date.now()}`,
      dateKey: state.activeDateKey,
      completedAt: new Date().toISOString(),
      intervalMinutes: state.deskIntervalMinutes,
      movementsCompleted: movements,
    };
    setState((prev) => ({
      ...prev,
      postureLogs: [log, ...prev.postureLogs],
    }));
    setSpineResetOpen(false);
    setDeskSecondsLeft(state.deskIntervalMinutes * 60);
    setStatusNotice('Logged +1 posture break.');
  };

  const handleCompleteWorkout = (
    routineName: string,
    totalWorkSeconds: number,
    setsCompleted: number
  ) => {
    const session = {
      id: `workout-${Date.now()}`,
      dateKey: state.activeDateKey,
      completedAt: new Date().toISOString(),
      routineName,
      totalWorkSeconds,
      setsCompleted,
    };
    setState((prev) => ({
      ...prev,
      workouts: [session, ...prev.workouts],
    }));
  };

  const avatarUser = authUser
    ? {
        displayName: authUser.displayName || state.profile.name || 'Student',
        email: authUser.email || '',
      }
    : null;

  const syncCaption = authUser
    ? isOnline
      ? 'Synced across devices'
      : 'Saved offline'
    : 'Saved offline';

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'today':
        return (
          <TodayView
            profile={state.profile}
            targets={targets}
            readiness={state.readiness}
            evaluation={readinessEval}
            meals={state.meals}
            tasks={state.tasks}
            preferredCity={state.preferredCity}
            selectedWorkoutType={state.selectedWorkoutType}
            latestVital={latestVital}
            deskSecondsLeft={deskSecondsLeft}
            deskRunning={deskRunning}
            todaysDeskBreaks={todaysPostureLogs.length}
            onUpdateProfile={handleUpdateProfile}
            onChangeReadiness={handleChangeReadiness}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onChangeCity={handleChangeCity}
            onChangeWorkoutType={handleChangeWorkoutType}
            onToggleDeskTimer={() => setDeskRunning((r) => !r)}
            onOpenSpineReset={() => setSpineResetOpen(true)}
            onNavigate={setActiveTab}
          />
        );
      case 'wellness':
        return (
          <WellnessHub
            activeDateKey={state.activeDateKey}
            wellnessLogs={state.wellnessLogs}
            onAddWellnessLog={handleAddWellnessLog}
            onDeleteWellnessLog={handleDeleteWellnessLog}
          />
        );
      case 'vitals':
        return (
          <VitalsScanner
            profile={state.profile}
            fatigueLevel={state.readiness.fatigueLevel}
            activeDateKey={state.activeDateKey}
            vitalsHistory={state.vitalsHistory}
            onSaveVital={handleSaveVital}
            onDeleteVital={handleDeleteVital}
          />
        );
      case 'rations':
        return (
          <RationsTracker
            profile={state.profile}
            meals={state.meals}
            targets={targets}
            dietPreference={state.dietPreference}
            dietAdherenceIds={state.dietAdherenceIds}
            onChangeDietPreference={handleChangeDietPreference}
            onToggleDietAdherence={handleToggleDietAdherence}
            onResetDietAdherence={handleResetDietAdherence}
            onLogDietSlot={handleLogDietSlot}
            onAddMeal={handleAddMeal}
            onRemoveMeal={handleRemoveMeal}
          />
        );
      case 'training':
        return (
          <PostureAndPacer
            deskIntervalMinutes={state.deskIntervalMinutes}
            deskSecondsLeft={deskSecondsLeft}
            deskRunning={deskRunning}
            spineResetOpen={spineResetOpen}
            onSelectDeskInterval={handleSelectDeskInterval}
            onToggleDeskTimer={() => setDeskRunning((r) => !r)}
            onResetDeskTimer={() => {
              setDeskRunning(false);
              setDeskSecondsLeft(state.deskIntervalMinutes * 60);
            }}
            onOpenSpineReset={() => setSpineResetOpen(true)}
            onCompleteSpineReset={handleCompleteSpineReset}
            onDismissSpineReset={() => setSpineResetOpen(false)}
            todaysPostureLogs={todaysPostureLogs}
            todaysWorkouts={todaysWorkouts}
            onCompleteWorkout={handleCompleteWorkout}
          />
        );
      case 'chronicle':
        return <ChronicleView state={state} targets={targets} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6EE] text-[#1F1916]">
      {/* Deep Espresso Top Application Bar */}
      <header className="no-print sticky top-0 z-40 border-b border-[#3D281C] bg-[#2B1B12] text-[#F2EAD3]">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 md:h-16 md:px-6">
          {/* Brand Title */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="font-serif text-lg font-bold tracking-wide text-[#F2EAD3] whitespace-nowrap md:text-xl">
              JANKENFIT
            </span>
          </div>

          {/* Minimal Top-Right Circular User Initial Avatar */}
          <UserAvatarMenu
            user={avatarUser}
            isSyncedOnline={Boolean(authUser) && isOnline}
            onOpenAuth={() => setAuthModalOpen(true)}
            onSignOut={handleSignOut}
          />
        </div>
      </header>

      {/* Unified Responsive Shell (Full-Bleed Mobile + Desktop Sidebar Dashboard) */}
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1440px] md:min-h-[calc(100vh-4rem)]">
        {/* Desktop Left Sand-Cream Navigation Rail (>= 768px) */}
        <aside className="no-print hidden w-60 shrink-0 flex-col justify-between border-r border-[#EFE8DD] bg-[#EFE8D8] p-4 md:sticky md:top-16 md:flex md:h-[calc(100vh-4rem)] md:overflow-y-auto">
          <div>
            <p className="px-3 text-xs font-medium text-[#6E5D52]">
              Daily Ledger · {state.activeDateKey}
            </p>
            <nav aria-label="Primary navigation" className="mt-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#C85A28] text-white shadow-xs'
                        : 'text-[#2B1B12] hover:bg-[#E4DAC7]/70'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Live Companion Summary in Left Rail */}
          <div className="space-y-3 border-t border-[#EFE8DD] pt-4">
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FDFBF7] p-3.5">
              <div className="flex items-center justify-between text-xs text-[#6E5D52]">
                <span>Readiness</span>
                <Activity className="h-3.5 w-3.5 text-[#2D6A4F]" aria-hidden="true" />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-metrics text-[#2D6A4F]">
                {readinessEval.score}%
              </p>
              <p className="mt-0.5 text-[11px] text-[#6E5D52]">{readinessEval.statusLabel}</p>
            </div>

            <div className="rounded-xl border border-[#EFE8DD] bg-[#FDFBF7] p-3.5">
              <div className="flex items-center justify-between text-xs text-[#6E5D52]">
                <span>Posture Timer</span>
                <span className="font-semibold text-[#C85A28]">
                  {deskRunning ? 'Live' : 'Idle'}
                </span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-metrics text-[#1F1916]">
                {formatClock(deskSecondsLeft)}
              </p>
              <button
                type="button"
                onClick={() => setDeskRunning((r) => !r)}
                className="mt-2 min-h-[34px] w-full rounded-lg border border-[#EFE8DD] bg-[#F9F6EE] px-2.5 py-1 text-xs font-semibold text-[#1F1916] hover:border-[#C85A28]"
              >
                {deskRunning ? 'Pause Clock' : 'Start Clock'}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace Canvas */}
        <main className="@container min-w-0 flex-1 px-4 pt-5 pb-24 md:px-8 md:py-7">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h1 className="font-serif text-2xl font-bold text-[#1F1916] md:text-3xl">
                  {activeTab === 'today' && 'Today’s Wellness Ledger'}
                  {activeTab === 'wellness' && 'Mind & Body Wellness'}
                  {activeTab === 'vitals' && 'Optical Pulse & Blood Pressure'}
                  {activeTab === 'rations' && 'Diet Plan & Hostel Nutrition'}
                  {activeTab === 'training' && 'Fitness, Posture & Workout Pacer'}
                  {activeTab === 'chronicle' && '7-Day Discipline Chronicle'}
                </h1>
                <p className="mt-1 text-xs text-[#6E5D52] tabular-metrics">
                  {state.profile.name} · {state.activeDateKey} · {syncCaption}
                </p>
              </div>

              {statusNotice && (
                <p
                  role="status"
                  className="rounded-lg border border-[#EFE8DD] bg-[#EFE8D8] px-3 py-1.5 text-xs font-medium text-[#2B1B12]"
                >
                  {statusNotice}
                </p>
              )}
            </div>

            {renderActiveContent()}
          </div>
        </main>

        {/* Responsive Mobile Fixed Sand-Cream Bottom Tab Bar (< 768px) */}
        <nav
          aria-label="Mobile bottom navigation"
          className="no-print fixed right-0 bottom-0 left-0 z-40 grid min-h-16 grid-cols-6 border-t border-[#EFE8DD] bg-[#EFE8D8] px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 transition-colors ${
                  active
                    ? 'font-semibold text-[#C85A28]'
                    : 'text-[#6E5D52] hover:text-[#1F1916]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 1-Time Persistent Sign-In & Create Account Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          setStatusNotice('Signed in — synced across mobile and web.');
        }}
      />
    </div>
  );
}
