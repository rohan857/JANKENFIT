import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSevenDayChronicle,
  calculateBMI,
  calculateDailyMacros,
  calculateDietAdherence,
  calculateReadiness,
  calculateTargets,
  estimateVitalsFromPPG,
  evaluateWorkoutWeatherSuitability,
  formatClock,
  generatePersonalizedDietPlan,
  rolloverDayIfNeeded,
} from './calculations';
import {
  createEmptyState,
  deserializeFromFirestorePayload,
  mergeLocalAndCloudState,
  serializeToFirestorePayload,
} from '../services/wellnessStore';
import { translateAuthError } from './authErrors';
import { AppState, LiveWeatherData, UserProfile } from '../types/wellness';

function buildPopulatedTestState(activeDateKey: string): AppState {
  const base = createEmptyState(activeDateKey, 'Aarav');
  return {
    ...base,
    readiness: {
      sleepHours: 7.5,
      sleepQuality: 'Deep',
      fatigueLevel: 2,
      hydrationGlasses: 6,
    },
    meals: [
      { id: 'm1', name: '2 Boiled Eggs', proteinG: 12, caloriesKcal: 155, loggedAt: '2026-11-18T08:30:00.000Z' },
      { id: 'm2', name: 'Soya Chunks Bowl', proteinG: 26, caloriesKcal: 170, loggedAt: '2026-11-18T13:00:00.000Z' },
    ],
    dietAdherenceIds: ['breakfast', 'lunch'],
    workouts: [
      {
        id: 'w1',
        dateKey: activeDateKey,
        completedAt: '2026-11-18T18:00:00.000Z',
        routineName: 'Core Plank Circuit',
        totalWorkSeconds: 180,
        setsCompleted: 3,
      },
    ],
    postureLogs: [
      { id: 'p1', dateKey: activeDateKey, completedAt: '2026-11-18T11:00:00.000Z', intervalMinutes: 45, movementsCompleted: ['Wall Angels'] },
      { id: 'p2', dateKey: activeDateKey, completedAt: '2026-11-18T15:00:00.000Z', intervalMinutes: 45, movementsCompleted: ['Thoracic Openers'] },
    ],
    dailyHistory: [
      { dateKey: '2026-11-13', dayLabel: 'Fri', proteinG: 95, proteinTargetG: 110, proteinConsistencyPct: 86, caloriesKcal: 2100, readinessScore: 78, trainingSessions: 1, trainingSeconds: 180, deskBreaks: 4, hydrationGlasses: 8 },
      { dateKey: '2026-11-14', dayLabel: 'Sat', proteinG: 108, proteinTargetG: 110, proteinConsistencyPct: 98, caloriesKcal: 2250, readinessScore: 84, trainingSessions: 1, trainingSeconds: 200, deskBreaks: 5, hydrationGlasses: 9 },
      { dateKey: '2026-11-15', dayLabel: 'Sun', proteinG: 92, proteinTargetG: 110, proteinConsistencyPct: 84, caloriesKcal: 2050, readinessScore: 80, trainingSessions: 1, trainingSeconds: 160, deskBreaks: 4, hydrationGlasses: 8 },
      { dateKey: '2026-11-16', dayLabel: 'Mon', proteinG: 102, proteinTargetG: 110, proteinConsistencyPct: 93, caloriesKcal: 2200, readinessScore: 82, trainingSessions: 1, trainingSeconds: 180, deskBreaks: 5, hydrationGlasses: 9 },
      { dateKey: '2026-11-17', dayLabel: 'Tue', proteinG: 110, proteinTargetG: 110, proteinConsistencyPct: 100, caloriesKcal: 2300, readinessScore: 86, trainingSessions: 2, trainingSeconds: 240, deskBreaks: 6, hydrationGlasses: 10 },
      { dateKey: '2026-11-18', dayLabel: 'Wed', proteinG: 98, proteinTargetG: 110, proteinConsistencyPct: 89, caloriesKcal: 2150, readinessScore: 81, trainingSessions: 1, trainingSeconds: 180, deskBreaks: 4, hydrationGlasses: 8 },
    ],
  };
}

test('BMI and target engine compute accurate student metrics', () => {
  const bmi = calculateBMI(72, 176);
  assert.equal(bmi.value, 23.2);
  assert.equal(bmi.category, 'Healthy');

  const profile: UserProfile = {
    name: 'Aarav',
    age: 21,
    heightCm: 176,
    weightKg: 72,
    activityLevel: 'Calisthenics / Moderate',
    goal: 'Muscle Gain',
  };
  const targets = calculateTargets(profile);
  assert.ok(targets.bmr > 1500 && targets.bmr < 1900);
  assert.ok(targets.calorieTargetKcal > targets.tdee);
  assert.ok(targets.proteinTargetG >= 120);
  assert.ok(targets.hydrationTargetGlasses >= 10);
});

