# Backend Architecture

This document describes the implemented modular backend and its approved target architecture. The backend lives under `src/backend`, exposes a REST-only API to the UI, and persists data in PostgreSQL. Production is being re-architected from a drifted ECS/Fargate stack to Docker Compose on the consolidated personal-projects EC2 host; this document does not authorize the live cutover.

## Goals

- Keep the frontend and backend decoupled through a stable REST API.
- Support the current dashboard-and-widget editing UX without forcing the UI to understand backend internals.
- Cleanly separate dashboard configuration data from generated briefing content.
- Make local development simple while staying compatible with AWS deployment patterns.
- Leave room for asynchronous data ingestion and briefing generation as more widget types and connectors are added.

## Stack

- Runtime: Node.js 24 LTS, pinned by base-image digest and compatibility-tested on ARM64
- Language: TypeScript
- Web framework: Fastify
- Validation and contracts: JSON Schema with Fastify request/response schemas
- Database: PostgreSQL
- Migrations: Prisma Migrate
- Query layer: Prisma ORM
- Background jobs: on-host RabbitMQ plus a dedicated worker process; local development can embed the scheduler and worker
- Configuration: environment variables with typed config loading
- Logging: structured JSON logs with request IDs

The frontend is also strict TypeScript, but the REST contract remains the boundary between the independently built browser bundle and backend. Typed DTOs, schema-driven validation, and focused tests strengthen refactoring as widget types and connector integrations grow.

## Architectural Style

The backend should follow a modular monolith design inside `src/backend`. That gives us clear domain boundaries without the operational cost of multiple services. The initial packages should be:

- `api`: REST routes, request parsing, response shaping
- `application`: use cases and orchestration
- `domain`: core business rules and entities
- `infrastructure`: database, secrets, external connector clients, background execution
- `jobs`: briefing generation and connector sync entry points

This keeps the codebase easy to run locally while making future extraction possible if a specific capability grows independently.

## REST-Only Contract

The UI should communicate with the backend only through REST over HTTP/JSON. No server-rendered HTML, no direct database access, and no frontend dependency on internal job state beyond explicit API resources.

### API principles

- Resource-oriented URLs
- Versioned base path such as `/api/v1`
- JSON request and response bodies
- Optimistic concurrency for mutable resources where practical
- Idempotent `PUT`/`PATCH` semantics for dashboard and widget updates
- Asynchronous operations represented as resource state, not long-held HTTP connections

### Initial resource model

- `tenants`
- `users`
- `dashboards`
- `dashboard-widgets`
- `connectors`
- `briefing-snapshots`
- `widget-snapshots`

### Recommended first endpoints

- `GET /api/v1/me`
- `GET /api/v1/dashboards`
- `POST /api/v1/dashboards`
- `GET /api/v1/dashboards/:dashboardId`
- `PATCH /api/v1/dashboards/:dashboardId`
- `GET /api/v1/dashboards/:dashboardId/widgets`
- `POST /api/v1/dashboards/:dashboardId/widgets`
- `PATCH /api/v1/dashboards/:dashboardId/widgets/:widgetId`
- `GET /api/v1/reference/cities?q=<query>`
- `DELETE /api/v1/dashboards/:dashboardId/widgets/:widgetId`
- `GET /api/v1/dashboards/:dashboardId/snapshots/latest`
- `GET /api/v1/snapshots/:snapshotId`
- `GET /api/v1/connections`
- `POST /api/v1/connections`
- `PATCH /api/v1/connections/:connectionId`
- `POST /api/v1/connectors/:connectorId/sync`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`

## How The Current UI Maps To The Backend

The framework-free TypeScript UI implies a few important backend requirements:

- Dashboards are user-facing named containers with description and theme metadata.
- Widgets are dashboard-scoped instances, not abstract widget definitions.
- Widget layout is freeform, so absolute `x`, `y`, `width`, and `height` must be persisted.
- Widget type definitions remain code-owned in the application layer, while widget instance configuration belongs in the database.
- Widget display content should come from snapshot data or connector-backed reads, not be mixed into widget configuration rows.
- Connector management needs both creation from task-widget flows and a dedicated page for later credential edits.
- User profile management needs persisted preferences that survive future auth-token refreshes, including delivery-channel settings for generated audio briefings, uploaded profile imagery, and a preferred output language for all LLM-generated text.

That last point is the main reason to keep both `dashboard_widget.config_json` and `widget_snapshot.content_json`. One stores configuration; the other stores rendered content for a specific briefing run.

## Backend Module Layout

The initial backend structure should look like this:

```text
src/backend/
  app/
    server.ts
    plugins/
    routes/
  modules/
    dashboards/
      api/
      application/
      domain/
      infrastructure/
    widgets/
      api/
      application/
      domain/
      infrastructure/
    connectors/
      api/
      application/
      domain/
      infrastructure/
    briefings/
      api/
      application/
      domain/
      infrastructure/
  infrastructure/
    config/
    db/
    jobs/
    logging/
    secrets/
  shared/
    errors/
    schemas/
    utils/
