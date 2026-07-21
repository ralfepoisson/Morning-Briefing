#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

docker start morning-briefing-rabbitmq
cd "$SCRIPT_DIR/../src/backend"
npm run message-broker:setup
