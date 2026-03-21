#!/bin/bash

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
export AWS_REGION=eu-west-1
export STAGE=prod
./serverless/scripts/deploy.sh
