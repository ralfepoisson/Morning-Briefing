# Deployment Approach

This document is the source of truth for production deployments of Morning Briefing.

Going forward, production deployments should follow this runbook, and this file should be updated whenever the deployment flow, infrastructure, or smoke-test expectations change.

## Production deployment command

Production is deployed from the repo root via:

```bash
cd /Users/ralfe/Dev/Morning-Briefing/cicd
./run_cicd.sh
```

`run_cicd.sh` currently:

1. Builds the backend.
2. Builds the frontend.
3. Sources AWS and deployment credentials from `cicd/export_credentials.sh`.
4. Runs `cicd/serverless/scripts/deploy.sh`.

`deploy.sh` then:

1. Deploys the AWS stack with placeholder images and all ECS services scaled to `0`.
2. Builds and pushes the real backend and frontend images.
3. Re-deploys the stack with those images and services still at `0`.
4. Runs Prisma migrations and the production seed in ECS.
5. Re-deploys the stack with frontend, backend, and worker desired counts restored to `1`.

## Preconditions before every production deploy

Before running the deploy:

1. Make sure the working tree contains exactly the changes you intend to deploy.
2. Run the relevant automated tests locally.
3. Confirm the production URLs are still correct:
   - frontend: `https://briefing.ralfepoisson.com/`
   - Google OAuth callback: `https://briefing.ralfepoisson.com/api/v1/connections/google-calendar/oauth/callback`
4. Confirm the Google Cloud Console OAuth client still includes:
   - JavaScript origin: `https://briefing.ralfepoisson.com`
   - Redirect URI: `https://briefing.ralfepoisson.com/api/v1/connections/google-calendar/oauth/callback`
5. Review database changes carefully. Any Prisma migration failure will leave ECS services at `0` until recovery is completed.

## Required deployment checks

These checks should be performed for every production deployment.

### 1. Confirm the deploy script itself succeeds

The deployment is not complete unless `run_cicd.sh` finishes successfully.

If it exits with a non-zero code, assume production may be partially deployed and verify ECS immediately.

### 2. Confirm ECS services are back up

Run:

```bash
source /Users/ralfe/Dev/Morning-Briefing/cicd/export_credentials.sh
aws ecs describe-services \
  --region eu-west-1 \
  --cluster morning-briefing-prod-cluster \
  --services morning-briefing-prod-backend morning-briefing-prod-frontend morning-briefing-prod-worker \
  --query 'services[].{serviceName:serviceName,desired:desiredCount,running:runningCount,pending:pendingCount}' \
  --output table
```

Expected result:

- backend desired/running: `1/1`
- frontend desired/running: `1/1`
- worker desired/running: `1/1`

If any service is still at `0`, production is not healthy.

### 3. Confirm the public site is serving traffic

Run:

```bash
curl -I https://briefing.ralfepoisson.com/
```

Expected result:

- HTTP status `200`
- not `503`

## Smoke tests after every production deploy

Perform these smoke tests in order.

### Infrastructure smoke tests

