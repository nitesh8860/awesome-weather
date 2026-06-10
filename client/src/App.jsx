import { useEffect, useState } from "react";

function App() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/top-rainy");
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
        <h1>Top 10 Places with awesome weather this Week</h1>
        <p>Places with rain and temperatures between 15°C and 22°C.</p>
      </header>

      {loading && <div className="message">Loading weather data…</div>}
      {error && <div className="message error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="explain">
            <strong>Why we call this "awesome" weather</strong>
            <div>
              We look for places that had rainy moments paired with pleasant
              temperatures (about 15–22°C) and comfortable humidity. That mix
              makes for dramatic skies, cozy cafés, and perfect umbrella selfies
              — sciencey, but fun. Results are from recent cached 7-day scans.
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>City</th>
                  <th>Location</th>
                  <th>Rainy Hours</th>
                  <th>Rainy Days</th>
                  <th>Avg Temp (°C)</th>
                  <th>Avg Hum (%)</th>
                </tr>
              </thead>
              <tbody>
                {places.length ? (
                  places.map((place, index) => (
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
                      <td>{place.rainyHours}</td>
                      <td>{place.rainyDays}</td>
                      <td>{place.averageTemperature}</td>
                      <td>{place.averageHumidity ?? "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">No matching places found this week.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