```

This structure keeps domain logic close to each module while still allowing shared platform concerns to stay centralized.

## Data Model

`docs/diagrams/data-model.puml` reflects the current Prisma schema. `DashboardWidget` distinguishes persisted instances from code-owned widget definitions. Dashboard and widget versions support safe edit/save flows; generated snapshot and briefing records remain separate from configuration. The schema enforces one daily briefing snapshot per `(user_id, dashboard_id, snapshot_date)` and an idempotency key per snapshot-generation job.

### PostgreSQL conventions

- Use `uuid` primary keys for externally visible resources.
- Use `jsonb` instead of `json` for flexible config and snapshot payloads.
- Use `timestamptz` rather than naive timestamps.
- Add foreign key indexes and common query indexes up front.
- Use enum-like check constraints or Postgres enums for stable status/type fields.

## Database Responsibilities

PostgreSQL is the system of record for:

- tenant and user metadata
- dashboard definitions
- widget layout and configuration
- reference data such as cities used by provider-agnostic widget configuration
- connector metadata
- generated briefing snapshots

PostgreSQL should not store:

- plaintext secrets
- transient third-party API tokens that belong in a dedicated secret store
- frontend-only widget definition metadata already owned by code

## Snapshot Generation Flow

The backend should support two distinct flows:

1. Configuration flow
   The UI creates and updates dashboards and widget instances through REST.
2. Generation flow
   Background jobs gather source data, resolve widget content, and persist briefing snapshots and widget snapshots.

A typical generation path is:

1. Load the active dashboard and its visible widgets for a user.
2. Resolve required connectors for each widget.
3. Fetch or refresh source data.
4. Build one `briefing_snapshot`.
5. Build one `widget_snapshot` per widget.
6. Mark the snapshot as `ready` or `failed`.
7. Let the UI fetch the latest completed snapshot through REST.

This model keeps the dashboard editor fast and independent from the timing of data collection.

### Durable broker implementation

The target Compose deployment uses a RabbitMQ-backed generation pipeline:

- widget configuration changes enqueue `GenerateWidgetSnapshotRequested` messages through the broker publisher
- admin widget operations can queue one widget or all eligible widgets for manual snapshot regeneration through the same job pipeline
- admin dashboard audio regeneration enqueues `GenerateDashboardAudioBriefingRequested` messages to the same queue
- a dedicated worker process consumes RabbitMQ deliveries and handles both widget-snapshot and dashboard-audio commands
- in the target production deployment, systemd timers invoke one-shot Compose services that enqueue widget refresh work at `01:00` UTC and dashboard audio work at `05:00` UTC
- each scheduled producer owns its AMQP confirm channel, broker connection, and database client for exactly one run and closes them in `finally` after success or failure; the long-lived worker retains its separate reconnecting consumer lifecycle
- `snapshot_generation_jobs` and `dashboard_briefing_generation_jobs` persist independent idempotency, attempt, duplicate, lease, and failure state
- workers detect stale widget jobs by comparing the queued widget config version/hash with the current widget row before generating anything
- the durable topology consists of a quorum main queue, a quorum retry queue with TTL-based backoff, and a quorum terminal dead-letter queue
- publishers declare persistent messages as mandatory and wait for publisher confirms; an unroutable or unconfirmed message fails the enqueue operation
- consumers use bounded prefetch and manual acknowledgements, acknowledging only after a job is processed or safely coalesced
- retryable failures are dead-lettered to the retry queue, which returns them to the main exchange after its TTL; the worker reads the RabbitMQ `x-death` history and explicitly dead-letters a delivery after the configured bounded attempt count
- malformed, unsupported, linked, or otherwise unsafe message shapes go directly to the terminal dead-letter queue rather than being acknowledged and discarded

The retry queue is an application topology boundary, not an alternative job ledger. RabbitMQ owns durable delivery and backoff; PostgreSQL remains authoritative for idempotency, attempts, active processing leases, stale widget configuration, and terminal application outcome. Broker redelivery is therefore safe but still at least once, not exactly once.

The logical idempotency key is:

- `widgetId:snapshotDate:widgetConfigHash`

That key intentionally coalesces overlapping scheduled and ad hoc refresh requests for the same widget/day/config state while still allowing a new config change to produce a fresh job.

## Audio Briefing Pipeline

Audio Briefing extends the existing snapshot architecture at the dashboard level rather than introducing a new widget type.

### Pipeline shape

1. Widgets produce structured `widget_snapshots`.
2. A dashboard briefing aggregation step selects the latest eligible snapshots for the dashboard.
3. Widget-type-specific transformers normalize those snapshots into one dashboard briefing input payload.
4. A tenant-scoped OpenAI configuration is loaded from admin-managed configuration.
5. OpenAI generates a structured JSON script contract, explicitly instructed to answer in the user profile's preferred language.
6. AWS Polly converts the full script into audio and stores the generated file.
7. A delivery orchestration step fan-outs the saved audio to any enabled user channels, starting with Telegram.
8. The dashboard UI fetches the latest saved briefing metadata and plays the stored audio artifact.

### Design rules

- Audio Briefing must use backend snapshot data, not rendered DOM text.
- Widget eligibility is controlled at two levels:
  - code-owned widget type defaults
  - per-widget instance overrides persisted on `dashboard_widgets`
- Briefing preferences are dashboard-scoped and stored separately from widget configuration.
- Tenant-scoped AI configuration is stored separately from both widget configuration and briefing preferences.
- User delivery preferences are stored on the user profile so channel choices follow the person rather than a single dashboard.
- User preferred language is stored on the user profile and injected into every LLM prompt so news summaries and audio scripts stay consistent for that person.
- User avatars are stored directly on the user profile as base64 image data so the current UI can upload without adding a separate media service yet.
- Voice assistants can reuse the saved dashboard briefing script instead of re-synthesizing audio, starting with an Alexa custom skill webhook that reads the latest `READY` briefing for the linked user.
- Manual regeneration belongs to admin tooling or scheduled jobs, not the end-user dashboard.
- Manual audio regeneration is queue-backed so the HTTP request only enqueues work and the worker performs the heavy generation.
- Cache reuse is based on a source hash built from the included widget snapshot identities and the current dashboard briefing preferences.
- Delivery-channel failures should not invalidate an otherwise successful audio generation; they are logged separately and can be retried independently later.

## Connectors And Secrets

Connectors should be tenant-scoped integrations such as weather, calendar, email, tasks, RSS, or news. The connector row should store stable metadata only:

- connector type
- display name
- status
- non-secret config
- secret reference
- last sync state

Secrets should be abstracted behind a `SecretStore` interface:

- local development: `.env` or a local secret file outside source control
- production: environment variables loaded from root-owned mode-`0600` files outside release directories
- future alternative: AWS Secrets Manager, SSM Parameter Store, or another secret store

Production secret inputs include `DATABASE_URL`, `MESSAGE_BROKER_URL`, RabbitMQ bootstrap credentials, OAuth credentials, Life2 JWT verification material, delivery-provider credentials, and `OPENAI_API_KEY`. These values must not appear in Git, image layers, release bundles/manifests, Compose command output, or logs. `tenant_ai_configurations.openai_api_key` remains in the current schema only as a deprecated compatibility column; runtime providers read `OPENAI_API_KEY` from the protected environment and must never read or write that column.

## Authentication And Multi-Tenancy

The existing data model is tenant-aware, so the backend should preserve that boundary from the start even if MVP auth is simple.

Implemented approach:

- Fastify authentication middleware resolves the Life2 JWT into current user and tenant context.
- Protected `/api/v1/*` routes use that context in tenant-scoped queries.
- Signature verification must be configured in production with `LIFE2_JWT_SECRET` or `LIFE2_JWT_PUBLIC_KEY`; shape-only validation is not an acceptable production configuration.
- The SPA callback `/#/auth/callback` and Google/Gmail OAuth callbacks must survive Apache and ALB routing unchanged.

## Operational Approach

### Local development

- Backend runs locally against local PostgreSQL.
- Migrations create the full schema.
- Seed data provides one tenant, one user, one dashboard, and sample widgets.
- Background jobs can run in-process on a simple interval or triggered by explicit endpoints.

### Test and production

- one stateless backend container and a separately restartable worker using the same immutable ARM64 image digest
- static frontend bundle in a minimal Nginx container
- PostgreSQL 18.4 on the existing external Docker network `personal-projects-postgresql`
- RabbitMQ on the internal application network with persistent host storage and durable quorum main, retry, and dead-letter queues
- secrets supplied from root-owned mode-`0600` environment files outside releases
- one-shot Compose commands driven by persistent, non-overlapping systemd timers
- Apache on host port `8080` proxies `/api/*` to a loopback backend port and all other paths to a loopback frontend port behind the shared ALB/WAF
- a protected host audio directory mounted into backend and worker at `AUDIO_BRIEFING_STORAGE_DIR`
- Docker `awslogs` logging with distinct service stream prefixes in the existing retained seven-day `/personal-projects/morning-briefing` group; project infrastructure grants write access but does not create or manage the group

The production database is not owned by the application Compose project and must not publish port 5432 publicly. The restored database was independently verified at 19 tables and 92,767 rows. Migrations run as an explicit one-shot release gate; normal deployment never runs the production seed.

## Production Process Boundaries

- `backend`: API traffic, OAuth callbacks, audio playback, confirmed broker publication, and readiness checks for PostgreSQL, required configuration, and RabbitMQ when enabled
- `worker`: RabbitMQ manual-ack consumption, retry/dead-letter routing, idempotency/staleness checks, connector/provider work, snapshot persistence, audio generation, and delivery fan-out
- `widget-refresh`: one-shot enqueue command `npm run snapshot:refresh:nightly:prod`
- `dashboard-audio-refresh`: one-shot enqueue command `npm run dashboard-briefing:refresh:scheduled:prod`
- `migrate`: one-shot `npm run db:deploy`

Candidate workers and timers stay disabled until the legacy ECS worker and EventBridge schedules have completed a deliberate writer handoff. Running both sides against the production queue/database risks duplicate external effects.

## Reliability and Storage

- RabbitMQ delivery is at least once. Durable quorum queues, persistent mandatory publication, publisher confirms, and manual consumer acknowledgements prevent a successful enqueue or completion from being reported before the corresponding durability boundary.
- Retryable failures pass through a durable TTL retry queue for backoff. The consumer derives the bounded attempt count from trusted `x-death` headers and explicitly routes exhausted or invalid deliveries to the durable terminal DLQ; it never accepts a caller-supplied retry count as authority.
- The widget and dashboard-audio generation-job tables remain unchanged and supply separate idempotency keys, processing leases, attempt state, duplicate accounting, stale-config detection, and recovery after a worker dies between an external side effect and acknowledgement.
- Backend readiness must check PostgreSQL, required runtime configuration, and RabbitMQ connectivity/topology when publication is enabled. Worker health must prove a live broker channel and registered consumer rather than merely finding a process name. Process liveness alone is insufficient.
- Real-broker integration starts both production scheduled-producer entrypoints with eligible PostgreSQL records and requires confirmed publication plus process exit within a bounded deadline.
- Audio bytes live in the protected persistent host mount, while PostgreSQL stores their metadata and relative storage key.
- RabbitMQ data also lives in a protected persistent host mount and survives container or application-release replacement. Application rollback must not delete or recreate that volume.
- Audio storage is backed up and must survive replacement of either application container.
- Releases use digest-pinned ARM64 images and retain prior manifests/digests for rollback.

## Legacy Deployment Status

The material under `cicd/serverless` and the CloudFormation stack `morning-briefing-platform-prod` describe the legacy ECS deployment. Live discovery found three running Fargate services, two enabled EventBridge schedules, and healthy shallow ALB checks, but backend and worker still point to the deleted RDS endpoint. The stack is drifted and must not be updated or removed until its database deletion and retained ECR/SQS/ALB/ECS ownership are reconciled.

## Non-Functional Requirements

- Every endpoint validates inputs and outputs.
- All writes are auditable through timestamps and request logging.
- API responses should be stable enough for the TypeScript SPA to consume without unnecessary mapping complexity.
- The backend should degrade gracefully when connector sync fails by returning the last successful snapshot where possible.
- Database migrations must be the only supported path for schema changes.

## Historical Development Sequence

1. Create the `src/backend` scaffold with Fastify bootstrapping and config loading.
2. Add PostgreSQL connectivity, migrations, and seed data.
3. Implement dashboard and widget REST endpoints first.
4. Update the UI to replace in-memory services with HTTP-backed services.
5. Add snapshot read endpoints.
6. Add connector management and a first end-to-end generator for the weather widget.

## Implemented So Far

- `GET /api/v1/me` resolves the current Life2-authenticated application user
- `GET /api/v1/users/me` returns the persisted current-user profile, including avatar data, preferred language, and audio delivery preferences
- `PATCH /api/v1/users/me` updates the persisted current-user profile, including preferred language and Telegram delivery settings
- Dashboard audio briefing generation now personalizes the opening greeting from the persisted user profile, preferring phonetic name over first name
- News summarization and dashboard audio briefing prompts now both instruct the LLM to respond in the persisted user preferred language
- `GET /api/v1/dashboards` lists that user's dashboards
- `POST /api/v1/dashboards` creates dashboards for that user
- `PATCH /api/v1/dashboards/:dashboardId` updates dashboard metadata
- `GET /api/v1/dashboards/:dashboardId/widgets` lists persisted widget instances for a dashboard
- `POST /api/v1/dashboards/:dashboardId/widgets` creates widget instances using server-side widget defaults
- `PATCH /api/v1/dashboards/:dashboardId/widgets/:widgetId` persists widget layout and configuration
- `GET /api/v1/reference/cities` searches a reference-city catalog for weather widget location configuration

Reference-city imports are designed around the GeoNames `cities5000` open dataset so weather configuration stays independent of any single weather provider.

Widget definitions remain code-owned rather than database-owned. The backend currently uses a server-side widget definition catalog to validate widget types, choose default layout values, and provide explicit empty or configuration-required states while snapshot-backed content is pending.

The current-user bootstrap path now preserves saved profile fields such as display name, timezone, preferred language, avatar URL, and Telegram delivery preferences instead of overwriting them on every sign-in.

## Related Diagrams

- Data model: `docs/diagrams/data-model.puml`
- Backend package diagram: `docs/diagrams/backend-package-diagram.puml`
