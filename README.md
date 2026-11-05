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

Open:

- App: <http://localhost:5173>
- API health: <http://localhost:5001/api/health>
- Prometheus: <http://localhost:9090>
- Alertmanager: <http://localhost:9093>

The Prometheus UI's **Status → Targets** page should show `backend`, `node-exporter`, and `prometheus` as **UP**. Metrics are retained in the `prometheus_data` volume for 15 days. Alert rules are in `monitoring/prometheus/alert-rules.yml`.

All published ports bind to localhost. Node Exporter is only available to Prometheus on the Compose network. Set a non-demo `JWT_SECRET` in the shell or a root `.env` file before using this beyond a local demonstration; the Compose fallback secret is for local use only.

## Monitoring

The backend exposes Prometheus text metrics at `http://localhost:5001/metrics`.

| Metric | Type | Labels / purpose |
|---|---|---|
| `http_requests_total` | Counter | Completed requests by method, normalized Express route, and status code; use `status_code=~"5.."` for 5xx rates. |
| `http_request_duration_seconds` | Histogram | Request latency in seconds, with the same bounded labels and buckets from 5 ms to 10 s. |
| `process_*` and `nodejs_*` | Default process metrics | Collected by `prom-client`, including process memory and CPU. |
| `node_cpu_seconds_total` | Counter | Node Exporter CPU time by CPU and mode. |
| `node_memory_MemAvailable_bytes`, `node_memory_MemTotal_bytes` | Gauges | Node Exporter available and total host memory. |

Request metrics omit `/metrics` itself. Route labels use Express route templates (for example `/api/tasks/:id`), not raw URLs or user/task IDs. Unmatched API paths share the `unmatched` label.

Prometheus evaluates these alerts:

| Alert | Condition | Hold time |
|---|---|---|
| `ServiceDown` | `up{job="backend"} == 0` | 1 minute |
| `HighCPUUsage` | At least one host CPU core exceeds 80% utilization over 1 minute | 30 seconds |
| `HighMemoryUsage` | Host memory usage exceeds 85%, based on `MemAvailable` | 1 minute |
| `HighErrorRate` | HTTP 5xx responses exceed 5% of requests over 5 minutes | 2 minutes |

The CPU and memory percentages are configurable by editing the comparison values (`80` and `85`) in `monitoring/prometheus/alert-rules.yml`. The CPU rule intentionally reports a busy core rather than averaging all cores, so a single-threaded workload can demonstrate the alert.

## Alertmanager and CybrAID

Alertmanager groups alerts by alert name and service, waits 15 seconds before the first grouped notification, and repeats unresolved notifications hourly. Its webhook sends both firing and resolved notifications to:

```text
http://host.docker.internal:3000/api/monitoring/alerts
```

The destination is configured in `monitoring/alertmanager/alertmanager.yml`. Change the `webhook_configs.url` to the URL reachable **from the Alertmanager container**, preserving the `/api/monitoring/alerts` path, then apply it:

```bash
docker compose restart alertmanager
docker compose logs -f alertmanager
```

Choose the destination as follows:

- **CybrAID on the host:** use `http://host.docker.internal:<published-port>/api/monitoring/alerts` and replace `3000` with the backend's port. Docker Desktop provides `host.docker.internal`; the Compose `host-gateway` mapping supports Linux Docker.
- **CybrAID in a separate Docker environment:** use a hostname or address routable from this Compose network, such as the other environment's published service host and port. Container service names are not shared across separate Docker networks.
- **CybrAID on another machine:** use its reachable DNS name or address and published port, preferably HTTPS, for example `https://cybraid.example.edu/api/monitoring/alerts`. Ensure network routing and firewall rules allow the connection.

CybrAID remains a separate application; this repository only sends Alertmanager webhook notifications. When the destination is unavailable, Alertmanager logs delivery failures and retries according to its notification behavior; inspect its logs to diagnose connectivity or receiver errors.

## Demonstrate alerts safely

The application failure endpoints are only registered when `DEMO_MODE=true`; they are disabled by default. Published API and monitoring ports bind to localhost. Enable the endpoints by recreating the backend:

```bash
DEMO_MODE=true docker compose up --build -d
```

1. **ServiceDown:** stop the backend for over one minute, check the alert, then start it and wait for the resolved notification:

   ```bash
   docker compose stop backend
   # Check http://localhost:9090/alerts and http://localhost:9093
   docker compose start backend
   ```

2. **HTTP 500 / HighErrorRate:** one request demonstrates a 500; sustain 5xx traffic to fire the rate alert (the rule has a 5-minute rate window and 2-minute hold):

   ```bash
   curl -i http://localhost:5001/api/demo/error
   for i in $(seq 1 240); do curl -s -o /dev/null http://localhost:5001/api/demo/error; sleep 1; done
   ```

3. **HighCPUUsage:** one bounded request runs a CPU workload for at most 120 seconds. It permits only one active CPU simulation and yields periodically so the API can still respond:

   ```bash
   curl --max-time 125 'http://localhost:5001/api/demo/cpu?seconds=120'
   ```

   The alert measures the busiest core, so one busy core can trigger it. If needed, adjust the CPU comparison value to suit the demonstration host, then reload Prometheus:

   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

4. **HighMemoryUsage:** hold a touched allocation of up to 128 MB for up to 120 seconds; only one allocation can run at a time:

   ```bash
   curl 'http://localhost:5001/api/demo/memory?megabytes=128&seconds=120'
   ```

   This is a bounded demonstration, not a guarantee of crossing the host-level 85% threshold. Check the host's baseline in Prometheus and adjust the rule threshold if the available memory makes the increase too small. Restore the original threshold afterward.

Stop the CPU or memory simulation by waiting for its requested duration (up to 120 seconds). Disable the failure endpoints and recreate the backend:

```bash
DEMO_MODE=false docker compose up -d --force-recreate backend
```

For any alert, check **Prometheus → Alerts**, then **Alertmanager → Status** and `docker compose logs -f alertmanager`. Alertmanager's webhook receiver can also be inspected in CybrAID's backend logs. Alerts resolve after their expression stops matching and Prometheus observes the change.

## Validate configuration

```bash
docker compose config
docker compose run --rm --no-deps --entrypoint promtool prometheus check config /etc/prometheus/prometheus.yml
docker compose run --rm --no-deps --entrypoint promtool prometheus check rules /etc/prometheus/alert-rules.yml
docker compose run --rm --no-deps --entrypoint amtool alertmanager check-config /etc/alertmanager/alertmanager.yml
```

## Host-metric limitations

Node Exporter mounts Linux host `/proc`, `/sys`, and `/` read-only. On Linux Docker, these expose host metrics. On macOS and Windows with Docker Desktop, containers run in a Linux VM; Node Exporter therefore reports the Docker VM's Linux resources, not the physical macOS/Windows host. The monitored CPU and memory values should be interpreted accordingly.

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
