# Daily Briefing login and logo repair — 2026-09-05

## Observed production failure

A signed-in Chrome session sends Authorization on `/api/v1/dashboards`.
The live API returns 401 with `Life2 token signature verification failed.`
The frontend retains its decoded session and leaves `Loading dashboard…` visible.
Read-only comparison on the production host confirms that the running Briefing
`LIFE2_JWT_SECRET` differs from the decoded running Auth
`LIFE2_JWT_SIGNING_KEY_BASE64`. Neither key was printed or copied locally.
Auth signs HS256 tokens; signature validation must remain enabled.

The requested `/assets/img/logo-dark.png` returns HTML via SPA fallback.
The same image exists at `/assets/assets/img/logo-dark.png`. Vite creates
`dist/assets` before the old recursive copy runs, causing the nested directory.

## Prepared local changes

- Copy static asset contents into `dist/assets` and verify every source asset
  at its expected production-relative path after building.
- Treat backend 401 as authoritative rejection: clear only the rejected token,
  cancel dashboard refresh, discard loaded dashboard state, and render a sign-in
  explanation without an automatic login loop.
- Catch route-load failures with an explicit retry view. Preserve sessions on
  403, service errors, and network failures.
- Verify both supported callback placements against a real signed-JWT backend,
  plus an intentionally incorrectly signed token against real verification.

## Production repair plan — awaiting authorization

1. Acquire the existing deployment lock; re-read running Auth/Briefing container
   identifiers, image digests, effective key configuration and Compose paths.
2. Save a mode-0600 backup of Briefing's backend secret file and record existing
   frontend/backend image digests and release configuration. Keep backups on host.
3. Set only Briefing's `LIFE2_JWT_SECRET` to the UTF-8-decoded active Auth signing
   key, using protected on-host memory and atomic file replacement. Do not rotate
   Auth's key or disable verification. Recreate only the Briefing backend using
   its existing pinned image and Compose environment; confirm readiness.
4. Package the reviewed frontend fix as an immutable ARM64 image and validate
   exact logo URLs and callback rejection behavior before activating it. The
   working checkout contains substantial unrelated uncommitted changes: do not
   publish the entire checkout as an incidental part of this repair. Match the
   candidate to the deployed source/release and include only reviewed fixes.
5. Verify fresh central login and a 200 dashboard response in the user's browser,
   then logo naturalWidth and response Content-Type. Do not count only container
   health or a parsed JWT as authenticated acceptance.

Rollback: restore the protected backend secret-file backup atomically and
recreate that service with the prior pinned image/configuration; restore the
prior frontend image digest. No database migration, worker restart, timer change,
identity change, or user-data modification is required by this repair.

No production configuration or image was changed during diagnosis/preparation.

## Local verification results

- Frontend unit tests: 7 files, 14 tests passed.
- Real PostgreSQL scratch database: all 19 migrations applied successfully.
- Real Fastify + built Vite browser checks: 3 passed (valid root callback,
  valid hash callback, incorrect signature rejection/clear/error UI and loaded logo).
  The backend verified real HMAC signatures; API responses were not intercepted.
- Static asset artifact regression: passed, after failing against the old nested layout.
- Frontend container/config contract tests: 4 passed.
- Backend build and frontend strict typecheck/build: passed.
- Local backend restarted on 127.0.0.1:3000 with local schedulers/workers disabled;
  rebuilt frontend preview started on 127.0.0.1:8080, configured for that local API.

Production remains unchanged. The browser's existing production session remains
available for post-repair verification. Unrelated checkout changes were preserved;
no repository commit, push, or release activation was performed.

## Production authorization

The user authorized production deployment on 2026-09-05. Release is based on
deployed commit 238accab0a3316969442d1ad09bb5b3f4e178d24 in an isolated worktree;
only frontend repair files, tests, and repair documentation are included.
Backend image, database schema, worker and timers remain unchanged.
