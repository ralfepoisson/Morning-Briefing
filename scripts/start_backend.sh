#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR/../src/backend"
LOCAL_SCHEDULER_ENABLED="${LOCAL_SCHEDULER_ENABLED:-true}" \
LOCAL_SNAPSHOT_WORKER_ENABLED="${LOCAL_SNAPSHOT_WORKER_ENABLED:-true}" \
npm run dev
