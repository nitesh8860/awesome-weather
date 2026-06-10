# Where To Go

A full-stack weather app showing the top 10 places where this week it was rainy and the temperature stayed between 15°C and 22°C.

## Install

From the project root:

```bash
npm install
```

## Run locally

```bash
npm run dev
```

This starts:
- backend: `http://localhost:3000`
- frontend: `http://localhost:5173`

## API endpoint

- `GET /api/top-rainy`

## Notes

- The backend uses Open-Meteo free weather data.
- The frontend displays a table of the top rainy locations for the week.
