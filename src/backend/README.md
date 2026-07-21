# Backend Database Setup

The backend database tooling uses Prisma with PostgreSQL.

## Environment

Copy `src/backend/.env.example` to `src/backend/.env` and adjust only if your local database settings differ.

Default values assume:

- PostgreSQL is listening on `127.0.0.1:5432`
- the `postgres` user exists
- no password is required locally
- the application database should be named `morning_briefing`

## Commands

- `npm install`
- `npm run db:create`
- `npm run db:migrate -- --name <change-name>`
- `npm run db:seed`
- `npm run db:init`
- `npm run db:reset`
- `npm run reference:import:cities`

## Notes

- `db:create` connects to the admin database and creates the application database if it does not already exist.
- `db:init` is intended for first-time local setup.
- Prisma CLI configuration, including the seed command, lives in `src/backend/prisma.config.ts`.
- After the initial migration exists, future schema changes should be made by editing `prisma/schema.prisma` and generating a new named migration.
- `reference:import:cities` downloads the GeoNames `cities5000` dataset and imports it into `reference_cities` for weather widget location search.

## Durable Message Broker Architecture

- Widget updates publish persistent `GenerateWidgetSnapshotRequested` commands to RabbitMQ and wait for publisher confirms.
- Admin dashboard audio regeneration publishes `GenerateDashboardAudioBriefingRequested` commands to the same durable exchange.
- The queue carries commands only, never snapshot payloads.
- A separate worker uses bounded prefetch and manual acknowledgements, routes commands by type, and persists widget snapshots or dashboard audio briefings.
- Host systemd timers invoke one-shot Compose services at `01:00` and `05:00` UTC after the approved legacy-writer handoff.
- Retryable failures move through a quorum retry queue with TTL backoff. A monotonic application retry header enforces the configured attempt bound before the terminal quorum DLQ.

### Design choices

- Queue type: RabbitMQ durable quorum main, retry, and dead-letter queues
- Idempotency key: `widgetId:snapshotDate:widgetConfigHash`
- Stale detection: compare the message's `widgetConfigVersion` and `widgetConfigHash` against the current widget row at processing time
- Persisted widget job state: `snapshot_generation_jobs`
- Persisted dashboard-audio job state: `dashboard_briefing_generation_jobs`
- Processing leases allow abandoned `PROCESSING` work to be recovered after a worker failure
- Deleted or hidden widgets: worker marks the job as skipped
- Retry policy: confirmed forwarding to the retry queue precedes source acknowledgement; invalid or exhausted deliveries are confirmed into the DLQ; PostgreSQL job rows remain authoritative for idempotency and processing leases

## Local Development With RabbitMQ

Start a local RabbitMQ instance, then set at least these variables in `src/backend/.env`:

- `MESSAGE_BROKER_ENABLED=true`
- `MESSAGE_BROKER_URL=amqp://<local-user>:<local-password>@127.0.0.1:5672`

Declare the durable topology:

- `npm run message-broker:setup`

The production backend readiness check performs the same idempotent durable declaration, so a fresh RabbitMQ data directory is bootstrapped before `/health/ready` reports success. The setup command remains useful for explicit local administration and verification.

### Run the worker locally

- `npm run snapshot:worker`

The worker consumes RabbitMQ deliveries and acknowledges them only after successful processing or confirmed retry/dead-letter forwarding.

For normal local app startup, `./scripts/start_backend.sh` now enables the local worker inside the backend dev process by default, so a separate worker terminal is optional unless you want one explicitly.

### Run the nightly refresh locally

- `npm run snapshot:refresh:nightly`

This script only enqueues per-widget refresh commands. It does not do the heavy snapshot generation work itself.

### Run the daily local scheduler

- `npm run scheduler:local`
- or from the repo root: `./scripts/start_scheduler.sh`
- or start the normal backend dev process with `./scripts/start_backend.sh` or `./scripts/start_dev_env.sh`

The local scheduler keeps two UTC jobs alive:

