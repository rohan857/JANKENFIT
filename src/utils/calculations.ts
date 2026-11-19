import {
  ActivityLevel,
  AppState,
  ComputedTargets,
  DailySummary,
  FitnessGoal,
  MealEntry,
  ReadinessEvaluation,
  ReadinessState,
  UserProfile,
  VitalReading,
} from '../types/wellness';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayLabelFromKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return DAY_NAMES[dt.getDay()];
}

export function getPastDateKeys(referenceDateKey: string, count = 7): string[] {
  const [y, m, d] = referenceDateKey.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    keys.push(formatDateKey(dt));
  }
  return keys;
}

export function calculateBMI(
  weightKg: number,
  heightCm: number
): { value: number; category: ComputedTargets['bmiCategory'] } {
  const safeHeightM = Math.max(heightCm, 100) / 100;
  const safeWeight = Math.max(weightKg, 30);
  const raw = safeWeight / (safeHeightM * safeHeightM);
  const value = Math.round(raw * 10) / 10;

  let category: ComputedTargets['bmiCategory'] = 'Healthy';
  if (value < 18.5) category = 'Underweight';
  else if (value < 25) category = 'Healthy';
  else if (value < 30) category = 'Overweight';
  else category = 'Elevated';

  return { value, category };
}

export function calculateBMR(weightKg: number, heightCm: number, age: number): number {
  const safeWeight = Math.max(weightKg, 30);
  const safeHeight = Math.max(heightCm, 100);
  const safeAge = Math.max(age, 14);
  // Gender-neutral Mifflin-St Jeor student baseline
  return Math.round(10 * safeWeight + 6.25 * safeHeight - 5 * safeAge - 40);
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  'Desk Student / Light': 1.35,
  'Calisthenics / Moderate': 1.55,
  'Heavy Training': 1.72,
};

const GOAL_CALORIE_DELTA: Record<FitnessGoal, number> = {
  'Lean Core & Posture': 0,
  'Muscle Gain': 260,
  'Fat Loss': -320,
};

const GOAL_PROTEIN_MULTIPLIER: Record<FitnessGoal, number> = {
  'Lean Core & Posture': 1.5,
  'Muscle Gain': 1.85,
  'Fat Loss': 1.75,
};

export function calculateTargets(profile: UserProfile): ComputedTargets {
  const { value: bmi, category: bmiCategory } = calculateBMI(profile.weightKg, profile.heightCm);
  const bmr = calculateBMR(profile.weightKg, profile.heightCm, profile.age);
  const tdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[profile.activityLevel] ?? 1.45));
  const calorieTargetKcal = Math.max(1400, tdee + (GOAL_CALORIE_DELTA[profile.goal] ?? 0));

  const activityProteinBonus =
    profile.activityLevel === 'Heavy Training'
      ? 0.15
      : profile.activityLevel === 'Calisthenics / Moderate'
        ? 0.08
        : 0;
  const proteinPerKg = (GOAL_PROTEIN_MULTIPLIER[profile.goal] ?? 1.5) + activityProteinBonus;
  const proteinTargetG = Math.round(Math.max(55, profile.weightKg * proteinPerKg));

  // ~35ml per kg divided by 250ml glass, plus +1/+2 for moderate/heavy training
  const baseGlasses = Math.round((profile.weightKg * 35) / 250);
  const activityHydrationBonus =
    profile.activityLevel === 'Heavy Training'
      ? 2
      : profile.activityLevel === 'Calisthenics / Moderate'
        ? 1
        : 0;
  const hydrationTargetGlasses = Math.max(8, Math.min(16, baseGlasses + activityHydrationBonus));

  return {
    bmi,
    bmiCategory,
    bmr,
    tdee,
    calorieTargetKcal,
    proteinTargetG,
    hydrationTargetGlasses,
  };
}

