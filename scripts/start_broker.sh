#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

docker start morning-briefing-localstack
cd "$SCRIPT_DIR/../src/backend"
npm run snapshot:queues:setup
npm run snapshot:worker
