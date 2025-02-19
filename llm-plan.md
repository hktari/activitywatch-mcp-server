# ActivityWatch MCP Server Development Plan

## Project Overview
Create an MCP server that allows Claude to interact with ActivityWatch, a privacy-first time tracking application. The server will enable Claude to query time tracking data and provide insights about time usage.

## Development Principles
- **Simplicity First**: Keep implementations simple and maintainable
- **Error Handling**: Implement comprehensive error handling
- **Incremental Development**: Build and test one feature at a time
- **Test-Driven**: Each feature should have clear testing criteria

## Development Phases

### Phase 1: Basic Setup and Core Functionality
Goal: Set up project and implement basic ActivityWatch API connectivity

1. **Project Setup**
   - Use mcp-framework CLI to scaffold project
   - Configure TypeScript
   - Set up ActivityWatch API client
   - Test: Verify connection to local ActivityWatch instance

2. **Query Tool Implementation**
   - Create tool for executing ActivityWatch queries
   - Handle basic error cases (API unavailable, invalid query)
   - Test: Execute a simple query for current day's data

### Phase 2: Event and Bucket Access
Goal: Access to core ActivityWatch data

1. **Event Fetching Tool**
   - Implement tool to get events from specific buckets
   - Add filtering capabilities (time range, bucket type)
   - Test: Fetch events from window watcher bucket

2. **Bucket Management Tool**
   - List available buckets
   - Get bucket metadata
   - Test: List all buckets and verify metadata

### Phase 3: Analysis Tools
Goal: Provide meaningful insights from ActivityWatch data

1. **Time Summary Tool**
   - Calculate time spent in applications
   - Generate activity summaries
   - Test: Get summary for specific application usage

2. **AFK Status Tool**
   - Check current and historical AFK status
   - Calculate active time periods
   - Test: Get AFK status for current day

## Testing Each Feature
1. Start ActivityWatch locally (default: http://localhost:5600)
2. Run the MCP server
3. Connect via Claude Desktop or MCP Inspector
4. Execute test cases specific to each feature
5. Verify error handling by testing edge cases

## Future Enhancements (Post-MVP)
- Advanced query capabilities
- Productivity analysis
- Custom time period analysis
- Category-based insights

## Notes
- ActivityWatch must be running locally for the server to function
- All features depend on successful API connection
- Error handling should be user-friendly and informative