test('Readiness score reflects optimal vs strained recovery states', () => {
  const optimal = calculateReadiness(
    { sleepHours: 8, sleepQuality: 'Deep', fatigueLevel: 1, hydrationGlasses: 10 },
    10,
    {
      id: 'v1',
      timestamp: new Date().toISOString(),
      dateKey: '2026-11-19',
      bpm: 62,
      systolic: 116,
      diastolic: 74,
      recoveryIndex: 88,
      stressLabel: 'Calm',
      source: 'optical-pad',
      confidencePct: 96,
    }
  );
  assert.ok(optimal.score >= 85);
  assert.equal(optimal.statusLabel, 'Optimal');
  assert.equal(optimal.tone, 'forest');

  const strained = calculateReadiness(
    { sleepHours: 4.5, sleepQuality: 'Restless', fatigueLevel: 5, hydrationGlasses: 2 },
    10,
    {
      id: 'v2',
      timestamp: new Date().toISOString(),
      dateKey: '2026-11-19',
      bpm: 88,
      systolic: 135,
      diastolic: 88,
      recoveryIndex: 42,
      stressLabel: 'Elevated',
      source: 'optical-pad',
      confidencePct: 95,
    }
  );
  assert.ok(strained.score < 55);
  assert.equal(strained.statusLabel, 'Strained');
  assert.equal(strained.tone, 'crimson');
});

test('Daily macro calculation sums protein and calories accurately', () => {
  const state = createEmptyState('2026-11-19');
  const targets = calculateTargets(state.profile);
  const macros = calculateDailyMacros(
    [
      { id: '1', name: '2 Boiled Eggs', proteinG: 12, caloriesKcal: 155, loggedAt: '' },
      { id: '2', name: 'Soya Chunks Bowl (50g)', proteinG: 26, caloriesKcal: 170, loggedAt: '' },
    ],
    targets
  );
  assert.equal(macros.proteinG, 38);
  assert.equal(macros.caloriesKcal, 325);
  assert.equal(macros.proteinDiff, 38 - targets.proteinTargetG);
});

test('Midnight rollover archives active day and resets daily counters', () => {
  const dayOne = buildPopulatedTestState('2026-11-18');
  const rolled = rolloverDayIfNeeded(dayOne, '2026-11-19');
  assert.equal(rolled.activeDateKey, '2026-11-19');
  assert.equal(rolled.meals.length, 0);
  assert.equal(rolled.dietAdherenceIds.length, 0);
  assert.equal(rolled.readiness.hydrationGlasses, 0);
  assert.ok(rolled.dailyHistory.some((d) => d.dateKey === '2026-11-18'));
  assert.equal(rolled.dailyHistory.length, 6);
});

test('7-day chronicle aggregates streak, readiness, training seconds, and desk breaks', () => {
  const populated = buildPopulatedTestState('2026-11-19');
  const chronicle = buildSevenDayChronicle(populated);
  assert.equal(chronicle.days.length, 7);
  assert.ok(chronicle.streakDays >= 6);
  assert.ok(chronicle.avgReadiness >= 70);
  assert.ok(chronicle.totalTrainingSeconds > 800);
  assert.ok(chronicle.totalDeskBreaks >= 25);
});

test('Optical pulse estimator outputs physiological BPM, BP, and recovery ranges', () => {
  const empty = createEmptyState('2026-11-19');
  const reading = estimateVitalsFromPPG([12, 18, 25, 14, 9], empty.profile, 2, 'optical-pad', '2026-11-19');
  assert.ok(reading.bpm >= 52 && reading.bpm <= 98);
  assert.ok(reading.systolic >= 104 && reading.systolic <= 136);
  assert.ok(reading.diastolic >= 64 && reading.diastolic <= 88);
  assert.equal(formatClock(125), '02:05');
});

test('Weather workout suitability evaluates ideal, humid caution, and rain move-indoors accurately', () => {
  const baseWx: LiveWeatherData = {
    city: 'Bengaluru',
    country: 'India',
    latitude: 12.97,
    longitude: 77.59,
    temperatureC: 23,
    apparentTempC: 23.5,
    humidityPct: 54,
    windKmh: 9,
    precipitationMm: 0,
    weatherCode: 1,
    conditionLabel: 'Partly Cloudy',
    observedAt: '2026-11-19T10:00',
    provider: 'Open-Meteo',
  };

  const ideal = evaluateWorkoutWeatherSuitability(baseWx, 'Outdoor Calisthenics & Run');
  assert.equal(ideal.verdict, 'Ideal');
  assert.ok(ideal.podcastScript.includes('JANKENFIT'));

  const rainy = evaluateWorkoutWeatherSuitability(
    { ...baseWx, precipitationMm: 2.5, weatherCode: 63, conditionLabel: 'Rain' },
    'Outdoor Calisthenics & Run'
  );
  assert.equal(rainy.verdict, 'Move Indoors');
  assert.equal(rainy.tone, 'crimson');

  const humid = evaluateWorkoutWeatherSuitability(
    { ...baseWx, temperatureC: 32, apparentTempC: 35, humidityPct: 78 },
    'Hostel Core & Planks'
  );
  assert.equal(humid.verdict, 'Caution');
});

