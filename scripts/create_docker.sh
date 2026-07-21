#!/bin/bash

docker run -d --name morning-briefing-rabbitmq \
  -p 127.0.0.1:5672:5672 \
  -e RABBITMQ_DEFAULT_USER=morning-briefing \
  -e RABBITMQ_DEFAULT_PASS=local-only \
  -v morning-briefing-rabbitmq-data:/var/lib/rabbitmq \
  rabbitmq:4.1-alpine@sha256:d2baf254132a017d54f1bf546dbf827190f4063644065307d8fe7f9532106919
