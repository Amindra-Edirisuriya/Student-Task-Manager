# Student Task Manager

A demonstration task manager that CybrAID can monitor. Students can register, sign in, and create, update, filter, and delete tasks.

## Application architecture

- **Frontend:** React 19 single-page application built with Vite and served by Nginx.
- **Backend:** Bun runs an Express 5 REST API. Mongoose connects it to MongoDB.
- **Authentication:** Email/password registration and login issue JWTs; task routes require a bearer token.
- **API routes:** `POST /api/auth/register`, `POST /api/auth/login`, CRUD at `/api/tasks` (including `PUT`/`DELETE /api/tasks/:id`), and `GET /api/health`.
- **Docker:** Docker Compose builds the existing frontend and backend images and runs MongoDB. The frontend's Nginx configuration proxies `/api/` to the backend.

## Run the application and monitoring stack

Requirements: Docker with the Compose plugin.

```bash
docker compose up --build -d
docker compose ps
```

## Local development without Docker

Run MongoDB separately, then start the backend and frontend:

```bash
cd server
bun install
cp env.example .env
bun run dev
```

In another terminal:

```bash
cd client
bun install
bun run dev
```

The local API defaults to port 5000 and the Vite client to port 5173. Configure `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` in `server/.env`.
