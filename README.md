# ActivityWatch MCP Server

An MCP server for interacting with ActivityWatch, a privacy-first, open-source time tracking application.

## Features

The server currently provides the following MCP tools:

### 1. `list-buckets`

List all ActivityWatch buckets with optional filtering.

**Parameters:**
- `type` (string, optional): Filter buckets by type
- `includeData` (boolean, optional): Include bucket data in response

**Example usage:**
```
Can you list all the window tracking buckets in ActivityWatch?
```

### 2. `run-query`

Run queries using ActivityWatch's query language.

**Parameters:**
- `timeperiods` (string[], required): List of time periods to query (e.g. ['2024-02-01', '2024-02-28'])
- `query` (string[], required): List of query statements for ActivityWatch's query language
- `name` (string, optional): Optional name for the query (used for caching)

**Example usage:**
```
Can you show me a summary of my computer usage for the past week?
```

## Installation

### Prerequisites
- Node.js 16 or higher
- ActivityWatch running locally (default: http://localhost:5600)

### Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/activitywatch-mcp-server.git
cd activitywatch-mcp-server
```

2. Install dependencies
```bash
npm install
```

3. Build the server
```bash
npm run build
```

4. Run the server
```bash
npm start
```

## Integration with Claude Desktop

Add the following to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/absolute/path/to/activitywatch-mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Development

Run tests:
```bash
npm test
```

Run with watch mode:
```bash
npm run dev
```

## License

This project is open-source and available under the MIT license.
