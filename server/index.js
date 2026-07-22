import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const cities = [];
const CITY_SOURCE_URL =
  "https://countriesnow.space/api/v0.1/countries/population/cities";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const MAX_CITY_LOAD = 1200;
const FORECAST_DAY_OFFSET = 14;
const RANGE_DELTA = 5;

function inRange(value, center) {
  return (
    value >= Math.max(0, center - RANGE_DELTA) &&
    value <= center + RANGE_DELTA
  );
}

function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
}

const CACHE_FILE = path.join(__dirname, "server", "weather-cache.json");
const CACHE_TTL_DAYS = 1; // refresh once every day
let cache = { timestamp: 0, data: [] };

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

async function fetchCitySource() {
  const response = await fetch(CITY_SOURCE_URL);
  if (!response.ok) {
    throw new Error("Failed to load cities from remote source");
  }

  const payload = await response.json();
  const sourceCities = Array.isArray(payload.data) ? payload.data : [];

  return sourceCities
    .map((item) => {
      const latestPopulation =
        Array.isArray(item.populationCounts) && item.populationCounts.length
          ? Number(
              item.populationCounts[item.populationCounts.length - 1].value ||
                0,
            )
          : 0;

      return {
        city: item.city,
        country: item.country,
        population: latestPopulation,
      };
    })
    .filter((item) => item.city && item.country)
    .sort((a, b) => b.population - a.population)
    .slice(0, MAX_CITY_LOAD * 3);
}

