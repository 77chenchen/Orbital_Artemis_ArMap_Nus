# Atlas - NUS AR Campus Assistant

Atlas is a full-stack campus navigation prototype for NUS students. It combines an interactive campus dashboard, facility discovery, schedule planning, route-style recommendations, NUSMods sync status, JWT authentication, and Google Sign-In into one React + Go demo application.

## Short Description

An NUS campus assistant prototype with React, Go, SQLite, Google Sign-In, schedule planning, facility discovery, and NUSMods sync status.

## Features

- Interactive sign-in experience with email/password login, registration, demo mode, and Google Sign-In.
- Protected dashboard powered by JWT authentication.
- Campus building and facility discovery with filters for building and facility type.
- 2D campus map preview for selected NUS locations.
- Schedule management for upcoming classes, meetings, and events.
- Recommendation cards that respond to schedule and campus context.
- NUSMods sync status and manual sync trigger for external API integration.
- Seeded demo data for buildings, facilities, schedules, and demo credentials.
- Docker Compose deployment with Caddy reverse proxy and HTTPS support.

## Tech Stack

```text
Frontend: React 19, Vite, React Router, Framer Motion, React Native Web
Backend:  Go, net/http, SQLite, JWT, Google ID token verification
Data:     SQLite with seeded NUS campus demo data
Deploy:   Docker, Docker Compose, Caddy
```

## Project Structure

```text
.
├── backend/          Go API server, SQLite store, auth, scheduler, NUSMods client
├── frontend/         React + Vite frontend application
├── deploy/           Production deployment notes and Caddy config
├── poster_work/      Project poster assets and generation scripts
├── Dockerfile        Multi-stage frontend/backend production image
└── docker-compose.yml
```

## Quick Start

### 1. Start The Backend

The backend uses Go and the local `sqlite3` CLI.

```bash
cd backend
go run ./cmd/server
```

Default backend URL:

```text
http://localhost:8080
```

Demo credentials:

```text
Email:    test1@gmail.com
Password: cp2106
```

### 2. Start The Frontend

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

If your API is not running on the default backend URL:

```bash
VITE_API_BASE_URL=http://localhost:8080/api npm run dev
```

## Google Sign-In Setup

Google Sign-In requires a Google OAuth 2.0 Web client ID.

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure the OAuth consent screen.
4. Create an OAuth Client ID with application type `Web application`.
5. Add the local frontend origin:

```text
http://localhost:5173
```

For production, also add:

```text
https://7chen.online
```

Run the backend and frontend with the same client ID:

```bash
cd backend
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com go run ./cmd/server
```

```bash
cd frontend
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com npm run dev
```

If the API runs on a non-default port:

```bash
VITE_API_BASE_URL=http://localhost:8081/api VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com npm run dev
```

In network-restricted environments, the Go backend must be able to reach Google's certificate endpoint for ID token verification. If your browser uses a local proxy, start the backend with matching proxy variables:

```bash
HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 ALL_PROXY=socks5://127.0.0.1:7890 GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com go run ./cmd/server
```

## Environment Variables

### Backend

```text
PORT=8080
DB_PATH=atlas.db
ALLOWED_ORIGIN=*
STATIC_DIR=
JWT_SECRET=
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
NUSMODS_ACAD_YEAR=2025-2026
SYNC_INTERVAL=21600
HTTP_CLIENT_TIMEOUT=10
```

### Frontend

```text
VITE_API_BASE_URL=http://localhost:8080/api
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

## API Overview

```text
GET    /api/health
POST   /api/register
POST   /api/login
POST   /api/auth/google

GET    /api/buildings
GET    /api/facilities?building=COM1&type=study_space
GET    /api/schedule
POST   /api/schedule
DELETE /api/schedule/{id}
GET    /api/recommendations
GET    /api/sync/status
POST   /api/sync/run
```

Most app data routes require:

```text
Authorization: Bearer <app-jwt>
```

## Demo Flow

1. Start the backend.
2. Start the frontend.
3. Sign in with the demo account, register a new account, enter demo mode, or use Google Sign-In.
4. Explore buildings and filter facilities.
5. Add or delete schedule items.
6. View recommendation updates.
7. Trigger NUSMods sync and inspect sync status.

## Build

Build the frontend:

```bash
cd frontend
npm run build
```

Run backend checks:

```bash
cd backend
go test ./...
```

## Docker Deployment

Create a `.env` file:

```text
JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

Start the stack:

```bash
docker compose up -d --build
```

The production stack includes:

- `app`: Go API plus built React frontend.
- `caddy`: HTTPS reverse proxy for `7chen.online`.
- `atlas_data`: persistent SQLite data volume.

More production notes are available in [deploy/README.md](deploy/README.md).

## License

This project is licensed under the terms in [LICENSE](LICENSE).
