#!/bin/bash

# Kill existing processes
pkill -9 -f "node index.js" 2>/dev/null
sleep 1

# Start server in background
node index.js > /tmp/test_server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Wait for server to initialize
echo "Waiting for server to initialize..."
sleep 8

# Check if server is listening
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server is running"
   
    # Run the test
    echo "Running test..."
    node quick_test.js
    TEST_EXIT=$?
    
    # Kill the server
    kill $SERVER_PID 2>/dev/null
    
    exit $TEST_EXIT
else
    echo "❌ Server failed to start"
    cat /tmp/test_server.log
    exit 1
fi
