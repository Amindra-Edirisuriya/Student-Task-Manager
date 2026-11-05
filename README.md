# Student Task Manager

A task manager for students, with account-based login and a REST API backed by MongoDB.

## Stack

- **Client** — React 19 + Vite, plain CSS (light/dark aware), Axios
- **Server** — Bun + Express 5 + Mongoose
- **Database** — MongoDB, run locally (no cloud DB for this project)
- **Auth** — email/password accounts, JWT sessions

## Project structure

```
client/   React frontend (Vite)
server/   Express API (Bun runtime)
docs/     Generated guides/notes
```

## Prerequisites

- [Bun](https://bun.com) v1.4+
- MongoDB running locally, e.g. `brew install mongodb-community && brew services start mongodb-community`

## Setup

### 1. Server

```bash
cd server
bun install
cp env.example .env   # then fill in JWT_SECRET with your own random value
bun run dev            # http://localhost:5000 (or PORT from .env)
```

`server/.env` variables:

| Variable          | Purpose                                      |
|--------------------|-----------------------------------------------|
| `PORT`             | API port (defaults to 5000)                   |
| `MONGODB_URI`      | Local MongoDB connection string               |
| `CLIENT_ORIGIN`    | Allowed CORS origin for the Vite dev server    |
| `JWT_SECRET`       | Secret used to sign login tokens — keep private |
| `JWT_EXPIRES_IN`   | Login token lifetime (e.g. `7d`)               |

> Note: macOS's AirPlay Receiver also listens on port 5000 by default. If the API won't bind, either turn that off (System Settings → General → AirDrop & Handoff) or set a different `PORT` in `.env`.

### 2. Client

```bash
cd client
bun install
bun run dev             # http://localhost:5173
```

Open `http://localhost:5173`, sign up for an account, then sign in.

## API

| Method | Route              | Description              |
|--------|--------------------|---------------------------|
| POST   | `/api/auth/register`| Create an account         |
| POST   | `/api/auth/login`   | Sign in, returns a JWT    |
| GET    | `/api/tasks`         | List tasks                |
| POST   | `/api/tasks`         | Create a task              |
| PUT    | `/api/tasks/:id`     | Update a task              |
| DELETE | `/api/tasks/:id`     | Delete a task              |
| GET    | `/api/health`        | Health check (API + DB)    |

## Scripts

Run from `server/` or `client/` respectively:

| Command         | Server               | Client            |
|------------------|----------------------|--------------------|
| `bun run dev`    | API with auto-reload | Vite dev server    |
| `bun run start`  | API (no reload)      | —                  |
| `bun run build`  | —                     | Production build   |
| `bun run lint`   | —                     | Oxlint             |

## Status / known gaps

- `/api/tasks` isn't scoped per user yet — the login flow issues a JWT and the client attaches it to every request, but the server doesn't verify it on task routes yet.
- No CI/CD or Docker setup yet.
