import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, SkipForward, Timer, Dumbbell } from 'lucide-react';
import { CALISTHENICS_ROUTINES, SPINE_RESET_MOVEMENTS } from '../data/presets';
import { PacerBlock, PostureLog, WorkoutSession } from '../types/wellness';
import { audioService } from '../utils/audioService';
import { formatClock } from '../utils/calculations';

interface PostureAndPacerProps {
  deskIntervalMinutes: 30 | 45 | 60;
  deskSecondsLeft: number;
  deskRunning: boolean;
  spineResetOpen: boolean;
  onSelectDeskInterval: (minutes: 30 | 45 | 60) => void;
  onToggleDeskTimer: () => void;
  onResetDeskTimer: () => void;
  onOpenSpineReset: () => void;
  onCompleteSpineReset: (movements: string[]) => void;
  onDismissSpineReset: () => void;
  todaysPostureLogs: PostureLog[];
  todaysWorkouts: WorkoutSession[];
  onCompleteWorkout: (routineName: string, totalWorkSeconds: number, setsCompleted: number) => void;
}

interface PacerStep {
  blockLabel: string;
  phase: 'work' | 'rest';
  durationSeconds: number;
  setIndex: number;
  totalSetsInBlock: number;
}

function buildStepsFromBlocks(blocks: PacerBlock[]): PacerStep[] {
  const steps: PacerStep[] = [];
  blocks.forEach((block, blockIdx) => {
    for (let s = 1; s <= block.sets; s += 1) {
      steps.push({
        blockLabel: block.label,
        phase: 'work',
        durationSeconds: Math.max(5, block.workSeconds),
        setIndex: s,
        totalSetsInBlock: block.sets,
      });
      const isVeryLastStep = blockIdx === blocks.length - 1 && s === block.sets;
      if (!isVeryLastStep && block.restSeconds > 0) {
        steps.push({
          blockLabel: block.label,
          phase: 'rest',
          durationSeconds: Math.max(5, block.restSeconds),
          setIndex: s,
          totalSetsInBlock: block.sets,
        });
      }
    }
  });
  return steps;
}

