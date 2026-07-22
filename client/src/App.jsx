import { useEffect, useState, useRef, useCallback } from "react";

const DEFAULT_RAINY_HOURS = 1;
const DEFAULT_PREFERRED_TEMP = 17;
const DEFAULT_PREFERRED_HUMIDITY = 55;
const DEFAULT_PREFERRED_WIND = 16;
const RANGE_DELTA = 5;

const PRESETS = [
  {
    label: "Moody",
    icon: "🌫",
    desc: "Cloudy, cool, pre-storm breeze",
    rainyHours: 2,
    temp: 17,
    humidity: 60,
    wind: 20,
  },
  {
    label: "Sunny",
    icon: "☀️",
    desc: "Clear skies, warm, light air",
    rainyHours: 0,
    temp: 25,
    humidity: 40,
    wind: 10,
  },
  {
    label: "Bracing",
    icon: "🍃",
    desc: "Cool, crisp, fresh breeze",
    rainyHours: 3,
    temp: 10,
    humidity: 50,
    wind: 25,
  },
  {
    label: "Cozy Rain",
    icon: "🌧",
    desc: "Steady drizzle, calm air",
    rainyHours: 12,
    temp: 15,
    humidity: 75,
    wind: 5,
  },
  {
    label: "Dreich",
    icon: "☁️",
    desc: "Gloomy, damp, still chill",
    rainyHours: 10,
    temp: 8,
    humidity: 85,
    wind: 8,
  },
  {
    label: "Storm Chase",
    icon: "⛈",
    desc: "Hot, humid, gusty, electric",
    rainyHours: 18,
    temp: 28,
    humidity: 80,
    wind: 35,
  },
];

function inRange(value, center) {
  return (
    value >= Math.max(0, center - RANGE_DELTA) && value <= center + RANGE_DELTA
  );
}

function filterPlace(place, filters) {
  const {
    enableRainyHours,
    rainyHours,
    enableTemp,
    preferredTemp,
    enableHumidity,
    preferredHumidity,
    enableWind,
    preferredWind,
  } = filters;

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

  if (enableRainyHours && !inRange(place.rainyHours, rainyHours)) {
    return false;
  }
  if (enableTemp && !inRange(dayTemp, preferredTemp)) {
    return false;
  }
  if (enableHumidity && !inRange(dayHumidity, preferredHumidity)) {
    return false;
  }
  if (enableWind && !inRange(dayWind, preferredWind)) {
    return false;
  }
  return true;
}

function applyPreset(preset, setters) {
  const {
    setRainyHours,
    setPreferredTemp,
    setPreferredHumidity,
    setPreferredWind,
    setEnableRainyHours,
    setEnableTemp,
    setEnableHumidity,
    setEnableWind,
  } = setters;

  setRainyHours(preset.rainyHours);
  setPreferredTemp(preset.temp);
  setPreferredHumidity(preset.humidity);
  setPreferredWind(preset.wind);
  setEnableRainyHours(true);
  setEnableTemp(true);
  setEnableHumidity(true);
  setEnableWind(true);
}

