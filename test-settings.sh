#!/bin/bash

# Build the project first
echo "Building project..."
npm run build

# Check if the build succeeded
if [ $? -ne 0 ]; then
  echo "Build failed. Please fix the issues and try again."
  exit 1
fi

# Run the settings tool test
echo "Running tests for the settings tool..."
npm run test:settings

# Check if tests passed
if [ $? -ne 0 ]; then
  echo "Tests failed. Please fix the issues and try again."
  exit 1
fi

echo "All tests passed!"
echo ""
echo "To try the tool with a real ActivityWatch instance:"
echo "1. Make sure ActivityWatch is running (http://localhost:5600)"
echo "2. Run the server with: npm start"
echo "3. Use an MCP client like Claude Desktop to access the new 'activitywatch_get_settings' tool"
echo ""
echo "Example queries:"
echo "- Get all settings: activitywatch_get_settings with no parameters"
echo "- Get a specific setting: activitywatch_get_settings with key=settings.category_colors"
