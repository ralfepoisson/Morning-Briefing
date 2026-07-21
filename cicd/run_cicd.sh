#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "The legacy Serverless deploy path is retired. Running secret-safe CI only."
echo "Use scripts/publish-release.sh after CI and explicit live-phase approval."
exec "${ROOT_DIR}/scripts/ci.sh"