- widget snapshot refresh at `01:00` UTC
- dashboard audio briefing refresh at `05:00` UTC

`./scripts/start_backend.sh` exports `LOCAL_SCHEDULER_ENABLED=true`, so the scheduler now starts inside the local backend dev process by default.
`./scripts/start_backend.sh` also exports `LOCAL_SNAPSHOT_WORKER_ENABLED=true`, so the local queue worker runs inside that same backend dev process by default.

When started through `./scripts/start_scheduler.sh`, output is written to `src/backend/data/local-scheduler.log`.

## Environment Variables

- `MESSAGE_BROKER_ENABLED`: toggles broker publishing and readiness
- `MESSAGE_BROKER_URL`: secret AMQP connection URL supplied through a protected env file in production
- `MESSAGE_BROKER_EXCHANGE`, `MESSAGE_BROKER_QUEUE`, `MESSAGE_BROKER_RETRY_QUEUE`, `MESSAGE_BROKER_DLQ`: durable topology names
- `MESSAGE_BROKER_RETRY_DELAY_MS`, `MESSAGE_BROKER_MAX_ATTEMPTS`: retry backoff and terminal attempt bound
- `MESSAGE_BROKER_PREFETCH`, `MESSAGE_BROKER_RECONNECT_DELAY_MS`: worker flow control and reconnect delay
- `SNAPSHOT_JOB_LEASE_SECONDS`: PostgreSQL processing-lease duration

## Observability

Current structured logs cover:

- enqueue
- dequeue
- processing start
- processing success
- skipped duplicate/stale jobs
- failures and worker loop errors

## Known Limitations

- Scheduled refresh currently targets the current UTC snapshot date; per-user timezone scheduling can be added later.
- Provider errors currently produce failed snapshots instead of retry-specific classification.
- The legacy ECS/EventBridge deployment is still live and its CloudFormation stack is drifted after the RDS instance was removed. It is not the target architecture and must not be updated or deleted before resource ownership is reconciled.
- The target EC2 Compose release, Apache route, shared-ALB rule, host IAM grants, and systemd timers require a separately approved live phase.

## Audio Briefing

Audio Briefing is a dashboard-level derived artifact. It is not stored as a widget snapshot and it does not scrape widget HTML.

### How it works

1. Widget snapshots are generated and stored as usual.
2. The dashboard briefing aggregation service loads the latest eligible widget snapshots for the dashboard.
3. Structured widget-specific transforms normalize those snapshots into one dashboard briefing input payload.
4. An LLM provider generates structured JSON for the spoken script.
5. A TTS provider converts the script into audio and stores the generated file under `AUDIO_BRIEFING_STORAGE_DIR` (the backend data directory is only a local-development default).
6. The dashboard UI loads the latest saved briefing and plays the stored audio file through a backend playback endpoint.

### Widget inclusion rules

- Widget type defaults are code-owned in `src/modules/widgets/widget-definitions.ts`.
- `weather`, `calendar`, `tasks`, and `news` default to included.
- `xkcd` defaults to excluded.
- Each widget instance can override that default with `include_in_briefing_override`.
- The dashboard edit modal also stores dashboard-level Audio Briefing preferences such as enabled state, duration, tone, and voice.

### Shared AI configuration

Shared AI settings are now tenant-scoped and edited from `Admin > Configuration`.

The admin page stores only the non-secret shared OpenAI model. `OPENAI_API_KEY` is supplied to backend and worker processes through root-owned mode-`0600` environment files outside immutable releases; the browser and API never accept or return its value.

That shared OpenAI configuration is used by:

- the news summarization flow
- the dashboard briefing script generation flow

Audio synthesis now uses AWS Polly and stores the generated audio artifact before playback.

In production, `AUDIO_BRIEFING_STORAGE_DIR` must point to one protected host directory mounted into both backend and worker containers. The database stores only metadata and the relative storage key. The directory must be included in backup/restore checks and audio must survive replacement of either container.

Environment variables:

