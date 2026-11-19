import React, { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { ActivityLevel, ComputedTargets, FitnessGoal, UserProfile } from '../types/wellness';

interface ProfileCardProps {
  profile: UserProfile;
  targets: ComputedTargets;
  onUpdateProfile: (next: UserProfile) => void;
}

const ACTIVITY_LEVELS: ActivityLevel[] = [
  'Desk Student / Light',
  'Calisthenics / Moderate',
  'Heavy Training',
];

const FITNESS_GOALS: FitnessGoal[] = [
  'Lean Core & Posture',
  'Muscle Gain',
  'Fat Loss',
];

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  targets,
  onUpdateProfile,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setDraft(profile);
    setError(null);
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }
    if (!Number.isFinite(draft.age) || draft.age < 14 || draft.age > 80) {
      setError('Age must be between 14 and 80.');
      return;
    }
    if (!Number.isFinite(draft.heightCm) || draft.heightCm < 120 || draft.heightCm > 230) {
      setError('Height must be between 120 cm and 230 cm.');
      return;
    }
    if (!Number.isFinite(draft.weightKg) || draft.weightKg < 35 || draft.weightKg > 180) {
      setError('Weight must be between 35 kg and 180 kg.');
      return;
    }
    onUpdateProfile({
      ...draft,
      name: trimmedName,
    });
    setIsEditing(false);
    setError(null);
  };

  const bmiColor =
    targets.bmiCategory === 'Healthy'
      ? 'text-[#2D6A4F]'
      : targets.bmiCategory === 'Elevated'
        ? 'text-[#B91C1C]'
        : 'text-[#D99B26]';

  return (
    <section
      aria-labelledby="profile-engine-heading"
      className="editorial-card rounded-2xl p-5 md:p-6"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#E8E0D1] pb-4">
        <div>
          <p className="text-xs font-medium text-[#6E5D52]">
            Personal Targets
          </p>
          <h2
            id="profile-engine-heading"
            className="mt-1 font-serif text-lg font-bold text-[#1F1916]"
          >
            {profile.name}
          </h2>
          <p className="mt-0.5 text-xs text-[#5C5046]">
            {profile.activityLevel} · {profile.goal}
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2 text-xs font-semibold text-[#1F1916] transition-colors hover:border-[#C85A28] hover:text-[#C85A28] whitespace-nowrap"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Profile
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-medium text-[#5C5046]"
              >
                Student Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2 text-sm text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="profile-age"
                  className="block text-xs font-medium text-[#5C5046]"
                >
                  Age
                </label>
                <input
                  id="profile-age"
                  type="number"
                  min={14}
                  max={80}
                  value={draft.age}
                  onChange={(e) => setDraft({ ...draft, age: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-2.5 py-2 text-sm tabular-metrics text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-height"
                  className="block text-xs font-medium text-[#5C5046]"
                >
                  Height (cm)
                </label>
                <input
                  id="profile-height"
                  type="number"
                  min={120}
                  max={230}
                  value={draft.heightCm}
                  onChange={(e) => setDraft({ ...draft, heightCm: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-2.5 py-2 text-sm tabular-metrics text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-weight"
                  className="block text-xs font-medium text-[#5C5046]"
                >
                  Weight (kg)
                </label>
                <input
                  id="profile-weight"
                  type="number"
                  min={35}
                  max={180}
                  step="0.5"
                  value={draft.weightKg}
                  onChange={(e) => setDraft({ ...draft, weightKg: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-2.5 py-2 text-sm tabular-metrics text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-activity"
                className="block text-xs font-medium text-[#5C5046]"
              >
                Activity Level
              </label>
              <select
                id="profile-activity"
                value={draft.activityLevel}
                onChange={(e) =>
                  setDraft({ ...draft, activityLevel: e.target.value as ActivityLevel })
                }
                className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2 text-sm text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
              >
                {ACTIVITY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-goal"
                className="block text-xs font-medium text-[#5C5046]"
              >
                Primary Goal
              </label>
              <select
                id="profile-goal"
                value={draft.goal}
                onChange={(e) =>
                  setDraft({ ...draft, goal: e.target.value as FitnessGoal })
                }
                className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-3 py-2 text-sm text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
              >
                {FITNESS_GOALS.map((goal) => (
                  <option key={goal} value={goal}>
                    {goal}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-[#B91C1C]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setError(null);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-4 py-2 text-xs font-semibold text-[#5C5046] hover:text-[#1F1916]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#C85A28] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B04A1D]"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Save Targets
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5C5046] tabular-metrics">
            <span>Age {profile.age} yrs</span>
            <span aria-hidden="true">·</span>
            <span>{profile.heightCm} cm</span>
            <span aria-hidden="true">·</span>
            <span>{profile.weightKg} kg</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[#EFE8D8] pt-4 @xl:grid-cols-5">
            <div>
              <p className="text-xs text-[#5C5046]">BMI Index</p>
              <p className="mt-1 text-xl font-bold tabular-metrics text-[#1F1916]">
                {targets.bmi.toFixed(1)}
              </p>
              <p className={`text-xs font-semibold ${bmiColor}`}>{targets.bmiCategory}</p>
            </div>
            <div>
              <p className="text-xs text-[#5C5046]">BMR / TDEE</p>
              <p className="mt-1 text-xl font-bold tabular-metrics text-[#1F1916]">
                {targets.tdee}
              </p>
              <p className="text-xs text-[#5C5046] tabular-metrics">BMR {targets.bmr} kcal</p>
            </div>
            <div>
              <p className="text-xs text-[#5C5046]">Calorie Target</p>
              <p className="mt-1 text-xl font-bold tabular-metrics text-[#2D6A4F]">
                {targets.calorieTargetKcal}
              </p>
              <p className="text-xs text-[#5C5046]">kcal / day</p>
            </div>
            <div>
              <p className="text-xs text-[#5C5046]">Protein Target</p>
              <p className="mt-1 text-xl font-bold tabular-metrics text-[#D99B26]">
                {targets.proteinTargetG}g
              </p>
              <p className="text-xs text-[#5C5046]">daily lean floor</p>
            </div>
            <div className="col-span-2 @xl:col-span-1">
              <p className="text-xs text-[#5C5046]">Hydration Goal</p>
              <p className="mt-1 text-xl font-bold tabular-metrics text-[#1F1916]">
                {targets.hydrationTargetGlasses}
              </p>
              <p className="text-xs text-[#5C5046] tabular-metrics">
                glasses ({(targets.hydrationTargetGlasses * 0.25).toFixed(1)}L)
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
