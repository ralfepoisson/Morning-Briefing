# Auth Service Integration

This document describes the current authentication integration between Morning Briefing and the central Life2 auth service. It is written as a practical reuse guide for other projects that want to delegate sign-in to the same auth service and avoid the failure modes discovered during this implementation.

## Summary

Morning Briefing does not sign users in directly with Cognito.

Instead:

1. The SPA redirects unauthenticated users to the central Life2 auth UI.
2. The auth service authenticates the user with Cognito.
3. The auth service exchanges the Cognito token for a Life2 JWT.
4. The auth service redirects back to the SPA callback route with that Life2 JWT.
5. The SPA validates the JWT payload, stores it in `localStorage`, and restores the authenticated session.
6. The SPA adds the JWT to backend API requests as `Authorization: Bearer <token>`.
7. The backend validates the JWT for protected API requests and derives the current app user from it.

## Required Redirect Contract

Use a dedicated SPA callback route:

```text
http://localhost:8080/#/auth/callback?token=<life2_jwt>
```

Do not use a generic root callback such as:

```text
http://localhost:8080/?token=<token>
```

This application uses hash routing. A dedicated `/#/auth/callback` route avoids stale hash fragments such as `#/signed-out` interfering with the login handoff.

## Required JWT Shape

The token returned to the application must be the exchanged Life2 JWT, not the raw Cognito access token.

The JWT must include identity claims. The implementation currently accepts:

- user id: `userid`, `userId`, or `sub`
- account id: `accountId`, `accountid`, `tenantId`, or `tenantid`
- expiry: `exp`

Claim values may be strings or numbers.

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

Example token that will fail:

```json
{
  "iat": 1774274963,
  "nbf": 1774274963,
  "exp": 1774318163,
  "aud": "account",
  "iss": "life2.ralfe.me"
}
```

That token is missing the user/account identity claims the app requires.

## Frontend Implementation

Frontend code lives under `src/web/`.

### Runtime configuration

Runtime config is assembled from:

- [`src/web/config.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/config.js)
- [`cicd/ci/build-frontend.sh`](/Users/ralfe/Dev/Morning-Briefing/cicd/ci/build-frontend.sh)

Supported settings:

- `apiBaseUrl`
- `authServiceSignInUrl`
- `authServiceSignOutUrl`
- `appBaseUrl`

Local development defaults currently use:

```js
window.__MORNING_BRIEFING_CONFIG__ = Object.assign({
  apiBaseUrl: window.location.protocol + '//' + morningBriefingApiHost + ':3000/api/v1',
  authServiceSignInUrl: 'http://localhost:63431/signIn',
  authServiceSignOutUrl: 'http://localhost:63431/logout',
  appBaseUrl: window.location.origin + '/'
}, window.__MORNING_BRIEFING_CONFIG__ || {});
```

Production frontend builds currently default `authServiceSignInUrl` to:

```text
https://auth.life-sqrd.com/signIn
```

That default is emitted from:

- [`cicd/ci/build-frontend.sh`](/Users/ralfe/Dev/Morning-Briefing/cicd/ci/build-frontend.sh)

and can still be overridden with `FRONTEND_AUTH_SERVICE_SIGN_IN_URL`.

### Callback route

The AngularJS route is defined in:

- [`src/web/app/app.routes.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/app.routes.js)

Relevant auth routes:

- `/#/auth/callback`
- `/#/signed-out`

### Early token capture before Angular routing

The most important reliability detail is that token capture happens before Angular bootstraps:

- [`src/web/app/bootstrap-auth.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/bootstrap-auth.js)

This script:

- reads `token` from the URL immediately
- validates the decoded payload shape
- stores the JWT and parsed session in `localStorage`
- strips `token` from the URL
- purges expired stored tokens during startup

This avoids route-guard races where Angular could redirect away before the token was persisted.

### Frontend auth service

Main frontend auth logic lives in:

- [`src/web/app/core/services/auth.service.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/core/services/auth.service.js)

Responsibilities:

- restore session from `localStorage`
- validate JWT payload shape and expiry
- expose the current auth state to the SPA
- build the central auth sign-in redirect
- handle sign-out
- expose the stored bearer token for API requests
- preserve a post-login return path
- store the latest auth error for troubleshooting

Current local storage keys:

- `morningBriefing.auth.token`
- `morningBriefing.auth.session`
- `morningBriefing.auth.returnPath`
- `morningBriefing.auth.error`

### HTTP auth header injection

All API requests include the JWT through:

- [`src/web/app/core/services/auth-http.interceptor.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/core/services/auth-http.interceptor.js)

Behavior:

- adds `Authorization: Bearer <jwt>` to outgoing requests
- signs the SPA out if the backend returns `401`

### App startup and route guard behavior

Startup behavior is implemented in:

- [`src/web/app/app.run.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/app.run.js)

Behavior:

- restores the session on boot
- consumes callback tokens
- redirects unauthenticated users to the auth service
- redirects authenticated users away from public auth pages
- normalizes post-login routing so users do not get stuck on `#/signed-out`
- preserves `oauthConnectionId` and `oauthProvider` query parameters for connector-related OAuth flows

### Auth UI pages

Files:

- [`src/web/app/features/auth/auth-callback-page.component.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/features/auth/auth-callback-page.component.js)
- [`src/web/app/features/auth/auth-status-page.component.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/features/auth/auth-status-page.component.js)

Behavior:

- callback page consumes the token and routes into the app
- signed-out page shows the latest auth failure reason
- signed-out page self-heals by redirecting into the app if a valid session already exists

### Current debug logging

There are temporary console logs in the auth flow to make callback failures easier to debug:

- callback token detection
- token acceptance/rejection
- redirect branch decisions
- signed-out page initialization

These logs live primarily in:

- [`src/web/app/core/services/auth.service.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/core/services/auth.service.js)
- [`src/web/app/features/auth/auth-callback-page.component.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/features/auth/auth-callback-page.component.js)
- [`src/web/app/features/auth/auth-status-page.component.js`](/Users/ralfe/Dev/Morning-Briefing/src/web/app/features/auth/auth-status-page.component.js)

If you reuse this integration in another project, these logs can be helpful during rollout and then removed afterward.

## Backend Implementation

Backend code lives under `src/backend/`.

### Global auth enforcement

Protected API routes are guarded in:

- [`src/backend/src/app/build-app.ts`](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/app/build-app.ts)

Behavior:

- all `/api/v1/*` routes require auth by default
- `OPTIONS` requests are allowed through for CORS preflight
- the current exception is:
  - `/api/v1/connections/google-calendar/oauth/callback`

Missing or invalid bearer tokens return `401`.

### JWT validation and user derivation

Main backend auth logic lives in:

- [`src/backend/src/modules/default-user/default-user-service.ts`](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/modules/default-user/default-user-service.ts)

Responsibilities:

- extract the bearer token from the request
- validate token structure
- validate `exp` and `nbf`
- validate required identity claims
- optionally verify the JWT signature
- derive a deterministic tenant id and user id from Life2 claims
- upsert the corresponding tenant and app user records
- return the current app user context for route handlers

Current user context includes:

- `tenantId`
- `userId`
- `displayName`
- `timezone`
- `locale`
- `email`
- `isAdmin`

### Admin bootstrap behavior

When the backend creates a user row from a Life2 JWT, it currently grants bootstrap admin access to the first admin-capable user in a tenant. That behavior is part of the user upsert logic in:

- [`src/backend/src/modules/default-user/default-user-service.ts`](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/modules/default-user/default-user-service.ts)

### Supported signature verification config

The backend supports:

- `LIFE2_JWT_SECRET` for `HS256`
- `LIFE2_JWT_PUBLIC_KEY` for `RS256`

If neither is configured, the backend still validates token shape and expiry, but it does not cryptographically verify the signature.

### Route integration

Protected route modules call into the user service with the current request so the app user is derived from the JWT.

Current examples include:

- dashboards
- widgets
- RSS feeds
- snapshots
- connectors
- admin widgets
- admin connectors
- users

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

## Why This Uses localStorage

This implementation uses `localStorage` for the application JWT.

Reasons:

- simple to integrate in a static SPA
- reliable session restoration across refreshes
- explicit control over when the token is attached to backend requests
- straightforward compatibility with redirect-based sign-in

Important note:

Using a cookie instead of a query parameter would not have fixed the main integration failure we hit. The real issue was receiving the wrong token contents from the auth service. If the wrong JWT were stored in a cookie, the app would still reject it.

The important pieces are:

- a dedicated callback route
- the correct Life2 JWT claims
- early token capture before the SPA router boots
- backend validation of protected requests

## Failure Modes We Hit

These are the major issues discovered during implementation.

### 1. Wrong token type returned from the auth service

Symptom:

- the app keeps redirecting back to the auth service or lands on signed-out

Cause:

- the auth service returned a generic token without user/account identity claims

Fix:

- make sure the final redirect returns the exchanged Life2 JWT

### 2. Root callback URL mixed with hash routing

Symptom:

- token appears in the browser URL but the SPA never fully accepts the login

Cause:

- redirecting to `/?token=...` while the app uses hash routing

Fix:

- standardize on `/#/auth/callback?token=...`

### 3. Angular route guard race

Symptom:

- browser lands on the app with a token and immediately redirects away

Cause:

- route guards ran before the token had been persisted

Fix:

- capture/store the token before Angular boot in `bootstrap-auth.js`

### 4. Stale `#/signed-out` hash after successful login

Symptom:

- token arrives successfully, but the user still sees the signed-out page

Cause:

- the browser kept the old hash route from before the login redirect

Fix:

- redirect authenticated users away from public auth routes
- make the signed-out page self-heal when a valid session exists

### 5. Numeric identity claims

Symptom:

- a valid token is rejected even though user/account information is present

Cause:

- claim parsing assumed string values only

Fix:

- normalize accepted user/account claim values as strings even when they are numeric

## Reuse Checklist

Use this checklist when integrating the Life2 auth service into another SPA project.

1. Add a dedicated SPA callback route: `/#/auth/callback`.
2. Redirect unauthenticated users to the central auth UI.
3. Pass `redirect={appBaseUrl}/#/auth/callback`.
4. Ensure the auth service returns the exchanged Life2 JWT, not the raw Cognito token.
5. Ensure the JWT includes user/account identity claims plus `exp`.
6. Capture and store the token before the SPA router boots.
7. Store the token in `localStorage`.
8. On initial app load, restore the token from `localStorage` and reject expired sessions.
9. Attach the token as `Authorization: Bearer <jwt>` on every protected backend API request.
10. Validate the token again on the backend for every protected API request.
11. Redirect authenticated users away from public auth routes such as `#/signed-out`.
12. Surface the last auth error during rollout/debugging.
13. Configure signature verification with `LIFE2_JWT_SECRET` or `LIFE2_JWT_PUBLIC_KEY`.

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

If you are integrating the Life2 auth service into another SPA project, the highest-signal guidance is:

- use `/#/auth/callback`
- require a Life2 JWT with explicit user/account claims
- capture the token before the SPA router boots
- store it in `localStorage`
- attach it as a bearer token to backend API requests
- validate it again on the backend for protected routes

If those pieces are in place, the integration should be straightforward and repeatable.
