#!/usr/bin/env bash

EXPECTED_AWS_ACCOUNT="154596858576"
EXPECTED_AWS_REGION="eu-west-1"
EXPECTED_REPOSITORY_NAME="Morning-Briefing"

die() {
  echo "ERROR: $*" >&2
  return 1
}

sha256_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file}" | awk '{print $1}'
  else
    shasum -a 256 "${file}" | awk '{print $1}'
  fi
}

validate_digest_ref() {
  local image_ref="${1:-}"
  [[ "${image_ref}" =~ ^[^[:space:]@]+@sha256:[0-9a-f]{64}$ ]]
}

require_clean_worktree() {
  local repo_root="${1:-.}"
  [[ -z "$(git -C "${repo_root}" status --porcelain --untracked-files=normal)" ]] || die "Release worktree is not clean."
}

require_repository_identity() {
  local repo_root="${1:-.}"
  local remote
  git -C "${repo_root}" rev-parse --show-toplevel >/dev/null || return 1
  remote="$(git -C "${repo_root}" remote get-url origin 2>/dev/null || true)"
  [[ "${remote}" == *"/${EXPECTED_REPOSITORY_NAME}.git" || "${remote}" == *":${EXPECTED_REPOSITORY_NAME}.git" ]] \
    || die "Unexpected origin repository."
}

require_release_commit() {
  local repo_root="${1:-.}"
  local sha branch
  sha="$(git -C "${repo_root}" rev-parse HEAD)"
  branch="$(git -C "${repo_root}" branch --show-current)"
  [[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || die "Release commit is not a full Git SHA."
  [[ -n "${branch}" ]] || die "Detached HEAD releases are not allowed."
}

require_pushed_release_commit() {
  local repo_root="${1:-.}"
  local sha branch
  require_release_commit "${repo_root}" || return 1
  sha="$(git -C "${repo_root}" rev-parse HEAD)"
  branch="$(git -C "${repo_root}" branch --show-current)"
  git -C "${repo_root}" merge-base --is-ancestor "${sha}" "origin/${branch}" 2>/dev/null || die "Release commit has not been pushed to origin/${branch}."
}

verify_aws_identity() {
  local account region
  export AWS_EC2_METADATA_DISABLED=true
  export AWS_PAGER=''
  region="${AWS_REGION:-${AWS_DEFAULT_REGION:-${EXPECTED_AWS_REGION}}}"
  [[ "${region}" == "${EXPECTED_AWS_REGION}" ]] || die "AWS region must be ${EXPECTED_AWS_REGION}."
  account="$(aws sts get-caller-identity --query Account --output text)" || return 1
  [[ "${account}" == "${EXPECTED_AWS_ACCOUNT}" ]] || die "AWS account must be ${EXPECTED_AWS_ACCOUNT}."
}

validate_release_manifest() {
  local manifest="$1"
  local schema application git_sha account region backend frontend compose_sha created_at
  jq -e . "${manifest}" >/dev/null || return 1
  schema="$(jq -r '.schemaVersion' "${manifest}")"
  application="$(jq -r '.application' "${manifest}")"
  git_sha="$(jq -r '.gitSha' "${manifest}")"
  account="$(jq -r '.awsAccount' "${manifest}")"
  region="$(jq -r '.region' "${manifest}")"
  backend="$(jq -r '.images.backend' "${manifest}")"
  frontend="$(jq -r '.images.frontend' "${manifest}")"
  compose_sha="$(jq -r '.composeSha256' "${manifest}")"
  created_at="$(jq -r '.createdAt' "${manifest}")"

  [[ "${schema}" == "1" ]] || return 1
  [[ "${application}" == "morning-briefing" ]] || return 1
  [[ "${git_sha}" =~ ^[0-9a-f]{40}$ ]] || return 1
  [[ "${account}" == "${EXPECTED_AWS_ACCOUNT}" ]] || return 1
  [[ "${region}" == "${EXPECTED_AWS_REGION}" ]] || return 1
  validate_digest_ref "${backend}" || return 1
  validate_digest_ref "${frontend}" || return 1
  [[ "${compose_sha}" =~ ^[0-9a-f]{64}$ ]] || return 1
  [[ "${created_at}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*Z$ ]] || return 1
}

acquire_deploy_lock() {
  local lock_file="$1"
  mkdir -p "$(dirname "${lock_file}")"
  exec 9>"${lock_file}"
  flock -n 9 || die "Another Morning Briefing deployment is active."
}

assert_secret_file_mode() {
  local file="$1"
  local mode owner group
  [[ -f "${file}" && ! -L "${file}" ]] || { die "Secret path must be a regular non-symlink file: ${file}"; return 1; }
  if stat -c '%a' "${file}" >/dev/null 2>&1; then
    mode="$(stat -c '%a' "${file}")"
    owner="$(stat -c '%u' "${file}")"
    group="$(stat -c '%g' "${file}")"
  else
    mode="$(stat -f '%Lp' "${file}")"
    owner="$(stat -f '%u' "${file}")"
    group="$(stat -f '%g' "${file}")"
  fi
  [[ "${owner}" == "0" ]] || { die "Secret file must be owned by root: ${file}"; return 1; }
  [[ "${group}" == "0" ]] || { die "Secret file group must be root: ${file}"; return 1; }
  [[ "${mode}" == "600" ]] || { die "Secret file must have mode 0600: ${file}"; return 1; }
}

prepare_runtime_directory() {
  local directory="$1"
  local owner="$2"
  local group="$3"
  local actual
  [[ "$(id -u)" == "0" ]] || { die "Runtime directories must be prepared as root."; return 1; }
  [[ "${directory}" == /* && "${owner}" =~ ^[0-9]+$ && "${group}" =~ ^[0-9]+$ ]] \
    || { die "Runtime directory ownership input is invalid."; return 1; }
  [[ ! -L "${directory}" ]] || { die "Runtime directory must not be a symlink: ${directory}"; return 1; }
  install -d -m 0750 "${directory}"
  chown "${owner}:${group}" "${directory}"
  chmod 0750 "${directory}"
  if stat -c '%a:%u:%g' "${directory}" >/dev/null 2>&1; then
    actual="$(stat -c '%a:%u:%g' "${directory}")"
  else
    actual="$(stat -f '%Lp:%u:%g' "${directory}")"
  fi
  [[ "${actual}" == "750:${owner}:${group}" ]] \
    || { die "Runtime directory mode or ownership is incorrect: ${directory}"; return 1; }
}

require_env_key() {
  local file="$1"
  local key="$2"
  grep -Eq "^${key}=.+$" "${file}" || die "Required key ${key} is missing from $(basename "${file}")."
}

require_env_value() {
  local file="$1"
  local key="$2"
  local expected="$3"
  grep -Fqx "${key}=${expected}" "${file}" \
    || die "Required value for ${key} is not configured in $(basename "${file}")."
}

require_one_env_key() {
  local file="$1"
  shift
  local key
  for key in "$@"; do
    if grep -Eq "^${key}=.+$" "${file}"; then
      return 0
    fi
  done
  die "Required alternative authentication material is missing from $(basename "${file}")."
}

run_candidate_with_rollback() {
  local deploy_function="$1"
  local health_function="$2"
  local rollback_function="$3"

  if "${deploy_function}" && "${health_function}"; then
    return 0
  fi

  "${rollback_function}" || true
  return 1
}
