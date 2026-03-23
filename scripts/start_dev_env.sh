#!/bin/bash

echo "================================"
echo "Starting Backend"
echo "================================"
./start_backend.sh &
sleep 10


echo "================================"
echo "Starting Broker"
echo "================================"
./start_broker.sh &
sleep 10

echo "================================"
echo "Starting Frontend"
echo "================================"
./start_ui.sh &