export const PostureAndPacer: React.FC<PostureAndPacerProps> = ({
  deskIntervalMinutes,
  deskSecondsLeft,
  deskRunning,
  spineResetOpen,
  onSelectDeskInterval,
  onToggleDeskTimer,
  onResetDeskTimer,
  onOpenSpineReset,
  onCompleteSpineReset,
  onDismissSpineReset,
  todaysPostureLogs,
  todaysWorkouts,
  onCompleteWorkout,
}) => {
  // Spine reset 60-second checklist state
  const [checkedMovements, setCheckedMovements] = useState<string[]>(
    SPINE_RESET_MOVEMENTS.map((m) => m.title)
  );
  const [resetSecondsLeft, setResetSecondsLeft] = useState<number>(60);
  const [resetTimerActive, setResetTimerActive] = useState<boolean>(false);

  useEffect(() => {
    if (spineResetOpen) {
      setResetSecondsLeft(60);
      setResetTimerActive(true);
      setCheckedMovements(SPINE_RESET_MOVEMENTS.map((m) => m.title));
    } else {
      setResetTimerActive(false);
    }
  }, [spineResetOpen]);

  useEffect(() => {
    if (!resetTimerActive) return;
    const id = window.setInterval(() => {
      setResetSecondsLeft((prev) => {
        if (prev <= 1) {
          setResetTimerActive(false);
          audioService.playCompleteChord();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [resetTimerActive]);

  // Calisthenics Interval Pacer state
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(CALISTHENICS_ROUTINES[0].id);
  const [customSets, setCustomSets] = useState<number>(3);
  const [customWork, setCustomWork] = useState<number>(40);
  const [customRest, setCustomRest] = useState<number>(20);

  const activeRoutine = useMemo(() => {
    if (selectedRoutineId === 'custom') {
      return {
        id: 'custom',
        name: `Custom Calisthenics (${customSets}×${customWork}s)`,
        description: `${customSets} sets · ${customWork}s work · ${customRest}s rest`,
        blocks: [
          {
            label: 'Custom Isometric / Calisthenics Hold',
            sets: Math.max(1, Math.min(12, customSets)),
            workSeconds: Math.max(5, Math.min(300, customWork)),
            restSeconds: Math.max(5, Math.min(180, customRest)),
          },
        ],
      };
    }
    return (
      CALISTHENICS_ROUTINES.find((r) => r.id === selectedRoutineId) ?? CALISTHENICS_ROUTINES[0]
    );
  }, [selectedRoutineId, customSets, customWork, customRest]);

  const steps = useMemo(() => buildStepsFromBlocks(activeRoutine.blocks), [activeRoutine]);

  const [stepIdx, setStepIdx] = useState<number>(0);
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState<number>(steps[0]?.durationSeconds ?? 40);
  const [pacerRunning, setPacerRunning] = useState<boolean>(false);
  const [workoutCompletedBanner, setWorkoutCompletedBanner] = useState<string | null>(null);
  const completedWorkSecRef = useRef<number>(0);
  const completedSetsRef = useRef<number>(0);

  // Sync pacer cleanly when switching routines while stopped
  useEffect(() => {
    setPacerRunning(false);
    setStepIdx(0);
    setPhaseSecondsLeft(steps[0]?.durationSeconds ?? 40);
    completedWorkSecRef.current = 0;
    completedSetsRef.current = 0;
  }, [steps]);

  const currentStep = steps[stepIdx] ?? steps[0];

  const advanceToNextStep = (finishedNaturally: boolean) => {
    const step = steps[stepIdx];
    if (step && step.phase === 'work' && finishedNaturally) {
      completedWorkSecRef.current += step.durationSeconds;
      completedSetsRef.current += 1;
    }

    const nextIdx = stepIdx + 1;
    if (nextIdx >= steps.length) {
      setPacerRunning(false);
      setStepIdx(0);
      setPhaseSecondsLeft(steps[0]?.durationSeconds ?? 40);
      const totalLoggedSec = Math.max(
        completedWorkSecRef.current,
        activeRoutine.blocks.reduce((sum, b) => sum + b.sets * b.workSeconds, 0)
      );
      const totalLoggedSets = Math.max(
        completedSetsRef.current,
        activeRoutine.blocks.reduce((sum, b) => sum + b.sets, 0)
      );
      onCompleteWorkout(activeRoutine.name, totalLoggedSec, totalLoggedSets);
      audioService.playCompleteChord();
      audioService.vibrate([50, 60, 80]);
      setWorkoutCompletedBanner(
        `Logged "${activeRoutine.name}" (${totalLoggedSec}s total tension across ${totalLoggedSets} sets).`
      );
      completedWorkSecRef.current = 0;
      completedSetsRef.current = 0;
      return;
    }

    const nextStep = steps[nextIdx];
    setStepIdx(nextIdx);
    setPhaseSecondsLeft(nextStep.durationSeconds);
    if (nextStep.phase === 'work') {
      audioService.playStartWork();
      audioService.vibrate(40);
    } else {
      audioService.playRestChime();
      audioService.vibrate([25, 35, 25]);
    }
  };

  useEffect(() => {
    if (!pacerRunning) return;
    const id = window.setInterval(() => {
      setPhaseSecondsLeft((prev) => {
        if (prev <= 1) {
          advanceToNextStep(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  });

  const handleTogglePacer = () => {
    setWorkoutCompletedBanner(null);
    if (!pacerRunning) {
      audioService.playStartWork();
      audioService.vibrate(35);
    }
    setPacerRunning((prev) => !prev);
  };

  const handleResetPacer = () => {
    setPacerRunning(false);
    setStepIdx(0);
    setPhaseSecondsLeft(steps[0]?.durationSeconds ?? 40);
    completedWorkSecRef.current = 0;
    completedSetsRef.current = 0;
  };

  // Circular countdown ring geometry
  const ringRadius = 74;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const stepDuration = Math.max(1, currentStep?.durationSeconds ?? 40);
  const ringProgress = phaseSecondsLeft / stepDuration;
  const ringOffset = ringCircumference * (1 - ringProgress);
  const isWorkPhase = currentStep?.phase === 'work';
  const phaseColor = isWorkPhase ? '#2D6A4F' : '#D99B26';

  const deskTotalSeconds = deskIntervalMinutes * 60;
  const deskPct = Math.round(((deskTotalSeconds - deskSecondsLeft) / deskTotalSeconds) * 100);

  const toggleMovement = (title: string) => {
    setCheckedMovements((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  return (
    <div className="space-y-6">
      {/* 60-Second Spine & Hip-Flexor Reset Banner / Modal Panel */}
      {spineResetOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="spine-reset-heading"
          className="rounded-2xl border-2 border-[#C85A28] bg-[#FDFBF7] p-5 shadow-md md:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E0D1] pb-4">
            <div>
              <p className="text-xs font-semibold text-[#C85A28]">
                Desk-Fatigue Alert · 60-Second Spine &amp; Hip-Flexor Reset
              </p>
              <h3 id="spine-reset-heading" className="mt-1 font-serif text-xl font-bold text-[#1F1916]">
                Stand Up &amp; Decompress Your Lower Back
              </h3>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-metrics text-[#2D6A4F]">
                {formatClock(resetSecondsLeft)}
              </p>
              <p className="text-xs text-[#5C5046]">Guided reset clock</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 @2xl:grid-cols-3">
            {SPINE_RESET_MOVEMENTS.map((movement) => {
              const checked = checkedMovements.includes(movement.title);
              return (
                <label
                  key={movement.id}
                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                    checked
                      ? 'border-[#2D6A4F] bg-[#2D6A4F]/8'
                      : 'border-[#DDD4C3] bg-[#F9F6EE]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-[#1F1916]">{movement.title}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMovement(movement.title)}
                      className="mt-0.5 h-4 w-4 accent-[#2D6A4F]"
                    />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#5C5046]">{movement.cue}</p>
                  <p className="mt-2 text-xs font-semibold tabular-metrics text-[#2D6A4F]">
                    {movement.durationSec}s hold
                  </p>
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onDismissSpineReset}
              className="min-h-[42px] rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-4 py-2 text-xs font-semibold text-[#5C5046] hover:text-[#1F1916]"
            >
              Snooze
            </button>
            <button
              type="button"
              onClick={() =>
                onCompleteSpineReset(
                  checkedMovements.length > 0
                    ? checkedMovements
                    : SPINE_RESET_MOVEMENTS.map((m) => m.title)
                )
              }
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#2D6A4F] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#23543E]"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Complete Reset (+1 Desk Break)
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-12">
        {/* 1. Desk-Fatigue & Spine Reset Timer */}
        <section
          aria-labelledby="desk-guard-heading"
          className="editorial-card flex flex-col justify-between rounded-2xl p-5 @md:p-6 @3xl:col-span-5"
        >
          <div>
            <div className="flex items-start justify-between gap-3 border-b border-[#E8E0D1] pb-4">
              <div>
                <p className="text-xs font-medium text-[#5C5046]">
                  Study &amp; Coding Ergonomics
                </p>
                <h2 id="desk-guard-heading" className="mt-1 font-serif text-xl font-bold text-[#1F1916]">
                  Desk-Posture Guard
                </h2>
              </div>
              <Timer className="h-5 w-5 text-[#C85A28]" aria-hidden="true" />
            </div>

            {/* Interval Selector */}
            <div className="mt-4">
              <span className="block text-xs font-semibold text-[#5C5046]">
                Study Block Interval
              </span>
              <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-[#EFE8D8] p-1">
                {([30, 45, 60] as const).map((mins) => {
                  const active = deskIntervalMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onSelectDeskInterval(mins)}
                      className={`min-h-[38px] rounded-lg px-2 py-1.5 text-xs font-semibold tabular-metrics transition-colors ${
                        active
                          ? 'bg-[#C85A28] text-white'
                          : 'text-[#5C5046] hover:text-[#1F1916]'
                      }`}
                    >
                      {mins} min
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Countdown Display */}
            <div className="mt-6 rounded-xl bg-[#F9F6EE] p-5 text-center">
              <p className="text-xs font-medium text-[#5C5046]">
                {deskRunning ? 'Study session active' : 'Next spine reset countdown'}
              </p>
              <p
                className="mt-2 text-5xl font-bold tracking-tight tabular-metrics text-[#1F1916]"
                data-testid="desk-timer-clock"
              >
                {formatClock(deskSecondsLeft)}
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#E6DEC9]">
                <div
                  className="h-full rounded-full bg-[#C85A28] transition-all duration-300"
                  style={{ width: `${deskPct}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleDeskTimer}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#C85A28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B04A1D]"
              >
                {deskRunning ? (
                  <>
                    <Pause className="h-4 w-4" aria-hidden="true" />
                    Pause Guard
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Start Study Timer
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onResetDeskTimer}
                aria-label="Reset desk posture timer"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] text-[#1F1916] hover:border-[#C85A28]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenSpineReset}
              className="mt-2.5 min-h-[40px] w-full rounded-lg border border-[#2D6A4F]/40 bg-[#2D6A4F]/8 px-3 py-2 text-xs font-semibold text-[#2D6A4F] transition-colors hover:bg-[#2D6A4F]/15"
            >
              Launch 60-Second Spine Reset Now
            </button>
          </div>

          <div className="mt-6 border-t border-[#EFE8D8] pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-[#1F1916]">
                Desk Breaks Completed Today
              </span>
              <span
                className="text-base font-bold tabular-metrics text-[#2D6A4F]"
                data-testid="desk-breaks-count"
              >
                {todaysPostureLogs.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#5C5046]">
              Target 4+ spine resets during long coding or exam-prep days.
            </p>
          </div>
        </section>

        {/* 2. Form-First Isometric & Calisthenics Interval Pacer */}
        <section
          aria-labelledby="pacer-heading"
          className="editorial-card rounded-2xl p-5 @md:p-6 @3xl:col-span-7"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#E8E0D1] pb-4">
            <div>
              <p className="text-xs font-medium text-[#5C5046]">
                Form-First Bodyweight &amp; Isometric Pacer
              </p>
              <h2 id="pacer-heading" className="mt-1 font-serif text-xl font-bold text-[#1F1916]">
                Calisthenics Interval Pacer
              </h2>
            </div>
            <Dumbbell className="h-5 w-5 text-[#2D6A4F]" aria-hidden="true" />
          </div>

          {/* Preset Routine Selector */}
          <div className="mt-4 grid grid-cols-1 gap-2 @lg:grid-cols-2">
            {CALISTHENICS_ROUTINES.map((routine) => {
              const active = selectedRoutineId === routine.id;
              return (
                <button
                  key={routine.id}
                  type="button"
                  onClick={() => setSelectedRoutineId(routine.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-[#C85A28] bg-[#C85A28]/8'
                      : 'border-[#DDD4C3] bg-[#F9F6EE] hover:border-[#C85A28]/50'
                  }`}
                >
                  <p className="text-xs font-bold text-[#1F1916]">{routine.name}</p>
                  <p className="mt-0.5 text-[11px] text-[#5C5046]">{routine.description}</p>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedRoutineId('custom')}
              className={`rounded-xl border p-3 text-left transition-colors ${
                selectedRoutineId === 'custom'
                  ? 'border-[#C85A28] bg-[#C85A28]/8'
                  : 'border-[#DDD4C3] bg-[#F9F6EE] hover:border-[#C85A28]/50'
              }`}
            >
              <p className="text-xs font-bold text-[#1F1916]">Custom Interval Builder</p>
              <p className="mt-0.5 text-[11px] text-[#5C5046] tabular-metrics">
                {customSets} sets × {customWork}s work / {customRest}s rest
              </p>
            </button>
          </div>

          {selectedRoutineId === 'custom' && (
            <div className="mt-3 grid grid-cols-3 gap-3 rounded-xl bg-[#F9F6EE] p-3">
              <div>
                <label htmlFor="custom-sets" className="block text-[11px] font-medium text-[#5C5046]">
                  Sets
                </label>
                <input
                  id="custom-sets"
                  type="number"
                  min={1}
                  max={12}
                  value={customSets}
                  onChange={(e) => setCustomSets(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#FDFBF7] px-2.5 py-1.5 text-sm tabular-metrics text-[#1F1916]"
                />
              </div>
              <div>
                <label htmlFor="custom-work" className="block text-[11px] font-medium text-[#5C5046]">
                  Work (sec)
                </label>
                <input
                  id="custom-work"
                  type="number"
                  min={5}
                  max={300}
                  value={customWork}
                  onChange={(e) => setCustomWork(Number(e.target.value) || 10)}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#FDFBF7] px-2.5 py-1.5 text-sm tabular-metrics text-[#1F1916]"
                />
              </div>
              <div>
                <label htmlFor="custom-rest" className="block text-[11px] font-medium text-[#5C5046]">
                  Rest (sec)
                </label>
                <input
                  id="custom-rest"
                  type="number"
                  min={5}
                  max={180}
                  value={customRest}
                  onChange={(e) => setCustomRest(Number(e.target.value) || 10)}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#FDFBF7] px-2.5 py-1.5 text-sm tabular-metrics text-[#1F1916]"
                />
              </div>
            </div>
          )}

          {/* Large Circular Countdown Ring */}
          <div className="mt-6 flex flex-col items-center">
            <div className="relative flex h-48 w-48 items-center justify-center">
              <svg
                viewBox="0 0 180 180"
                className="h-48 w-48 -rotate-90"
                role="img"
                aria-label={`${isWorkPhase ? 'Work hold' : 'Rest'} timer, ${formatClock(phaseSecondsLeft)} remaining`}
              >
                <circle
                  cx="90"
                  cy="90"
                  r={ringRadius}
                  fill="none"
                  stroke="#EFE8D8"
                  strokeWidth="12"
                />
                <circle
                  cx="90"
                  cy="90"
                  r={ringRadius}
                  fill="none"
                  stroke={phaseColor}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-[stroke-dashoffset,stroke] duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className="text-xs font-bold tracking-wide"
                  style={{ color: phaseColor }}
                >
                  {isWorkPhase ? 'HOLD / WORK' : 'REST'}
                </span>
                <span
                  className="mt-1 text-4xl font-bold tabular-metrics text-[#1F1916]"
                  data-testid="pacer-clock"
                >
                  {formatClock(phaseSecondsLeft)}
                </span>
                <span className="mt-1 text-xs text-[#5C5046] tabular-metrics">
                  Set {currentStep?.setIndex ?? 1} of {currentStep?.totalSetsInBlock ?? 1}
                </span>
              </div>
            </div>

            <p className="mt-2 text-sm font-semibold text-[#1F1916]">
              {currentStep?.blockLabel ?? activeRoutine.name}
            </p>
            <p className="text-xs text-[#5C5046] tabular-metrics">
              Interval {stepIdx + 1} of {steps.length}
            </p>

            {/* Pacer Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleTogglePacer}
                className="inline-flex min-h-[44px] min-w-[140px] items-center justify-center gap-2 rounded-lg bg-[#C85A28] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B04A1D]"
              >
                {pacerRunning ? (
                  <>
                    <Pause className="h-4 w-4" aria-hidden="true" />
                    Pause Pacer
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {stepIdx === 0 && phaseSecondsLeft === stepDuration
                      ? 'Start Pacer'
                      : 'Resume Pacer'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => advanceToNextStep(true)}
                aria-label="Skip to next interval"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3.5 py-2 text-xs font-semibold text-[#1F1916] hover:border-[#C85A28]"
              >
                <SkipForward className="h-4 w-4" aria-hidden="true" />
                Next
              </button>
              <button
                type="button"
                onClick={handleResetPacer}
                aria-label="Reset calisthenics pacer"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] text-[#1F1916] hover:border-[#C85A28]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {workoutCompletedBanner && (
              <p
                role="status"
                className="mt-4 rounded-xl bg-[#2D6A4F]/12 px-4 py-2.5 text-xs font-semibold text-[#2D6A4F]"
              >
                {workoutCompletedBanner}
              </p>
            )}
          </div>

          {/* Today's Completed Workouts */}
          <div className="mt-6 border-t border-[#EFE8D8] pt-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-sm font-bold text-[#1F1916]">
                Today&apos;s Completed Sessions
              </h3>
              <span className="text-xs text-[#5C5046] tabular-metrics">
                {todaysWorkouts.length} completed
              </span>
            </div>
            {todaysWorkouts.length === 0 ? (
              <p className="mt-2 text-xs text-[#5C5046]">
                Finish a paced routine above to log total plank &amp; training tension automatically.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[#EFE8D8]">
                {todaysWorkouts.map((w) => (
                  <li key={w.id} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-semibold text-[#1F1916]">{w.routineName}</span>
                    <span className="tabular-metrics text-[#2D6A4F] font-semibold">
                      {w.setsCompleted} sets · {w.totalWorkSeconds}s
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
