# Backend Architecture

This document defines the proposed backend architecture for the Morning Briefing application before implementation begins. The backend will live under `src/backend`, expose a REST-only API to the UI, and persist data in PostgreSQL for local development and AWS RDS PostgreSQL in test and production.

## Goals

- Keep the frontend and backend decoupled through a stable REST API.
- Support the current dashboard-and-widget editing UX without forcing the UI to understand backend internals.
- Cleanly separate dashboard configuration data from generated briefing content.
- Make local development simple while staying compatible with AWS deployment patterns.
- Leave room for asynchronous data ingestion and briefing generation as more widget types and connectors are added.

## Proposed Stack

- Runtime: Node.js 22 LTS
- Language: TypeScript
- Web framework: Fastify
- Validation and contracts: JSON Schema with Fastify request/response schemas
- Database: PostgreSQL
- Migrations: Prisma Migrate or Knex migrations
- Query layer: Prisma ORM
- Background jobs: a small in-process job runner for local development, with a clean abstraction so it can move to SQS/EventBridge/worker processes later
- Configuration: environment variables with typed config loading
- Logging: structured JSON logs with request IDs

TypeScript is recommended here even though the frontend is currently plain JavaScript. The backend will benefit from typed DTOs, schema-driven validation, and stronger refactoring support as the number of widget types and connector integrations grows.

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

## How The Current UI Maps To The Backend

The existing AngularJS UI already implies a few important backend requirements:

- Dashboards are user-facing named containers with description and theme metadata.
- Widgets are dashboard-scoped instances, not abstract widget definitions.
- Widget layout is freeform, so absolute `x`, `y`, `width`, and `height` must be persisted.
- Widget type definitions remain code-owned in the application layer, while widget instance configuration belongs in the database.
- Widget display content should come from snapshot data or connector-backed reads, not be mixed into widget configuration rows.
- Connector management needs both creation from task-widget flows and a dedicated page for later credential edits.

That last point is the main reason to keep both `dashboard_widget.config_json` and `widget_snapshot.content_json`. One stores configuration; the other stores rendered content for a specific briefing run.

## Proposed Backend Module Layout

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

## Data Model Guidance

The existing model in `docs/diagrams/data-model.puml` is a solid start, but it benefits from a few changes:

### Recommended adjustments

- Rename `Widget` to `DashboardWidget` to distinguish persisted widget instances from code-defined widget types.
- Keep widget type definitions out of the database for now; the frontend already models them as a registry owned by application code.
- Add a `version` field to `Dashboard` and `DashboardWidget` for optimistic concurrency and safe edit/save flows.
- Keep connector secrets outside Postgres; store only a `secret_ref` that points to local secret storage in development and AWS Secrets Manager or SSM in cloud environments.
- Treat `BriefingSnapshot` and `WidgetSnapshot` as generated, mostly immutable records.
- Add uniqueness around one daily snapshot per `(user_id, dashboard_id, snapshot_date)`.

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

### Current queue-based implementation

The codebase now uses an AWS-managed, serverless-first generation pipeline:

- widget configuration changes enqueue `GenerateWidgetSnapshotRequested` messages to SQS Standard
- admin dashboard audio regeneration enqueues `GenerateDashboardAudioBriefingRequested` messages to the same queue
- EventBridge Scheduler is intended to trigger a nightly enqueue function that lists eligible widgets and enqueues one message per widget
- Lambda is the initial worker runtime, but the consumer logic is written as a transport-agnostic processor so it can move to ECS/Fargate later
- `snapshot_generation_jobs` persists idempotency, attempt counts, and skip/failure state
- workers detect stale widget jobs by comparing the queued widget config version/hash with the current widget row before generating anything
- a DLQ receives messages that exhaust SQS retries

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
5. OpenAI generates a structured JSON script contract.
6. AWS Polly converts the full script into audio and stores the generated file.
7. The dashboard UI fetches the latest saved briefing metadata and plays the stored audio artifact.

### Design rules

- Audio Briefing must use backend snapshot data, not rendered DOM text.
- Widget eligibility is controlled at two levels:
  - code-owned widget type defaults
  - per-widget instance overrides persisted on `dashboard_widgets`
- Briefing preferences are dashboard-scoped and stored separately from widget configuration.
- Tenant-scoped AI configuration is stored separately from both widget configuration and briefing preferences.
- Manual regeneration belongs to admin tooling or scheduled jobs, not the end-user dashboard.
- Manual audio regeneration is queue-backed so the HTTP request only enqueues work and the worker performs the heavy generation.
- Cache reuse is based on a source hash built from the included widget snapshot identities and the current dashboard briefing preferences.

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
- AWS test/prod: AWS Secrets Manager or SSM Parameter Store

## Authentication And Multi-Tenancy

The existing data model is tenant-aware, so the backend should preserve that boundary from the start even if MVP auth is simple.

Recommended approach:

- Introduce an authentication middleware that resolves a current user and tenant context.
- Use that context in every repository query.
- Start with a development-friendly auth stub if needed, but keep the interface compatible with future JWT or OIDC integration.

## Operational Approach

### Local development

- Backend runs locally against local PostgreSQL.
- Migrations create the full schema.
- Seed data provides one tenant, one user, one dashboard, and sample widgets.
- Background jobs can run in-process on a simple interval or triggered by explicit endpoints.

### Test and production

- Stateless Node.js app instances
- PostgreSQL on AWS RDS
- Secrets outside the database
- Background execution moved behind a queue or scheduled runner when needed

## Non-Functional Requirements

- Every endpoint validates inputs and outputs.
- All writes are auditable through timestamps and request logging.
- API responses should be stable enough for the AngularJS UI to consume without extra mapping complexity.
- The backend should degrade gracefully when connector sync fails by returning the last successful snapshot where possible.
- Database migrations must be the only supported path for schema changes.

## Recommended First Development Sequence

1. Create the `src/backend` scaffold with Fastify bootstrapping and config loading.
2. Add PostgreSQL connectivity, migrations, and seed data.
3. Implement dashboard and widget REST endpoints first.
4. Update the UI to replace in-memory services with HTTP-backed services.
5. Add snapshot read endpoints.
6. Add connector management and a first end-to-end generator for the weather widget.

## Implemented So Far

- `GET /api/v1/me` resolves a temporary default local user named `Ralfe`
- `GET /api/v1/dashboards` lists that user's dashboards
- `POST /api/v1/dashboards` creates dashboards for that user
- `PATCH /api/v1/dashboards/:dashboardId` updates dashboard metadata
- `GET /api/v1/dashboards/:dashboardId/widgets` lists persisted widget instances for a dashboard
- `POST /api/v1/dashboards/:dashboardId/widgets` creates widget instances using server-side widget defaults
- `PATCH /api/v1/dashboards/:dashboardId/widgets/:widgetId` persists widget layout and configuration
- `GET /api/v1/reference/cities` searches a reference-city catalog for weather widget location configuration

Reference-city imports are designed around the GeoNames `cities5000` open dataset so weather configuration stays independent of any single weather provider.

Widget definitions remain code-owned rather than database-owned. The backend currently uses a server-side widget definition catalog to validate widget types, choose default layout values, and provide mock content until snapshot-backed content is introduced.

## Related Diagrams

- Data model: `docs/diagrams/data-model.puml`
- Backend package diagram: `docs/diagrams/backend-package-diagram.puml`