function App() {
  // Hydrate initial state from URL query params (shareable/bookmarkable)
  const urlParams = new URLSearchParams(window.location.search);
  const hasUrlParams = [...urlParams.keys()].length > 0;

  function initialVal(param, fallback) {
    return hasUrlParams
      ? Number(urlParams.get(param)) || fallback
      : fallback;
  }
  function initialBool(param, fallback) {
    if (!hasUrlParams) return fallback;
    const v = urlParams.get(param);
    if (v === null) return fallback;
    return v !== "false";
  }

  const [rainyHours, setRainyHours] = useState(
    initialVal("rainyHours", DEFAULT_RAINY_HOURS),
  );
  const [preferredTemp, setPreferredTemp] = useState(
    initialVal("temp", DEFAULT_PREFERRED_TEMP),
  );
  const [preferredHumidity, setPreferredHumidity] = useState(
    initialVal("humidity", DEFAULT_PREFERRED_HUMIDITY),
  );
  const [preferredWind, setPreferredWind] = useState(
    initialVal("wind", DEFAULT_PREFERRED_WIND),
  );
  const [enableRainyHours, setEnableRainyHours] = useState(
    initialBool("enableRainy", true),
  );
  const [enableTemp, setEnableTemp] = useState(
    initialBool("enableTemp", true),
  );
  const [enableHumidity, setEnableHumidity] = useState(
    initialBool("enableHumidity", true),
  );
  const [enableWind, setEnableWind] = useState(
    initialBool("enableWind", true),
  );

  const [places, setPlaces] = useState([]);
  const [allPlacesCount, setAllPlacesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);

  const presetSetters = {
    setRainyHours,
    setPreferredTemp,
    setPreferredHumidity,
    setPreferredWind,
    setEnableRainyHours,
    setEnableTemp,
    setEnableHumidity,
    setEnableWind,
  };

  // Build current filter state into a single object
  const currentFilters = {
    enableRainyHours,
    rainyHours,
    enableTemp,
    preferredTemp,
    enableHumidity,
    preferredHumidity,
    enableWind,
    preferredWind,
  };

  // Build query string from enabled filters for server-side pre-filtering
  function buildQueryString() {
    const params = new URLSearchParams();
    if (enableRainyHours) params.set("rainyHours", rainyHours);
    if (enableTemp) params.set("temperature", preferredTemp);
    if (enableHumidity) params.set("humidity", preferredHumidity);
    if (enableWind) params.set("wind", preferredWind);
    return params.toString();
  }

  // Sync filter state to URL query params for shareable/bookmarkable URLs
  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("rainyHours", rainyHours);
    params.set("temp", preferredTemp);
    params.set("humidity", preferredHumidity);
    params.set("wind", preferredWind);
    params.set("enableRainy", enableRainyHours);
    params.set("enableTemp", enableTemp);
    params.set("enableHumidity", enableHumidity);
    params.set("enableWind", enableWind);
    const qs = params.toString();
    const newUrl = `${window.location.pathname}?${qs}`;
    window.history.replaceState(null, "", newUrl);
  }, [
    rainyHours,
    preferredTemp,
    preferredHumidity,
    preferredWind,
    enableRainyHours,
    enableTemp,
    enableHumidity,
    enableWind,
  ]);

  // Debounced fetch from server with current filter params.
  // Keep old results visible during re-fetch instead of showing a spinner.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Update URL immediately (no debounce)
    syncUrl();

    debounceRef.current = setTimeout(async () => {
      try {
        setError(null);
        const qs = buildQueryString();
        const baseUrl = import.meta.env.VITE_API_URL
          ? `${import.meta.env.VITE_API_URL}/api/weather`
          : "/api/weather";
        const apiUrl = qs ? `${baseUrl}?${qs}` : baseUrl;
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error("Failed to load weather data");
        }
        const payload = await response.json();
        setAllPlacesCount(payload.count);
        setPlaces(payload.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    rainyHours,
    preferredTemp,
    preferredHumidity,
    preferredWind,
    enableRainyHours,
    enableTemp,
    enableHumidity,
    enableWind,
    syncUrl,
  ]);

  const matchedCount = places.filter((place) =>
    filterPlace(place, currentFilters),
  ).length;

  function rangeLabel(center) {
    const lo = Math.max(0, center - RANGE_DELTA);
    const hi = center + RANGE_DELTA;
    return `(${lo}–${hi})`;
  }

  return (
    <div className="app-shell">
      <header>
        <h2>Find your perfect climate</h2>
        <p>Discover destinations with mild temperatures, a gentle breeze, and minimal rain — 14 days ahead.</p>
      </header>

      {error && <div className="message error">{error}</div>}

      {/* Initial loading state (first-ever load, no data yet) */}
      {loading && places.length === 0 && (
        <div className="message">Loading weather data…</div>
      )}

      {/* Show table once we've fetched at least once (keep visible during re-fetches) */}
      {(!loading || places.length > 0) && (
        <div className="content-grid">
          <div className="side-panel">
            <div className="explain">
              <strong>14-day forecast</strong>
              <div>Showing the forecast 14 days from today so you can plan ahead. Pick a mood below or tweak the sliders yourself.</div>
            </div>
            <div className="slider-panel">
              <div className="presets-row">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className="preset-btn"
                    title={preset.desc}
                    onClick={() => applyPreset(preset, presetSetters)}>
                    <span className="preset-icon">{preset.icon}</span>
                    <span className="preset-label">{preset.label}</span>
                  </button>
                ))}
              </div>
              <div className="filter-toggle-row">
                <label>
                  <input
                    type="checkbox"
                    checked={enableRainyHours}
                    onChange={(event) =>
                      setEnableRainyHours(event.target.checked)
                    }
                  />
                  Rain
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={enableTemp}
                    onChange={(event) => setEnableTemp(event.target.checked)}
                  />
                  Temperature
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={enableHumidity}
                    onChange={(event) =>
                      setEnableHumidity(event.target.checked)
                    }
                  />
                  Humidity
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={enableWind}
                    onChange={(event) =>
                      setEnableWind(event.target.checked)
                    }
                  />
                  Wind
                </label>
              </div>
              <div className="slider-row">
                <label htmlFor="rainy-hours-slider">
                  Rainy hours: <strong>{rainyHours}h</strong>{" "}
                  <span className="range-hint">{rangeLabel(rainyHours)}</span>
                </label>
                <input
                  id="rainy-hours-slider"
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={rainyHours}
                  onChange={(event) =>
                    setRainyHours(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>0</span>
                  <span>12</span>
                  <span>24</span>
                </div>
              </div>
              <div className="slider-row">
                <label htmlFor="temp-slider">
                  Temperature: <strong>{preferredTemp}°C</strong>{" "}
                  <span className="range-hint">
                    {rangeLabel(preferredTemp)}
                  </span>
                </label>
                <input
                  id="temp-slider"
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={preferredTemp}
                  onChange={(event) =>
                    setPreferredTemp(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>0</span>
                  <span>20</span>
                  <span>40</span>
                </div>
              </div>
              <div className="slider-row">
                <label htmlFor="humidity-slider">
                  Humidity: <strong>{preferredHumidity}%</strong>{" "}
                  <span className="range-hint">
                    {rangeLabel(preferredHumidity)}
                  </span>
                </label>
                <input
                  id="humidity-slider"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={preferredHumidity}
                  onChange={(event) =>
                    setPreferredHumidity(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="slider-row">
                <label htmlFor="wind-slider">
                  Wind: <strong>{preferredWind} km/h</strong>{" "}
                  <span className="range-hint">
                    {rangeLabel(preferredWind)}
                  </span>
                </label>
                <input
                  id="wind-slider"
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={preferredWind}
                  onChange={(event) =>
                    setPreferredWind(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
              <div className="slider-note secondary">
                <span className="match-count">
                  {matchedCount} of {allPlacesCount} cities match
                  {loading && places.length > 0 && " (updating…)"}
                </span>
              </div>
            </div>
          </div>
          <div className="table-panel">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>City</th>
                    <th>Location</th>
                    <th>Forecast Date</th>
                    <th>Rain</th>
                    <th>Temp (°C)</th>
                    <th>Hum (%)</th>
                    <th>Wind (km/h)</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedCount ? (
                    places
                      .filter((place) => filterPlace(place, currentFilters))
                      .map((place, index) => (
                        <tr key={place.name}>
                          <td>{index + 1}</td>
                          <td>{place.name}</td>
                          <td>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                place.location,
                              )}`}
                              target="_blank"
                              rel="noreferrer noopener">
                              {place.location}
                            </a>
                          </td>
                          <td>{place.forecastDate}</td>
                          <td>{place.rainyHours}h</td>
                          <td>
                            {place.minTemperature != null
                              ? `${place.minTemperature}–${place.maxTemperature}`
                              : "-"}
                          </td>
                          <td>
                            {place.minHumidity != null
                              ? `${place.minHumidity}–${place.maxHumidity}`
                              : "-"}
                          </td>
                          <td>
                            {place.minWind != null
                              ? `${place.minWind}–${place.maxWind}`
                              : "-"}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="8">
                        No cities match your current filter settings. Try
                        widening your ranges or disabling some filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
