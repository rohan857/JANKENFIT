import { LiveWeatherData } from '../types/wellness';

function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code >= 1 && code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Light Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mild Conditions';
}

async function fetchDirectlyFromOpenMeteo(params: {
  city?: string;
  lat?: number;
  lon?: number;
}): Promise<LiveWeatherData> {
  let latitude = params.lat;
  let longitude = params.lon;
  let city = params.city?.trim() || 'Local Area';
  let country = '';

  if ((latitude === undefined || longitude === undefined) && params.city) {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1&language=en&format=json`
    );
    if (!geoRes.ok) {
      throw new Error('Could not reach live weather geocoding service.');
    }
    const geo = (await geoRes.json()) as {
      results?: Array<{ name: string; country?: string; latitude: number; longitude: number }>;
    };
    const match = geo.results?.[0];
    if (!match) {
      throw new Error(`City "${city}" was not found.`);
    }
    latitude = match.latitude;
    longitude = match.longitude;
    city = match.name;
    country = match.country ?? '';
  }

  if (latitude === undefined || longitude === undefined) {
    throw new Error('Location coordinates required.');
  }

  const wxRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      String(latitude)
    )}&longitude=${encodeURIComponent(
      String(longitude)
    )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`
  );
  if (!wxRes.ok) {
    throw new Error('Could not fetch live weather conditions.');
  }
  const wx = (await wxRes.json()) as {
    current?: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      precipitation: number;
      weather_code: number;
      wind_speed_10m: number;
    };
  };

  if (!wx.current) {
    throw new Error('Live weather response was incomplete.');
  }

  return {
    city,
    country,
    latitude,
    longitude,
    temperatureC: Math.round(wx.current.temperature_2m * 10) / 10,
    apparentTempC: Math.round(wx.current.apparent_temperature * 10) / 10,
    humidityPct: Math.round(wx.current.relative_humidity_2m),
    windKmh: Math.round(wx.current.wind_speed_10m * 10) / 10,
    precipitationMm: Math.round(wx.current.precipitation * 10) / 10,
    weatherCode: wx.current.weather_code,
    conditionLabel: describeWeatherCode(wx.current.weather_code),
    observedAt: wx.current.time,
    provider: 'Open-Meteo Direct API',
  };
}

export const weatherService = {
  async fetchWeather(params: { city?: string; lat?: number; lon?: number }): Promise<LiveWeatherData> {
    const query = new URLSearchParams();
    if (params.lat !== undefined && params.lon !== undefined) {
      query.set('lat', String(params.lat));
      query.set('lon', String(params.lon));
    } else if (params.city) {
      query.set('city', params.city.trim());
    }

    // Prefer our real Express backend route when running with server.ts
    try {
      const res = await fetch(`/api/weather?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return (await res.json()) as LiveWeatherData;
      }
      if (!res.ok && contentType.includes('application/json')) {
        const errPayload = (await res.json()) as { error?: string };
        if (errPayload.error && errPayload.error.includes('not found')) {
          throw new Error(errPayload.error);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        throw err;
      }
      // Static GitHub Pages or Capacitor APK without local Express -> call Open-Meteo directly
    }

    return fetchDirectlyFromOpenMeteo(params);
  },
};
