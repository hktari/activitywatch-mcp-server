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


## Issues
- npm run build is failing 
```
npm run build

> activitywatch-mcp-server@1.0.0 build
> tsc && npm run copy-files

src/index.ts:20:3 - error TS2353: Object literal may only specify known properties, and 'method' does not exist in type 'ZodObject<{ method: ZodLiteral<string>; }, UnknownKeysParam, ZodTypeAny, { method: string; }, { method: string; }>'.

20   method: bucketListTool.name,
     ~~~~~~


Found 1 error in src/index.ts:20

```