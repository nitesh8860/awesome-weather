import { useEffect, useState } from "react";

const DEFAULT_MIN_RAINY_HOURS = 1;
const DEFAULT_MIN_MONTHLY_RAINY_DAYS = 6;
const DEFAULT_MIN_AVG_TEMP = 16;
const DEFAULT_MIN_AVG_HUMIDITY = 55;
const RANGE_DELTA = 5;

function inRange(value, center) {
  return (
    value >= Math.max(0, center - RANGE_DELTA) && value <= center + RANGE_DELTA
  );
}

function App() {
  const [places, setPlaces] = useState([]);
  const [minRainyHours, setMinRainyHours] = useState(DEFAULT_MIN_RAINY_HOURS);
  const [minMonthlyRainyDays, setMinMonthlyRainyDays] = useState(
    DEFAULT_MIN_MONTHLY_RAINY_DAYS,
  );
  const [minAvgTemp, setMinAvgTemp] = useState(DEFAULT_MIN_AVG_TEMP);
  const [minAvgHumidity, setMinAvgHumidity] = useState(
    DEFAULT_MIN_AVG_HUMIDITY,
  );
  const [enableRainyHours, setEnableRainyHours] = useState(true);
  const [enableMonthlyRainyDays, setEnableMonthlyRainyDays] = useState(true);
  const [enableAvgTemp, setEnableAvgTemp] = useState(true);
  const [enableAvgHumidity, setEnableAvgHumidity] = useState(true);
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
        <h2>Places with calm rainy weather for the next 60 days</h2>
      </header>

      {loading && <div className="message">Loading weather data…</div>}
      {error && <div className="message error">{error}</div>}

      {!loading && !error && (
        <div className="content-grid">
          <div className="side-panel">
            <div className="explain">
              <strong>Why we call this "awesome" weather</strong>
              <div>
                We scan the next 60 days for rainy windows with mild 15–22°C
                temperatures and comfortable humidity. That blend feels calm,
                moody, and refreshingly quiet. Results are from the full cached
                2-month forecast set.
              </div>
            </div>
            <div className="slider-panel">
              <div className="slider-note">
                Ideal defaults: 15–17°C, 45–55% humidity, 6–8 rainy days/month,
                1–3 rainy hours/day on rainy days.
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
                    checked={enableMonthlyRainyDays}
                    onChange={(event) =>
                      setEnableMonthlyRainyDays(event.target.checked)
                    }
                  />
                  Rainy Days/month
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={enableAvgTemp}
                    onChange={(event) => setEnableAvgTemp(event.target.checked)}
                  />
                  Avg Temp
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={enableAvgHumidity}
                    onChange={(event) =>
                      setEnableAvgHumidity(event.target.checked)
                    }
                  />
                  Avg Hum
                </label>
              </div>
              <div className="slider-row">
                <label htmlFor="rainy-hours-slider">
                  Rainy Hours/day around: <strong>{minRainyHours}</strong>
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
                <label htmlFor="rainy-days-slider">
                  Rainy Days/month around:{" "}
                  <strong>{minMonthlyRainyDays}</strong>
                </label>
                <input
                  id="rainy-days-slider"
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={minMonthlyRainyDays}
                  onChange={(event) =>
                    setMinMonthlyRainyDays(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>0</span>
                  <span>15</span>
                  <span>30</span>
                </div>
              </div>
              <div className="slider-row">
                <label htmlFor="avg-temp-slider">
                  Avg Temp around: <strong>{minAvgTemp}°C</strong>
                </label>
                <input
                  id="avg-temp-slider"
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={minAvgTemp}
                  onChange={(event) =>
                    setMinAvgTemp(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
              <div className="slider-row">
                <label htmlFor="humidity-slider">
                  Avg Hum around: <strong>{minAvgHumidity}%</strong>
                </label>
                <input
                  id="humidity-slider"
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={minAvgHumidity}
                  onChange={(event) =>
                    setMinAvgHumidity(Number(event.target.value))
                  }
                />
                <div className="slider-ticks">
                  <span>10%</span>
                  <span>55%</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="slider-note">
                Refresh restores the default sliders.
              </div>
              <div className="slider-note secondary">
                Rainy Days/month is a monthly estimate; Rainy Hours/day is
                average hours on rainy days.
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
                    <th>Rainy Hours/day</th>
                    <th>Rainy Days/month</th>
                    <th>Avg Temp (°C)</th>
                    <th>Avg Hum (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {places.filter((place) => {
                    if (
                      enableRainyHours &&
                      !inRange(
                        place.avgRainHoursPerRainyDay ?? 0,
                        minRainyHours,
                      )
                    ) {
                      return false;
                    }
                    if (
                      enableMonthlyRainyDays &&
                      !inRange(place.monthlyRainyDays ?? 0, minMonthlyRainyDays)
                    ) {
                      return false;
                    }
                    if (
                      enableAvgTemp &&
                      !inRange(place.averageTemperature, minAvgTemp)
                    ) {
                      return false;
                    }
                    if (
                      enableAvgHumidity &&
                      !inRange(place.averageHumidity ?? 0, minAvgHumidity)
                    ) {
                      return false;
                    }
                    return true;
                  }).length ? (
                    places
                      .filter((place) => {
                        if (
                          enableRainyHours &&
                          !inRange(
                            place.avgRainHoursPerRainyDay ?? 0,
                            minRainyHours,
                          )
                        ) {
                          return false;
                        }
                        if (
                          enableMonthlyRainyDays &&
                          !inRange(
                            place.monthlyRainyDays ?? 0,
                            minMonthlyRainyDays,
                          )
                        ) {
                          return false;
                        }
                        if (
                          enableAvgTemp &&
                          !inRange(place.averageTemperature, minAvgTemp)
                        ) {
                          return false;
                        }
                        if (
                          enableAvgHumidity &&
                          !inRange(place.averageHumidity ?? 0, minAvgHumidity)
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
                          <td>{place.avgRainHoursPerRainyDay}</td>
                          <td>{place.monthlyRainyDays}</td>
                          <td>{place.averageTemperature}</td>
                          <td>{place.averageHumidity ?? "-"}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="7">
                        No matching places found for the next 60 days.
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
