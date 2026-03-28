#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../src/backend"
LOG_DIR="$BACKEND_DIR/data"
LOG_FILE="$LOG_DIR/local-scheduler.log"

mkdir -p "$LOG_DIR"

cd "$BACKEND_DIR"
echo "Running local scheduler in the current terminal."
echo "Logs: $LOG_FILE"
./node_modules/.bin/tsx scripts/run-local-scheduler.ts 2>&1 | tee -a "$LOG_FILE"
