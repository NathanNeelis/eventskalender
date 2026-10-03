# Events Kalender

Plan and visualise upcoming events for the department, and see who from the team is going.

- **Backend:** FastAPI + PyMongo (async), managed with `uv` — [backend/](backend/)
- **Frontend:** React + TypeScript (Vite), Mantine UI, Leaflet/OpenStreetMap — [frontend/](frontend/)
- **Database:** MongoDB (local Docker), configured via [.env](.env)

## Requirements

- Python 3.12 (uv installs it automatically) and [uv](https://docs.astral.sh/uv/)
- Node.js **22.12+** (or 20.19+) — required by Vite 8
- MongoDB running locally (see `.env`)
- [Ollama](https://ollama.com) running locally with the model pulled: `ollama pull gpt-oss:20b` (for the chat assistant)

## Configuration

The backend reads `../.env`:

| Variable                               | Purpose                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `MONGODB_HOST`, `MONGODB_PORT`         | Mongo server                                             |
| `MONGODB_DATABASE`                     | Database name (default `events`)                         |
| `MONGODB_USERNAME`, `MONGODB_PASSWORD` | Credentials (authenticated against the `admin` database) |

`MONGODB_URI` is not used; the connection string is built from the variables above.

Optional settings for the chat assistant (also in `.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_MODEL` | `gpt-oss:20b` | Model used by the agent |
| `OLLAMA_THINK` | `low` | Reasoning effort for gpt-oss (`low` / `medium` / `high`) |
| `OLLAMA_NUM_CTX` | `16384` | Context window |
| `TIMEZONE` | `Europe/Amsterdam` | Used to resolve dates like "next Thursday" |

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

Add team members (name and function) on the **Team** page with the **Add team member** button.

## Features

- Add, edit and remove events (title, organisation, date + time or all-day, optional end, location with map pin,
  internal/external, description, invitation, info URL)
- Select attending colleagues per event
- Filter by date range, organisation, attending yes/no, internal/external, and free-text search
- List, month-calendar and map views
- **Add to Outlook**: downloads an `.ics` file that opens in Outlook desktop
- **Event assistant** (chat button, bottom right): paste an invitation email and a local LLM (Ollama) extracts the
  details, creates the event, and asks which team members attend — names are matched against the Team page
  (tolerant of typos; asks when a name is ambiguous)
- **Live updates**: every change (by the assistant, another tab, or a colleague) shows up immediately in all open
  browsers via Server-Sent Events; the dot in the header shows the connection

## API overview

| Method         | Path                                                          |                                          |
| -------------- | ------------------------------------------------------------- | ---------------------------------------- |
| GET            | `/api/events?from=&to=&organisation=&attending=&internal=&q=` | List/filter events                       |
| POST           | `/api/events`                                                 | Create                                   |
| GET/PUT/DELETE | `/api/events/{id}`                                            | Read / update / delete                   |
| GET            | `/api/events/{id}/ics`                                        | Calendar file                            |
| GET            | `/api/events/organisations`                                   | Distinct organisations                   |
| GET/POST       | `/api/colleagues`                                             | List / add team members                  |
| PUT            | `/api/colleagues/{id}`                                        | Edit name / function                     |
| GET            | `/api/geocode?q=`                                             | Address search (OpenStreetMap Nominatim) |
| GET            | `/api/stream`                                                 | Server-Sent Events: `events_changed`, `colleagues_changed` |
| POST           | `/api/agent/chat`                                             | One chat turn; streams NDJSON (`delta`, `tool_start`, `tool_result`, `done`, `error`) |
| DELETE         | `/api/agent/sessions/{id}`                                    | Forget a chat conversation               |

Times are stored as local wall-clock time (no timezone), which Outlook interprets in the user's own timezone.
