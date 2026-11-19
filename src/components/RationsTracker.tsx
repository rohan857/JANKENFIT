import React, { useState } from 'react';
import { Plus, Trash2, Utensils } from 'lucide-react';
import { HOSTEL_FOOD_PRESETS } from '../data/presets';
import {
  ComputedTargets,
  DietMealSlot,
  DietPreference,
  FoodPreset,
  MealEntry,
  UserProfile,
} from '../types/wellness';
import { calculateDailyMacros } from '../utils/calculations';
import { DietPlanGuide } from './DietPlanGuide';

interface RationsTrackerProps {
  profile: UserProfile;
  meals: MealEntry[];
  targets: ComputedTargets;
  dietPreference: DietPreference;
  dietAdherenceIds: string[];
  onChangeDietPreference: (pref: DietPreference) => void;
  onToggleDietAdherence: (slotId: string) => void;
  onResetDietAdherence: () => void;
  onLogDietSlot: (slot: DietMealSlot) => void;
  onAddMeal: (meal: Omit<MealEntry, 'id' | 'loggedAt'>) => void;
  onRemoveMeal: (id: string) => void;
}

export const RationsTracker: React.FC<RationsTrackerProps> = ({
  profile,
  meals,
  targets,
  dietPreference,
  dietAdherenceIds,
  onChangeDietPreference,
  onToggleDietAdherence,
  onResetDietAdherence,
  onLogDietSlot,
  onAddMeal,
  onRemoveMeal,
}) => {
  const [customName, setCustomName] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const macros = calculateDailyMacros(meals, targets);

  const handleQuickAdd = (preset: FoodPreset) => {
    onAddMeal({
      name: preset.name,
      proteinG: preset.proteinG,
      caloriesKcal: preset.caloriesKcal,
      isCustom: false,
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customName.trim();
    const protein = Number(customProtein);
    const calories = Number(customCalories);

    if (!name) {
      setFormError('Enter a meal or mess item name.');
      return;
    }
    if (customProtein === '' || !Number.isFinite(protein) || protein < 0 || protein > 200) {
      setFormError('Enter a valid protein value (0–200 g).');
      return;
    }
    if (customCalories === '' || !Number.isFinite(calories) || calories <= 0 || calories > 3000) {
      setFormError('Enter a valid calorie value (1–3000 kcal).');
      return;
    }

    onAddMeal({
      name,
      proteinG: Math.round(protein),
      caloriesKcal: Math.round(calories),
      isCustom: true,
    });
    setCustomName('');
    setCustomProtein('');
    setCustomCalories('');
    setFormError(null);
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Macro Progress Card */}
      <section aria-labelledby="rations-macro-heading" className="editorial-card rounded-2xl p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E8E0D1] pb-4">
          <div>
            <p className="text-xs font-medium text-[#5C5046]">
              Hostel-Friendly Rations · Daily Macro Ledger
            </p>
            <h2 id="rations-macro-heading" className="mt-1 font-serif text-xl font-bold text-[#1F1916]">
              Protein &amp; Energy Intake
            </h2>
          </div>
          <span className="text-xs font-medium text-[#5C5046] tabular-metrics">
            {meals.length} {meals.length === 1 ? 'entry' : 'entries'} logged today
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 @2xl:grid-cols-2">
          {/* Protein Progress (Amber Gold #D99B26) */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#1F1916]">Protein Intake</span>
              <span className="text-base font-bold tabular-metrics text-[#1F1916]" data-testid="protein-total">
                {macros.proteinG}g{' '}
                <span className="text-xs font-normal text-[#5C5046]">
                  / {targets.proteinTargetG}g
                </span>
              </span>
            </div>
            <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-[#EFE8D8]">
              <div
                className="h-full rounded-full bg-[#D99B26] transition-all duration-300"
                style={{ width: `${macros.proteinPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[#5C5046] tabular-metrics">
              {macros.proteinDiff >= 0
                ? `Target met (+${macros.proteinDiff}g surplus)`
                : `${Math.abs(macros.proteinDiff)}g remaining to hit daily lean floor (${macros.proteinPct}%)`}
            </p>
          </div>

          {/* Calorie Progress (Forest Green #2D6A4F) */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#1F1916]">Caloric Energy</span>
              <span className="text-base font-bold tabular-metrics text-[#1F1916]" data-testid="calorie-total">
                {macros.caloriesKcal}{' '}
                <span className="text-xs font-normal text-[#5C5046]">
                  / {targets.calorieTargetKcal} kcal
                </span>
              </span>
            </div>
            <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-[#EFE8D8]">
              <div
                className="h-full rounded-full bg-[#2D6A4F] transition-all duration-300"
                style={{ width: `${macros.caloriePct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[#5C5046] tabular-metrics">
              {macros.calorieDiff > 150
                ? `+${macros.calorieDiff} kcal above target`
                : macros.calorieDiff >= -150
                  ? `Within daily target window (${macros.caloriePct}%)`
                  : `${Math.abs(macros.calorieDiff)} kcal deficit remaining (${macros.caloriePct}%)`}
            </p>
          </div>
        </div>
      </section>

      {/* Personalized Daily Meal Template & Interactive Adherence Checklist */}
      <DietPlanGuide
        profile={profile}
        targets={targets}
        dietPreference={dietPreference}
        loggedMeals={meals}
        adheredSlotIds={dietAdherenceIds}
        onChangePreference={onChangeDietPreference}
        onToggleAdherence={onToggleDietAdherence}
        onResetAdherence={onResetDietAdherence}
        onLogDietSlot={onLogDietSlot}
      />

      {/* 1-Tap Quick-Add Hostel Rations Grid */}
      <section aria-labelledby="quick-add-rations-heading" className="editorial-card rounded-2xl p-5 md:p-6">
        <div className="border-b border-[#E8E0D1] pb-4">
          <p className="text-xs font-medium text-[#5C5046]">No Food Scale Required</p>
          <h3 id="quick-add-rations-heading" className="mt-1 font-serif text-lg font-bold text-[#1F1916]">
            1-Tap Hostel Rations
          </h3>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-4">
          {HOSTEL_FOOD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleQuickAdd(preset)}
              className="group flex min-h-[76px] flex-col justify-between rounded-xl border border-[#DDD4C3] bg-[#F9F6EE] p-3.5 text-left transition-all hover:border-[#C85A28] hover:bg-[#FDFBF7] active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-[#1F1916] leading-snug">
                  {preset.name}
                </span>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C85A28] text-white transition-colors group-hover:bg-[#B04A1D]">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs tabular-metrics">
                <span className="font-semibold text-[#C85A28]">+{preset.proteinG}g Protein</span>
                <span className="text-[#5C5046]">{preset.caloriesKcal} kcal</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Custom Food Entry + Today's Logged Meals */}
      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-12">
        <section
          aria-labelledby="custom-meal-heading"
          className="editorial-card rounded-2xl p-5 @md:p-6 @3xl:col-span-5"
        >
          <h3 id="custom-meal-heading" className="font-serif text-lg font-bold text-[#1F1916]">
            Log Custom Mess or Snack Item
          </h3>
          <p className="mt-1 text-xs text-[#5C5046]">
            Add canteen specials, whey scoops, oats, or home-packed tiffins.
          </p>

          <form onSubmit={handleCustomSubmit} className="mt-4 space-y-3.5" noValidate>
            <div>
              <label htmlFor="custom-meal-name" className="block text-xs font-medium text-[#5C5046]">
                Meal Name
              </label>
              <input
                id="custom-meal-name"
                type="text"
                placeholder="e.g., Sprouts Chaat Bowl"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2.5 text-sm text-[#1F1916] placeholder:text-[#8E8174] focus:border-[#C85A28] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="custom-meal-protein"
                  className="block text-xs font-medium text-[#5C5046]"
                >
                  Protein (g)
                </label>
                <input
                  id="custom-meal-protein"
                  type="number"
                  min={0}
                  max={200}
                  placeholder="14"
                  value={customProtein}
                  onChange={(e) => setCustomProtein(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2.5 text-sm tabular-metrics text-[#1F1916] placeholder:text-[#8E8174] focus:border-[#C85A28] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="custom-meal-calories"
                  className="block text-xs font-medium text-[#5C5046]"
                >
                  Calories (kcal)
                </label>
                <input
                  id="custom-meal-calories"
                  type="number"
                  min={1}
                  max={3000}
                  placeholder="220"
                  value={customCalories}
                  onChange={(e) => setCustomCalories(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2.5 text-sm tabular-metrics text-[#1F1916] placeholder:text-[#8E8174] focus:border-[#C85A28] focus:outline-none"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-[#B91C1C]">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#C85A28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B04A1D]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Custom Ration
            </button>
          </form>
        </section>

        <section
          aria-labelledby="logged-meals-heading"
          className="editorial-card rounded-2xl p-5 @md:p-6 @3xl:col-span-7"
        >
          <div className="flex items-baseline justify-between border-b border-[#E8E0D1] pb-3">
            <h3 id="logged-meals-heading" className="font-serif text-lg font-bold text-[#1F1916]">
              Today&apos;s Ration Ledger
            </h3>
            <span className="text-xs text-[#5C5046] tabular-metrics">
              {macros.proteinG}g P · {macros.caloriesKcal} kcal
            </span>
          </div>

          {meals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Utensils className="h-8 w-8 text-[#B5A998]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[#1F1916]">
                No rations logged yet today
              </p>
              <p className="mt-1 max-w-xs text-xs text-[#5C5046]">
                Tap any hostel staple above or log a custom mess meal to start tracking protein consistency.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[#EFE8D8]">
              {meals.map((meal) => (
                <li
                  key={meal.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1F1916]">
                      {meal.name}
                    </p>
                    <p className="text-xs text-[#5C5046] tabular-metrics">
                      +{meal.proteinG}g Protein · {meal.caloriesKcal} kcal
                      {meal.loggedAt ? ` · ${formatTime(meal.loggedAt)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveMeal(meal.id)}
                    aria-label={`Remove ${meal.name}`}
                    className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg text-[#5C5046] transition-colors hover:bg-[#B91C1C]/10 hover:text-[#B91C1C]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