async function geocodeCity(cityName, countryName) {
  const params = new URLSearchParams({
    name: cityName,
    count: "5",
    language: "en",
  });

  const response = await fetch(`${GEOCODING_URL}?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];
  if (!results.length) {
    return null;
  }

  const preferred =
    results.find(
      (result) => result.country?.toLowerCase() === countryName?.toLowerCase(),
    ) || results[0];

  if (
    typeof preferred.latitude !== "number" ||
    typeof preferred.longitude !== "number"
  ) {
    return null;
  }

  return preferred;
}

async function loadCities() {
  try {
    const sourceCities = await fetchCitySource();
    const geocodePromises = sourceCities.map(async (item) => {
      const result = await geocodeCity(item.city, item.country);
      if (!result) {
        return null;
      }

      return {
        name: `${item.city}, ${item.country}`,
        latitude: result.latitude,
        longitude: result.longitude,
      };
    });

    const settled = await Promise.allSettled(geocodePromises);
    const loaded = settled
      .filter((entry) => entry.status === "fulfilled" && entry.value)
      .map((entry) => entry.value)
      .slice(0, MAX_CITY_LOAD);

    cities.push(...loaded);
    console.log(`Loaded ${cities.length} cities from remote API.`);
  } catch (error) {
    console.error("Failed to populate cities from API:", error);
  }
}

async function loadCacheFromDisk() {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.timestamp && Array.isArray(parsed.data)) {
      cache = parsed;
      console.log(
        "Loaded weather cache from disk (",
        cache.data.length,
        "items )",
      );
      return true;
    }
  } catch (e) {
    // ignore missing file
  }
  return false;
}

async function saveCacheToDisk(obj) {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write cache to disk:", e);
  }
}

function isCacheStale() {
  if (!cache || !cache.timestamp) return true;
  const ageMs = Date.now() - cache.timestamp;
  return ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

async function refreshCacheInBatches() {
  // Ensure cities are loaded before refresh
  if (cities.length === 0) {
    console.log("Cities not loaded yet. Loading before cache refresh...");
    await loadCities();
  }

  console.log("Refreshing weather cache for", cities.length, "cities...");
  const results = [];
  const batchSize = 12;
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);

    // First pass
    const settled = await Promise.allSettled(
      batch.map((city) => getCityWeather(city)),
    );

    // Collect failures for retry
    const retryItems = [];
    settled.forEach((s, idx) => {
      if (s.status === "fulfilled" && s.value) {
        results.push(s.value);
      } else if (s.status === "rejected") {
        retryItems.push(batch[idx]);
      }
    });

    // Retry failed items once after a short delay
    if (retryItems.length > 0) {
      console.log(
        `  Retrying ${retryItems.length} failed item(s) in batch ${Math.floor(i / batchSize) + 1}...`,
      );
      await new Promise((r) => setTimeout(r, 1000));
      const retried = await Promise.allSettled(
        retryItems.map((city) => getCityWeather(city)),
      );
      retried.forEach((s) => {
        if (s.status === "fulfilled" && s.value) results.push(s.value);
      });
    }

    // polite delay to avoid hammering APIs
    await new Promise((r) => setTimeout(r, 400));
  }

  cache = { timestamp: Date.now(), data: results };
  await saveCacheToDisk(cache);
  console.log("Weather cache refreshed; stored", results.length, "items");
}

function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function scheduleDailyRefresh() {
  const delay = msUntilNextMidnight();
  console.log(
    `Scheduling next daily refresh in ${Math.round(delay / 1000 / 60)} minutes`,
  );
  setTimeout(async () => {
    try {
      await refreshCacheInBatches();
    } catch (e) {
      console.error("Daily refresh failed:", e);
    }

    setInterval(
      async () => {
        try {
          await refreshCacheInBatches();
        } catch (e) {
          console.error("Daily refresh failed:", e);
        }
      },
      24 * 60 * 60 * 1000,
    );
  }, delay);
}

// Start server immediately (non-blocking)
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

// Load cities in background, then check/refresh cache
loadCities()
  .then(async () => {
    await loadCacheFromDisk();
    if (isCacheStale()) {
      console.log(
        "Cache stale or missing. Refreshing in background...",
      );
      return refreshCacheInBatches()
        .then(() => console.log("Background cache refresh complete."))
        .catch((e) =>
          console.error("Background cache refresh failed:", e),
        );
    } else {
      console.log("Loaded fresh weather cache from disk.");
    }
  })
  .catch((e) => console.error("Initialization error:", e));

scheduleDailyRefresh();

async function getCityWeather(city) {
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + FORECAST_DAY_OFFSET);

  const params = new URLSearchParams({
    latitude: city.latitude,
    longitude: city.longitude,
    hourly: "temperature_2m,precipitation,relativehumidity_2m,wind_speed_10m",
    start_date: formatDate(targetDate),
    end_date: formatDate(targetDate),
    timezone: "UTC",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Weather API error for ${city.name}`);
  }

  const data = await response.json();
  const times = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
  const temperatures = Array.isArray(data?.hourly?.temperature_2m)
    ? data.hourly.temperature_2m
    : [];
  const precipitations = Array.isArray(data?.hourly?.precipitation)
    ? data.hourly.precipitation
    : [];
  const humidities = Array.isArray(data?.hourly?.relativehumidity_2m)
    ? data.hourly.relativehumidity_2m
    : [];
  const winds = Array.isArray(data?.hourly?.wind_speed_10m)
    ? data.hourly.wind_speed_10m
    : [];

  const hourlyForecast = times.map((_time, index) => ({
    temperature: temperatures[index] ?? null,
    precipitation: precipitations[index] ?? 0,
    humidity: humidities[index] ?? null,
    wind: winds[index] ?? null,
  }));

  const rainyHours = hourlyForecast.filter(
    (entry) => entry.precipitation > 0,
  ).length;
  const totalPrecipitation = hourlyForecast.reduce(
    (sum, entry) => sum + (entry.precipitation || 0),
    0,
  );
  const validTemperatures = hourlyForecast
    .map((entry) => entry.temperature)
    .filter((value) => typeof value === "number");
  const validHumidities = hourlyForecast
    .map((entry) => entry.humidity)
    .filter((value) => typeof value === "number");
  const validWinds = hourlyForecast
    .map((entry) => entry.wind)
    .filter((value) => typeof value === "number");

  const minTemperature = validTemperatures.length
    ? Math.min(...validTemperatures)
    : null;
  const maxTemperature = validTemperatures.length
    ? Math.max(...validTemperatures)
    : null;
  const minHumidity = validHumidities.length
    ? Math.min(...validHumidities)
    : null;
  const maxHumidity = validHumidities.length
    ? Math.max(...validHumidities)
    : null;
  const minWind = validWinds.length ? Math.min(...validWinds) : null;
  const maxWind = validWinds.length ? Math.max(...validWinds) : null;

  return {
    name: city.name,
    location: `${city.latitude.toFixed(2)}, ${city.longitude.toFixed(2)}`,
    forecastDate: formatDate(targetDate),
    rainyHours,
    totalPrecipitation: Number(totalPrecipitation.toFixed(1)),
    minTemperature:
      minTemperature !== null ? Number(minTemperature.toFixed(1)) : null,
    maxTemperature:
      maxTemperature !== null ? Number(maxTemperature.toFixed(1)) : null,
    minHumidity: minHumidity !== null ? Number(minHumidity.toFixed(0)) : null,
    maxHumidity: maxHumidity !== null ? Number(maxHumidity.toFixed(0)) : null,
    minWind: minWind !== null ? Number(minWind.toFixed(0)) : null,
    maxWind: maxWind !== null ? Number(maxWind.toFixed(0)) : null,
  };
}