- `AWS_REGION`
- `AWS_ENDPOINT_URL_POLLY`
- `AUDIO_BRIEFING_TTS_POLLY_VOICE`
- `AUDIO_BRIEFING_STORAGE_DIR`
- `ALEXA_SKILL_APPLICATION_ID` for validating requests from your Alexa custom skill endpoint

If shared OpenAI configuration is missing, AI-backed summarization and dashboard briefing generation fail with a clear admin-facing error that points to `Admin > Configuration`.

### Alexa skill endpoint

The backend now exposes `POST /api/v1/integrations/alexa` as a custom-skill webhook for Alexa.

Recommended setup:

1. Create an Alexa custom skill with an intent named `GetDailyBriefingIntent`.
2. Configure account linking so Alexa sends an OAuth access token in `context.System.user.accessToken`.
3. Point the Alexa endpoint at your backend `POST /api/v1/integrations/alexa`.
4. Set `ALEXA_SKILL_APPLICATION_ID` in the backend to the Alexa skill application id so unexpected skill ids are rejected.

Current Alexa behavior:

- the skill reads the latest saved `READY` dashboard briefing from the user's default dashboard
- if no linked access token is present, the skill responds with a `LinkAccount` card
- if no dashboard or ready briefing exists yet, the skill responds with a friendly retry message
- the response uses the saved `scriptText` generated by the existing dashboard briefing pipeline

### Caching and regeneration

- A dashboard briefing source hash is computed from dashboard id, briefing preferences, widget inclusion overrides, and the latest included widget snapshot ids, statuses, hashes, and timestamps.
- Manual dashboard-side regeneration is disabled.
- `POST /api/v1/admin/dashboards/:dashboardId/regenerate-audio-briefing` now queues an asynchronous regeneration job that bypasses reuse checks and regenerates a fresh dashboard briefing from the latest eligible snapshots.
- The dashboard page only plays the latest stored audio artifact.

## Current API

- `GET /health`
- `GET /api/v1/me`
- `GET /api/v1/dashboards`
- `POST /api/v1/dashboards`
- `PATCH /api/v1/dashboards/:dashboardId`
- `GET /api/v1/dashboards/:dashboardId/audio-briefing/preferences`
- `PATCH /api/v1/dashboards/:dashboardId/audio-briefing/preferences`
- `GET /api/v1/dashboards/:dashboardId/audio-briefing/input-preview`
- `GET /api/v1/dashboards/:dashboardId/audio-briefing`
- `GET /api/v1/dashboard-briefing-audio/:audioId`
- `GET /api/v1/dashboard-briefing-audio/:audioId/content`
- `POST /api/v1/integrations/alexa`
- `GET /api/v1/admin/configuration`
- `PATCH /api/v1/admin/configuration`
- `POST /api/v1/admin/dashboards/:dashboardId/regenerate-audio-briefing`
- `GET /api/v1/dashboards/:dashboardId/widgets`
- `POST /api/v1/dashboards/:dashboardId/widgets`
- `PATCH /api/v1/dashboards/:dashboardId/widgets/:widgetId`
- `GET /api/v1/reference/cities?q=<query>`

## Target Production Runtime

The approved target topology is Docker Compose on the private ARM64 personal-projects EC2 host:

- backend and worker use the same immutable image digest but separate commands, health/restart state, and resource limits
- the worker runs `npm run snapshot:worker:prod`
- systemd timers invoke `npm run snapshot:refresh:nightly:prod` at `01:00` UTC and `npm run dashboard-briefing:refresh:scheduled:prod` at `05:00` UTC as one-shot Compose services
- PostgreSQL 18.4 is external to the application Compose project on Docker network `personal-projects-postgresql`
- the API and frontend bind only to loopback-facing host ports; Apache exposes them through host port `8080` behind the shared ALB/WAF
- migrations run as an explicit one-shot `npm run db:deploy`; normal releases never run the production seed

The production worker and timers must stay disabled until the corresponding ECS worker and EventBridge schedules have been stopped during an approved writer handoff. See `docs/deployment_approach.md` for release, health, and rollback gates.
