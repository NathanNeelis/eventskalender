# MDSCevents

Plan and visualise upcoming events for the department, and see who from the team is going.

- **Backend:** FastAPI + PyMongo (async), managed with `uv` — [backend/](backend/)
- **Frontend:** React + TypeScript (Vite), Mantine UI, Leaflet/OpenStreetMap — [frontend/](frontend/)
- **Database:** MongoDB (local Docker), configured via [.env](.env)

## Requirements

- Python 3.12 (uv installs it automatically) and [uv](https://docs.astral.sh/uv/)
- Node.js **22.12+** (or 20.19+) — required by Vite 8
- MongoDB running locally (see `.env`)

## Configuration

The backend reads `../.env`:

| Variable | Purpose |
|---|---|
| `MONGODB_HOST`, `MONGODB_PORT` | Mongo server |
| `MONGODB_DATABASE` | Database name (default `events`) |
| `MONGODB_USERNAME`, `MONGODB_PASSWORD` | Credentials (authenticated against the `admin` database) |

`MONGODB_URI` is not used; the connection string is built from the variables above.

## Running

Two terminals:

```bash
# 1. Backend — http://localhost:8000  (API docs at /docs)
cd backend
uv run uvicorn app.main:app --reload --port 8000

# 2. Frontend — http://localhost:5173
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend.

On first start the backend creates 30 colleagues (`colleague1` … `colleague30`); rename them on the **Team** page.

## Features

- Add, edit and remove events (title, organisation, date + time or all-day, optional end, location with map pin,
  internal/external, description, invitation, info URL)
- Select attending colleagues per event
- Filter by date range, organisation, attending yes/no, internal/external, and free-text search
- List, month-calendar and map views
- **Add to Outlook**: downloads an `.ics` file that opens in Outlook desktop

## API overview

| Method | Path | |
|---|---|---|
| GET | `/api/events?from=&to=&organisation=&attending=&internal=&q=` | List/filter events |
| POST | `/api/events` | Create |
| GET/PUT/DELETE | `/api/events/{id}` | Read / update / delete |
| GET | `/api/events/{id}/ics` | Calendar file |
| GET | `/api/events/organisations` | Distinct organisations |
| GET | `/api/colleagues` | List colleagues |
| PUT | `/api/colleagues/{id}` | Rename |
| GET | `/api/geocode?q=` | Address search (OpenStreetMap Nominatim) |

Times are stored as local wall-clock time (no timezone), which Outlook interprets in the user's own timezone.
