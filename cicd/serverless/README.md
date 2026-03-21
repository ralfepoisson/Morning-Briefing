# AWS Deployment With Serverless

This directory provisions the AWS infrastructure for Morning Briefing with the Serverless Framework. The stack creates:

- Two ECR repositories, one for the backend image and one for the frontend image
- An ECS Fargate cluster with three task definitions:
  - frontend web container
  - backend API container
  - snapshot worker container
- An Application Load Balancer that routes `/api/*` to the backend and everything else to the frontend
- An ACM certificate and HTTPS listener for `briefing.ralfepoisson.com`
- A Route53 alias record for `briefing.ralfepoisson.com`
- An RDS PostgreSQL database
- An SQS queue and dead-letter queue for snapshot processing
- CloudWatch Logs for ECS tasks
- An EventBridge rule that runs the nightly snapshot refresh task on a schedule
- VPC, subnets, security groups, and IAM roles required for the above

## First deployment

The deployment flow is intentionally two-phase because the stack itself creates the ECR repositories.

```bash
export AWS_REGION=eu-west-3
export STAGE=dev
export DB_PASSWORD='replace-this'
export HOSTED_ZONE_NAME='ralfepoisson.com'
export FRONTEND_DOMAIN_NAME='briefing.ralfepoisson.com'
export GOOGLE_OAUTH_CLIENT_ID='optional'
export GOOGLE_OAUTH_CLIENT_SECRET='optional'
export GOOGLE_OAUTH_REDIRECT_URI='https://briefing.ralfepoisson.com/api/v1/connections/google-calendar/oauth/callback'
export GOOGLE_OAUTH_STATE_SECRET='optional'

./cicd/serverless/scripts/deploy.sh
```

The deploy script will:

1. Bootstrap the AWS stack with placeholder images and zero desired ECS tasks
2. Read the ECR repository URIs from CloudFormation outputs
3. Build and push the real frontend and backend images
4. Re-deploy the stack using those images
5. Run Prisma migrations and seed inside ECS
6. Re-deploy with the frontend, backend, and worker services scaled to `1`

## Useful overrides

- `IMAGE_TAG` to control the Docker tag instead of using the current git SHA
- `DB_NAME` and `DB_USER` to override the default database names
- `HOSTED_ZONE_NAME` and `FRONTEND_DOMAIN_NAME` to override the default Route53/ACM settings
- `NIGHTLY_REFRESH_SCHEDULE` to change the EventBridge schedule expression

## Notes

- The deploy script expects `aws`, `docker`, and `npm` to be available locally or in CI.
- The deploy script looks up the Route53 hosted zone ID automatically from `HOSTED_ZONE_NAME`.
- The initial database password is stored in AWS Secrets Manager for ECS task injection, but the RDS master password is also set from the same deployment input. Rotate it after the first deployment if this environment will be long-lived.
