import { FoodPreset, PacerRoutine } from '../types/wellness';

export const HOSTEL_FOOD_PRESETS: FoodPreset[] = [
  {
    id: 'boiled-eggs',
    name: '2 Boiled Eggs',
    proteinG: 12,
    caloriesKcal: 155,
    servingNote: '2 whole eggs',
  },
  {
    id: 'hostel-dal',
    name: 'Hostel Dal Bowl',
    proteinG: 10,
    caloriesKcal: 180,
    servingNote: '1 medium katori',
  },
  {
    id: 'paneer-curd',
    name: '100g Paneer / Curd',
    proteinG: 15,
    caloriesKcal: 240,
    servingNote: '100g serving',
  },
  {
    id: 'glass-milk',
    name: '1 Glass Milk (250ml)',
    proteinG: 8,
    caloriesKcal: 150,
    servingNote: '250ml toned milk',
  },
  {
    id: 'roasted-chana',
    name: 'Roasted Chana (50g)',
    proteinG: 10,
    caloriesKcal: 180,
    servingNote: '1 handful / 50g',
  },
  {
    id: 'roti-sabzi',
    name: '2 Roti + Sabzi',
    proteinG: 7,
    caloriesKcal: 260,
    servingNote: 'Mess standard plate',
  },
  {
    id: 'soya-chunks',
    name: 'Soya Chunks Bowl (50g)',
    proteinG: 26,
    caloriesKcal: 170,
    servingNote: '50g dry boiled',
  },
  {
    id: 'chicken-breast',
    name: 'Chicken Breast / Curry',
    proteinG: 28,
    caloriesKcal: 290,
    servingNote: '120g cooked portion',
  },
];

export const SPINE_RESET_MOVEMENTS = [
  {
    id: 'thoracic-reach',
    title: 'Overhead Thoracic Reach',
    durationSec: 20,
    cue: 'Interlace fingers overhead, ribs tucked down, lengthen the mid-back without flaring the lower spine.',
  },
  {
    id: 'hip-flexor-lunge',
    title: 'Standing Hip-Flexor Lunge',
    durationSec: 20,
    cue: 'Step one foot back, squeeze rear glute firmly, and gently tilt pelvis upward to release tight desk hip flexors.',
  },
  {
    id: 'wall-chin-tucks',
    title: 'Wall Chin Tucks',
    durationSec: 20,
    cue: 'Stand tall, glide chin straight back toward your throat to align cervical spine and counter laptop forward-head drift.',
  },
] as const;

export const CALISTHENICS_ROUTINES: PacerRoutine[] = [
  {
    id: 'core-shield',
    name: 'Core & Lower-Back Shield',
    description: '3×40s Forearm Plank + 2×15s Side Plank (Left & Right)',
    blocks: [
      { label: 'Forearm Plank Hold', sets: 3, workSeconds: 40, restSeconds: 20 },
      { label: 'Side Plank Hold', sets: 2, workSeconds: 15, restSeconds: 15 },
    ],
  },
  {
    id: 'beginner-core',
    name: 'Beginner Core',
    description: '3×30s Clean Forearm Plank with 20s recovery',
    blocks: [
      { label: 'Forearm Plank Hold', sets: 3, workSeconds: 30, restSeconds: 20 },
    ],
  },
  {
    id: 'dead-bug-bridge',
    name: 'Dead Bug & Glute Bridge Mobility',
    description: '2×40s Slow Dead Bugs + 2×40s Glute Bridge Hold',
    blocks: [
      { label: 'Slow Dead Bug Reps', sets: 2, workSeconds: 40, restSeconds: 15 },
      { label: 'Glute Bridge Hold', sets: 2, workSeconds: 40, restSeconds: 15 },
    ],
  },
];

export const FATIGUE_OPTIONS: Array<{
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  shortLabel: string;
}> = [
  { level: 1, label: '1 — Fresh & Loose', shortLabel: 'Fresh' },
  { level: 2, label: '2 — Mild Desk Stiffness', shortLabel: 'Light' },
  { level: 3, label: '3 — Moderate Fatigue', shortLabel: 'Moderate' },
  { level: 4, label: '4 — Tight Lower Back', shortLabel: 'Tight' },
  { level: 5, label: '5 — Heavy Strain', shortLabel: 'Heavy Strain' },
];
