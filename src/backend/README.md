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

## Snapshot Queue Architecture

- Widget updates publish `GenerateWidgetSnapshotRequested` commands to SQS.
- The queue carries commands only, never snapshot payloads.
- A worker consumes messages, checks idempotency and stale config state, generates the widget snapshot, and upserts it into the daily `briefing_snapshots` / `widget_snapshots` records.
- EventBridge Scheduler is expected to invoke the nightly enqueue handler, which enumerates eligible widgets and pushes one command per widget to SQS.
- Failed deliveries retry through the source queue until SQS redrives them to the DLQ.

### Design choices

- Queue type: SQS Standard
- Idempotency key: `widgetId:snapshotDate:widgetConfigHash`
- Stale detection: compare the message's `widgetConfigVersion` and `widgetConfigHash` against the current widget row at processing time
- Persisted job state: `snapshot_generation_jobs`
- Deleted or hidden widgets: worker marks the job as skipped
- Retry policy: infrastructure or unexpected failures throw so SQS retries; domain/config/provider failures are persisted as failed snapshots and the job is marked completed

## Local Development With LocalStack

Set these variables in `src/backend/.env` when using LocalStack:

- `SNAPSHOT_QUEUE_ENABLED=true`
- `AWS_ENDPOINT_URL_SQS=http://127.0.0.1:4566`
- `AWS_ACCESS_KEY_ID=test`
- `AWS_SECRET_ACCESS_KEY=test`

Then bootstrap the queues and capture the generated queue URL:

- `npm run snapshot:queues:setup`

Copy the reported queue URL into `SNAPSHOT_QUEUE_URL`.

### Run the worker locally

- `npm run snapshot:worker`

The worker long-polls SQS, processes available messages, and leaves failed messages for retry/DLQ handling.

### Run the nightly refresh locally

- `npm run snapshot:refresh:nightly`

This script only enqueues per-widget refresh commands. It does not do the heavy snapshot generation work itself.

## Environment Variables

- `SNAPSHOT_QUEUE_ENABLED`: toggles queue publishing
- `SNAPSHOT_QUEUE_URL`: source queue URL used by publishers and the local worker
- `SNAPSHOT_QUEUE_NAME`: queue name used by the setup script
- `SNAPSHOT_DLQ_NAME`: DLQ name used by the setup script
- `SNAPSHOT_QUEUE_MAX_RECEIVE_COUNT`: max receives before redrive to DLQ
- `SNAPSHOT_WORKER_WAIT_TIME_SECONDS`: SQS long-poll duration
- `SNAPSHOT_WORKER_VISIBILITY_TIMEOUT_SECONDS`: worker visibility timeout
- `SNAPSHOT_WORKER_MAX_MESSAGES`: batch size for local polling
- `SNAPSHOT_WORKER_POLL_INTERVAL_MS`: loop delay between local polls
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_SQS`: AWS/LocalStack connection settings

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
- Lambda/EventBridge infrastructure wiring is represented in code and docs, but deployment IaC is not part of this repo yet.

## Current API

- `GET /health`
- `GET /api/v1/me`
- `GET /api/v1/dashboards`
- `POST /api/v1/dashboards`
- `PATCH /api/v1/dashboards/:dashboardId`
- `GET /api/v1/dashboards/:dashboardId/widgets`
- `POST /api/v1/dashboards/:dashboardId/widgets`
- `PATCH /api/v1/dashboards/:dashboardId/widgets/:widgetId`
- `GET /api/v1/reference/cities?q=<query>`
