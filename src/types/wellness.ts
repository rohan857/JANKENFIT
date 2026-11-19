export type NavTab = 'today' | 'wellness' | 'vitals' | 'rations' | 'training' | 'chronicle';

export type ActivityLevel =
  | 'Desk Student / Light'
  | 'Calisthenics / Moderate'
  | 'Heavy Training';

export type FitnessGoal = 'Lean Core & Posture' | 'Muscle Gain' | 'Fat Loss';

export type SleepQuality = 'Restless' | 'Average' | 'Deep';

export type DietPreference = 'Hostel Veg' | 'Eggetarian' | 'Non-Veg';

export type TaskCategory = 'Fitness' | 'Wellness' | 'Study' | 'Diet';

export type MoodState = 'Focused' | 'Calm' | 'Stressed' | 'Tired' | 'Motivated';

export type WorkoutTypeOption =
  | 'Outdoor Calisthenics & Run'
  | 'Hostel Core & Planks'
  | 'Evening Mobility Walk'
  | 'Heavy Resistance Training';

export interface UserProfile {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
}

export interface ComputedTargets {
  bmi: number;
  bmiCategory: 'Underweight' | 'Healthy' | 'Overweight' | 'Elevated';
  bmr: number;
  tdee: number;
  calorieTargetKcal: number;
  proteinTargetG: number;
  hydrationTargetGlasses: number;
}

export interface VitalReading {
  id: string;
  timestamp: string;
  dateKey: string;
  bpm: number;
  systolic: number;
  diastolic: number;
  recoveryIndex: number; // 0-100
  stressLabel: 'Calm' | 'Balanced' | 'Elevated';
  source: 'optical-pad' | 'rear-camera';
  confidencePct: number;
}

export interface ReadinessState {
  sleepHours: number; // 3.0 to 11.0 step 0.5
  sleepQuality: SleepQuality;
  fatigueLevel: 1 | 2 | 3 | 4 | 5; // 1 = Fresh, 5 = Heavy Strain
  hydrationGlasses: number; // 250ml each
}

export interface ReadinessEvaluation {
  score: number; // 0-100
  statusLabel: 'Optimal' | 'Steady' | 'Strained';
  tone: 'forest' | 'amber' | 'crimson';
  prescription: string;
  breakdown: {
    sleep: number; // out of 40
    fatigue: number; // out of 30
    hydration: number; // out of 15
    vitals: number; // out of 15
  };
}

export interface FoodPreset {
  id: string;
  name: string;
  proteinG: number;
  caloriesKcal: number;
  servingNote: string;
}

export interface MealEntry {
  id: string;
  name: string;
  proteinG: number;
  caloriesKcal: number;
  loggedAt: string;
  isCustom?: boolean;
}

export interface DietMealSlot {
  id: string;
  slotLabel: string;
  timeWindow: string;
  mealName: string;
  itemsSummary: string;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  caloriesKcal: number;
  calorieSharePct: number;
  portionNote: string;
  hydrationCue: string;
}

export interface TaskItem {
  id: string;
  title: string;
  category: TaskCategory;
  dueTime?: string;
  completed: boolean;
  createdAt: string;
}

export interface WellnessLog {
  id: string;
  kind: 'breathing' | 'eye-rest' | 'mood';
  mood?: MoodState;
  note: string;
  durationSeconds: number;
  dateKey: string;
  loggedAt: string;
}

export interface LiveWeatherData {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  apparentTempC: number;
  humidityPct: number;
  windKmh: number;
  precipitationMm: number;
  weatherCode: number;
  conditionLabel: string;
  observedAt: string;
  provider: string;
}

export interface WeatherSuitability {
  verdict: 'Ideal' | 'Caution' | 'Move Indoors';
  tone: 'forest' | 'amber' | 'crimson';
  headline: string;
  advice: string;
  podcastScript: string;
}

export interface StorageInfo {
  engine: string;
  platform: string;
  activeDbPath: string;
  windowsTargetPath: string;
  androidTargetPath: string;
  connected: boolean;
}

export interface PacerBlock {
  label: string;
  sets: number;
  workSeconds: number;
  restSeconds: number;
}

export interface PacerRoutine {
  id: string;
  name: string;
  description: string;
  blocks: PacerBlock[];
}

export interface WorkoutSession {
  id: string;
  dateKey: string;
  completedAt: string;
  routineName: string;
  totalWorkSeconds: number;
  setsCompleted: number;
}

export interface PostureLog {
  id: string;
  dateKey: string;
  completedAt: string;
  intervalMinutes: number;
  movementsCompleted: string[];
}

export interface DailySummary {
  dateKey: string; // YYYY-MM-DD
  dayLabel: string; // Mon, Tue, etc.
  proteinG: number;
  proteinTargetG: number;
  proteinConsistencyPct: number; // 0-100+
  caloriesKcal: number;
  readinessScore: number;
  trainingSessions: number;
  trainingSeconds: number;
  deskBreaks: number;
  hydrationGlasses: number;
}

export interface AppState {
  activeDateKey: string;
  profile: UserProfile;
  readiness: ReadinessState;
  meals: MealEntry[];
  vitalsHistory: VitalReading[];
  workouts: WorkoutSession[];
  postureLogs: PostureLog[];
  dailyHistory: DailySummary[]; // Archived past days (up to 7 days)
  deskIntervalMinutes: 30 | 45 | 60;
  tasks: TaskItem[];
  wellnessLogs: WellnessLog[];
  dietPreference: DietPreference;
  dietAdherenceIds: string[];
  preferredCity: string;
  selectedWorkoutType: WorkoutTypeOption;
}
