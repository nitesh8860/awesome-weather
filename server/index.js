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
const FORECAST_RANGE_DAYS = 60;

const CACHE_FILE = path.join(__dirname, "server", "weather-cache.json");
const CACHE_TTL_DAYS = 3; // re-evaluate every 3 days by default
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

await loadCities();

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
  console.log("Refreshing weather cache for", cities.length, "cities...");
  const results = [];
  const batchSize = 12;
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(getCityWeather));
    settled.forEach((s) => {
      if (s.status === "fulfilled" && s.value) results.push(s.value);
    });
    // polite delay to avoid hammering APIs
    await new Promise((r) => setTimeout(r, 400));
  }

  cache = { timestamp: Date.now(), data: results };
  await saveCacheToDisk(cache);
  console.log("Weather cache refreshed; stored", results.length, "items");
}

// Try load cache; if missing or stale, refresh and block startup until first refresh completes
await loadCacheFromDisk();
if (isCacheStale()) {
  console.log(
    "Initial cache missing or stale. Performing blocking refresh before server start...",
  );
  try {
    await refreshCacheInBatches();
  } catch (e) {
    console.error("Initial cache refresh failed:", e);
    // continue startup with whatever (possibly empty) cache is available
  }
} else {
  console.log("Loaded fresh weather cache from disk; starting server.");
}

async function getCityWeather(city) {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + FORECAST_RANGE_DAYS);

  const params = new URLSearchParams({
    latitude: city.latitude,
    longitude: city.longitude,
    hourly: "temperature_2m,precipitation,relativehumidity_2m",
    start_date: formatDate(today),
    end_date: formatDate(endDate),
    timezone: "UTC",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API error for ${city.name}`);
  }

  const data = await response.json();
  const times = data.hourly.time || [];
  const temperatures = data.hourly.temperature_2m || [];
  const precipitations = data.hourly.precipitation || [];
  const humidities = data.hourly.relativehumidity_2m || [];

  const rainyFiltered = times.reduce((acc, time, index) => {
    const temp = temperatures[index];
    const precipitation = precipitations[index];
    if (precipitation > 0 && temp >= 15 && temp <= 22) {
      acc.push({
        time,
        temperature: temp,
        precipitation,
        humidity: humidities[index],
      });
    }
    return acc;
  }, []);

  const uniqueDays = new Set(
    rainyFiltered.map((entry) => entry.time.slice(0, 10)),
  );
  const averageTemperature = rainyFiltered.length
    ? rainyFiltered.reduce((sum, entry) => sum + entry.temperature, 0) /
      rainyFiltered.length
    : 0;
  const averageHumidity = rainyFiltered.length
    ? rainyFiltered.reduce((sum, entry) => sum + (entry.humidity || 0), 0) /
      rainyFiltered.length
    : 0;
  const rainyDaysCount = uniqueDays.size;
  const monthlyRainyDays = (rainyDaysCount * 30) / 7; // approximate to month
  const avgRainHoursPerRainyDay = rainyDaysCount
    ? rainyFiltered.length / rainyDaysCount
    : 0;

  return {
    name: city.name,
    location: `${city.latitude.toFixed(2)}, ${city.longitude.toFixed(2)}`,
    rainyHours: rainyFiltered.length,
    rainyDays: rainyDaysCount,
    monthlyRainyDays: Number(monthlyRainyDays.toFixed(1)),
    avgRainHoursPerRainyDay: Number(avgRainHoursPerRainyDay.toFixed(2)),
    averageTemperature: Number(averageTemperature.toFixed(1)),
    averageHumidity: Number(averageHumidity.toFixed(0)),
    sampleHour: rainyFiltered[0]?.time || null,
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

    res.json({
      generatedAt: new Date().toISOString(),
      count: cache.data.length,
      data: cache.data,
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

    // Consensus thresholds (relaxed ranges by default)
    const CONS = {
      minTemp: 15,
      maxTemp: 22,
      minHum: 40,
      maxHum: 60,
      minMonthlyRainyDays: 4,
      maxMonthlyRainyDays: 15,
      minHoursPerDay: 2,
      maxHoursPerDay: 8,
    };

    const valid = all
      .filter((city) => {
        if (!city || city.rainyHours <= 0) return false;
        if (
          city.averageTemperature < CONS.minTemp ||
          city.averageTemperature > CONS.maxTemp
        )
          return false;
        if (
          city.averageHumidity < CONS.minHum ||
          city.averageHumidity > CONS.maxHum
        )
          return false;
        if (
          city.monthlyRainyDays < CONS.minMonthlyRainyDays ||
          city.monthlyRainyDays > CONS.maxMonthlyRainyDays
        )
          return false;
        if (
          city.avgRainHoursPerRainyDay < CONS.minHoursPerDay ||
          city.avgRainHoursPerRainyDay > CONS.maxHoursPerDay
        )
          return false;
        return true;
      })
      .sort((a, b) => b.rainyHours - a.rainyHours || b.rainyDays - a.rainyDays)
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
    endpoints: ["/api/top-rainy"],
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
