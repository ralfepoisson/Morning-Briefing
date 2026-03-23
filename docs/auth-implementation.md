# Auth Service Integration

This document describes the working authentication integration between Morning Briefing and the central Life2 auth service. It is intended as a reusable implementation guide for other frontend/backend projects that need to delegate sign-in to the same auth system and get it working first try.

## Overview

Morning Briefing does not authenticate users directly with Cognito. Instead, it delegates sign-in to the shared Life2 auth service.

The working flow is:

1. The SPA detects that the user is unauthenticated.
2. The SPA redirects the browser to the central auth UI.
3. The auth service signs the user in with Cognito.
4. The auth service exchanges the Cognito token for a Life2 JWT.
5. The auth service redirects back to the SPA callback route with the Life2 JWT.
6. The SPA validates and stores the JWT in `localStorage`.
7. The SPA includes the JWT in the `Authorization` header on API requests.
8. The backend validates the JWT on protected routes and derives the current app user from it.

## Required Redirect Contract

Use a dedicated SPA callback route:

```text
http://localhost:8080/#/auth/callback?token=<life2_jwt>
```

Do not rely on a generic root URL such as `/?token=...` if the application uses hash routing. Using a dedicated callback route avoids stale hash fragments like `#/signed-out` interfering with the login handoff.

## Required JWT Shape

The token returned to the application must be the exchanged Life2 JWT, not the raw Cognito access token.

The JWT must contain at least:

- `userid`
- `accountId`
- `exp`

The frontend/backend implementation also tolerates common variants:

- user id: `userid`, `userId`, or `sub`
- account id: `accountId`, `accountid`, `tenantId`, or `tenantid`
- values may be strings or numbers

Example acceptable payload:

```json
{
  "userid": "user-123",
  "accountId": "account-456",
  "displayName": "Jane Doe",
  "email": "jane@example.com",
  "exp": 1774318163
}
```

Example of a token that will fail:

```json
{
  "iat": 1774274963,
  "nbf": 1774274963,
  "exp": 1774318163,
  "aud": "account",
  "iss": "life2.ralfe.me"
}
```

That token is missing user/account identity claims, so the app correctly treats it as invalid.

## Frontend Implementation

Frontend code lives under `src/web/`.

### Runtime configuration

Relevant config is loaded from:

- [`src/web/config.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/config.js)
- [`cicd/ci/build-frontend.sh`](/Users/ralfe/Dev/Morning-Briefing/cicd/ci/build-frontend.sh)

Supported settings:

- `apiBaseUrl`
- `authServiceSignInUrl`
- `authServiceSignOutUrl`
- `appBaseUrl`

Example local config:

```js
window.__MORNING_BRIEFING_CONFIG__ = Object.assign({
  apiBaseUrl: 'http://127.0.0.1:3000/api/v1',
  authServiceSignInUrl: 'http://localhost:63431/signIn',
  authServiceSignOutUrl: 'http://localhost:63431/signOut',
  appBaseUrl: 'http://localhost:8080'
}, window.__MORNING_BRIEFING_CONFIG__ || {});
```

### Callback route

The AngularJS route is defined in:

- [`src/web/app/app.routes.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/app.routes.js)

Route:

- `/#/auth/callback`

This route exists only to receive and complete the auth handoff.

### Early token capture before Angular routing

The most important reliability detail is that token capture happens before Angular bootstraps:

- [`src/web/app/bootstrap-auth.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/bootstrap-auth.js)

This file:

- reads `token` from the URL immediately
- validates the decoded payload shape
- stores the JWT and parsed session in `localStorage`
- removes `token` from the URL
- purges expired stored tokens on load

This avoids race conditions where Angular route guards can fire before the token has been persisted.

### Auth service

Main frontend auth logic lives in:

- [`src/web/app/core/services/auth.service.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/core/services/auth.service.js)

Responsibilities:

- restore session from `localStorage`
- validate JWT payload shape and expiry
- expose auth state to the SPA
- build redirect URL to the auth service
- handle sign-out
- expose the stored token for API calls
- keep the last auth error for troubleshooting

Stored keys:

- `morningBriefing.auth.token`
- `morningBriefing.auth.session`
- `morningBriefing.auth.returnPath`
- `morningBriefing.auth.error`

### HTTP auth header injection

All API calls include the JWT using:

- [`src/web/app/core/services/auth-http.interceptor.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/core/services/auth-http.interceptor.js)

Behavior:

- adds `Authorization: Bearer <jwt>` on outgoing requests
- if the backend returns `401`, the SPA signs the user out cleanly

### Route guard and post-login redirect behavior

App startup logic is in:

- [`src/web/app/app.run.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/app.run.js)

Behavior:

- restores session on boot
- redirects unauthenticated users to the auth service
- redirects authenticated users away from public auth pages
- normalizes the post-login path so users never get stuck on `#/signed-out`

### Callback and signed-out pages

Files:

- [`src/web/app/features/auth/auth-callback-page.component.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/features/auth/auth-callback-page.component.js)
- [`src/web/app/features/auth/auth-status-page.component.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/features/auth/auth-status-page.component.js)

Behavior:

- callback page consumes the token and routes into the app
- signed-out page shows the most recent auth error
- signed-out page also self-heals by redirecting into the app if a valid session already exists

## Backend Implementation

Backend code lives under `src/backend/`.

### Global auth enforcement

Protected API routes are guarded in:

- [`src/backend/src/app/build-app.ts`](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/app/build-app.ts)

Behavior:

- all `/api/v1/*` routes require auth
- exceptions:
  - `/api/v1/connections/google-calendar/oauth/start`
  - `/api/v1/connections/google-calendar/oauth/callback`
- missing or invalid bearer tokens return `401`

