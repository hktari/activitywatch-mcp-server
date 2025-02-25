# ActivityWatch MCP Server

A Model Context Protocol (MCP) server that connects to [ActivityWatch](https://activitywatch.net/), allowing LLMs like Claude to interact with your time tracking data.

## Features

- **List Buckets**: View all available ActivityWatch buckets
- **Run Queries**: Execute powerful AQL (ActivityWatch Query Language) queries
- **Get Raw Events**: Retrieve events directly from any bucket

## Installation

You can install the ActivityWatch MCP server either from npm or by building it yourself.

### Installing from npm (coming soon)

```bash
# Global installation
npm install -g activitywatch-mcp-server

# Or install locally
npm install activitywatch-mcp-server
```

### Building from Source

1. Clone this repository:
   ```bash
   git clone https://github.com/8bitgentleman/activitywatch-mcp-server.git
   cd activitywatch-mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Prerequisites

- [ActivityWatch](https://activitywatch.net/) installed and running
- Node.js (v14 or higher)
- Claude for Desktop (or any other MCP client)

## Usage

### Using with Claude for Desktop

1. Open your Claude for Desktop configuration file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the MCP server configuration:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "activitywatch-mcp-server",
      "args": []
    }
  }
}
```

If you built from source, use:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/path/to/activitywatch-mcp-server/dist/index.js"]
    }
  }
}
```

3. Restart Claude for Desktop
4. Look for the MCP icon in Claude's interface to confirm it's working

### Example Queries

Here are some example queries you can try in Claude:

- **List all your buckets**: "What ActivityWatch buckets do I have?"
- **Get application usage summary**: "Can you show me which applications I've used the most today?"
- **View browsing history**: "What websites have I spent the most time on today?"
- **Check productivity**: "How much time have I spent in productivity apps today?"

## Available Tools

### list-buckets

Lists all available ActivityWatch buckets with optional type filtering.

Parameters:
- `type` (optional): Filter buckets by type (e.g., "window", "web", "afk")
- `includeData` (optional): Include bucket data in response

### run-query

Run a query in ActivityWatch's query language (AQL).

Parameters:
- `timeperiods`: Time period(s) to query (e.g., "2023-10-28/2023-10-29")
- `query`: Array of query statements in ActivityWatch Query Language
- `name` (optional): Name for the query (used for caching)

Example query:
```javascript
["events = query_bucket('aw-watcher-window_hostname'); RETURN = events;"]
```

### get-events

Get raw events from an ActivityWatch bucket.

Parameters:
- `bucketId`: ID of the bucket to fetch events from
- `start` (optional): Start date/time in ISO format
- `end` (optional): End date/time in ISO format
- `limit` (optional): Maximum number of events to return

## Query Language Examples

ActivityWatch uses a simple query language. Here are some common patterns:

```
// Get window events
window_events = query_bucket(find_bucket("aw-watcher-window_"));
RETURN = window_events;

// Get only when not AFK
afk_events = query_bucket(find_bucket("aw-watcher-afk_"));
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);
window_events = filter_period_intersect(window_events, not_afk);
RETURN = window_events;

// Group by app
window_events = query_bucket(find_bucket("aw-watcher-window_"));
events_by_app = merge_events_by_keys(window_events, ["app"]);
RETURN = sort_by_duration(events_by_app);

// Filter by app name
window_events = query_bucket(find_bucket("aw-watcher-window_"));
code_events = filter_keyvals(window_events, "app", ["Code"]);
RETURN = code_events;
```

## Configuration

The server connects to the ActivityWatch API at `http://localhost:5600` by default. If your ActivityWatch instance is running on a different host or port, you can modify this in the source code.

## Troubleshooting

### ActivityWatch Not Running

If ActivityWatch isn't running, the server will show connection errors. Make sure ActivityWatch is running and accessible at http://localhost:5600.

### Query Errors

If you're encountering query errors:

1. Check your query syntax
2. Make sure the bucket IDs are correct
3. Verify that the timeperiods contain data
4. Check ActivityWatch logs for more details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
