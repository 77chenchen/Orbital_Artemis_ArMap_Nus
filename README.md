# Atlas NUS Campus Demo

Atlas is a demo full-stack app based on the Orbital Artemis proposal. It focuses on the core prototype flow:

- React frontend for campus navigation, facility discovery, schedule management, and sync status.
- Go backend API with SQLite persistence.
- Scheduled external API connection to NUSMods for module-list sync health.
- Seeded NUS campus data for buildings, facilities, and a sample schedule item.

## Project Structure

```text
backend/   Go API server, SQLite schema, scheduler, NUSMods client
frontend/  React + Vite frontend
```

## Backend

The API uses Go 1.22+ and the local `sqlite3` CLI.

```bash
cd backend
CGO_ENABLED=0 go run ./cmd/server
```

Default backend URL: `http://localhost:8080`

Environment variables:

```text
PORT=8080
DB_PATH=atlas.db
ALLOWED_ORIGIN=*
NUSMODS_ACAD_YEAR=2025-2026
SYNC_INTERVAL=21600
HTTP_CLIENT_TIMEOUT=10
```

Main API routes:

```text
GET    /api/health
GET    /api/buildings
GET    /api/facilities?building=COM1&type=study_space
GET    /api/schedule
POST   /api/schedule
DELETE /api/schedule/{id}
GET    /api/recommendations
GET    /api/sync/status
POST   /api/sync/run
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL: `http://localhost:5173`

If the API runs somewhere else:

```bash
VITE_API_BASE_URL=http://localhost:8080/api npm run dev
```

## Demo Flow

1. Start the Go API.
2. Start the React frontend.
3. Open the frontend and check API status.
4. Filter facilities by building/type.
5. Add a schedule item and watch the recommendations update.
6. Run the NUSMods sync to test the external API connection and sync log.