### JWT validation and user derivation

Main backend auth logic lives in:

- [`src/backend/src/modules/default-user/default-user-service.ts`](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/modules/default-user/default-user-service.ts)

Responsibilities:

- extract bearer token from the request
- validate token structure
- validate `exp` and `nbf`
- validate required identity claims
- optionally verify the JWT signature
- derive a deterministic tenant id and user id from Life2 claims
- upsert the corresponding tenant/user rows in the application database

Supported signature verification config:

- `LIFE2_JWT_SECRET` for `HS256`
- `LIFE2_JWT_PUBLIC_KEY` for `RS256`

If neither is configured, the backend still validates token shape and expiry, but not the signature.

### Route integration

Backend route modules pass the request into the user service so the current app user is derived from the JWT.

Examples:

- dashboards
- widgets
- RSS feeds
- snapshots
- connectors
- admin widgets

## Redirect URL Construction

The SPA sends users to the central auth UI using:

```text
{AUTH_SERVICE_SIGN_IN_URL}?redirect={APP_BASE_URL}/#/auth/callback
```

Example local redirect:

```text
http://localhost:63431/signIn?redirect=http%3A%2F%2Flocalhost%3A8080%2F%23%2Fauth%2Fcallback
```

The auth service must then redirect back to:

```text
http://localhost:8080/#/auth/callback?token=<life2_jwt>
```

## Local Storage vs Cookie

This implementation uses `localStorage` for the application JWT.

Reasons:

- simple to integrate into a static SPA
- easy to restore on refresh
- works cleanly with cross-origin redirect-based sign-in
- explicit control over when the token is attached to backend API requests

Important note:

Switching from query parameters to cookies would not have fixed the main issue encountered during implementation. The biggest failure mode was not transport, but receiving the wrong token contents from the auth service. If the wrong JWT is stored in a cookie instead of a query param, the app will still reject it.

For this implementation, the most important part is:

- correct Life2 JWT contents
- dedicated callback route
- early token capture before Angular routing

## Failure Modes We Hit

These are the main issues encountered while making the integration reliable.

### 1. Wrong token type returned from auth service

Symptom:

- app keeps redirecting back to auth service or lands on signed-out

Cause:

- auth service returned a generic token without `userid` and `accountId`

Fix:

- make sure the auth service returns the exchanged Life2 JWT

### 2. Callback URL with mixed query/hash behavior

Symptom:

- token appears in the URL, but Angular never fully accepts the login

Cause:

- redirecting to `/?token=...` while the app uses hash routing

Fix:

- standardize on `/#/auth/callback?token=...`

### 3. Angular route guard race

Symptom:

- browser lands on the app with a token but immediately redirects away

Cause:

- route guard ran before the token had been stored

Fix:

- capture/store the token before Angular boot in `bootstrap-auth.js`

### 4. Stale `#/signed-out` hash after successful login

Symptom:

- token arrives successfully, but the user still sees the signed-out screen

Cause:

- the browser kept the old hash route from before the redirect

Fix:

- redirect authenticated users away from public auth pages
- make the signed-out page self-heal if auth already succeeded

### 5. Numeric identity claims

Symptom:

- valid token rejected even though user/account information is present

Cause:

- claim parsing assumed string values only

Fix:

- normalize user/account claims as strings even when the JWT contains numeric values

## Recommended Integration Checklist

Use this checklist in a new project.

1. Add a dedicated callback route: `/#/auth/callback`.
2. Redirect unauthenticated users to the central auth UI.
3. Pass `redirect={appBaseUrl}/#/auth/callback`.
4. Ensure the auth service returns a Life2 JWT with `userid`, `accountId`, and `exp`.
5. Capture/store the token before SPA routing starts.
6. Store the token in `localStorage`.
7. On initial app load, restore the token from `localStorage` and reject expired sessions.
8. Attach the token as `Authorization: Bearer <jwt>` on every backend API request.
9. Reject unauthenticated or invalid tokens in the backend before protected route handlers run.
10. Redirect authenticated users away from public auth routes such as `#/signed-out`.
11. Surface the last auth failure reason in the UI during integration/debugging.
12. Configure backend signature verification with `LIFE2_JWT_SECRET` or `LIFE2_JWT_PUBLIC_KEY`.

## Files To Reuse As Reference

Frontend:

- [`src/web/app/bootstrap-auth.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/bootstrap-auth.js)
- [`src/web/app/core/services/auth.service.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/core/services/auth.service.js)
- [`src/web/app/core/services/auth-http.interceptor.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/core/services/auth-http.interceptor.js)
- [`src/web/app/app.run.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/app.run.js)
- [`src/web/app/app.routes.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/app.routes.js)
- [`src/web/app/features/auth/auth-callback-page.component.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/features/auth/auth-callback-page.component.js)
- [`src/web/app/features/auth/auth-status-page.component.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/features/auth/auth-status-page.component.js)

Backend:

- [`src/backend/src/app/build-app.ts`](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/app/build-app.ts)
- [`src/backend/src/modules/default-user/default-user-service.ts`](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/modules/default-user/default-user-service.ts)

Build/runtime config:

- [`src/web/config.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/config.js)
- [`cicd/ci/build-frontend.sh`](/Users/ralfe/Dev/Morning-Briefing/cicd/ci/build-frontend.sh)

## Final Recommendation

If you are integrating the Life2 auth service into another SPA project, the highest-signal advice is:

- use `/#/auth/callback`
- require a Life2 JWT with explicit user/account claims
- capture the token before the SPA router boots
- store it in `localStorage`
- attach it as a bearer token to backend API requests
- validate it again on the backend for every protected request

If those six pieces are in place, the integration should be straightforward and reproducible.