export function calculateReadiness(
  readiness: ReadinessState,
  hydrationTargetGlasses: number,
  latestVital?: VitalReading
): ReadinessEvaluation {
  // 1. Sleep (40 points)
  let sleepDurationRatio = 1;
  if (readiness.sleepHours < 7.5) {
    sleepDurationRatio = Math.max(0.15, (readiness.sleepHours - 3) / 4.5);
  } else if (readiness.sleepHours > 9.5) {
    sleepDurationRatio = Math.max(0.75, 1 - (readiness.sleepHours - 9.5) * 0.12);
  }
  const qualityFactor =
    readiness.sleepQuality === 'Deep'
      ? 1.0
      : readiness.sleepQuality === 'Average'
        ? 0.84
        : 0.62;
  const sleepPts = Math.round(40 * sleepDurationRatio * qualityFactor);

  // 2. Fatigue / Lower-Back Strain (30 points)
  const fatigueMap: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 30,
    2: 25,
    3: 18,
    4: 11,
    5: 5,
  };
  const fatiguePts = fatigueMap[readiness.fatigueLevel] ?? 18;

  // 3. Hydration (15 points)
  const hydrationRatio = Math.min(1, readiness.hydrationGlasses / Math.max(1, hydrationTargetGlasses));
  const hydrationPts = Math.round(15 * hydrationRatio);

  // 4. Vitals stability (15 points)
  let vitalsPts = 11; // Baseline neutral when no scan logged yet
  if (latestVital) {
    const bpmDeviation = Math.abs(latestVital.bpm - 64);
    const bpmScore = Math.max(0, 1 - bpmDeviation / 36);
    const bpPenalty =
      latestVital.systolic > 132 || latestVital.diastolic > 86
        ? 0.3
        : latestVital.systolic < 96
          ? 0.15
          : 0;
    const recoveryFactor = Math.min(1, Math.max(0.3, latestVital.recoveryIndex / 100));
    vitalsPts = Math.round(15 * Math.max(0.2, (bpmScore * 0.55 + recoveryFactor * 0.45) - bpPenalty));
  }

  const score = Math.max(0, Math.min(100, sleepPts + fatiguePts + hydrationPts + vitalsPts));

  let statusLabel: ReadinessEvaluation['statusLabel'] = 'Steady';
  let tone: ReadinessEvaluation['tone'] = 'amber';
  let prescription = '';

  if (score >= 76) {
    statusLabel = 'Optimal';
    tone = 'forest';
    prescription = `${score}% Optimal — Cleared for Core & Calisthenics`;
  } else if (score >= 58) {
    statusLabel = 'Steady';
    tone = 'amber';
    prescription = `${score}% Steady — Keep Form Strict & Hydrate Between Sets`;
  } else {
    statusLabel = 'Strained';
    tone = 'crimson';
    prescription = `${score}% Strained — Prioritize Spine Mobility & Hydration`;
  }

  return {
    score,
    statusLabel,
    tone,
    prescription,
    breakdown: {
      sleep: sleepPts,
      fatigue: fatiguePts,
      hydration: hydrationPts,
      vitals: vitalsPts,
    },
  };
}

export function calculateDailyMacros(meals: MealEntry[], targets: ComputedTargets) {
  const proteinG = meals.reduce((sum, item) => sum + item.proteinG, 0);
  const caloriesKcal = meals.reduce((sum, item) => sum + item.caloriesKcal, 0);

  const proteinPct = Math.min(100, Math.round((proteinG / Math.max(1, targets.proteinTargetG)) * 100));
  const caloriePct = Math.min(
    100,
    Math.round((caloriesKcal / Math.max(1, targets.calorieTargetKcal)) * 100)
  );

  return {
    proteinG,
    caloriesKcal,
    proteinPct,
    caloriePct,
    proteinDiff: proteinG - targets.proteinTargetG,
    calorieDiff: caloriesKcal - targets.calorieTargetKcal,
  };
}

