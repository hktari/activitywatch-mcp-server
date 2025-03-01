#!/bin/bash
cd /Users/mtvogel/Documents/Github-Repos/activitywatch-mcp-server
exec 2>&1
echo "Running npm build..."
npm run build
echo "Build completed with status: $?"
