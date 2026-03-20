#!/bin/bash

docker start morning-briefing-localstack
cd ../src/backend
npm run snapshot:queues:setup
npm run snapshot:worker
