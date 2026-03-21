#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <backend-image-tag> <frontend-image-tag>" >&2
  exit 1
fi

docker push "$1"
docker push "$2"