test('Personalized diet plan scales exactly to TDEE calorie & protein goals and computes adherence', () => {
  const heavyProfile: UserProfile = {
    name: 'Kabir',
    age: 22,
    heightCm: 182,
    weightKg: 84,
    activityLevel: 'Heavy Training',
    goal: 'Muscle Gain',
  };
  const targets = calculateTargets(heavyProfile);
  const plan = generatePersonalizedDietPlan(heavyProfile, targets, 'Non-Veg');
  assert.equal(plan.length, 5);

  const totalProtein = plan.reduce((sum, slot) => sum + slot.proteinG, 0);
  const totalCalories = plan.reduce((sum, slot) => sum + slot.caloriesKcal, 0);
  const totalShare = plan.reduce((sum, slot) => sum + slot.calorieSharePct, 0);

  assert.equal(totalProtein, targets.proteinTargetG);
  assert.equal(totalCalories, targets.calorieTargetKcal);
  assert.equal(totalShare, 100);
  assert.ok(plan.every((slot) => slot.carbsG > 0 && slot.fatsG > 0));

  const adherence = calculateDietAdherence(plan, [plan[0].id, plan[2].id]);
  assert.equal(adherence.completedCount, 2);
  assert.equal(adherence.totalCount, 5);
  assert.equal(adherence.adherencePct, 40);
  assert.equal(adherence.adheredProteinG, plan[0].proteinG + plan[2].proteinG);
  assert.equal(adherence.adheredCaloriesKcal, plan[0].caloriesKcal + plan[2].caloriesKcal);
});

test('Offline-to-cloud login merge preserves both cloud and offline entries without overwriting history', () => {
  const today = new Date().toISOString().slice(0, 10);
  const local = createEmptyState(today, 'Student');
  local.readiness.hydrationGlasses = 5;
  local.meals = [
    { id: 'meal-local-1', name: 'Paneer Bowl', proteinG: 24, caloriesKcal: 310, loggedAt: '2026-11-19T09:00:00.000Z' },
  ];
  local.tasks = [
    { id: 'task-local-1', title: 'Drink 2L water', category: 'Wellness', completed: false, createdAt: '2026-11-19T08:00:00.000Z' },
  ];

  const cloud = createEmptyState(today, 'Rohan Verma');
  cloud.readiness.hydrationGlasses = 3;
  cloud.meals = [
    { id: 'meal-cloud-1', name: '2 Boiled Eggs', proteinG: 12, caloriesKcal: 155, loggedAt: '2026-11-19T07:30:00.000Z' },
  ];
  cloud.tasks = [
    { id: 'task-cloud-1', title: 'Plank circuit', category: 'Fitness', completed: true, createdAt: '2026-11-19T07:00:00.000Z' },
  ];

  const merged = mergeLocalAndCloudState(local, cloud, 'Rohan Verma');
  assert.equal(merged.profile.name, 'Rohan Verma');
  assert.equal(merged.readiness.hydrationGlasses, 5);
  assert.equal(merged.meals.length, 2);
  assert.equal(merged.tasks.length, 2);
  assert.ok(merged.meals.some((m) => m.id === 'meal-cloud-1'));
  assert.ok(merged.meals.some((m) => m.id === 'meal-local-1'));
});

test('Firestore payload serializer roundtrips cleanly and enforces schema bounds', () => {
  const today = new Date().toISOString().slice(0, 10);
  const state = createEmptyState(today, 'A'.repeat(160));
  state.meals = Array.from({ length: 120 }, (_, i) => ({
    id: `m-${i}`,
    name: `Meal ${i}`,
    proteinG: 20,
    caloriesKcal: 250,
    loggedAt: new Date().toISOString(),
  }));
  state.vitalsHistory = [
    {
      id: 'v-roundtrip',
      timestamp: new Date().toISOString(),
      dateKey: today,
      bpm: 64,
      systolic: 118,
      diastolic: 76,
      recoveryIndex: 86,
      stressLabel: 'Calm',
      source: 'optical-pad',
      confidencePct: 96,
    },
  ];

  const payload = serializeToFirestorePayload('uid_test_123', 'rohan@example.com', state);
  assert.equal(payload.uid, 'uid_test_123');
  assert.equal(payload.profile.name.length, 100);
  assert.equal(payload.nutritionLogs.length, 100);
  assert.equal(payload.vitalsHistory.length, 1);

  const restored = deserializeFromFirestorePayload(payload, today);
  assert.ok(restored);
  assert.equal(restored.meals.length, 100);
  assert.equal(restored.vitalsHistory[0]?.bpm, 64);
  assert.equal(restored.vitalsHistory[0]?.stressLabel, 'Calm');
});

test('translateAuthError returns human-friendly messages for common auth error codes', () => {
  assert.equal(
    translateAuthError({ code: 'auth/wrong-password' }),
    'Incorrect email or password. Please try again.'
  );
  assert.equal(
    translateAuthError({ code: 'auth/email-already-in-use' }),
    'An account with this email already exists. Try signing in instead.'
  );
  assert.equal(
    translateAuthError({ code: 'auth/weak-password' }),
    'Please choose a stronger password with at least 6 characters.'
  );
  assert.ok(translateAuthError({ code: 'auth/operation-not-allowed' }).includes('Google Sign-In'));
});
