import React, { useEffect, useState } from 'react';
import { CloudSun, Droplets, LocateFixed, RefreshCw, Square, Volume2, Wind } from 'lucide-react';
import { weatherService } from '../services/weatherService';
import { LiveWeatherData, WorkoutTypeOption } from '../types/wellness';
import { evaluateWorkoutWeatherSuitability } from '../utils/calculations';

interface WeatherBriefCardProps {
  preferredCity: string;
  selectedWorkoutType: WorkoutTypeOption;
  onChangeCity: (city: string) => void;
  onChangeWorkoutType: (workout: WorkoutTypeOption) => void;
}

const WORKOUT_OPTIONS: WorkoutTypeOption[] = [
  'Outdoor Calisthenics & Run',
  'Hostel Core & Planks',
  'Evening Mobility Walk',
  'Heavy Resistance Training',
];

export const WeatherBriefCard: React.FC<WeatherBriefCardProps> = ({
  preferredCity,
  selectedWorkoutType,
  onChangeCity,
  onChangeWorkoutType,
}) => {
  const [cityInput, setCityInput] = useState(preferredCity);
  const [weather, setWeather] = useState<LiveWeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const loadWeather = async (params: { city?: string; lat?: number; lon?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await weatherService.fetchWeather(params);
      setWeather(data);
      if (data.city && data.city !== 'Local Area') {
        setCityInput(data.city);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach live weather feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCityInput(preferredCity);
    loadWeather({ city: preferredCity || 'Bengaluru' });
  }, [preferredCity]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === preferredCity.toLowerCase()) {
      loadWeather({ city: trimmed });
    } else {
      onChangeCity(trimmed);
    }
  };

  const handleUseGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is unavailable on this browser. Enter a city name instead.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        loadWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        setLoading(false);
        setError('Location permission denied — enter your city manually.');
      },
      { timeout: 8000 }
    );
  };

  const suitability = weather
    ? evaluateWorkoutWeatherSuitability(weather, selectedWorkoutType)
    : null;

  const handleTogglePodcastBrief = () => {
    if (!suitability || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(suitability.podcastScript);
    utterance.rate = 0.98;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const toneBadgeColor =
    suitability?.tone === 'forest'
      ? 'text-[#2D6A4F] bg-[#2D6A4F]/10 border-[#2D6A4F]/30'
      : suitability?.tone === 'crimson'
        ? 'text-[#B91C1C] bg-[#B91C1C]/10 border-[#B91C1C]/30'
        : 'text-[#B06C0A] bg-[#D99B26]/15 border-[#D99B26]/40';

  return (
    <section
      aria-labelledby="weather-brief-heading"
      className="editorial-card flex flex-col justify-between rounded-2xl p-5"
    >
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E8E0D1] pb-3.5">
          <div>
            <p className="text-xs font-medium text-[#5C5046]">
              Live Weather Brief · Audio Workout Check
            </p>
            <h2
              id="weather-brief-heading"
              className="mt-0.5 font-serif text-lg font-bold text-[#1F1916]"
            >
              {weather
                ? `${weather.city}${weather.country ? `, ${weather.country}` : ''}`
                : 'Live Local Weather'}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleTogglePodcastBrief}
            disabled={!suitability}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-40 ${
              isSpeaking
                ? 'bg-[#2B1B12] text-[#F2EAD3]'
                : 'bg-[#C85A28] text-white hover:bg-[#B04A1D]'
            }`}
          >
            {isSpeaking ? (
              <>
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                Stop Brief
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                Play Weather Brief
              </>
            )}
          </button>
        </div>

        {/* Compact City & Workout Controls */}
        <div className="mt-3.5 grid grid-cols-1 gap-2.5 @md:grid-cols-2">
          <form onSubmit={handleCitySubmit} className="flex items-center gap-1.5">
            <label htmlFor="weather-city-input" className="sr-only">
              City for live weather
            </label>
            <input
              id="weather-city-input"
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="City (e.g. Bengaluru)"
              className="min-h-[38px] min-w-0 flex-1 rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-2.5 py-1.5 text-xs text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Update weather city"
              className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] text-[#1F1916] hover:border-[#C85A28]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleUseGps}
              aria-label="Use current GPS location for weather"
              className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] text-[#1F1916] hover:border-[#2D6A4F]"
            >
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </form>

          <div>
            <label htmlFor="weather-workout-select" className="sr-only">
              Select today&apos;s workout for suitability check
            </label>
            <select
              id="weather-workout-select"
              value={selectedWorkoutType}
              onChange={(e) => onChangeWorkoutType(e.target.value as WorkoutTypeOption)}
              className="min-h-[38px] w-full rounded-lg border border-[#DDD4C3] bg-[#F9F6EE] px-2.5 py-1.5 text-xs font-medium text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
            >
              {WORKOUT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Telemetry & Suitability Verdict */}
        {loading && !weather ? (
          <p className="mt-4 text-xs text-[#5C5046]">Fetching live temperature &amp; humidity...</p>
        ) : error ? (
          <p role="alert" className="mt-4 text-xs font-medium text-[#B91C1C]">
            {error}
          </p>
        ) : weather && suitability ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F9F6EE] px-3.5 py-3">
              <div className="flex items-center gap-3">
                <CloudSun className="h-7 w-7 shrink-0 text-[#C85A28]" aria-hidden="true" />
                <div>
                  <p
                    className="text-2xl font-bold leading-none tabular-metrics text-[#1F1916]"
                    data-testid="weather-temp"
                  >
                    {weather.temperatureC}°C
                  </p>
                  <p className="mt-1 text-xs text-[#5C5046]">
                    {weather.conditionLabel} · Feels {weather.apparentTempC}°C
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs tabular-metrics text-[#1F1916]">
                <span className="inline-flex items-center gap-1" data-testid="weather-humidity">
                  <Droplets className="h-3.5 w-3.5 text-[#2D6A4F]" aria-hidden="true" />
                  <strong>{weather.humidityPct}%</strong> RH
                </span>
                <span className="inline-flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5 text-[#5C5046]" aria-hidden="true" />
                  <strong>{weather.windKmh}</strong> km/h
                </span>
              </div>
            </div>

            <div className={`rounded-xl border px-3.5 py-2.5 ${toneBadgeColor}`}>
              <p className="text-xs font-bold" data-testid="weather-suitability-verdict">
                {suitability.verdict}: {suitability.headline}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed opacity-90">{suitability.advice}</p>
            </div>
          </div>
        ) : null}
      </div>

      {weather && (
        <p className="mt-3 text-[11px] text-[#6E5D52] tabular-metrics">
          Live local weather
        </p>
      )}
    </section>
  );
};
