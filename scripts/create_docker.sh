#!/bin/bash

docker run -d --name morning-briefing-localstack -p 4566:4566 -e SERVICES=sqs -e DEBUG=0 localstack/localstack:latest
