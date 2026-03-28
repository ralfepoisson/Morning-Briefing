#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================"
echo "Starting Backend"
echo "================================"
"$SCRIPT_DIR/start_backend.sh" &
sleep 10


echo "================================"
echo "Starting Broker"
echo "================================"
"$SCRIPT_DIR/start_broker.sh" &
sleep 10

echo "================================"
echo "Starting Frontend"
echo "================================"
"$SCRIPT_DIR/start_ui.sh" &
