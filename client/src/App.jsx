import { useEffect, useState, useRef, useCallback } from "react";

const DEFAULT_RAINY_HOURS = 1;
const DEFAULT_PREFERRED_TEMP = 17;
const DEFAULT_PREFERRED_HUMIDITY = 55;
const DEFAULT_PREFERRED_WIND = 16;
const RANGE_DELTA = 5;

const WEEKS = [
  { label: "This week", offset: 6, desc: "6 days from now" },
  { label: "Next week", offset: 13, desc: "13 days from now" },
];

const PRESETS = [
  {
    label: "Moody",
    icon: "🌫",
    desc: "Cloudy, cool, pre-storm breeze",
    rainyHours: 2,
    temp: 17,
    humidity: 60,
    wind: 20,
    color: "#6b7b8d",
  },
  {
    label: "Sunny",
    icon: "☀️",
    desc: "Clear skies, warm, light air",
    rainyHours: 0,
    temp: 25,
    humidity: 40,
    wind: 10,
    color: "#c8962e",
  },
  {
    label: "Bracing",
    icon: "🍃",
    desc: "Cool, crisp, fresh breeze",
    rainyHours: 3,
    temp: 10,
    humidity: 50,
    wind: 25,
    color: "#4f9b7a",
  },
  {
    label: "Cozy Rain",
    icon: "🌧",
    desc: "Steady drizzle, calm air",
    rainyHours: 12,
    temp: 15,
    humidity: 75,
    wind: 5,
    color: "#5a72a8",
  },
  {
    label: "Dreich",
    icon: "☁️",
    desc: "Gloomy, damp, still chill",
    rainyHours: 10,
    temp: 8,
    humidity: 85,
    wind: 8,
    color: "#7d7196",
  },
  {
    label: "Monsoon",
    icon: "⛈",
    desc: "Heavy rain, warm, humid, breezy",
    rainyHours: 14,
    temp: 28,
    humidity: 80,
    wind: 15,
    color: "#3d8b8b",
  },
];