1. Open [https://briefing.ralfepoisson.com/](https://briefing.ralfepoisson.com/) and verify the app shell loads.
2. Sign in and verify the dashboard home page renders.
3. Open `Admin > Logs` and check for new error-level entries related to startup, OAuth, connectors, widgets, snapshots, or database access.

### Core product smoke tests

1. Open the main dashboard and confirm the standard widgets render:
   - Weather Outlook
   - News Briefing
   - Task List
   - Today on Calendar
2. Open `Admin > Widgets` and confirm the widgets list loads without backend errors.
3. Regenerate at least one widget snapshot from `Admin > Widgets` and confirm it completes successfully.

### Connector smoke tests

1. Open `Connectors` and confirm existing connectors load.
2. Open `Admin > Connectors` and confirm:
   - the page loads
   - connectors are listed
   - owner information is visible
   - widget usage information is visible
3. For the Google Calendar connector, confirm:
   - it appears in the connector inventory
   - it shows `OAUTH`
   - the existing Calendar widget can see it in the connection dropdown

### Google Calendar smoke tests

Run these whenever a deployment touches calendar, connectors, OAuth, auth, routing, or backend persistence:

1. Open the Calendar widget editor and verify the Google Calendar connector is selectable.
2. Save the dashboard if a staged connector selection was changed.
3. Return to the dashboard and confirm the Calendar widget renders without a connection error.
4. If the release touched OAuth specifically, perform one reconnect flow with `Reconnect Google` and confirm the app returns to production, not localhost.

## Release-specific smoke tests

In addition to the standard list above, always run smoke tests for the features touched by the release.

Examples:

- Widget work: verify both widget editing and rendering.
- Connector work: verify both connector administration and widget consumption.
- Auth/OAuth work: verify login, callback, and post-redirect state.
- Database work: verify both startup health and one write path.

## Failure mode: migration leaves production at 0 tasks

This happened on 2026-03-25 and should be treated as a known recovery path.

If `run_cicd.sh` reports a migration failure, the services may remain at `0` because the final scale-up step is never reached.

### Recovery checklist

1. Inspect the latest backend migration task logs in CloudWatch log group `/ecs/morning-briefing-prod`.
2. Fix the migration in code if needed.
3. If Prisma reports `P3009` because the migration is recorded as failed, run a one-off ECS backend task to resolve and rerun it.
4. After the migration succeeds, scale the services back to `1`.
5. Re-run the smoke tests above.

### Example recovery commands

Resolve a failed Prisma migration and rerun migrations plus seed:

```bash
source /Users/ralfe/Dev/Morning-Briefing/cicd/export_credentials.sh

CLUSTER_NAME="$(aws cloudformation describe-stacks \
  --stack-name morning-briefing-platform-prod \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`EcsClusterName`].OutputValue' \
  --output text)"

TASK_DEFINITION_ARN="$(aws cloudformation describe-stacks \
  --stack-name morning-briefing-platform-prod \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendTaskDefinitionArn`].OutputValue' \
  --output text)"

PUBLIC_SUBNET_A="$(aws cloudformation describe-stacks \
  --stack-name morning-briefing-platform-prod \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetAId`].OutputValue' \
  --output text)"

PUBLIC_SUBNET_B="$(aws cloudformation describe-stacks \
  --stack-name morning-briefing-platform-prod \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetBId`].OutputValue' \
  --output text)"

ECS_SECURITY_GROUP="$(aws cloudformation describe-stacks \
  --stack-name morning-briefing-platform-prod \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`EcsSecurityGroupId`].OutputValue' \
  --output text)"

aws ecs run-task \
  --region eu-west-1 \
  --cluster "${CLUSTER_NAME}" \
  --launch-type FARGATE \
  --task-definition "${TASK_DEFINITION_ARN}" \
  --network-configuration "awsvpcConfiguration={subnets=[${PUBLIC_SUBNET_A},${PUBLIC_SUBNET_B}],securityGroups=[${ECS_SECURITY_GROUP}],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["/bin/sh","-lc","npx prisma migrate resolve --rolled-back 20260325100000_add_connector_owner_user && npm run db:deploy && npm run db:seed:prod"]}]}'
```

Scale services back up:

```bash
source /Users/ralfe/Dev/Morning-Briefing/cicd/export_credentials.sh

aws ecs update-service --region eu-west-1 --cluster morning-briefing-prod-cluster --service morning-briefing-prod-backend --desired-count 1
aws ecs update-service --region eu-west-1 --cluster morning-briefing-prod-cluster --service morning-briefing-prod-frontend --desired-count 1
aws ecs update-service --region eu-west-1 --cluster morning-briefing-prod-cluster --service morning-briefing-prod-worker --desired-count 1
```

Then wait for service stability and verify the site returns `200`.

## Maintenance expectations

Whenever we change:

- deploy scripts
- infrastructure configuration
- OAuth/callback URLs
- required environment variables
- post-deploy validation expectations
- recovery procedures

this document should be updated in the same piece of work.
