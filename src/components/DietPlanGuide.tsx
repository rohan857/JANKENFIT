import React from 'react';
import { Check, CheckCircle2, Plus, RotateCcw, Sparkles } from 'lucide-react';
import {
  ComputedTargets,
  DietMealSlot,
  DietPreference,
  MealEntry,
  UserProfile,
} from '../types/wellness';
import { calculateDietAdherence, generatePersonalizedDietPlan } from '../utils/calculations';

interface DietPlanGuideProps {
  profile: UserProfile;
  targets: ComputedTargets;
  dietPreference: DietPreference;
  loggedMeals: MealEntry[];
  adheredSlotIds: string[];
  onChangePreference: (pref: DietPreference) => void;
  onToggleAdherence: (slotId: string) => void;
  onResetAdherence: () => void;
  onLogDietSlot: (slot: DietMealSlot) => void;
}

const PREFERENCES: DietPreference[] = ['Hostel Veg', 'Eggetarian', 'Non-Veg'];

export const DietPlanGuide: React.FC<DietPlanGuideProps> = ({
  profile,
  targets,
  dietPreference,
  loggedMeals,
  adheredSlotIds,
  onChangePreference,
  onToggleAdherence,
  onResetAdherence,
  onLogDietSlot,
}) => {
  const planSlots = generatePersonalizedDietPlan(profile, targets, dietPreference);
  const adherence = calculateDietAdherence(planSlots, adheredSlotIds);
  const planProtein = planSlots.reduce((sum, s) => sum + s.proteinG, 0);
  const planCalories = planSlots.reduce((sum, s) => sum + s.caloriesKcal, 0);
  const goalDelta = targets.calorieTargetKcal - targets.tdee;

  return (
    <section
      aria-labelledby="diet-plan-guide-heading"
      data-testid="diet-plan-guide"
      className="editorial-card rounded-2xl p-5 @md:p-6"
    >
      {/* Header & Dietary Preference Switcher */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E0D1] pb-4">
        <div>
          <p className="text-xs font-medium text-[#5C5046]">
            Structured Daily Meal Template · Calibrated for {profile.goal}
          </p>
          <h3
            id="diet-plan-guide-heading"
            className="mt-1 font-serif text-lg font-bold text-[#1F1916]"
          >
            Diet Plan Guide &amp; Adherence Checklist
          </h3>
        </div>

        <div
          role="radiogroup"
          aria-label="Dietary preference"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-[#EFE8D8] p-1"
        >
          {PREFERENCES.map((pref) => {
            const active = dietPreference === pref;
            return (
              <button
                key={pref}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChangePreference(pref)}
                className={`min-h-[34px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active ? 'bg-[#C85A28] text-white' : 'text-[#5C5046] hover:text-[#1F1916]'
                }`}
              >
                {pref}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calculated TDEE & Protein Basis Strip */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 @md:grid-cols-3">
        <div className="rounded-xl border border-[#E8E0D1] bg-[#F9F6EE] px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-[#5C5046]">Calculated TDEE</p>
          <p className="mt-0.5 text-base font-bold tabular-metrics text-[#1F1916]">
            {targets.tdee.toLocaleString()} kcal
          </p>
          <p className="text-[11px] text-[#5C5046] tabular-metrics">
            BMR {targets.bmr.toLocaleString()} kcal · {profile.activityLevel.split(' / ')[0]}
          </p>
        </div>

        <div className="rounded-xl border border-[#E8E0D1] bg-[#F9F6EE] px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-[#5C5046]">Daily Template Target</p>
          <p
            className="mt-0.5 text-base font-bold tabular-metrics text-[#2D6A4F]"
            data-testid="diet-plan-total-calories"
          >
            {planCalories.toLocaleString()} kcal
          </p>
          <p className="text-[11px] text-[#5C5046] tabular-metrics">
            {goalDelta === 0
              ? 'Matched to maintenance TDEE'
              : `${goalDelta > 0 ? '+' : ''}${goalDelta} kcal (${profile.goal})`}
          </p>
        </div>

        <div className="rounded-xl border border-[#E8E0D1] bg-[#F9F6EE] px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-[#5C5046]">Daily Protein Allocation</p>
          <p
            className="mt-0.5 text-base font-bold tabular-metrics text-[#D99B26]"
            data-testid="diet-plan-total-protein"
          >
            {planProtein}g Protein
          </p>
          <p className="text-[11px] text-[#5C5046] tabular-metrics">
            Distributed across 5 timed student meals
          </p>
        </div>
      </div>

      {/* Interactive Meal Adherence Progress Bar */}
      <div className="mt-4 rounded-xl border border-[#E8E0D1] bg-[#F9F6EE] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#2D6A4F]" aria-hidden="true" />
            <span className="text-xs font-semibold text-[#1F1916]">
              Daily Meal Adherence Checklist
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-xs font-bold tabular-metrics text-[#2D6A4F]"
              data-testid="diet-adherence-summary"
            >
              {adherence.completedCount} / {adherence.totalCount} followed ({adherence.adherencePct}%)
            </span>
            {adherence.completedCount > 0 && (
              <button
                type="button"
                onClick={onResetAdherence}
                className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-[#DDD4C3] bg-[#FDFBF7] px-2 py-1 text-[11px] font-medium text-[#5C5046] transition-colors hover:border-[#C85A28] hover:text-[#1F1916]"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EFE8D8]">
          <div
            className="h-full rounded-full bg-[#2D6A4F] transition-all duration-300"
            style={{ width: `${adherence.adherencePct}%` }}
          />
        </div>

        <p className="mt-1.5 text-[11px] text-[#5C5046] tabular-metrics">
          Adhered plan volume: {adherence.adheredProteinG}g / {planProtein}g Protein ·{' '}
          {adherence.adheredCaloriesKcal.toLocaleString()} / {planCalories.toLocaleString()} kcal
        </p>
      </div>

      {/* 5-Slot Interactive Meal Template Checklist */}
      <ul className="mt-4 divide-y divide-[#EFE8D8]" aria-label="Daily meal adherence checklist">
        {planSlots.map((slot) => {
          const isAdhered = adheredSlotIds.includes(slot.id);
          const alreadyLogged = loggedMeals.some((m) => m.name === slot.mealName);
          const checkboxId = `adherence-${slot.id}`;

          return (
            <li
              key={slot.id}
              className={`flex flex-col gap-3 rounded-xl px-2 py-3.5 transition-colors @xl:flex-row @xl:items-center @xl:justify-between ${
                isAdhered ? 'bg-[#2D6A4F]/[0.05]' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <label
                  htmlFor={checkboxId}
                  className="mt-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent hover:bg-[#EFE8D8]/70"
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={isAdhered}
                    onChange={() => onToggleAdherence(slot.id)}
                    aria-label={`Mark ${slot.slotLabel} (${slot.mealName}) as followed`}
                    className="h-5 w-5 cursor-pointer rounded border-[#B5A998] accent-[#2D6A4F]"
                  />
                </label>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5C5046] tabular-metrics">
                    <span className="font-bold text-[#C85A28]">{slot.slotLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{slot.timeWindow}</span>
                    <span aria-hidden="true">·</span>
                    <span>{slot.calorieSharePct}% daily share</span>
                    {isAdhered && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#2D6A4F]">Followed</span>
                      </>
                    )}
                  </div>

                  <p
                    className={`mt-1 text-sm font-semibold ${
                      isAdhered ? 'text-[#2D6A4F] line-through decoration-[#2D6A4F]/50' : 'text-[#1F1916]'
                    }`}
                  >
                    {slot.mealName}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5C5046]">{slot.itemsSummary}</p>
                  <p className="mt-1 text-[11px] text-[#5C5046] tabular-metrics">
                    Macros: <span className="font-semibold text-[#D99B26]">{slot.proteinG}g P</span> ·{' '}
                    {slot.carbsG}g C · {slot.fatsG}g F · {slot.hydrationCue}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 pl-12 @xl:justify-end @xl:pl-0">
                <div className="text-left text-xs tabular-metrics @xl:text-right">
                  <p className="font-bold text-[#D99B26]">+{slot.proteinG}g Protein</p>
                  <p className="text-[#5C5046]">{slot.caloriesKcal} kcal</p>
                </div>

                <button
                  type="button"
                  onClick={() => onLogDietSlot(slot)}
                  aria-label={`${alreadyLogged ? 'Log again' : 'Log meal'}: ${slot.mealName}`}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    alreadyLogged
                      ? 'border border-[#2D6A4F]/40 bg-[#2D6A4F]/10 text-[#2D6A4F] hover:bg-[#2D6A4F]/15'
                      : 'bg-[#C85A28] text-white hover:bg-[#B04A1D]'
                  }`}
                >
                  {alreadyLogged ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Logged
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Log Meal
                    </>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#F9F6EE] px-3.5 py-3 text-xs text-[#5C5046]">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D99B26]" aria-hidden="true" />
        <p>
          Meal portions automatically recalculate whenever you update your weight, activity level, or
          goal in the Profile Target Engine. Check each meal as you follow it, or tap{' '}
          <strong>Log Meal</strong> to record macros directly into Today&apos;s Ration Ledger.
        </p>
      </div>
    </section>
  );
};