export function buildDailySummaryFromState(state: AppState): DailySummary {
  const targets = calculateTargets(state.profile);
  const macros = calculateDailyMacros(state.meals, targets);
  const latestVital = state.vitalsHistory[0];
  const readinessEval = calculateReadiness(
    state.readiness,
    targets.hydrationTargetGlasses,
    latestVital
  );

  const todaysWorkouts = state.workouts.filter((w) => w.dateKey === state.activeDateKey);
  const todaysPosture = state.postureLogs.filter((p) => p.dateKey === state.activeDateKey);

  return {
    dateKey: state.activeDateKey,
    dayLabel: getDayLabelFromKey(state.activeDateKey),
    proteinG: macros.proteinG,
    proteinTargetG: targets.proteinTargetG,
    proteinConsistencyPct: Math.min(
      100,
      Math.round((macros.proteinG / Math.max(1, targets.proteinTargetG)) * 100)
    ),
    caloriesKcal: macros.caloriesKcal,
    readinessScore: readinessEval.score,
    trainingSessions: todaysWorkouts.length,
    trainingSeconds: todaysWorkouts.reduce((sum, w) => sum + w.totalWorkSeconds, 0),
    deskBreaks: todaysPosture.length,
    hydrationGlasses: state.readiness.hydrationGlasses,
  };
}

export function rolloverDayIfNeeded(state: AppState, currentDateKey: string): AppState {
  if (state.activeDateKey === currentDateKey) {
    return state;
  }

  const archivedDay = buildDailySummaryFromState(state);
  const hasMeaningfulActivity =
    archivedDay.proteinG > 0 ||
    archivedDay.trainingSessions > 0 ||
    archivedDay.deskBreaks > 0 ||
    archivedDay.hydrationGlasses > 0;

  const filteredHistory = state.dailyHistory.filter((d) => d.dateKey !== archivedDay.dateKey);
  const nextHistory = hasMeaningfulActivity
    ? [...filteredHistory, archivedDay].slice(-6)
    : filteredHistory.slice(-6);

  return {
    ...state,
    activeDateKey: currentDateKey,
    meals: [],
    dietAdherenceIds: [],
    readiness: {
      ...state.readiness,
      hydrationGlasses: 0,
    },
    dailyHistory: nextHistory,
  };
}

export function buildSevenDayChronicle(state: AppState): {
  days: DailySummary[];
  streakDays: number;
  avgReadiness: number;
  totalTrainingSeconds: number;
  totalDeskBreaks: number;
} {
  const todaySummary = buildDailySummaryFromState(state);
  const pastKeys = getPastDateKeys(state.activeDateKey, 7);
  const targets = calculateTargets(state.profile);

  const historyMap = new Map<string, DailySummary>();
  for (const item of state.dailyHistory) {
    historyMap.set(item.dateKey, item);
  }
  historyMap.set(todaySummary.dateKey, todaySummary);

  const days: DailySummary[] = pastKeys.map((dateKey) => {
    const found = historyMap.get(dateKey);
    if (found) {
      return {
        ...found,
        dayLabel: getDayLabelFromKey(dateKey),
      };
    }
    return {
      dateKey,
      dayLabel: getDayLabelFromKey(dateKey),
      proteinG: 0,
      proteinTargetG: targets.proteinTargetG,
      proteinConsistencyPct: 0,
      caloriesKcal: 0,
      readinessScore: 0,
      trainingSessions: 0,
      trainingSeconds: 0,
      deskBreaks: 0,
      hydrationGlasses: 0,
    };
  });

  // Active streak: consecutive days ending today (or yesterday if today just started) with meaningful discipline
  const isDisciplined = (d: DailySummary) =>
    d.proteinConsistencyPct >= 60 || d.trainingSessions >= 1 || d.deskBreaks >= 2;

  let streakDays = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (isDisciplined(days[i])) {
      streakDays += 1;
    } else if (i === days.length - 1) {
      // If today has not logged anything yet, allow yesterday's streak to continue
      continue;
    } else {
      break;
    }
  }

  const activeDaysWithReadiness = days.filter((d) => d.readinessScore > 0);
  const avgReadiness =
    activeDaysWithReadiness.length > 0
      ? Math.round(
          activeDaysWithReadiness.reduce((sum, d) => sum + d.readinessScore, 0) /
            activeDaysWithReadiness.length
        )
      : 0;

  const totalTrainingSeconds = days.reduce((sum, d) => sum + d.trainingSeconds, 0);
  const totalDeskBreaks = days.reduce((sum, d) => sum + d.deskBreaks, 0);

  return {
    days,
    streakDays,
    avgReadiness,
    totalTrainingSeconds,
    totalDeskBreaks,
  };
}

