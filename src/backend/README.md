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
