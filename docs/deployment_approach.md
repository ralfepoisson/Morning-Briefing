# Deployment Approach

This document defines the intended production deployment for Morning Briefing on the consolidated personal-projects EC2 host. It is a design and release runbook, not authorization to change production.

## Live-phase gate

Repository implementation, tests, image publication, and preparation of release artifacts may proceed independently. The following remain explicitly gated on approval in the active session:

- changing live AWS, DNS, ALB, IAM, Secrets Manager, SQS, or EventBridge resources
- uploading or activating a release on the EC2 host
- starting a candidate production worker or production timers
- running migrations against the restored production database
- stopping ECS services or EventBridge schedules
- deleting the drifted legacy stack or any of its resources

The existing `cicd/serverless` deployment is legacy. It still describes the ECS/Fargate deployment and a CloudFormation-owned RDS instance that has been deleted outside CloudFormation. Do not run `cicd/run_cicd.sh` with real credentials: the legacy runner exports and prints credential values, deploys the drifted stack, runs the production seed, and can leave services scaled to zero after a migration failure.

## Verified current state

Read-only discovery on 2026-07-20 established:

- AWS account `154596858576`, region `eu-west-1`
- three running ARM64 Fargate services: backend, worker, and frontend
- both backend and worker still reference the deleted RDS endpoint, so running task count is not proof of application health
- SQS queue `morning-briefing-prod-snapshot-jobs` with a DLQ, 120-second visibility timeout, five-receive redrive, and server-side encryption
- enabled EventBridge schedules at `01:00` UTC for widget refresh and `05:00` UTC for dashboard audio refresh
- mutable ECR repositories `morning-briefing-prod-backend` and `morning-briefing-prod-frontend`
- drifted stack `morning-briefing-platform-prod`; the deleted database and retained ECR/SQS/ALB/ECS resources remain represented in the stack
- restored PostgreSQL 18.4 database `morning_briefing` on the target host with 19 tables and 92,767 rows
- no `/srv/apps/morning-briefing` release, Apache Morning Briefing route, or Morning Briefing systemd timer yet
- target host role currently lacks Morning Briefing ECR, SQS, Secrets Manager, and Polly permissions

## Target production topology

The target is Docker Compose on private ARM64 EC2 instance `i-05e1df0a77863016d`, reached administratively as `ssh personal-projects`.

- `frontend`: framework-free strict TypeScript SPA built with Vite 8 and served as static assets by a minimal Nginx container on a loopback-only port
- `backend`: one stateless Node/Fastify container on a loopback-only port, serving `/api/v1` and a readiness endpoint that verifies required dependencies
- `worker`: a separately managed container using the exact backend image digest and `npm run snapshot:worker:prod`
- `rabbitmq`: a private, host-local broker container with durable exchanges and queues, persistent messages, publisher confirms, manual consumer acknowledgements, bounded prefetch, retry queues, and dead-letter routing
- `migrate`: a one-shot backend-image service running `npm run db:deploy`; normal release never runs `db:seed:prod`
- `widget-refresh` and `dashboard-audio-refresh`: one-shot backend-image services invoked by systemd timers
- PostgreSQL: existing external Docker network `personal-projects-postgresql`; no application-controlled PostgreSQL container and no public database port
- persistent audio: one protected host directory mounted at the same `AUDIO_BRIEFING_STORAGE_DIR` in backend and worker and included in off-host backups
- RabbitMQ data: the protected bind mount `/srv/apps/morning-briefing/data/rabbitmq` on the retained 200 GB `/srv` volume, outside release directories and included in backup and restore checks; never use an anonymous or Docker-root named volume on the 40 GB OS disk
- Polly, CloudWatch Logs, provider APIs, and Life2 Auth remain external services

RabbitMQ replaces SQS as the production application message transport after the separately approved writer cutover. Backend and worker remain separate processes: the backend and scheduled one-shots publish persistent commands, while the worker is the only consumer. The broker must not publish AMQP or management ports publicly. It joins only the private application network, persists its data outside immutable releases, and reports healthy only after RabbitMQ diagnostics confirm that it can serve connections. On a fresh data directory, backend readiness idempotently creates-or-verifies the durable direct exchange, quorum main/retry/DLQ queues, retry TTL/dead-letter arguments, and bindings before reporting ready; subsequent publisher and worker connections assert the identical topology. Durable storage protects against container replacement; it does not replace an off-host backup or provide host-level high availability.