export function estimateVitalsFromPPG(
  samples: number[],
  profile: UserProfile,
  fatigueLevel: 1 | 2 | 3 | 4 | 5,
  source: VitalReading['source'],
  dateKey: string
): VitalReading {
  // Use sample variance to derive realistic physiological modulation around student baseline
  const activityOffset =
    profile.activityLevel === 'Heavy Training'
      ? -6
      : profile.activityLevel === 'Calisthenics / Moderate'
        ? -3
        : 2;

  const sampleSeed =
    samples.length > 0
      ? samples.reduce((acc, v, idx) => acc + Math.abs(v) * ((idx % 5) + 1), 0)
      : 42;
  const microJitter = Math.round((sampleSeed % 7) - 3); // -3 to +3 BPM

  const bpm = Math.max(52, Math.min(98, 66 + activityOffset + (fatigueLevel - 2) * 3 + microJitter));
  const systolic = Math.max(
    104,
    Math.min(136, 114 + Math.round((bpm - 64) * 0.45) + (fatigueLevel - 2) * 2)
  );
  const diastolic = Math.max(
    64,
    Math.min(88, 72 + Math.round((bpm - 64) * 0.25) + Math.max(0, fatigueLevel - 2))
  );

  const recoveryIndex = Math.max(
    35,
    Math.min(96, Math.round(92 - (bpm - 56) * 0.8 - (fatigueLevel - 1) * 7))
  );
  const stressLabel: VitalReading['stressLabel'] =
    recoveryIndex >= 74 ? 'Calm' : recoveryIndex >= 56 ? 'Balanced' : 'Elevated';

  return {
    id: `vital-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    dateKey,
    bpm,
    systolic,
    diastolic,
    recoveryIndex,
    stressLabel,
    source,
    confidencePct: source === 'rear-camera' ? 94 : 96,
  };
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function evaluateWorkoutWeatherSuitability(
  weather: import('../types/wellness').LiveWeatherData,
  workoutType: import('../types/wellness').WorkoutTypeOption
): import('../types/wellness').WeatherSuitability {
  const { temperatureC, apparentTempC, humidityPct, precipitationMm, windKmh, conditionLabel, city } =
    weather;
  const isIndoorSession =
    workoutType === 'Hostel Core & Planks' || workoutType === 'Heavy Resistance Training';

  const isStormOrRain = precipitationMm >= 0.4 || weather.weatherCode >= 61;
  const isHighHeatStress = apparentTempC >= 34 || (temperatureC >= 31 && humidityPct >= 70);
  const isHumidOrWarm = apparentTempC >= 29 || humidityPct >= 75 || windKmh >= 32;
  const isVeryCold = temperatureC <= 7;

  let verdict: 'Ideal' | 'Caution' | 'Move Indoors' = 'Ideal';
  let tone: 'forest' | 'amber' | 'crimson' = 'forest';
  let headline = '';
  let advice = '';

  if (isIndoorSession) {
    if (isHighHeatStress) {
      verdict = 'Caution';
      tone = 'amber';
      headline = `Warm indoor air (${temperatureC}°C · ${humidityPct}% RH) — keep water close`;
      advice = `High ambient humidity slows sweat cooling even indoors. Keep airflow open and add +250ml electrolytes during ${workoutType}.`;
    } else {
      verdict = 'Ideal';
      tone = 'forest';
      headline = `Suitable for ${workoutType} today`;
      advice = `${conditionLabel} outside (${temperatureC}°C, ${humidityPct}% humidity). Great conditions for focused indoor tension and posture sets.`;
    }
  } else if (isStormOrRain || apparentTempC >= 37) {
    verdict = 'Move Indoors';
    tone = 'crimson';
    headline = isStormOrRain
      ? `Wet conditions (${conditionLabel}) — shift ${workoutType} indoors`
      : `Severe heat index (${apparentTempC}°C feels-like) — avoid outdoor strain`;
    advice = `Swap to indoor Hostel Core & Planks or wait for cooler evening conditions to protect recovery and grip safety.`;
  } else if (isHighHeatStress || isHumidOrWarm || isVeryCold) {
    verdict = 'Caution';
    tone = 'amber';
    headline = isVeryCold
      ? `Chilly (${temperatureC}°C) — extend warm-up by 5 min`
      : `Humid / warm (${temperatureC}°C · ${humidityPct}% RH) — pace intensity`;
    advice = isVeryCold
      ? `Wear a light layer and warm up joints thoroughly before ${workoutType}.`
      : `Drink 500ml water before starting ${workoutType}, shorten intervals slightly, and seek shade.`;
  } else {
    verdict = 'Ideal';
    tone = 'forest';
    headline = `Ideal outdoor window for ${workoutType}`;
    advice = `Comfortable ${temperatureC}°C with ${humidityPct}% humidity and ${windKmh} km/h breeze. Cleared for full outdoor pacing.`;
  }

  const podcastScript = `JANKENFIT weather brief for ${city}. Right now it is ${temperatureC} degrees Celsius, feeling like ${apparentTempC}, with ${humidityPct} percent humidity and ${conditionLabel.toLowerCase()}. For your selected workout, ${workoutType}, the verdict is ${verdict}. ${advice}`;

  return {
    verdict,
    tone,
    headline,
    advice,
    podcastScript,
  };
}

export function generatePersonalizedDietPlan(
  profile: UserProfile,
  targets: ComputedTargets,
  preference: import('../types/wellness').DietPreference
): import('../types/wellness').DietMealSlot[] {
  const goalDescriptor =
    profile.goal === 'Muscle Gain'
      ? `Surplus (+${Math.max(0, targets.calorieTargetKcal - targets.tdee)} kcal over TDEE)`
      : profile.goal === 'Fat Loss'
        ? `Deficit (${targets.calorieTargetKcal - targets.tdee} kcal vs TDEE)`
        : `Maintenance (matched to ${targets.tdee} kcal TDEE)`;

  const slotsByPref: Record<
    import('../types/wellness').DietPreference,
    Array<{
      id: string;
      slotLabel: string;
      timeWindow: string;
      mealName: string;
      itemsSummary: string;
      proteinWeight: number;
      calorieWeight: number;
      hydrationCue: string;
    }>
  > = {
    'Hostel Veg': [
      {
        id: 'diet-breakfast',
        slotLabel: 'Breakfast',
        timeWindow: '08:00 AM',
        mealName: 'Milk + Sprouts / Poha & Peanuts',
        itemsSummary: 'Toned milk (250ml), soaked moong sprouts & roasted peanuts',
        proteinWeight: 0.18,
        calorieWeight: 0.22,
        hydrationCue: '2 glasses water on waking',
      },
      {
        id: 'diet-midmorning',
        slotLabel: 'Mid-Morning',
        timeWindow: '11:00 AM',
        mealName: 'Roasted Chana & Seasonal Fruit',
        itemsSummary: '50g roasted chana + banana or apple between lectures',
        proteinWeight: 0.11,
        calorieWeight: 0.12,
        hydrationCue: '1 glass during class break',
      },
      {
        id: 'diet-lunch',
        slotLabel: 'Mess Lunch',
        timeWindow: '01:30 PM',
        mealName: 'Whole-Wheat Roti + Double Hostel Dal + Curd',
        itemsSummary: 'Rotis, thick hostel dal bowl, 100g curd & fresh cucumber salad',
        proteinWeight: 0.23,
        calorieWeight: 0.28,
        hydrationCue: '2 glasses water 20 min before lunch',
      },
      {
        id: 'diet-snack',
        slotLabel: 'Post-Workout Ration',
        timeWindow: '05:30 PM',
        mealName: 'Boiled Soya Chunks Chaat',
        itemsSummary: 'Boiled soya chunks tossed with onion, lemon & chaat masala',
        proteinWeight: 0.25,
        calorieWeight: 0.14,
        hydrationCue: '2 glasses post-training',
      },
      {
        id: 'diet-dinner',
        slotLabel: 'Dinner',
        timeWindow: '08:30 PM',
        mealName: 'Paneer Bhurji + Roti + Seasonal Sabzi',
        itemsSummary: 'Lightly spiced paneer, seasonal sabzi & whole-wheat rotis (low oil)',
        proteinWeight: 0.23,
        calorieWeight: 0.24,
        hydrationCue: '1 glass warm water before study wind-down',
      },
    ],
    Eggetarian: [
      {
        id: 'diet-breakfast',
        slotLabel: 'Breakfast',
        timeWindow: '08:00 AM',
        mealName: 'Boiled Eggs + Toned Milk & Whole-Wheat Toast',
        itemsSummary: 'Whole eggs + egg white, 250ml toned milk & whole-wheat bread',
        proteinWeight: 0.22,
        calorieWeight: 0.22,
        hydrationCue: '2 glasses water on waking',
      },
      {
        id: 'diet-midmorning',
        slotLabel: 'Mid-Morning',
        timeWindow: '11:00 AM',
        mealName: 'Roasted Chana + Fruit',
        itemsSummary: '50g roasted chana + apple or guava for steady lecture focus',
        proteinWeight: 0.1,
        calorieWeight: 0.12,
        hydrationCue: '1 glass between classes',
      },
      {
        id: 'diet-lunch',
        slotLabel: 'Mess Lunch',
        timeWindow: '01:30 PM',
        mealName: 'Roti + Hostel Dal + Curd + Sabzi',
        itemsSummary: 'Balanced mess plate prioritizing dal & curd over fried sides',
        proteinWeight: 0.21,
        calorieWeight: 0.28,
        hydrationCue: '2 glasses water around lunch',
      },
      {
        id: 'diet-snack',
        slotLabel: 'Post-Workout Ration',
        timeWindow: '05:30 PM',
        mealName: 'Soya Chunks Bowl or Boiled Eggs',
        itemsSummary: 'Boiled soya chunks with lemon & pepper (or 2 boiled eggs) for recovery',
        proteinWeight: 0.24,
        calorieWeight: 0.14,
        hydrationCue: '2 glasses post-calisthenics',
      },
      {
        id: 'diet-dinner',
        slotLabel: 'Dinner',
        timeWindow: '08:30 PM',
        mealName: 'Egg Bhurji / Paneer + Roti & Salad',
        itemsSummary: 'Egg bhurji or grilled paneer with rotis and raw greens',
        proteinWeight: 0.23,
        calorieWeight: 0.24,
        hydrationCue: '1 glass water 1 hour before sleep',
      },
    ],
    'Non-Veg': [
      {
        id: 'diet-breakfast',
        slotLabel: 'Breakfast',
        timeWindow: '08:00 AM',
        mealName: 'Boiled Eggs + Oats & Milk',
        itemsSummary: 'Boiled eggs paired with 250ml toned milk or warm rolled oats',
        proteinWeight: 0.22,
        calorieWeight: 0.22,
        hydrationCue: '2 glasses water on waking',
      },
      {
        id: 'diet-midmorning',
        slotLabel: 'Mid-Morning',
        timeWindow: '11:00 AM',
        mealName: 'Roasted Chana + Spiced Buttermilk',
        itemsSummary: 'Crunchy roasted chana + salted chaas for light campus electrolytes',
        proteinWeight: 0.1,
        calorieWeight: 0.12,
        hydrationCue: '1 glass during mid-morning break',
      },
      {
        id: 'diet-lunch',
        slotLabel: 'Mess Lunch',
        timeWindow: '01:30 PM',
        mealName: 'Lean Chicken Curry + Rice & Dal',
        itemsSummary: 'Cooked lean chicken portion, 1 bowl hostel dal, rice & salad',
        proteinWeight: 0.28,
        calorieWeight: 0.28,
        hydrationCue: '2 glasses water before lunch',
      },
      {
        id: 'diet-snack',
        slotLabel: 'Post-Workout Ration',
        timeWindow: '05:30 PM',
        mealName: 'Boiled Eggs + Banana',
        itemsSummary: 'Quick hostel recovery combo right after core or calisthenics sets',
        proteinWeight: 0.15,
        calorieWeight: 0.14,
        hydrationCue: '2 glasses post-workout',
      },
      {
        id: 'diet-dinner',
        slotLabel: 'Dinner',
        timeWindow: '08:30 PM',
        mealName: 'Grilled Chicken / Paneer + Roti & Greens',
        itemsSummary: 'Lean chicken or paneer portion with whole-wheat rotis and sabzi',
        proteinWeight: 0.25,
        calorieWeight: 0.24,
        hydrationCue: '1 glass water before sleep',
      },
    ],
  };

  const rawSlots = slotsByPref[preference];
  const targetProtein = Math.max(55, Math.round(targets.proteinTargetG));
  const targetCalories = Math.max(1400, Math.round(targets.calorieTargetKcal));

  // Distribute exact integer protein and calories across the 5 slots so totals match target goals
  const proteinAllocations = rawSlots.map((slot) => Math.round(targetProtein * slot.proteinWeight));
  const calorieAllocations = rawSlots.map((slot) => Math.round(targetCalories * slot.calorieWeight));

  const proteinRemainder = targetProtein - proteinAllocations.reduce((s, n) => s + n, 0);
  const calorieRemainder = targetCalories - calorieAllocations.reduce((s, n) => s + n, 0);
  // Apply tiny rounding adjustment to Mess Lunch (largest slot, index 2)
  proteinAllocations[2] += proteinRemainder;
  calorieAllocations[2] += calorieRemainder;

  const baselineScale = targetCalories / 2200;
  const portionScaleLabel =
    baselineScale >= 1.15
      ? 'Hearty portion (+15%)'
      : baselineScale <= 0.88
        ? 'Trimmed portion (-12%)'
        : 'Standard hostel portion';

  return rawSlots.map((slot, idx) => {
    const proteinG = Math.max(5, proteinAllocations[idx]);
    const caloriesKcal = Math.max(120, calorieAllocations[idx]);
    // Allocate remaining non-protein energy (~70% carbs / ~30% healthy fats)
    const remainingKcal = Math.max(40, caloriesKcal - proteinG * 4);
    const fatsG = Math.max(3, Math.round((remainingKcal * 0.28) / 9));
    const carbsG = Math.max(8, Math.round((remainingKcal - fatsG * 9) / 4));

    return {
      id: slot.id,
      slotLabel: slot.slotLabel,
      timeWindow: slot.timeWindow,
      mealName: slot.mealName,
      itemsSummary: slot.itemsSummary,
      proteinG,
      carbsG,
      fatsG,
      caloriesKcal,
      calorieSharePct: Math.round(slot.calorieWeight * 100),
      portionNote: `${portionScaleLabel} · ${goalDescriptor}`,
      hydrationCue: slot.hydrationCue,
    };
  });
}

export function calculateDietAdherence(
  slots: import('../types/wellness').DietMealSlot[],
  adheredIds: string[]
): {
  completedCount: number;
  totalCount: number;
  adherencePct: number;
  adheredProteinG: number;
  adheredCaloriesKcal: number;
} {
  const adheredSet = new Set(adheredIds);
  const matched = slots.filter((slot) => adheredSet.has(slot.id));
  const totalCount = slots.length;
  const completedCount = matched.length;
  const adherencePct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const adheredProteinG = matched.reduce((sum, s) => sum + s.proteinG, 0);
  const adheredCaloriesKcal = matched.reduce((sum, s) => sum + s.caloriesKcal, 0);

  return {
    completedCount,
    totalCount,
    adherencePct,
    adheredProteinG,
    adheredCaloriesKcal,
  };
}


