import React, { useState } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { AppState, ComputedTargets, DailySummary } from '../types/wellness';
import { buildSevenDayChronicle } from '../utils/calculations';

interface ChronicleViewProps {
  state: AppState;
  targets: ComputedTargets;
}

export const ChronicleView: React.FC<ChronicleViewProps> = ({ state, targets }) => {
  const chronicle = buildSevenDayChronicle(state);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    chronicle.days[chronicle.days.length - 1]?.dateKey ?? state.activeDateKey
  );
  const [showPrintModal, setShowPrintModal] = useState(false);

  const selectedDay: DailySummary =
    chronicle.days.find((d) => d.dateKey === selectedDayKey) ??
    chronicle.days[chronicle.days.length - 1];

  // Scale helper for SVG grouped bars (all normalized onto 0..100 chart height)
  const maxSessions = Math.max(2, ...chronicle.days.map((d) => d.trainingSessions));
  const maxBreaks = Math.max(6, ...chronicle.days.map((d) => d.deskBreaks));

  return (
    <div className="space-y-6">
      {/* Streak & Consistency Summary Cards */}
      <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
        <div className="editorial-card rounded-2xl p-4 md:p-5">
          <p className="text-xs font-medium text-[#5C5046]">Active Discipline Streak</p>
          <p className="mt-2 text-3xl font-bold tabular-metrics text-[#C85A28]" data-testid="chronicle-streak">
            {chronicle.streakDays}{' '}
            <span className="text-sm font-semibold text-[#5C5046]">
              {chronicle.streakDays === 1 ? 'day' : 'days'}
            </span>
          </p>
          <p className="mt-1 text-xs text-[#5C5046]">Consistent protein, training, or breaks</p>
        </div>

        <div className="editorial-card rounded-2xl p-4 md:p-5">
          <p className="text-xs font-medium text-[#5C5046]">7-Day Avg Readiness</p>
          <p className="mt-2 text-3xl font-bold tabular-metrics text-[#2D6A4F]">
            {chronicle.avgReadiness}%
          </p>
          <p className="mt-1 text-xs text-[#5C5046]">Recovery &amp; vitals composite</p>
        </div>

        <div className="editorial-card rounded-2xl p-4 md:p-5">
          <p className="text-xs font-medium text-[#5C5046]">Weekly Plank &amp; Training</p>
          <p className="mt-2 text-3xl font-bold tabular-metrics text-[#1F1916]">
            {chronicle.totalTrainingSeconds}s
          </p>
          <p className="mt-1 text-xs text-[#5C5046] tabular-metrics">
            {Math.round(chronicle.totalTrainingSeconds / 60)} min under tension
          </p>
        </div>

        <div className="editorial-card rounded-2xl p-4 md:p-5">
          <p className="text-xs font-medium text-[#5C5046]">Desk-Posture Breaks</p>
          <p className="mt-2 text-3xl font-bold tabular-metrics text-[#1F1916]">
            {chronicle.totalDeskBreaks}
          </p>
          <p className="mt-1 text-xs text-[#5C5046]">60-sec spine resets logged</p>
        </div>
      </div>

      {/* 7-Day Grouped Bar Chart */}
      <section aria-labelledby="chronicle-chart-heading" className="editorial-card rounded-2xl p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E8E0D1] pb-4">
          <div>
            <p className="text-xs font-medium text-[#5C5046]">
              Rolling 7-Day Consistency Ledger
            </p>
            <h2 id="chronicle-chart-heading" className="mt-1 font-serif text-xl font-bold text-[#1F1916]">
              Protein, Training &amp; Desk Breaks
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#C85A28] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B04A1D] whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Printable Summary
            </button>
          </div>
        </div>

        {/* Chart Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#5C5046]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#D99B26]" aria-hidden="true" />
            Protein Consistency (%)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#2D6A4F]" aria-hidden="true" />
            Core / Training Sessions
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#C85A28]" aria-hidden="true" />
            Desk-Posture Breaks
          </span>
        </div>

        {/* Responsive Pure SVG Grouped Bar Chart */}
        <div className="mt-5 overflow-x-auto">
          <svg
            viewBox="0 0 680 230"
            className="h-56 w-full min-w-[460px]"
            role="img"
            aria-label="7-day grouped bar chart comparing protein consistency, training sessions, and desk posture breaks"
          >
            {/* Horizontal grid lines */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = 186 - (pct / 100) * 156;
              return (
                <g key={pct}>
                  <line
                    x1="40"
                    y1={y}
                    x2="664"
                    y2={y}
                    stroke="#ECE4D5"
                    strokeWidth="1"
                  />
                  <text
                    x="32"
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#7D7064"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {chronicle.days.map((day, idx) => {
              const groupWidth = 88;
              const startX = 56 + idx * groupWidth;
              const isSelected = day.dateKey === selectedDay?.dateKey;

              const proteinH = Math.max(2, (day.proteinConsistencyPct / 100) * 156);
              const sessionH = Math.max(
                day.trainingSessions > 0 ? 12 : 2,
                (day.trainingSessions / maxSessions) * 156
              );
              const breaksH = Math.max(
                day.deskBreaks > 0 ? 10 : 2,
                (day.deskBreaks / maxBreaks) * 156
              );

              return (
                <g
                  key={day.dateKey}
                  onClick={() => setSelectedDayKey(day.dateKey)}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <rect
                      x={startX - 8}
                      y="22"
                      width="72"
                      height="196"
                      rx="10"
                      fill="#EFE8D8"
                      fillOpacity="0.65"
                    />
                  )}
                  {/* Protein Consistency Bar (Amber Gold) */}
                  <rect
                    x={startX}
                    y={186 - proteinH}
                    width="16"
                    height={proteinH}
                    rx="3"
                    fill="#D99B26"
                  />
                  {/* Training Sessions Bar (Forest Green) */}
                  <rect
                    x={startX + 20}
                    y={186 - sessionH}
                    width="16"
                    height={sessionH}
                    rx="3"
                    fill="#2D6A4F"
                  />
                  {/* Desk Breaks Bar (Terracotta) */}
                  <rect
                    x={startX + 40}
                    y={186 - breaksH}
                    width="16"
                    height={breaksH}
                    rx="3"
                    fill="#C85A28"
                  />
                  <text
                    x={startX + 28}
                    y="206"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={isSelected ? '700' : '500'}
                    fill={isSelected ? '#1F1916' : '#5C5046'}
                  >
                    {day.dayLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Interactive Day Inspector Row */}
        {selectedDay && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#F9F6EE] px-4 py-3.5 text-xs">
            <div>
              <span className="font-serif text-sm font-bold text-[#1F1916]">
                {selectedDay.dayLabel} · {selectedDay.dateKey}
              </span>
              <span className="ml-2 text-[#5C5046]">
                {selectedDay.dateKey === state.activeDateKey ? '(Today)' : '(Archived)'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-metrics text-[#1F1916]">
              <span>
                Protein:{' '}
                <strong className="text-[#D99B26]">
                  {selectedDay.proteinG}g ({selectedDay.proteinConsistencyPct}%)
                </strong>
              </span>
              <span>
                Training:{' '}
                <strong className="text-[#2D6A4F]">
                  {selectedDay.trainingSessions} sessions ({selectedDay.trainingSeconds}s)
                </strong>
              </span>
              <span>
                Desk Breaks:{' '}
                <strong className="text-[#C85A28]">{selectedDay.deskBreaks}</strong>
              </span>
              <span>
                Readiness: <strong>{selectedDay.readinessScore}%</strong>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Printable Wellness Summary Modal */}
      {showPrintModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="printable-report-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B1B12]/60 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#DDD4C3] bg-[#FDFBF7] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#E8E0D1] pb-4">
              <div>
                <p className="text-xs font-medium text-[#5C5046]">
                  JANKENFIT Student Wellness Report · Generated {state.activeDateKey}
                </p>
                <h3
                  id="printable-report-title"
                  className="mt-1 font-serif text-xl font-bold text-[#1F1916]"
                >
                  7-Day Discipline &amp; Recovery Summary
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                aria-label="Close printable wellness summary"
                className="no-print flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-[#5C5046] hover:bg-[#EFE8D8]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F9F6EE] p-4 text-xs sm:grid-cols-4 tabular-metrics">
              <div>
                <p className="text-[#5C5046]">Student</p>
                <p className="mt-0.5 font-semibold text-[#1F1916]">{state.profile.name}</p>
              </div>
              <div>
                <p className="text-[#5C5046]">BMI / Goal</p>
                <p className="mt-0.5 font-semibold text-[#1F1916]">
                  {targets.bmi.toFixed(1)} ({targets.bmiCategory})
                </p>
              </div>
              <div>
                <p className="text-[#5C5046]">Daily Protein Floor</p>
                <p className="mt-0.5 font-semibold text-[#1F1916]">{targets.proteinTargetG}g</p>
              </div>
              <div>
                <p className="text-[#5C5046]">7-Day Streak</p>
                <p className="mt-0.5 font-semibold text-[#2D6A4F]">{chronicle.streakDays} days</p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs tabular-metrics">
                <thead>
                  <tr className="border-b border-[#DDD4C3] text-[#5C5046]">
                    <th className="py-2 pr-3 font-semibold">Day</th>
                    <th className="py-2 px-3 text-right font-semibold">Protein</th>
                    <th className="py-2 px-3 text-right font-semibold">Readiness</th>
                    <th className="py-2 px-3 text-right font-semibold">Training</th>
                    <th className="py-2 pl-3 text-right font-semibold">Desk Breaks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE8D8]">
                  {chronicle.days.map((d) => (
                    <tr key={d.dateKey}>
                      <td className="py-2.5 pr-3 font-semibold text-[#1F1916]">
                        {d.dayLabel} ({d.dateKey})
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {d.proteinG}g ({d.proteinConsistencyPct}%)
                      </td>
                      <td className="py-2.5 px-3 text-right">{d.readinessScore}%</td>
                      <td className="py-2.5 px-3 text-right">
                        {d.trainingSessions} ({d.trainingSeconds}s)
                      </td>
                      <td className="py-2.5 pl-3 text-right">{d.deskBreaks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="no-print mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#C85A28] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B04A1D]"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
