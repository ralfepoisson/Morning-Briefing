#!/usr/bin/env bash
set -euo pipefail

release="${1:-}"
[[ -n "${release}" ]] || { echo "Usage: scripts/rollback.sh <git-sha-or-release>" >&2; exit 2; }
[[ "${release}" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Release must be a Git SHA." >&2; exit 2; }

ssh personal-projects "sudo -n /srv/apps/morning-briefing/current/cicd/host/rollback.sh '${release}'"
