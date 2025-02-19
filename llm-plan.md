# ActivityWatch MCP Server Development Plan

## Project Overview
Create an MCP server that allows Claude to interact with ActivityWatch, a privacy-first time tracking application. The server will enable Claude to query time tracking data and provide insights about time usage.

## Development Principles
- **Simplicity First**: Keep implementations simple and maintainable
- **Error Handling**: Implement comprehensive error handling
- **Incremental Development**: Build and test one feature at a time
- **Test-Driven**: Each feature should have clear testing criteria

## Current Status
✅ Phase 1: Core Setup Complete
- Created project structure using @modelcontextprotocol/sdk
- Configured TypeScript and build process
- Implemented test-connection tool
- Verified Claude Desktop integration
- Successfully tested ActivityWatch API connectivity

✅ Phase 2.1: Bucket List Tool Complete
- Implemented bucket listing with filtering
- Added comprehensive error handling
- Created thorough test suite
- Verified Claude Desktop integration
- Added metadata support

## Next Development Phases

### Phase 2.2: Query Tool Implementation (NEXT)
Goal: Create a robust query tool for ActivityWatch data analysis

1. **Basic Query Features**
   - Implement ActivityWatch query language support
   - Add time range parameters
   - Support basic query operations
   - Test: Basic query execution

2. **Advanced Query Features**
   - Support complex query operations
   - Add query parameter validation
   - Implement error handling
   - Test: Complex query validation

3. **Query Result Formatting**
   - Format results for readability
   - Add result summarization
   - Support different output formats
   - Test: Result formatting

### Phase 2.3: Event Fetching Tool
Goal: Implement direct event access from buckets

1. **Event Retrieval**
   - Get events from specific buckets
   - Add time range filtering
   - Support event type filtering
   - Test: Event fetching

2. **Event Processing**
   - Implement event data formatting
   - Add event metadata access
   - Support batch operations
   - Test: Event processing

### Phase 3: Analysis and Insights
Goal: Add tools for meaningful time tracking analysis

1. **Time Summary Tool**
   - Calculate application usage time
   - Generate daily/weekly summaries
   - Support category-based grouping
   - Test: Generate accurate time summaries

2. **Activity Analysis Tool**
   - Track productivity patterns
   - Generate activity heatmaps
   - Calculate focus metrics
   - Test: Analysis accuracy

3. **AFK Integration**
   - Track active/inactive periods
   - Calculate true productive time
   - Generate AFK statistics
   - Test: AFK detection accuracy

## Implementation Details

### Project Structure
```
activitywatch-mcp-server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── bucketList.ts         # Bucket listing tool (✅ COMPLETE)
│   ├── bucketList.test.ts    # Bucket tool tests (✅ COMPLETE)
│   ├── query.ts              # Query tool (🔄 NEXT)
│   └── query.test.ts         # Query tool tests (🔄 NEXT)
├── dist/                     # Compiled JavaScript
├── node_modules/            
├── package.json            
└── tsconfig.json           
```

### API Interface
```typescript
// Base URL for ActivityWatch API
const AW_API_BASE = "http://localhost:5600/api/0";

// Core endpoints
const ENDPOINTS = {
  buckets: `${AW_API_BASE}/buckets`,
  query: `${AW_API_BASE}/query`,
  events: (bucketId: string) => `${AW_API_BASE}/buckets/${bucketId}/events`,
  info: `${AW_API_BASE}/info`
};
```

## Testing Strategy

### Unit Testing
- Test individual tool functionality
- Verify error handling
- Test API integration
- Validate data transformations

### Integration Testing
- Test with Claude Desktop
- Verify real ActivityWatch data
- Test concurrent operations
- Validate error propagation

## Error Handling Strategy
- API connectivity errors (✅ Implemented)
- Invalid parameters (✅ Implemented)
- Data format issues (✅ Implemented)
- Network timeouts (✅ Implemented)
- Query validation errors (🔄 Next)

## Security Considerations
- Local-only operation
- Read-only access by default
- API request validation
- Data sanitization
- Rate limiting

## Next Immediate Steps
1. Implement Query Tool
   - Basic query execution
   - Query parameter validation
   - Result formatting
   - Error handling
   - Test suite
2. Test with Claude Desktop
3. Document query capabilities
4. Move on to Event Fetching Tool