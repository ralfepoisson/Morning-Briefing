#!/usr/bin/env bash
set -euo pipefail

STAGE="${STAGE:-dev}"
REGION="${AWS_REGION:-eu-west-3}"
STACK_NAME="morning-briefing-platform-${STAGE}"

stack_output() {
  local output_key="$1"
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue" \
    --output text
}

CLUSTER_NAME="$(stack_output EcsClusterName)"
TASK_DEFINITION_ARN="$(stack_output BackendTaskDefinitionArn)"
PUBLIC_SUBNET_A="$(stack_output PublicSubnetAId)"
PUBLIC_SUBNET_B="$(stack_output PublicSubnetBId)"
ECS_SECURITY_GROUP="$(stack_output EcsSecurityGroupId)"

TASK_ARN="$(aws ecs run-task \
  --region "${REGION}" \
  --cluster "${CLUSTER_NAME}" \
  --launch-type FARGATE \
  --task-definition "${TASK_DEFINITION_ARN}" \
  --network-configuration "awsvpcConfiguration={subnets=[${PUBLIC_SUBNET_A},${PUBLIC_SUBNET_B}],securityGroups=[${ECS_SECURITY_GROUP}],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["/bin/sh","-lc","npm run reference:import:cities:prod"]}]}' \
  --query 'tasks[0].taskArn' \
  --output text)"

aws ecs wait tasks-stopped \
  --region "${REGION}" \
  --cluster "${CLUSTER_NAME}" \
  --tasks "${TASK_ARN}"

TASK_ID="${TASK_ARN##*/}"
LOG_GROUP_NAME="/ecs/morning-briefing-${STAGE}"
LOG_STREAM_NAME="backend/backend/${TASK_ID}"
EXIT_CODE="$(aws ecs describe-tasks \
  --region "${REGION}" \
  --cluster "${CLUSTER_NAME}" \
  --tasks "${TASK_ARN}" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)"

if [[ "${EXIT_CODE}" != "0" ]]; then
  STOPPED_REASON="$(aws ecs describe-tasks \
    --region "${REGION}" \
    --cluster "${CLUSTER_NAME}" \
    --tasks "${TASK_ARN}" \
    --query 'tasks[0].stoppedReason' \
    --output text)"
  CONTAINER_REASON="$(aws ecs describe-tasks \
    --region "${REGION}" \
    --cluster "${CLUSTER_NAME}" \
    --tasks "${TASK_ARN}" \
    --query 'tasks[0].containers[0].reason' \
    --output text)"

  echo "Reference city import stopped reason: ${STOPPED_REASON}" >&2
  echo "Reference city import container reason: ${CONTAINER_REASON}" >&2

  aws logs get-log-events \
    --region "${REGION}" \
    --log-group-name "${LOG_GROUP_NAME}" \
    --log-stream-name "${LOG_STREAM_NAME}" \
    --limit 50 \
    --query 'events[].message' \
    --output text 2>/dev/null || true

  echo "Reference city import failed with exit code ${EXIT_CODE}" >&2
  exit 1
fi

echo "Reference city import completed."