The two scheduled Compose producers are bounded one-shot processes: after confirmed publication they close their AMQP channel and connection and disconnect their database client in `finally`, including failure paths. The worker does not share this lifecycle and keeps its reconnecting consumer session open. Release integration tests execute both production producer entrypoints against real RabbitMQ and PostgreSQL and fail if either remains running beyond 15 seconds after enqueue completion.

Delivery remains at least once. Publishers wait for broker confirms, consumers acknowledge only after the database-backed job transition and required side effects complete, retry delivery is bounded, and exhausted messages route to a durable dead-letter queue. Existing PostgreSQL generation-job records remain the idempotency authority across redelivery, worker restart, deployment, and rollback.

Apache listens on host port `8080` behind the shared WAF-protected ALB. For the `briefing.ralfepoisson.com` virtual host, Apache proxies `/api/*` to the loopback backend and all other paths to the loopback frontend. The ALB terminates TLS; Apache does not. Preserve these paths exactly:

- `/api/v1/connections/google-calendar/oauth/callback`
- `/api/v1/connections/gmail/oauth/callback`
- `/#/auth/callback` for the SPA Life2 Auth handoff

## Container and host controls

Production services must use:

- `linux/arm64` images pinned by ECR digest, never `latest` or a mutable tag
- an internal application network plus a separate egress-capable bridge for backend/worker/provider access; the external PostgreSQL network remains internal
- explicit health checks, restart policies, CloudWatch logging, `init`, PID/CPU/memory limits, and `no-new-privileges`
- read-only root filesystems and dropped capabilities where compatible with runtime behavior
- independent backend and worker restart/resource boundaries
- a root-owned or otherwise tightly scoped secret source outside Git and image layers
- narrowly scoped instance-role access for ECR pull, CloudWatch log streams, and Polly/SES only where the relevant process requires them

The backend, worker, and broker environment manifests are separate. Their secret inputs live only in root-owned, root-group, non-symlink regular files at exact mode `0600`:

- `/srv/apps/morning-briefing/secrets/backend.env`
- `/srv/apps/morning-briefing/secrets/worker.env`
- `/srv/apps/morning-briefing/secrets/rabbitmq.env`

These files remain outside releases, images, Git, and generated artifacts. Backend and worker files contain only the credentials each process requires, including the database and broker connection material and relevant OAuth, JWT, delivery, or provider secrets. The broker file contains its bootstrap username, password, and Erlang cookie. Public URLs, regions, queue/exchange names, retry limits, ports, and log-group names belong in the non-secret shared configuration or secret-free `release.env`. Production uses the EC2 instance role rather than static AWS access keys. Secret values must never appear in release manifests, Compose command output, logs, shell traces, task definitions, or command output.

Docker sends frontend, backend, worker, RabbitMQ, migration, and scheduled-job output through the `awslogs` driver to the existing retained seven-day group `/personal-projects/morning-briefing`. All four `*_AWSLOGS_GROUP` release variables should resolve to that same group. Native Docker uses explicit `awslogs-stream` values—not the ECS-only `awslogs-stream-prefix` option—with deterministic names `morning-briefing-frontend`, `morning-briefing-backend`, `morning-briefing-worker`, `morning-briefing-rabbitmq`, `morning-briefing-migrate`, `morning-briefing-snapshot-refresh`, and `morning-briefing-dashboard-audio-refresh`. The project infrastructure does not create or manage the group or its retention; the host role may create streams and publish events to its supplied ARN but must not create groups or alter retention. A missing group or insufficient logging permission is a deployment preflight failure, not a reason to fall back silently to local unbounded logs.

## CI and immutable build

The intended local-Mac workflow is CI-system agnostic:

1. `scripts/ci.sh` verifies repository identity and requires a clean release commit.
2. Install locked dependencies and run lint/type checks, backend tests, frontend tests/build, Prisma validation and migration checks.
3. Run integration tests against disposable real PostgreSQL and RabbitMQ infrastructure; mocks remain limited to unit tests.
4. Build and smoke-test backend and frontend images for `linux/arm64`.
5. Tag each image `git-<full-commit-sha>`, push to ECR, and resolve the registry digests.
6. Produce a secret-free manifest containing commit SHA, both image digests, Compose checksum, migration identifier, and UTC timestamp.

ECR ownership and retention must be moved out of the drifted legacy stack before that stack is removed. Repository tag immutability and an intentional lifecycle policy should be configured during an approved infrastructure phase.

The backend and frontend build stages use a digest-pinned Node 24 LTS base. Any future runtime change must pass backend, frontend, Prisma, container, and ARM64 smoke tests before the pinned digest changes.

## Host release layout

Releases are immutable directories:

```text
/srv/apps/morning-briefing/
  releases/<git-sha>/
    release-manifest.json
    release.env
    cicd/compose/compose.yaml
    cicd/host/
    scripts/lib/
  current -> releases/<healthy-git-sha>
  secrets/
  shared/config/
  data/audio/
  backups/
  locks/
```

Keep at least two prior release manifests and their image digests. Secret files are not copied into release directories. The `current` symlink changes atomically only after all validation succeeds. Runtime data directories are created first, then assigned their container numeric UID/GID and mode `0750`; no matching host passwd or group entry is required.

## Deployment transaction

The approved host deploy must:

1. Acquire a global `flock` and fail cleanly if another deploy is active.
2. Verify account, region, manifest schema, full commit SHA, digest-pinned images, Compose checksum, root ownership and exact `0600` mode for all three secret files, the existing retained CloudWatch log group and scoped write permission, directories, persistent broker storage, and Docker networks.
3. Pull images using the instance role.
4. Create a named pre-migration PostgreSQL backup and retain its checksum and migration status.
5. Run `prisma migrate status`, then `npm run db:deploy` as a one-shot container.
6. Start candidate frontend and backend without switching public traffic.
7. Start RabbitMQ and verify broker diagnostics, durable topology, persistent storage, CloudWatch logging, and a controlled publish/consume cycle; keep the candidate worker and timers disabled until writer handoff.
8. Verify container health, logs, direct loopback endpoints, local Apache routing, and a pinned-host shared-ALB route.
9. Perform the deliberate SQS-to-RabbitMQ writer handoff described below; never allow legacy SQS and host RabbitMQ consumers or schedulers to write concurrently.
10. Prove a RabbitMQ command is confirmed, processed and acknowledged, and prove retry, dead-letter, redelivery, idempotency, and worker-restart behavior.
11. Switch `current` atomically only after success and record the deployment without secrets.

Database readiness must be distinct from liveness. A process that returns HTTP 200 while its configured database endpoint is gone is not ready.

The publisher never writes directly beneath `/srv/apps` as the SSH login user. It creates a deterministic release bundle, computes its SHA-256 locally, uploads only that mode-`0600` bundle into a user-owned staging directory under the remote home, and sends the trusted checksum and Git SHA to the checked-in activator through `sudo -n bash -s`. The root activator first copies the archive out of the user-controlled directory, verifies the bundle checksum, rejects unsafe paths and links, validates the release manifest and Compose checksum, and only then atomically installs a root-owned immutable release. It enters the existing deploy script as root, where the global lock, backup, health, and rollback transaction remain authoritative. The user staging directory is removed after either success or failure; `/srv/apps` stays mode `0700` and runtime secrets stay mode `0600`.

## Scheduling

Use systemd timers to invoke one-shot Compose services:

- widget refresh: daily at `01:00` UTC
- dashboard audio refresh: daily at `05:00` UTC

Each timer uses `Persistent=true`, a non-overlap lock, bounded runtime, explicit failure status, and journal/monitoring integration. After installation, prove missed executions run once after reboot and that two overlapping invocations cannot execute concurrently.