function parseCountry(placeName) {
  const parts = placeName.split(", ");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function parseCity(placeName) {
  const parts = placeName.split(", ");
  return parts.length > 1 ? parts.slice(0, -1).join(", ") : placeName;
}

function inRange(value, center) {
  return (
    value >= Math.max(0, center - RANGE_DELTA) && value <= center + RANGE_DELTA
  );
}

function filterPlace(place, filters) {
  const { enableRainyHours, rainyHours, enableTemp, preferredTemp, enableHumidity, preferredHumidity, enableWind, preferredWind } = filters;
  const dayTemp = place.minTemperature != null && place.maxTemperature != null
    ? (place.minTemperature + place.maxTemperature) / 2
    : (place.minTemperature ?? place.maxTemperature ?? 0);
  const dayHumidity = place.minHumidity != null && place.maxHumidity != null
    ? (place.minHumidity + place.maxHumidity) / 2
    : (place.minHumidity ?? place.maxHumidity ?? 0);
  const dayWind = place.minWind != null && place.maxWind != null
    ? (place.minWind + place.maxWind) / 2
    : (place.minWind ?? place.maxWind ?? 0);

  if (enableRainyHours && !inRange(place.rainyHours, rainyHours)) return false;
  if (enableTemp && !inRange(dayTemp, preferredTemp)) return false;
  if (enableHumidity && !inRange(dayHumidity, preferredHumidity)) return false;
  if (enableWind && !inRange(dayWind, preferredWind)) return false;
  return true;
}

function applyPreset(preset, setters) {
  const { setRainyHours, setPreferredTemp, setPreferredHumidity, setPreferredWind, setEnableRainyHours, setEnableTemp, setEnableHumidity, setEnableWind } = setters;
  setRainyHours(preset.rainyHours);
  setPreferredTemp(preset.temp);
  setPreferredHumidity(preset.humidity);
  setPreferredWind(preset.wind);
  setEnableRainyHours(true);
  setEnableTemp(true);
  setEnableHumidity(true);
  setEnableWind(true);
}

function weatherEmoji(place) {
  const avgTemp = ((place.minTemperature ?? 20) + (place.maxTemperature ?? 20)) / 2;
  if (place.rainyHours >= 10) return "🌧";
  if (place.rainyHours >= 4) return "🌦";
  if (avgTemp >= 28) return "☀️";
  if (avgTemp <= 12) return "❄️";
  return "⛅";
}

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const hasUrlParams = [...urlParams.keys()].length > 0;

  const initialVal = (param, fallback) => hasUrlParams ? Number(urlParams.get(param)) || fallback : fallback;
  const initialBool = (param, fallback) => {
    if (!hasUrlParams) return fallback;
    const v = urlParams.get(param);
    return v === null ? fallback : v !== "false";
  };
  const defaultOffset = WEEKS.find((w) => w.offset === Number(urlParams.get("offset")))?.offset || 13;
  const [selectedOffset, setSelectedOffset] = useState(defaultOffset);

  const [rainyHours, setRainyHours] = useState(initialVal("rainyHours", DEFAULT_RAINY_HOURS));
  const [preferredTemp, setPreferredTemp] = useState(initialVal("temp", DEFAULT_PREFERRED_TEMP));
  const [preferredHumidity, setPreferredHumidity] = useState(initialVal("humidity", DEFAULT_PREFERRED_HUMIDITY));
  const [preferredWind, setPreferredWind] = useState(initialVal("wind", DEFAULT_PREFERRED_WIND));
  const [enableRainyHours, setEnableRainyHours] = useState(initialBool("enableRainy", true));
  const [enableTemp, setEnableTemp] = useState(initialBool("enableTemp", true));
  const [enableHumidity, setEnableHumidity] = useState(initialBool("enableHumidity", true));
  const [enableWind, setEnableWind] = useState(initialBool("enableWind", true));
  const [mood, setMood] = useState(null);

  const [places, setPlaces] = useState([]);
  const [allPlacesCount, setAllPlacesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);

  const presetSetters = { setRainyHours, setPreferredTemp, setPreferredHumidity, setPreferredWind, setEnableRainyHours, setEnableTemp, setEnableHumidity, setEnableWind };

  const currentFilters = { enableRainyHours, rainyHours, enableTemp, preferredTemp, enableHumidity, preferredHumidity, enableWind, preferredWind };

  function buildQueryString() {
    const params = new URLSearchParams();
    params.set("offset", selectedOffset);
    if (enableRainyHours) params.set("rainyHours", rainyHours);
    if (enableTemp) params.set("temperature", preferredTemp);
    if (enableHumidity) params.set("humidity", preferredHumidity);
    if (enableWind) params.set("wind", preferredWind);
    return params.toString();
  }

  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("offset", selectedOffset);
    params.set("rainyHours", rainyHours);
    params.set("temp", preferredTemp);
    params.set("humidity", preferredHumidity);
    params.set("wind", preferredWind);
    params.set("enableRainy", enableRainyHours);
    params.set("enableTemp", enableTemp);
    params.set("enableHumidity", enableHumidity);
    params.set("enableWind", enableWind);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [rainyHours, preferredTemp, preferredHumidity, preferredWind, enableRainyHours, enableTemp, enableHumidity, enableWind, selectedOffset]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    syncUrl();

    debounceRef.current = setTimeout(async () => {
      try {
        setError(null);
        setLoading(true);
        const qs = buildQueryString();
        const baseUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/weather` : "/api/weather";
        const apiUrl = `${baseUrl}?${qs}`;
        const response = await fetch(apiUrl);
        if (response.status === 503) {
          setPlaces([]);
          setAllPlacesCount(0);
          const activeWeek = WEEKS.find((w) => w.offset === selectedOffset);
          throw new Error(
            `Weather data for ${activeWeek?.label || "this week"} is still loading. Check back in a minute.`,
          );
        }
        if (!response.ok) throw new Error("Failed to load weather data");
        const payload = await response.json();
        setAllPlacesCount(payload.count);
        setPlaces(payload.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rainyHours, preferredTemp, preferredHumidity, preferredWind, enableRainyHours, enableTemp, enableHumidity, enableWind, selectedOffset, syncUrl]);

  const matchedPlaces = places.filter((p) => filterPlace(p, currentFilters));
  const matchedCount = matchedPlaces.length;

  const rangeLabel = (center) => `(${Math.max(0, center - RANGE_DELTA)}–${center + RANGE_DELTA})`;

  function handlePresetClick(preset) {
    setMood(preset.label);
    applyPreset(preset, presetSetters);
  }

  function handleSliderChange(setter) {
    return (e) => { setMood(null); setter(Number(e.target.value)); };
  }
  function handleToggleChange(setter) {
    return (e) => { setMood(null); setter(e.target.checked); };
  }

  return (
    <div className="app-shell" data-mood={mood}>
      <header>
        <h1>Where to go <span className="hl">next</span></h1>
        <p className="tagline">
          See which cities will have <strong>your kind of weather</strong> in the coming weeks — so you can book your trip with confidence.
        </p>
        <p className="subtitle">
          Pick a week → choose your weather mood → find your next destination.
        </p>
      </header>

      {error && <div className="message error">{error}</div>}

      {loading && places.length === 0 && <div className="message">Loading weather data…</div>}

      {(!loading || places.length > 0) && (
        <>
          {/* ─── Week tabs ─── */}
          <div className="week-tabs">
            {WEEKS.map((w) => (
              <button
                key={w.offset}
                className={`week-tab${selectedOffset === w.offset ? " active" : ""}`}
                onClick={() => { setSelectedOffset(w.offset); setMood(null); }}>
                <span className="week-label">{w.label}</span>
                <span className="week-desc">{w.desc}</span>
              </button>
            ))}
          </div>

          <div className="content-grid">
            {/* ─── Filters ─── */}
            <div className="side-panel">
              <div className="explain">
                <strong>What weather do you want?</strong>
                <div>Pick a mood or tweak the sliders. We'll highlight matching destinations below.</div>
              </div>
              <div className="slider-panel">
                <div className="presets-row">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      className={`preset-btn${mood === preset.label ? " active" : ""}`}
                      style={{ "--preset-color": preset.color, borderColor: mood === preset.label ? preset.color : undefined, background: mood === preset.label ? `${preset.color}18` : undefined }}
                      title={preset.desc}
                      onClick={() => handlePresetClick(preset)}>
                      <span className="preset-icon">{preset.icon}</span>
                      <span className="preset-label" style={{ color: mood === preset.label ? preset.color : undefined }}>{preset.label}</span>
                    </button>
                  ))}
                </div>

                {mood && (() => {
                  const active = PRESETS.find((p) => p.label === mood);
                  if (!active) return null;
                  return (
                    <div className="mood-summary" style={{ "--mood-color": active.color }}>
                      <span className="mood-summary-icon">{active.icon}</span>
                      <span className="mood-summary-text">{active.desc}</span>
                    </div>
                  );
                })()}

                <div className="filter-toggle-row">
                  <label><input type="checkbox" checked={enableRainyHours} onChange={handleToggleChange(setEnableRainyHours)} /> Rain</label>
                  <label><input type="checkbox" checked={enableTemp} onChange={handleToggleChange(setEnableTemp)} /> Temperature</label>
                  <label><input type="checkbox" checked={enableHumidity} onChange={handleToggleChange(setEnableHumidity)} /> Humidity</label>
                  <label><input type="checkbox" checked={enableWind} onChange={handleToggleChange(setEnableWind)} /> Wind</label>
                </div>

                <div className="slider-row">
                  <label>Rainy hours: <strong>{rainyHours}h</strong> <span className="range-hint">{rangeLabel(rainyHours)}</span></label>
                  <input type="range" min="0" max="24" step="1" value={rainyHours} onChange={handleSliderChange(setRainyHours)} />
                  <div className="slider-ticks"><span>0</span><span>12</span><span>24</span></div>
                </div>
                <div className="slider-row">
                  <label>Temperature: <strong>{preferredTemp}°C</strong> <span className="range-hint">{rangeLabel(preferredTemp)}</span></label>
                  <input type="range" min="0" max="40" step="1" value={preferredTemp} onChange={handleSliderChange(setPreferredTemp)} />
                  <div className="slider-ticks"><span>0</span><span>20</span><span>40</span></div>
                </div>
                <div className="slider-row">
                  <label>Humidity: <strong>{preferredHumidity}%</strong> <span className="range-hint">{rangeLabel(preferredHumidity)}</span></label>
                  <input type="range" min="0" max="100" step="1" value={preferredHumidity} onChange={handleSliderChange(setPreferredHumidity)} />
                  <div className="slider-ticks"><span>0%</span><span>50%</span><span>100%</span></div>
                </div>
                <div className="slider-row">
                  <label>Wind: <strong>{preferredWind} km/h</strong> <span className="range-hint">{rangeLabel(preferredWind)}</span></label>
                  <input type="range" min="0" max="50" step="1" value={preferredWind} onChange={handleSliderChange(setPreferredWind)} />
                  <div className="slider-ticks"><span>0</span><span>25</span><span>50</span></div>
                </div>

                <div className="slider-note secondary">
                  <span className="match-count">
                    {matchedCount} of {allPlacesCount} cities match
                    {loading && places.length > 0 && " (updating…)"}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── Destination cards ─── */}
            <div className="cards-panel">
              {matchedCount ? (
                <div className="cards-grid">
                  {matchedPlaces.map((place, index) => (
                    <div className="dest-card" key={place.name}>
                      <div className="card-emoji">{weatherEmoji(place)}</div>
                      <div className="card-body">
                        <div className="card-city">{parseCity(place.name)}</div>
                        <div className="card-country">{parseCountry(place.name)}</div>
                        <div className="card-stats">
                          <span className="card-stat" title="Rainy hours">🌧 {place.rainyHours}h</span>
                          <span className="card-stat" title="Temperature range">
                            🌡 {place.minTemperature ?? "-"}–{place.maxTemperature ?? "-"}°
                          </span>
                          <span className="card-stat" title="Wind">💨 {place.minWind ?? "-"}–{place.maxWind ?? "-"} km/h</span>
                        </div>
                        <a
                          className="card-cta"
                          href={`https://www.google.com/travel/flights?q=flights+to+${encodeURIComponent(parseCity(place.name))}`}
                          target="_blank"
                          rel="noreferrer noopener">
                          Plan trip →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-cards">
                  <div className="empty-icon">🔍</div>
                  <div>No cities match your filters. Try a different mood or widen the ranges.</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
