#!/bin/bash

# Configuration
export STAGE=prod

# Build the backend
echo "==================================================="
echo "BUILDING BACKEND"
echo "==================================================="
./ci/build-backend.sh

# Build the frontend
echo "==================================================="
echo "BUILDING FRONTEND"
echo "==================================================="
./ci/build-frontend.sh

# Deploy the application
echo "==================================================="
echo "DEPLOYING APPLICATION"
echo "==================================================="
source ./export_credentials.sh
echo "Deploying to ${AWS_REGION}"
printf '<%s>\n' "$AWS_ACCESS_KEY_ID"
printf '<%s>\n' "$AWS_SECRET_ACCESS_KEY"
printf '<%s>\n' "$AWS_SESSION_TOKEN"
./serverless/scripts/deploy.sh
