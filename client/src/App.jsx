import { useEffect, useState } from "react";

const DEFAULT_MIN_RAINY_HOURS = 1;
const DEFAULT_MIN_TOTAL_PRECIPITATION = 1;
const DEFAULT_PREFERRED_TEMP = 18;
const DEFAULT_PREFERRED_HUMIDITY = 55;
const RANGE_DELTA = 5;

function inRange(value, center) {
  return (
    value >= Math.max(0, center - RANGE_DELTA) && value <= center + RANGE_DELTA
  );
}

function App() {
  const [places, setPlaces] = useState([]);
  const [minRainyHours, setMinRainyHours] = useState(DEFAULT_MIN_RAINY_HOURS);
  const [minTotalPrecipitation, setMinTotalPrecipitation] = useState(
    DEFAULT_MIN_TOTAL_PRECIPITATION,
  );
  const [preferredTemp, setPreferredTemp] = useState(DEFAULT_PREFERRED_TEMP);
  const [preferredHumidity, setPreferredHumidity] = useState(
    DEFAULT_PREFERRED_HUMIDITY,
  );
  const [enableRainyHours, setEnableRainyHours] = useState(true);
  const [enableTotalPrecipitation, setEnableTotalPrecipitation] =
    useState(true);
  const [enableTemp, setEnableTemp] = useState(true);
  const [enableHumidity, setEnableHumidity] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL
          ? `${import.meta.env.VITE_API_URL}/api/weather`
          : "/api/weather";
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error("Failed to load weather data");
        }
        const payload = await response.json();
        setPlaces(payload.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="app-shell">
      <header>
        <h2>Exact weather on day 14 from today</h2>
      </header>

      {loading && <div className="message">Loading weather data…</div>}
      {error && <div className="message error">{error}</div>}

      {!loading && !error && (
        <div className="content-grid">
          <div className="side-panel">
            <div className="explain">
              <strong>14th-day forecast only</strong>
              <div>
                This view shows the exact forecast 14 days from today. No
                multi-day blending means the filters apply to the single-day
                forecast values.
              </div>
            </div>
            <div className="slider-panel">
              <div className="slider-note">
                Use filters to narrow down the day-14 results. Values are
                computed from the exact forecast for that day.
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
                  Rainy Hours
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={enableTotalPrecipitation}
                    onChange={(event) =>
                      setEnableTotalPrecipitation(event.target.checked)
                    }
                  />
                  Total Precipitation
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
              </div>
              <div className="slider-row">
                <label htmlFor="rainy-hours-slider">
                  Rainy Hours around: <strong>{minRainyHours}</strong>
                </label>
                <input
                  id="rainy-hours-slider"
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={minRainyHours}
                  onChange={(event) =>
                    setMinRainyHours(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>0</span>
                  <span>12</span>
                  <span>24</span>
                </div>
              </div>
              <div className="slider-row">
                <label htmlFor="precipitation-slider">
                  Precipitation around:{" "}
                  <strong>{minTotalPrecipitation} mm</strong>
                </label>
                <input
                  id="precipitation-slider"
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={minTotalPrecipitation}
                  onChange={(event) =>
                    setMinTotalPrecipitation(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
              <div className="slider-row">
                <label htmlFor="temp-slider">
                  Target temp around: <strong>{preferredTemp}°C</strong>
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
                  Target humidity around: <strong>{preferredHumidity}%</strong>
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
              <div className="slider-note secondary">
                Use the toggles to keep or ignore each filter.
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
                    <th>Rainy Hours</th>
                    <th>Total Precipitation</th>
                    <th>Min Temp (°C)</th>
                    <th>Max Temp (°C)</th>
                    <th>Min Hum (%)</th>
                    <th>Max Hum (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {places.filter((place) => {
                    const dayTemp =
                      place.minTemperature != null &&
                      place.maxTemperature != null
                        ? (place.minTemperature + place.maxTemperature) / 2
                        : (place.minTemperature ?? place.maxTemperature ?? 0);
                    const dayHumidity =
                      place.minHumidity != null && place.maxHumidity != null
                        ? (place.minHumidity + place.maxHumidity) / 2
                        : (place.minHumidity ?? place.maxHumidity ?? 0);

                    if (
                      enableRainyHours &&
                      !inRange(place.rainyHours, minRainyHours)
                    ) {
                      return false;
                    }
                    if (
                      enableTotalPrecipitation &&
                      !inRange(place.totalPrecipitation, minTotalPrecipitation)
                    ) {
                      return false;
                    }
                    if (enableTemp && !inRange(dayTemp, preferredTemp)) {
                      return false;
                    }
                    if (
                      enableHumidity &&
                      !inRange(dayHumidity, preferredHumidity)
                    ) {
                      return false;
                    }
                    return true;
                  }).length ? (
                    places
                      .filter((place) => {
                        const dayTemp =
                          place.minTemperature != null &&
                          place.maxTemperature != null
                            ? (place.minTemperature + place.maxTemperature) / 2
                            : (place.minTemperature ??
                              place.maxTemperature ??
                              0);
                        const dayHumidity =
                          place.minHumidity != null && place.maxHumidity != null
                            ? (place.minHumidity + place.maxHumidity) / 2
                            : (place.minHumidity ?? place.maxHumidity ?? 0);

                        if (
                          enableRainyHours &&
                          !inRange(place.rainyHours, minRainyHours)
                        ) {
                          return false;
                        }
                        if (
                          enableTotalPrecipitation &&
                          !inRange(
                            place.totalPrecipitation,
                            minTotalPrecipitation,
                          )
                        ) {
                          return false;
                        }
                        if (enableTemp && !inRange(dayTemp, preferredTemp)) {
                          return false;
                        }
                        if (
                          enableHumidity &&
                          !inRange(dayHumidity, preferredHumidity)
                        ) {
                          return false;
                        }
                        return true;
                      })
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
                          <td>{place.rainyHours}</td>
                          <td>{place.totalPrecipitation}</td>
                          <td>{place.minTemperature ?? "-"}</td>
                          <td>{place.maxTemperature ?? "-"}</td>
                          <td>{place.minHumidity ?? "-"}</td>
                          <td>{place.maxHumidity ?? "-"}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="10">
                        No forecast data available for day 14.
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