The host application tree is deliberately root-owned and not traversable by the login account. Scheduled services therefore use a narrow root-owned oneshot boundary to reach the immutable release and the Docker socket; the application command itself still runs inside the backend image as its non-root UID. The units set `UMask=0077`, `NoNewPrivileges=true`, and systemd filesystem protections. Every deployment reinstalls the four root-owned unit files and reloads systemd without changing timer enablement, preserving the writer-handoff decision. Runtime secret files remain root-owned mode `0600` and are consumed by Compose; they are never made group- or world-readable to solve path traversal.

Do not enable host timers while the corresponding EventBridge rules remain enabled against the same production database. Duplicate schedulers or consumers can create duplicate Telegram and audio effects even when database writes are idempotent.

## Required health and functional checks

Before cutover:

- frontend and backend loopback endpoints are healthy
- backend readiness confirms PostgreSQL and required configuration
- RabbitMQ survives container replacement with durable exchanges, queues, bindings, messages, and dead-letter state intact
- worker remains stable while idle and can process a controlled real RabbitMQ message
- publisher confirms, manual acknowledgement, redelivery, bounded retry, stale-job handling, idempotency, and dead-letter behavior are proven
- Docker logs reach distinct service streams in the existing `/personal-projects/morning-briefing` group and its retained seven-day policy remains unchanged
- audio persists across backend and worker container replacement
- Apache returns the SPA for frontend paths and routes `/api/*` to the backend
- public/pinned-host paths preserve Life2 Auth, Google Calendar OAuth, Gmail OAuth, and SPA callbacks
- dashboard, widget refresh, snapshot generation, audio generation, Polly, Telegram, and SES/contact delivery receive representative real checks
- a host reboot restores all enabled services and persistent timers

## Rollback

`scripts/rollback.sh <release>` crosses the same protected host path with `sudo -n`, then restores the previous Compose configuration and exact image digests under the deployment lock, waits for health, rechecks Apache routes, and leaves an audit record. A failed pre-switch release leaves `current` untouched.

RabbitMQ data is persistent shared state, not release content, so application rollback must never delete, recreate, or clear the broker volume. A rollback between two RabbitMQ-aware releases reuses the durable broker and must preserve compatible exchange, queue, retry, and dead-letter declarations. Before rolling back to an SQS-based release, stop RabbitMQ producers, timers, and consumers and verify that the ready, unacknowledged, retry, and dead-letter message counts are all reconciled. If RabbitMQ still contains work, refuse automatic rollback: drain it with the current worker or export and deliberately re-enqueue the commands with their original idempotency keys after review. Do not silently abandon or duplicate broker work.

Back up `/srv/apps/morning-briefing/data/rabbitmq` only with RabbitMQ stopped or by using a RabbitMQ-supported consistent backup procedure. Restore only while the broker service is stopped, preserve the broker node identity and Erlang cookie, then verify the restored directory is exactly mode `0750` and owned by numeric UID `100`, GID `101` before restart. After restart, require broker health plus durable exchange, queue, binding, retry, and dead-letter inventory checks before starting application producers or consumers.

Rollback is not automatically safe after every database migration. Each migration must be classified before deployment:

- backward-compatible/additive: application rollback may be allowed
- destructive or contract-breaking: stop and require a documented database restoration/forward-fix decision

Never automatically restore a database backup over a live database with writers attached.

## SQS-to-RabbitMQ cutover and data safety

The coordinating AWS task owns this live sequence. Repository validation alone does not authorize any step:

