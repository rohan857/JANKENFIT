import React from 'react';
import { ArrowRight, HeartPulse, Pause, Play, Timer, Utensils } from 'lucide-react';
import {
  ComputedTargets,
  MealEntry,
  NavTab,
  ReadinessEvaluation,
  ReadinessState,
  TaskItem,
  UserProfile,
  VitalReading,
  WorkoutTypeOption,
} from '../types/wellness';
import { calculateDailyMacros, formatClock } from '../utils/calculations';
import { ProfileCard } from './ProfileCard';
import { ReadinessPanel } from './ReadinessPanel';
import { TaskListCard } from './TaskListCard';
import { WeatherBriefCard } from './WeatherBriefCard';

interface TodayViewProps {
  profile: UserProfile;
  targets: ComputedTargets;
  readiness: ReadinessState;
  evaluation: ReadinessEvaluation;
  meals: MealEntry[];
  tasks: TaskItem[];
  preferredCity: string;
  selectedWorkoutType: WorkoutTypeOption;
  latestVital?: VitalReading;
  deskSecondsLeft: number;
  deskRunning: boolean;
  todaysDeskBreaks: number;
  onUpdateProfile: (next: UserProfile) => void;
  onChangeReadiness: (next: ReadinessState) => void;
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed' | 'createdAt'>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onChangeCity: (city: string) => void;
  onChangeWorkoutType: (workout: WorkoutTypeOption) => void;
  onToggleDeskTimer: () => void;
  onOpenSpineReset: () => void;
  onNavigate: (tab: NavTab) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  profile,
  targets,
  readiness,
  evaluation,
  meals,
  tasks,
  preferredCity,
  selectedWorkoutType,
  latestVital,
  deskSecondsLeft,
  deskRunning,
  todaysDeskBreaks,
  onUpdateProfile,
  onChangeReadiness,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onChangeCity,
  onChangeWorkoutType,
  onToggleDeskTimer,
  onOpenSpineReset,
  onNavigate,
}) => {
  const macros = calculateDailyMacros(meals, targets);

  return (
    <div className="space-y-6">
      {/* Primary Module C: Readiness & Recovery Telemetry */}
      <ReadinessPanel
        readiness={readiness}
        evaluation={evaluation}
        hydrationTargetGlasses={targets.hydrationTargetGlasses}
        latestVital={latestVital}
        onChangeReadiness={onChangeReadiness}
      />

      {/* Home Companion Row: Live Weather Brief + Interactive Daily Task List */}
      <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-2">
        <WeatherBriefCard
          preferredCity={preferredCity}
          selectedWorkoutType={selectedWorkoutType}
          onChangeCity={onChangeCity}
          onChangeWorkoutType={onChangeWorkoutType}
        />

        <TaskListCard
          tasks={tasks}
          onAddTask={onAddTask}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
        />
      </div>

      {/* Bento Live Companion Row: Posture Guard + Rations & Diet + Latest Vitals */}
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-3">
        {/* Live Desk-Posture Guard Mini-Card */}
        <section
          aria-labelledby="today-posture-heading"
          className="editorial-card flex flex-col justify-between rounded-2xl p-5"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#5C5046]">Desk-Posture Guard</p>
              <Timer className="h-4 w-4 text-[#C85A28]" aria-hidden="true" />
            </div>
            <h3
              id="today-posture-heading"
              className="mt-1 font-serif text-lg font-bold text-[#1F1916]"
            >
              Spine Reset Clock
            </h3>
            <p className="mt-3 text-3xl font-bold tabular-metrics text-[#1F1916]">
              {formatClock(deskSecondsLeft)}
            </p>
            <p className="mt-1 text-xs text-[#5C5046] tabular-metrics">
              {todaysDeskBreaks} desk {todaysDeskBreaks === 1 ? 'break' : 'breaks'} completed today
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleDeskTimer}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#C85A28] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B04A1D] whitespace-nowrap"
            >
              {deskRunning ? (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Start Timer
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenSpineReset();
                onNavigate('training');
              }}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2 text-xs font-semibold text-[#1F1916] hover:border-[#C85A28] whitespace-nowrap"
            >
              60s Reset
            </button>
          </div>
        </section>

        {/* Today's Rations & Diet Plan Snapshot */}
        <section
          aria-labelledby="today-rations-heading"
          className="editorial-card flex flex-col justify-between rounded-2xl p-5"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#5C5046]">Rations &amp; Diet Plan</p>
              <Utensils className="h-4 w-4 text-[#D99B26]" aria-hidden="true" />
            </div>
            <h3
              id="today-rations-heading"
              className="mt-1 font-serif text-lg font-bold text-[#1F1916]"
            >
              Daily Macros
            </h3>

            <div className="mt-3 space-y-2.5">
              <div>
                <div className="flex justify-between text-xs tabular-metrics">
                  <span className="font-medium text-[#5C5046]">Protein</span>
                  <span className="font-bold text-[#1F1916]">
                    {macros.proteinG}g / {targets.proteinTargetG}g
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#EFE8D8]">
                  <div
                    className="h-full rounded-full bg-[#D99B26]"
                    style={{ width: `${macros.proteinPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs tabular-metrics">
                  <span className="font-medium text-[#5C5046]">Calories</span>
                  <span className="font-bold text-[#1F1916]">
                    {macros.caloriesKcal} / {targets.calorieTargetKcal}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#EFE8D8]">
                  <div
                    className="h-full rounded-full bg-[#2D6A4F]"
                    style={{ width: `${macros.caloriePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('rations')}
            className="mt-4 inline-flex min-h-[40px] w-full items-center justify-between rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3.5 py-2 text-xs font-semibold text-[#1F1916] transition-colors hover:border-[#C85A28] hover:text-[#C85A28]"
          >
            <span>Open Diet Plan &amp; Rations</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </section>

        {/* Latest Optical Pulse Snapshot */}
        <section
          aria-labelledby="today-vitals-heading"
          className="editorial-card flex flex-col justify-between rounded-2xl p-5"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#6E5D52]">Optical Pulse Check</p>
              <HeartPulse className="h-4 w-4 text-[#2D6A4F]" aria-hidden="true" />
            </div>
            <h3
              id="today-vitals-heading"
              className="mt-1 font-serif text-lg font-bold text-[#1F1916]"
            >
              Resting Vitals
            </h3>

            {latestVital ? (
              <div className="mt-3 flex items-baseline gap-4 tabular-metrics">
                <div>
                  <span className="text-3xl font-bold text-[#2D6A4F]">{latestVital.bpm}</span>
                  <span className="ml-1 text-xs text-[#6E5D52]">BPM</span>
                </div>
                <div>
                  <span className="text-xl font-bold text-[#1F1916]">
                    {latestVital.systolic}/{latestVital.diastolic}
                  </span>
                  <span className="ml-1 text-xs text-[#6E5D52]">mmHg</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-[#6E5D52]">
                No vitals logged yet today. Tap below to record your first check-in.
              </p>
            )}
            {latestVital && (
              <p className="mt-1 text-xs text-[#6E5D52]">
                Recovery Index {latestVital.recoveryIndex}/100 · {latestVital.stressLabel}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('vitals')}
            className="mt-4 inline-flex min-h-[40px] w-full items-center justify-between rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3.5 py-2 text-xs font-semibold text-[#1F1916] transition-colors hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
          >
            <span>Check Pulse &amp; Blood Pressure</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </section>
      </div>

      {/* Module A: Editable Student Profile & Sports-Science Target Engine */}
      <ProfileCard
        profile={profile}
        targets={targets}
        onUpdateProfile={onUpdateProfile}
      />
    </div>
  );
};
