#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/release-common.sh
source "${ROOT_DIR}/scripts/lib/release-common.sh"

require_repository_identity "${ROOT_DIR}"
require_clean_worktree "${ROOT_DIR}"
require_pushed_release_commit "${ROOT_DIR}"
verify_aws_identity

sha="$(git -C "${ROOT_DIR}" rev-parse HEAD)"
tag="git-${sha}"
registry="${EXPECTED_AWS_ACCOUNT}.dkr.ecr.${EXPECTED_AWS_REGION}.amazonaws.com"
backend_repo="${registry}/morning-briefing-prod-backend"
frontend_repo="${registry}/morning-briefing-prod-frontend"
artifact_dir="${ROOT_DIR}/release-artifacts/${sha}"
mkdir -p "${artifact_dir}"

aws ecr get-login-password --region "${EXPECTED_AWS_REGION}" \
  | docker login --username AWS --password-stdin "${registry}" >/dev/null

docker buildx build --platform linux/arm64 --provenance=true --sbom=true --push \
  -f "${ROOT_DIR}/cicd/ci/Dockerfile.backend" -t "${backend_repo}:${tag}" "${ROOT_DIR}"
docker buildx build --platform linux/arm64 --provenance=true --sbom=true --push \
  -f "${ROOT_DIR}/cicd/ci/Dockerfile.frontend" -t "${frontend_repo}:${tag}" "${ROOT_DIR}"

backend_digest="$(docker buildx imagetools inspect "${backend_repo}:${tag}" --format '{{json .Manifest}}' | jq -r '.digest')"
frontend_digest="$(docker buildx imagetools inspect "${frontend_repo}:${tag}" --format '{{json .Manifest}}' | jq -r '.digest')"
backend_ref="${backend_repo}@${backend_digest}"
frontend_ref="${frontend_repo}@${frontend_digest}"
validate_digest_ref "${backend_ref}"
validate_digest_ref "${frontend_ref}"

compose_sha="$(sha256_file "${ROOT_DIR}/cicd/compose/compose.yaml")"
migration_id="$(basename "$(find "${ROOT_DIR}/src/backend/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | sort | tail -1)")"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg gitSha "${sha}" --arg backend "${backend_ref}" --arg frontend "${frontend_ref}" \
  --arg composeSha "${compose_sha}" --arg migrationId "${migration_id}" --arg createdAt "${created_at}" \
  '{schemaVersion:1,application:"morning-briefing",gitSha:$gitSha,awsAccount:"154596858576",region:"eu-west-1",images:{backend:$backend,frontend:$frontend},composeSha256:$composeSha,migrationId:$migrationId,createdAt:$createdAt}' \
  > "${artifact_dir}/release-manifest.json"
cat > "${artifact_dir}/release.env" <<EOF
APP_ROOT=/srv/apps/morning-briefing
BACKEND_IMAGE=${backend_ref}
FRONTEND_IMAGE=${frontend_ref}
BACKEND_LOOPBACK_PORT=13000
FRONTEND_LOOPBACK_PORT=18080
EOF
validate_release_manifest "${artifact_dir}/release-manifest.json"

if [[ "${1:-}" == "--no-upload" ]]; then
  echo "Release manifest created at ${artifact_dir}."
  exit 0
fi

remote_dir="/srv/apps/morning-briefing/releases/${sha}"
ssh personal-projects "install -d -m 0750 '${remote_dir}'"
(cd "${ROOT_DIR}" && rsync -aR --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  ./cicd/compose ./cicd/host ./scripts/lib "personal-projects:${remote_dir}/")
rsync -a --chmod=Fu=rw,Fgo=r \
  "${artifact_dir}/release-manifest.json" "${artifact_dir}/release.env" \
  "personal-projects:${remote_dir}/"
ssh personal-projects "'${remote_dir}/cicd/host/deploy.sh' '${remote_dir}'"
echo "Published ${sha} using immutable image digests."