app.get("/api/weather", async (req, res) => {
  try {
    if (!cache || !Array.isArray(cache.data) || cache.data.length === 0) {
      return res.status(503).json({
        message:
          "Weather cache is warming. Please try again in a few minutes while data is fetched.",
      });
    }

    // Parse optional query params for server-side filtering
    const {
      rainyHours: rainyHoursParam,
      temperature: temperatureParam,
      humidity: humidityParam,
      wind: windParam,
    } = req.query;

    const hasFilters =
      rainyHoursParam !== undefined ||
      temperatureParam !== undefined ||
      humidityParam !== undefined ||
      windParam !== undefined;

    let filtered = cache.data;

    if (hasFilters) {
      const centerRainyHours = rainyHoursParam
        ? Number(rainyHoursParam)
        : null;
      const centerTemp = temperatureParam ? Number(temperatureParam) : null;
      const centerHumidity = humidityParam ? Number(humidityParam) : null;
      const centerWind = windParam ? Number(windParam) : null;

      filtered = cache.data.filter((place) => {
        const dayTemp =
          place.minTemperature != null && place.maxTemperature != null
            ? (place.minTemperature + place.maxTemperature) / 2
            : (place.minTemperature ?? place.maxTemperature ?? 0);
        const dayHumidity =
          place.minHumidity != null && place.maxHumidity != null
            ? (place.minHumidity + place.maxHumidity) / 2
            : (place.minHumidity ?? place.maxHumidity ?? 0);
        const dayWind =
          place.minWind != null && place.maxWind != null
            ? (place.minWind + place.maxWind) / 2
            : (place.minWind ?? place.maxWind ?? 0);

        if (
          centerRainyHours !== null &&
          !inRange(place.rainyHours, centerRainyHours)
        ) {
          return false;
        }
        if (centerTemp !== null && !inRange(dayTemp, centerTemp)) {
          return false;
        }
        if (centerHumidity !== null && !inRange(dayHumidity, centerHumidity)) {
          return false;
        }
        if (centerWind !== null && !inRange(dayWind, centerWind)) {
          return false;
        }
        return true;
      });
    }

    res.json({
      generatedAt: new Date().toISOString(),
      count: filtered.length,
      filters: hasFilters
        ? {
            rainyHours: rainyHoursParam ?? null,
            temperature: temperatureParam ?? null,
            humidity: humidityParam ?? null,
            wind: windParam ?? null,
          }
        : null,
      data: filtered,
    });
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Unable to fetch weather data right now." });
  }
});

app.get("/api/top-rainy", async (req, res) => {
  try {
    if (!cache || !Array.isArray(cache.data) || cache.data.length === 0) {
      return res.status(503).json({
        message:
          "Weather cache is warming. Please try again in a few minutes while data is fetched.",
      });
    }

    const all = cache.data;

    const valid = all
      .filter((city) => city && city.rainyHours > 0)
      .sort((a, b) => b.rainyHours - a.rainyHours)
      .slice(0, 10);

    res.json({
      generatedAt: new Date().toISOString(),
      count: valid.length,
      data: valid,
    });
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Unable to fetch weather data right now." });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Where To Go API is running",
    endpoints: ["/api/weather", "/api/top-rainy"],
  });
});