1. Take and checksum a PostgreSQL backup, back up the RabbitMQ data location, and record database generation-job counts by status plus SQS source/DLQ visible and in-flight counts.
2. Verify the existing `/personal-projects/morning-briefing` CloudWatch group still has seven-day retention, and install only the scoped host stream-write permission before starting any `awslogs` container; do not recreate or take ownership of the group.
3. Install the three root-owned `0600` secret files without printing their values. Validate broker credentials from inside the private Docker network; do not publish RabbitMQ ports.
4. Start RabbitMQ only, declare the durable exchange/queue/retry/dead-letter topology, and prove persistence across broker container replacement using a controlled non-production command.
5. Disable both legacy EventBridge schedules so no new scheduled work enters SQS. Keep the legacy ECS worker running until the SQS source queue has zero visible and zero in-flight messages for a deliberate quiet interval.
6. Reconcile the SQS DLQ and PostgreSQL job rows. Preserve failed commands and their idempotency keys for an explicit retry or disposition decision; do not copy messages blindly between brokers.
7. Stop the legacy ECS worker. Reconfirm that no legacy producer, consumer, or scheduler is active before enabling the host worker or timers.
8. Start the host backend and worker against RabbitMQ, publish one controlled command, and verify confirm, database idempotency, acknowledgement, retry/dead-letter behavior, persistent audio, and CloudWatch logs before enabling the host timers.
9. Record the cutover counts and timestamps. Retain the SQS queue, DLQ, EventBridge rules, ECS definitions, and legacy stack unchanged for at least 14 days and until the rollback acceptance window is explicitly closed. Leave schedules and services disabled, not deleted.
10. During that window, rollback to an SQS release only after RabbitMQ work is fully reconciled as described above. Re-enable legacy producers and consumers in a controlled order and confirm no host writer remains active.

The SQS source queue currently retains messages for four days and its DLQ for fourteen days. The fourteen-day resource-retention window is therefore a minimum operational observation period, not permission to discard unresolved DLQ entries. Extend the window whenever reconciliation, rollback confidence, or audit requirements remain open.

## Legacy OpenAI secret cutover

Live discovery found exactly one `tenant_ai_configurations` row, one non-null value, one distinct legacy `openai_api_key`, and an approved byte length of 164, without reading the value into task output. The coordinating task must move that value into the protected runtime files before deploying a release that requires `OPENAI_API_KEY`. Never retrieve it into a terminal, shell argument, task transcript, or release artifact.

Use the root-only `cicd/host/migrate-openai-secret.sh` from the verified candidate release directory. First run its `--dry-run` mode. It fails unless the table has exactly one row, one non-null value, and one distinct value; dry-run neither exports nor clears the secret. The full transaction then:

1. Acquires the normal deployment lock and revalidates both existing runtime files as root-owned, root-group, non-symlink exact-mode-`0600` files.
2. Uses PostgreSQL server-side `COPY` plus protected file transfer so the value never appears in stdout, stderr, or a command argument, and rechecks the approved 164-byte length.
3. Builds staged backend and worker files, atomically installs both as root:root `0600`, and restores both originals if any pre-clear step fails, including a failure between the two replacements.
4. Runs the actual `TenantAiConfigurationService` status semantics in one-shot backend and worker containers and requires `hasOpenAiApiKey=true`; a textual key-presence check alone is not the production gate.
5. Takes a custom-format PostgreSQL backup under `/srv/apps/morning-briefing/backups`, writes and verifies its SHA-256 checksum, and keeps both files root-only.
6. Only after the installed runtime and backup checks succeed, nulls `tenant_ai_configurations.openai_api_key` and requires the postcondition of one row, zero non-null values, and zero distinct values.

The utility never modifies a release directory. If the transaction fails before the database clear, investigate the reported gate and retain the checksummed backup; do not manually print or copy the value. If the clear succeeds but a later deployment fails, the protected env files and backup remain the recovery sources. Re-run the application configuration-status check after backend and worker recreation, then confirm the admin API reports only the boolean `hasOpenAiApiKey=true` and never the key itself.

## Legacy retirement

The old ECS services, EventBridge rules, SQS/DLQ, ALB, VPC resources, and drifted CloudFormation stack remain rollback assets until an explicitly approved retirement phase. Reconcile the template and resource ownership before any stack update. No old resource is deleted merely because host cutover succeeds or the minimum fourteen-day observation window elapses.

The Serverless Framework may maintain a CloudFormation deployment bucket for packaged templates and deployment artifacts. That bucket is deployment plumbing, not website hosting. The legacy live UI is the frontend Docker image from ECR, run by the ECS frontend service and reached through its ALB target group. Do not classify or delete the deployment bucket as an obsolete static website; retire it only as part of a reviewed legacy-stack ownership and rollback plan.
