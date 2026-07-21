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
- `migrate`: a one-shot backend-image service running `npm run db:deploy`; normal release never runs `db:seed:prod`
- `widget-refresh` and `dashboard-audio-refresh`: one-shot backend-image services invoked by systemd timers
- PostgreSQL: existing external Docker network `personal-projects-postgresql`; no application-controlled PostgreSQL container and no public database port
- persistent audio: one protected host directory mounted at the same `AUDIO_BRIEFING_STORAGE_DIR` in backend and worker and included in off-host backups
- SQS/DLQ, Polly, provider APIs, and Life2 Auth remain external services

Apache listens on host port `8080` behind the shared WAF-protected ALB. For the `briefing.ralfepoisson.com` virtual host, Apache proxies `/api/*` to the loopback backend and all other paths to the loopback frontend. The ALB terminates TLS; Apache does not. Preserve these paths exactly:

- `/api/v1/connections/google-calendar/oauth/callback`
- `/api/v1/connections/gmail/oauth/callback`
- `/#/auth/callback` for the SPA Life2 Auth handoff

## Container and host controls

Production services must use:

- `linux/arm64` images pinned by ECR digest, never `latest` or a mutable tag
- an internal application network plus a separate egress-capable bridge for backend/worker/provider access; the external PostgreSQL network remains internal
- explicit health checks, restart policies, bounded logs, `init`, PID/CPU/memory limits, and `no-new-privileges`
- read-only root filesystems and dropped capabilities where compatible with runtime behavior
- independent backend and worker restart/resource boundaries
- a root-owned or otherwise tightly scoped secret source outside Git and image layers
- narrowly scoped instance-role access for the two queue ARNs, required secret ARNs, ECR pull, and Polly/SES only where the relevant process requires them

The backend and worker environment manifests are separate. Worker-side connector refresh needs Google OAuth configuration as well as database, queue, provider, and audio settings. Secret values must never appear in release manifests, logs, shell traces, task definitions, or command output.

## CI and immutable build

The intended local-Mac workflow is CI-system agnostic:

1. `scripts/ci.sh` verifies repository identity and requires a clean release commit.
2. Install locked dependencies and run lint/type checks, backend tests, frontend tests/build, Prisma validation and migration checks.
3. Run integration tests against disposable real PostgreSQL and SQS-compatible infrastructure; mocks remain limited to unit tests.
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

Keep at least two prior release manifests and their image digests. Secret files are not copied into release directories. The `current` symlink changes atomically only after all validation succeeds.

## Deployment transaction

The approved host deploy must:

1. Acquire a global `flock` and fail cleanly if another deploy is active.
2. Verify account, region, manifest schema, full commit SHA, digest-pinned images, Compose checksum, required secrets, directories, and Docker networks.
3. Pull images using the instance role.
4. Create a named pre-migration PostgreSQL backup and retain its checksum and migration status.
5. Run `prisma migrate status`, then `npm run db:deploy` as a one-shot container.
6. Start candidate frontend and backend without switching public traffic.
7. Keep candidate worker and timers disabled until writer handoff, unless they use an isolated database and queue.
8. Verify container health, logs, direct loopback endpoints, local Apache routing, and a pinned-host shared-ALB route.
9. Perform a deliberate writer handoff: stop legacy EventBridge schedules and the ECS worker before enabling host timers/worker against production queues and database.
10. Prove one queue message is processed exactly once or retried/redriven according to policy.
11. Switch `current` atomically only after success and record the deployment without secrets.

Database readiness must be distinct from liveness. A process that returns HTTP 200 while its configured database endpoint is gone is not ready.

## Scheduling

Use systemd timers to invoke one-shot Compose services:

- widget refresh: daily at `01:00` UTC
- dashboard audio refresh: daily at `05:00` UTC

Each timer uses `Persistent=true`, a non-overlap lock, bounded runtime, explicit failure status, and journal/monitoring integration. After installation, prove missed executions run once after reboot and that two overlapping invocations cannot execute concurrently.

The host application tree is deliberately root-owned and not traversable by the login account. Scheduled services therefore use a narrow root-owned oneshot boundary to reach the immutable release and the Docker socket; the application command itself still runs inside the backend image as its non-root UID. The units set `UMask=0077`, `NoNewPrivileges=true`, and systemd filesystem protections. Every deployment reinstalls the four root-owned unit files and reloads systemd without changing timer enablement, preserving the writer-handoff decision. Runtime secret files remain root-owned mode `0600` and are consumed by Compose; they are never made group- or world-readable to solve path traversal.

Do not enable host timers while the corresponding EventBridge rules remain enabled against the same production database/queue. Duplicate schedulers or consumers can create duplicate Telegram and audio effects even when database writes are idempotent.

## Required health and functional checks

Before cutover:

- frontend and backend loopback endpoints are healthy
- backend readiness confirms PostgreSQL and required configuration
- worker remains stable while idle and can process a controlled real SQS message
- source queue retry, visibility extension, stale-job handling, idempotency, and DLQ behavior are proven
- audio persists across backend and worker container replacement
- Apache returns the SPA for frontend paths and routes `/api/*` to the backend
- public/pinned-host paths preserve Life2 Auth, Google Calendar OAuth, Gmail OAuth, and SPA callbacks
- dashboard, widget refresh, snapshot generation, audio generation, Polly, Telegram, and SES/contact delivery receive representative real checks
- a host reboot restores all enabled services and persistent timers

## Rollback

`scripts/rollback.sh <release>` restores the previous Compose configuration and exact image digests, waits for health, rechecks Apache routes, and leaves an audit record. A failed pre-switch release leaves `current` untouched.

Rollback is not automatically safe after every database migration. Each migration must be classified before deployment:

- backward-compatible/additive: application rollback may be allowed
- destructive or contract-breaking: stop and require a documented database restoration/forward-fix decision

Never automatically restore a database backup over a live database with writers attached.

## Legacy retirement

The old ECS services, EventBridge rules, ALB, VPC resources, and drifted CloudFormation stack remain rollback assets until an explicitly approved retirement phase. Reconcile the template and resource ownership before any stack update. No old resource is deleted merely because host cutover succeeds.
