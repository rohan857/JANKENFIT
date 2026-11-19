import React, { useEffect, useState } from 'react';
import { Eye, HeartHandshake, Pause, Play, RotateCcw, Trash2, Wind } from 'lucide-react';
import { MoodState, WellnessLog } from '../types/wellness';
import { audioService } from '../utils/audioService';
import { formatClock } from '../utils/calculations';

interface WellnessHubProps {
  activeDateKey: string;
  wellnessLogs: WellnessLog[];
  onAddWellnessLog: (log: Omit<WellnessLog, 'id' | 'dateKey' | 'loggedAt'>) => void;
  onDeleteWellnessLog: (id: string) => void;
}

const BREATH_PHASES = [
  { label: 'Inhale Slowly', seconds: 4, scale: 1.0 },
  { label: 'Hold Full', seconds: 4, scale: 1.0 },
  { label: 'Exhale Gently', seconds: 4, scale: 0.62 },
  { label: 'Hold Empty', seconds: 4, scale: 0.62 },
] as const;

const MOOD_OPTIONS: MoodState[] = ['Focused', 'Calm', 'Motivated', 'Tired', 'Stressed'];

export const WellnessHub: React.FC<WellnessHubProps> = ({
  wellnessLogs,
  onAddWellnessLog,
  onDeleteWellnessLog,
}) => {
  // 1. Box Breathing 4-4-4-4 state
  const [breathRunning, setBreathRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseSecLeft, setPhaseSecLeft] = useState<number>(BREATH_PHASES[0].seconds);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  useEffect(() => {
    if (!breathRunning) return;
    const id = window.setInterval(() => {
      setPhaseSecLeft((prev) => {
        if (prev <= 1) {
          const nextIdx = (phaseIdx + 1) % BREATH_PHASES.length;
          setPhaseIdx(nextIdx);
          if (nextIdx === 0) {
            setCyclesCompleted((c) => {
              const nextCycles = c + 1;
              if (nextCycles === 4) {
                setBreathRunning(false);
                audioService.playCompleteChord();
                onAddWellnessLog({
                  kind: 'breathing',
                  mood: 'Calm',
                  note: 'Completed 4 cycles of 4-4-4-4 Box Breathing stress reset.',
                  durationSeconds: 64,
                });
              } else {
                audioService.playRestChime();
              }
              return nextCycles;
            });
          } else {
            audioService.playScanTick();
          }
          return BREATH_PHASES[nextIdx].seconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [breathRunning, phaseIdx, onAddWellnessLog]);

  // 2. 20-20-20 Eye-Strain Relief Timer
  const [eyeRunning, setEyeRunning] = useState(false);
  const [eyeSecondsLeft, setEyeSecondsLeft] = useState(20);
  const [eyeDoneNotice, setEyeDoneNotice] = useState(false);

  useEffect(() => {
    if (!eyeRunning) return;
    const id = window.setInterval(() => {
      setEyeSecondsLeft((prev) => {
        if (prev <= 1) {
          setEyeRunning(false);
          setEyeDoneNotice(true);
          audioService.playCompleteChord();
          onAddWellnessLog({
            kind: 'eye-rest',
            mood: 'Focused',
            note: 'Completed 20-20-20 eye-strain relief break (looked 20 ft away for 20s).',
            durationSeconds: 20,
          });
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [eyeRunning, onAddWellnessLog]);

  // 3. Daily Mood & Reflection Journal
  const [mood, setMood] = useState<MoodState>('Focused');
  const [note, setNote] = useState('');
  const [journalError, setJournalError] = useState<string | null>(null);

  const handleSaveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = note.trim();
    if (!cleaned) {
      setJournalError('Write a brief check-in note or gratitude reflection.');
      return;
    }
    onAddWellnessLog({
      kind: 'mood',
      mood,
      note: cleaned,
      durationSeconds: 0,
    });
    setNote('');
    setJournalError(null);
  };

  const currentPhase = BREATH_PHASES[phaseIdx];

  const formatTime = (iso: string) => {
    try {
      const dt = new Date(iso);
      return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${dt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-12">
        {/* 1. Box Breathing 4-4-4-4 Stress Reset */}
        <section
          aria-labelledby="box-breathing-heading"
          className="editorial-card rounded-2xl p-5 @md:p-6 @3xl:col-span-6"
        >
          <div className="flex items-start justify-between gap-2 border-b border-[#E8E0D1] pb-4">
            <div>
              <p className="text-xs font-medium text-[#6E5D52]">
                Guided Calm Reset · 4-4-4-4
              </p>
              <h2
                id="box-breathing-heading"
                className="mt-1 font-serif text-xl font-bold text-[#1F1916]"
              >
                Box Breathing Pacer
              </h2>
            </div>
            <Wind className="h-5 w-5 text-[#2D6A4F]" aria-hidden="true" />
          </div>

          <div className="mt-6 flex flex-col items-center">
            <div className="relative flex h-44 w-44 items-center justify-center">
              <div
                className="flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 border-[#2D6A4F] bg-[#2D6A4F]/12 transition-transform duration-1000 ease-in-out"
                style={{
                  transform: `scale(${breathRunning ? currentPhase.scale : 0.84})`,
                }}
              >
                <span className="text-xs font-semibold text-[#2D6A4F]">{currentPhase.label}</span>
                <span className="mt-1 text-4xl font-bold tabular-metrics text-[#1F1916]">
                  {phaseSecLeft}s
                </span>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#5C5046] tabular-metrics">
              Cycle {Math.min(4, cyclesCompleted + (breathRunning ? 1 : 0))} of 4 · Auto-logs on
              completion
            </p>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!breathRunning) {
                    if (cyclesCompleted >= 4) setCyclesCompleted(0);
                    audioService.playStartWork();
                  }
                  setBreathRunning((r) => !r);
                }}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#2D6A4F] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#23543E]"
              >
                {breathRunning ? (
                  <>
                    <Pause className="h-4 w-4" aria-hidden="true" />
                    Pause Breathing
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Start 4-Cycle Reset
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBreathRunning(false);
                  setPhaseIdx(0);
                  setPhaseSecLeft(BREATH_PHASES[0].seconds);
                  setCyclesCompleted(0);
                }}
                aria-label="Reset box breathing pacer"
                className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] text-[#1F1916] hover:border-[#C85A28]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* 2. 20-20-20 Digital Eye-Strain Relief + Mindful Check-in */}
        <div className="space-y-6 @3xl:col-span-6">
          <section
            aria-labelledby="eye-strain-heading"
            className="editorial-card rounded-2xl p-5 @md:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#5C5046]">Screen Fatigue Protection</p>
                <h3
                  id="eye-strain-heading"
                  className="mt-1 font-serif text-lg font-bold text-[#1F1916]"
                >
                  20-20-20 Eye-Strain Break
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#5C5046]">
                  Every 20 minutes of coding or reading, look at an object 20 feet away for 20
                  seconds to relax ciliary eye muscles.
                </p>
              </div>
              <Eye className="h-5 w-5 shrink-0 text-[#C85A28]" aria-hidden="true" />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F9F6EE] px-4 py-3">
              <div>
                <span className="text-2xl font-bold tabular-metrics text-[#1F1916]">
                  {formatClock(eyeSecondsLeft)}
                </span>
                <p className="text-[11px] text-[#5C5046]">
                  {eyeRunning
                    ? 'Focus on a distant wall or window...'
                    : eyeDoneNotice
                      ? 'Eye break logged — vision refreshed.'
                      : 'Ready for a 20-second gaze shift'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEyeDoneNotice(false);
                  if (!eyeRunning) {
                    setEyeSecondsLeft(20);
                    audioService.playStartWork();
                  }
                  setEyeRunning((r) => !r);
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#C85A28] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B04A1D] whitespace-nowrap"
              >
                {eyeRunning ? 'Stop 20s Break' : 'Start 20s Eye Rest'}
              </button>
            </div>
          </section>

          <section
            aria-labelledby="mood-journal-heading"
            className="editorial-card rounded-2xl p-5 @md:p-6"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-[#5C5046]">Student Mental Clarity</p>
                <h3
                  id="mood-journal-heading"
                  className="mt-1 font-serif text-lg font-bold text-[#1F1916]"
                >
                  Mood &amp; Reflection Check-In
                </h3>
              </div>
              <HeartHandshake className="h-5 w-5 text-[#2D6A4F]" aria-hidden="true" />
            </div>

            <form onSubmit={handleSaveJournal} className="mt-3.5 space-y-3" noValidate>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Current mood">
                {MOOD_OPTIONS.map((opt) => {
                  const active = mood === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMood(opt)}
                      className={`min-h-[34px] rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white'
                          : 'border-[#DDD4C3] bg-[#F9F6EE] text-[#5C5046] hover:text-[#1F1916]'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div>
                <label htmlFor="wellness-reflection" className="sr-only">
                  Wellness reflection note
                </label>
                <textarea
                  id="wellness-reflection"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="How is your energy, stress level, or focus feeling today?"
                  className="w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2 text-xs text-[#1F1916] placeholder:text-[#8E8174] focus:border-[#C85A28] focus:outline-none"
                />
              </div>

              {journalError && (
                <p role="alert" className="text-xs font-medium text-[#B91C1C]">
                  {journalError}
                </p>
              )}

              <button
                type="submit"
                className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg bg-[#C85A28] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B04A1D]"
              >
                Save Wellness Check-In
              </button>
            </form>
          </section>
        </div>
      </div>

      {/* Mind-Body Wellness Ledger */}
      <section
        aria-labelledby="wellness-history-heading"
        className="editorial-card rounded-2xl p-5 @md:p-6"
      >
        <div className="flex items-baseline justify-between border-b border-[#EFE8DD] pb-3">
          <h3
            id="wellness-history-heading"
            className="font-serif text-lg font-bold text-[#1F1916]"
          >
            Mind-Body Wellness Ledger
          </h3>
          <span className="text-xs text-[#6E5D52] tabular-metrics">
            {wellnessLogs.length} {wellnessLogs.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {wellnessLogs.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#6E5D52]">
            No wellness check-ins yet today. Complete a breathing reset, eye break, or reflection
            above to start your log.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[#EFE8D8]" data-testid="wellness-log-list">
            {wellnessLogs.slice(0, 10).map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1F1916]">
                    {entry.mood ?? 'Mindfulness'} ·{' '}
                    <span className="font-normal text-[#6E5D52] capitalize">
                      {entry.kind.replace('-', ' ')}
                    </span>
                    {entry.loggedAt ? ` · ${formatTime(entry.loggedAt)}` : ''}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#6E5D52]">{entry.note}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteWellnessLog(entry.id)}
                  aria-label={`Delete wellness entry ${entry.note.slice(0, 20)}`}
                  className="flex min-h-[34px] min-w-[34px] shrink-0 items-center justify-center rounded-lg text-[#6E5D52] hover:bg-[#B91C1C]/10 hover:text-[#B91C1C]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
