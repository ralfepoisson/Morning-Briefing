# Alexa Skill Integration

This document describes the current Morning Briefing Alexa skill integration and how to configure it.

## Overview

The backend exposes an Alexa custom skill webhook at:

- `POST /api/v1/integrations/alexa`

The webhook does not generate a fresh briefing on demand. It reads the latest saved dashboard briefing script from the existing backend briefing pipeline and returns that text in an Alexa response envelope.

Current behavior:

- the Alexa skill reads the latest `READY` briefing from the user's default dashboard
- if the Alexa account is not linked, the backend returns a `LinkAccount` card
- if the user has no dashboard yet, Alexa responds with a setup message
- if a dashboard exists but no saved `READY` briefing exists yet, Alexa asks the user to try again later

## Backend Dependencies

The Alexa route reuses existing backend services:

- `DefaultUserService` to resolve the linked user from a bearer token
- `DashboardService` to find the user's default dashboard
- `DashboardBriefingService` to load the latest saved briefing

Implementation files:

- [alexa-skill-routes.ts](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/modules/alexa/alexa-skill-routes.ts)
- [alexa-skill-service.ts](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/modules/alexa/alexa-skill-service.ts)

## Environment Configuration

Add this environment variable in the backend:

- `ALEXA_SKILL_APPLICATION_ID`

This should be set to the Alexa skill application id, for example `amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

When set, the backend rejects requests whose Alexa `applicationId` does not match.

## Alexa Skill Setup

### 1. Create a custom skill

Create a custom Alexa skill in the Alexa Developer Console.

Suggested values:

- Skill type: `Custom`
- Invocation name: `morning briefing`

### 2. Add the intent

Create a custom intent:

- Intent name: `GetDailyBriefingIntent`

Suggested sample utterances:

- `give me my daily briefing`
- `read my daily briefing`
- `what is my daily briefing`
- `brief me on today`

The backend also handles:

- `LaunchRequest`
- `AMAZON.HelpIntent`
- `AMAZON.CancelIntent`
- `AMAZON.StopIntent`
- `SessionEndedRequest`

### 3. Configure the endpoint

Point the Alexa skill endpoint to your deployed backend:

- `https://<your-backend-host>/api/v1/integrations/alexa`

The backend expects Alexa request envelopes and returns Alexa response JSON.

### 4. Configure account linking

Account linking is required for the useful path of the skill.

The current implementation expects Alexa to send an OAuth bearer token in:

- `context.System.user.accessToken`

or:

- `session.user.accessToken`

That token is passed into the existing Morning Briefing user-resolution flow and treated like a normal bearer token.

## Request Flow

### Launch

When the user opens the skill, the backend responds with a welcome prompt and asks them to request their daily briefing.

### Daily briefing intent

When Alexa sends `GetDailyBriefingIntent`, the backend:

1. validates the Alexa `applicationId` if `ALEXA_SKILL_APPLICATION_ID` is configured
2. reads the linked access token from the Alexa request
3. resolves the Morning Briefing user from that bearer token
4. loads the user's dashboards and selects the first one returned, which is the default dashboard when present
5. loads the latest saved dashboard briefing
6. returns the saved `scriptText` as Alexa `PlainText` speech

### Missing account link

If no access token is present, the backend returns:

- `outputSpeech` explaining that account linking is required
- a `LinkAccount` card

### Missing dashboard or briefing

If the linked user has no dashboard, or no `READY` briefing yet, Alexa receives a friendly fallback message instead of an error.

## Current Limitations

- The backend currently serves the latest saved script only. It does not trigger a new briefing generation during the Alexa request.
- The route validates Alexa `applicationId`, but it does not yet verify Alexa request signatures.
- The integration assumes account linking is already set up and that the linked access token is compatible with the existing backend auth flow.
- The skill currently reads from the user's default dashboard only.
- The response uses Alexa `PlainText`, not SSML.

## Testing

Relevant tests:

- [alexa-skill-routes.test.ts](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/modules/alexa/alexa-skill-routes.test.ts)
- [alexa-skill-service.test.ts](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/modules/alexa/alexa-skill-service.test.ts)
- [build-app.test.ts](/Users/ralfe/Dev/Morning-Briefing/src/backend/src/app/build-app.test.ts)

Useful commands:

```bash
cd /Users/ralfe/Dev/Morning-Briefing/src/backend
npm test -- src/app/build-app.test.ts src/modules/alexa/alexa-skill-service.test.ts src/modules/alexa/alexa-skill-routes.test.ts
npm run build
```

## Voice Command Testing

voice prompt: `Alexa, open my daily briefing.`

## Suggested Next Improvements

- add Alexa request-signature verification
- support SSML output for better pacing and pronunciation
- allow explicit dashboard selection instead of always using the default dashboard
- optionally queue a fresh briefing generation when no current `READY` briefing exists
