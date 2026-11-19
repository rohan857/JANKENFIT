import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { FATIGUE_OPTIONS } from '../data/presets';
import {
  ReadinessEvaluation,
  ReadinessState,
  SleepQuality,
  VitalReading,
} from '../types/wellness';

interface ReadinessPanelProps {
  readiness: ReadinessState;
  evaluation: ReadinessEvaluation;
  hydrationTargetGlasses: number;
  latestVital?: VitalReading;
  onChangeReadiness: (next: ReadinessState) => void;
}

const SLEEP_QUALITIES: SleepQuality[] = ['Restless', 'Average', 'Deep'];

export const ReadinessPanel: React.FC<ReadinessPanelProps> = ({
  readiness,
  evaluation,
  hydrationTargetGlasses,
  latestVital,
  onChangeReadiness,
}) => {
  const gaugeRadius = 58;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const dashOffset = gaugeCircumference * (1 - evaluation.score / 100);

  const gaugeStroke =
    evaluation.tone === 'forest'
      ? '#2D6A4F'
      : evaluation.tone === 'amber'
        ? '#D99B26'
        : '#B91C1C';

  const hydrationPct = Math.min(
    100,
    Math.round((readiness.hydrationGlasses / Math.max(1, hydrationTargetGlasses)) * 100)
  );
  const flaskLiquidHeight = Math.round((hydrationPct / 100) * 62);
  const flaskLiquidY = 82 - flaskLiquidHeight;

  const updateHydration = (delta: number) => {
    const next = Math.max(0, Math.min(20, readiness.hydrationGlasses + delta));
    onChangeReadiness({ ...readiness, hydrationGlasses: next });
  };

  return (
    <section
      aria-labelledby="readiness-heading"
      className="editorial-card rounded-2xl p-5 @md:p-6"
    >
      <div className="flex flex-col gap-5 @2xl:flex-row @2xl:items-center @2xl:justify-between border-b border-[#E8E0D1] pb-5">
        <div className="flex items-center gap-5">
          {/* SVG Readiness Gauge */}
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
            <svg
              viewBox="0 0 140 140"
              className="h-36 w-36 -rotate-90"
              role="img"
              aria-label={`Daily readiness score ${evaluation.score} percent, status ${evaluation.statusLabel}`}
            >
              <circle
                cx="70"
                cy="70"
                r={gaugeRadius}
                fill="none"
                stroke="#EFE8D8"
                strokeWidth="12"
              />
              <circle
                cx="70"
                cy="70"
                r={gaugeRadius}
                fill="none"
                stroke={gaugeStroke}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset,stroke] duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                className="text-3xl font-bold tabular-metrics"
                style={{ color: gaugeStroke }}
                data-testid="readiness-score"
              >
                {evaluation.score}%
              </span>
              <span className="mt-0.5 text-xs font-semibold text-[#5C5046]">
                {evaluation.statusLabel}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-[#6E5D52]">
              Daily Readiness Score
            </p>
            <h2
              id="readiness-heading"
              className="mt-1 font-serif text-xl font-bold text-[#1F1916]"
            >
              {evaluation.prescription}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5C5046] tabular-metrics">
              <span>Sleep {evaluation.breakdown.sleep}/40</span>
              <span aria-hidden="true">·</span>
              <span>Strain {evaluation.breakdown.fatigue}/30</span>
              <span aria-hidden="true">·</span>
              <span>Hydration {evaluation.breakdown.hydration}/15</span>
              <span aria-hidden="true">·</span>
              <span>
                Vitals {evaluation.breakdown.vitals}/15
                {latestVital ? ` (${latestVital.bpm} BPM)` : ' (Baseline)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Recovery Inputs */}
      <div className="mt-5 grid grid-cols-1 gap-6 @2xl:grid-cols-12">
        {/* Sleep Duration + Quality */}
        <div className="space-y-4 @2xl:col-span-5">
          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="sleep-duration-slider"
                className="text-sm font-semibold text-[#1F1916]"
              >
                Sleep Duration
              </label>
              <span className="text-base font-bold tabular-metrics text-[#2D6A4F]">
                {readiness.sleepHours.toFixed(1)}h
              </span>
            </div>
            <input
              id="sleep-duration-slider"
              type="range"
              min={3.0}
              max={11.0}
              step={0.5}
              value={readiness.sleepHours}
              onChange={(e) =>
                onChangeReadiness({
                  ...readiness,
                  sleepHours: parseFloat(e.target.value),
                })
              }
              className="editorial-range mt-2.5 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-[#5C5046] tabular-metrics">
              <span>3.0h</span>
              <span>7.5h ideal</span>
              <span>11.0h</span>
            </div>
          </div>

          <div>
            <span className="block text-sm font-semibold text-[#1F1916]">
              Sleep Quality
            </span>
            <div
              role="radiogroup"
              aria-label="Sleep quality"
              className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-[#EFE8D8] p-1"
            >
              {SLEEP_QUALITIES.map((quality) => {
                const active = readiness.sleepQuality === quality;
                return (
                  <button
                    key={quality}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      onChangeReadiness({ ...readiness, sleepQuality: quality })
                    }
                    className={`min-h-[40px] rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#C85A28] text-white shadow-xs'
                        : 'text-[#5C5046] hover:text-[#1F1916]'
                    }`}
                  >
                    {quality}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lower-Back & Physical Fatigue Selector */}
        <div className="@2xl:col-span-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-[#1F1916]">
              Physical &amp; Lower-Back Fatigue
            </span>
            <span className="text-xs font-semibold tabular-metrics text-[#5C5046]">
              Level {readiness.fatigueLevel}/5
            </span>
          </div>
          <div
            role="radiogroup"
            aria-label="Physical and lower-back fatigue"
            className="mt-2.5 space-y-1.5"
          >
            {FATIGUE_OPTIONS.map((opt) => {
              const active = readiness.fatigueLevel === opt.level;
              const isHighStrain = opt.level >= 4;
              return (
                <button
                  key={opt.level}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    onChangeReadiness({ ...readiness, fatigueLevel: opt.level })
                  }
                  className={`flex min-h-[38px] w-full items-center justify-between rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                    active
                      ? isHighStrain
                        ? 'border-[#B91C1C] bg-[#B91C1C]/10 text-[#B91C1C] font-semibold'
                        : 'border-[#2D6A4F] bg-[#2D6A4F]/10 text-[#2D6A4F] font-semibold'
                      : 'border-[#E8E0D1] bg-[#F9F6EE] text-[#5C5046] hover:border-[#C85A28]/50 hover:text-[#1F1916]'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="tabular-metrics">{opt.level}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hydration Flask Tracker */}
        <div className="flex flex-col justify-between rounded-xl bg-[#F9F6EE] p-4 @2xl:col-span-3">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#1F1916]">Hydration Flask</span>
              <span className="text-xs font-semibold tabular-metrics text-[#2D6A4F]">
                {hydrationPct}%
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#5C5046] tabular-metrics">
              {readiness.hydrationGlasses} / {hydrationTargetGlasses} glasses (
              {(readiness.hydrationGlasses * 0.25).toFixed(2)}L)
            </p>
          </div>

          <div className="my-3 flex items-center justify-center">
            <svg
              viewBox="0 0 80 96"
              className="h-24 w-20"
              role="img"
              aria-label={`Hydration flask filled ${hydrationPct} percent`}
            >
              <defs>
                <clipPath id="flaskClip">
                  <rect x="16" y="20" width="48" height="62" rx="12" />
                </clipPath>
              </defs>
              {/* Flask Cap & Neck */}
              <rect x="28" y="6" width="24" height="8" rx="3" fill="#2B1B12" />
              <rect x="31" y="14" width="18" height="6" fill="#DDD4C3" />
              {/* Flask Body Background */}
              <rect
                x="16"
                y="20"
                width="48"
                height="62"
                rx="12"
                fill="#FDFBF7"
                stroke="#DDD4C3"
                strokeWidth="2.5"
              />
              {/* Liquid Fill */}
              <g clipPath="url(#flaskClip)">
                <rect
                  x="16"
                  y={flaskLiquidY}
                  width="48"
                  height={flaskLiquidHeight + 2}
                  fill="#2D6A4F"
                  fillOpacity="0.82"
                  className="transition-all duration-300"
                />
                {hydrationPct > 0 && (
                  <line
                    x1="16"
                    y1={flaskLiquidY}
                    x2="64"
                    y2={flaskLiquidY}
                    stroke="#F2EAD3"
                    strokeWidth="2"
                  />
                )}
              </g>
              {/* Measurement Tick Lines */}
              <line x1="22" y1="36" x2="30" y2="36" stroke="#DDD4C3" strokeWidth="1.5" />
              <line x1="22" y1="51" x2="32" y2="51" stroke="#DDD4C3" strokeWidth="1.5" />
              <line x1="22" y1="66" x2="30" y2="66" stroke="#DDD4C3" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateHydration(-1)}
              disabled={readiness.hydrationGlasses <= 0}
              aria-label="Remove 1 glass of water"
              className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg border border-[#DDD4C3] bg-[#FDFBF7] text-[#1F1916] transition-colors hover:border-[#C85A28] disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => updateHydration(1)}
              className="flex min-h-[42px] flex-1 items-center justify-center gap-1 rounded-lg bg-[#C85A28] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B04A1D] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              +1 Glass (250ml)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
