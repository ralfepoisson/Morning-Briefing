# CI Build And Docker Instructions

The scripts in this folder are CI-system agnostic so they can be called from GitHub Actions, GitLab CI, Jenkins, or a local release runner.

## Build steps

Backend:

```bash
./cicd/ci/build-backend.sh
```

Frontend:

```bash
./cicd/ci/build-frontend.sh
```

The frontend command installs the locked dependencies and runs the strict TypeScript/Vite 8 production build. Focused unit tests are run separately with:

```bash
npm --prefix src/web test
```

Both Docker images:

```bash
BACKEND_IMAGE_TAG=morning-briefing-backend:local \
FRONTEND_IMAGE_TAG=morning-briefing-frontend:local \
./cicd/ci/docker-build.sh
```

Push pre-built images:

```bash
./cicd/ci/docker-push.sh <backend-image> <frontend-image>
```

## Image behavior

- `Dockerfile.backend` builds the TypeScript backend, keeps Prisma CLI available for migrations, and exposes port `3000`.
- `Dockerfile.frontend` builds the framework-free TypeScript SPA with Vite 8, then serves only the generated static bundle from an unprivileged Nginx process on port `8080`.
- `render-frontend-config.mjs` writes `dist/config.js` after bundling. The default `apiBaseUrl` is `/api/v1`; on the consolidated host, Apache proxies that path to the loopback backend and all other paths to the frontend container.
- The frontend container exposes `/healthz`, serves SPA routes through the `index.html` fallback, and deliberately does not answer `/api/*` as application content.
- `cicd/serverless` is legacy deployment material and is not the routing authority for the consolidated-host release.
