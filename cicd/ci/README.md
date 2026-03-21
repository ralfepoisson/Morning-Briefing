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
- `Dockerfile.frontend` produces a static bundle and serves it with Nginx on port `8080`.
- The frontend bundle writes `config.js` with `apiBaseUrl: '/api/v1'`, which works behind the AWS Application Load Balancer path rule defined in `cicd/serverless/serverless.yml`.
