import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { activitywatch_list_buckets_tool } from "./tools/bucketList.js";
import { activitywatch_run_query_tool } from "./tools/runQuery.js";
import { activitywatch_desktop_activity_tool } from "./tools/desktopActivity.js";
import { activitywatch_category_activity_tool } from "./tools/categoryActivity.js";
import { activitywatch_get_events_tool } from "./tools/rawEvents.js";
import { activitywatch_query_examples_tool } from "./tools/queryExamples.js";
import { activitywatch_get_settings_tool } from "./tools/getSettings.js";

// Helper function to handle type-safe tool responses
const makeSafeToolResponse = (handler: Function) => async (...args: any[]) => {
  try {
    const result = await handler(...args);
    if (!result) {
      return {
        content: [{ type: "text", text: "Error: Tool handler returned no result" }],
        isError: true
      };
    }
    return result;
  } catch (error) {
    console.error("Tool execution error:", error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

// Create server instance
const server = new Server({
  name: "activitywatch-server",
  version: "1.1.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Register tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: activitywatch_list_buckets_tool.name,
        description: activitywatch_list_buckets_tool.description,
        inputSchema: activitywatch_list_buckets_tool.inputSchema
      },
      {
        name: activitywatch_query_examples_tool.name,
        description: activitywatch_query_examples_tool.description,
        inputSchema: activitywatch_query_examples_tool.inputSchema
      },
      {
        name: activitywatch_run_query_tool.name,
        description: activitywatch_run_query_tool.description,
        inputSchema: activitywatch_run_query_tool.inputSchema
      },
      {
        name: activitywatch_desktop_activity_tool.name,
        description: activitywatch_desktop_activity_tool.description,
        inputSchema: activitywatch_desktop_activity_tool.inputSchema
      },
      {
        name: activitywatch_category_activity_tool.name,
        description: activitywatch_category_activity_tool.description,
        inputSchema: activitywatch_category_activity_tool.inputSchema
      },
      {
        name: activitywatch_get_events_tool.name,
        description: activitywatch_get_events_tool.description,
        inputSchema: activitywatch_get_events_tool.inputSchema
      },
      {
        name: activitywatch_get_settings_tool.name,
        description: activitywatch_get_settings_tool.description,
        inputSchema: activitywatch_get_settings_tool.inputSchema
      }
    ]
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  // Default empty object if arguments is undefined
  let args = request.params.arguments || {};

  if (request.params.name === activitywatch_list_buckets_tool.name) {
    return makeSafeToolResponse(activitywatch_list_buckets_tool.handler)(args);
  } else if (request.params.name === activitywatch_query_examples_tool.name) {
    return makeSafeToolResponse(activitywatch_query_examples_tool.handler)(args);
  } else if (request.params.name === activitywatch_run_query_tool.name) {
    // For the query tool, we need to validate and normalize the args

    // First, log the raw arguments to debug format issues
    console.error(`\nRAW ARGS FROM MCP CLIENT:`);
    console.error(JSON.stringify(args, null, 2));

    // Validate timeperiods
    if (!args.timeperiods || !Array.isArray(args.timeperiods)) {
      return formatValidationError('timeperiods', 'must be an array of timeperiod strings');
    }

    // Validate query
    if (!args.query || !Array.isArray(args.query) || args.query.length !== 1) {
      return formatValidationError('query', 'must be an array with exactly one string element');
    }

    const queryArgs = {
      timeperiods: args.timeperiods,
      query: args.query,
      name: args.name
    };

    return makeSafeToolResponse(activitywatch_run_query_tool.handler)(queryArgs);
  } else if (request.params.name === activitywatch_desktop_activity_tool.name) {
    return makeSafeToolResponse(activitywatch_desktop_activity_tool.handler)(args);
  } else if (request.params.name === activitywatch_category_activity_tool.name) {
    return makeSafeToolResponse(activitywatch_category_activity_tool.handler)(args);
  } else if (request.params.name === activitywatch_get_events_tool.name) {
    // For the raw events tool
    if (!args.bucketId || typeof args.bucketId !== 'string') {
      return makeSafeToolResponse(() => ({
        content: [{
          type: "text",
          text: "Error: bucketId must be a string"
        }],
        isError: true
      }))();
    }

    return makeSafeToolResponse(activitywatch_get_events_tool.handler)(args);
  } else if (request.params.name === activitywatch_get_settings_tool.name) {
    return makeSafeToolResponse(activitywatch_get_settings_tool.handler)(args);
  } else {
    return {
      content: [{
        type: "text",
        text: `Unknown tool: ${request.params.name}`
      }],
      isError: true
    };
  }
});

// Helper function to return a nicely formatted validation error
function formatValidationError(paramName: string, message: string) {
  return {
    content: [{
      type: "text",
      text: `Error: Invalid query format.

The correct format for the 'run-query' tool is:

{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('bucket-id'); another_statement; RETURN = result;"]
}

NOTE THE FORMAT:
1. 'timeperiods' is an array with date ranges formatted as start/end with a slash
2. 'query' is an array with a SINGLE STRING containing all statements
3. All query statements must be in the same string, separated by semicolons

COMMON ERRORS:
- Splitting query statements into separate array items (WRONG)
- Not using semicolons between statements
- Not wrapping query in an array
- Double-wrapping the query in nested arrays (some MCP clients may do this)

DEBUGGING TIP:
If you're working with an MCP client that consistently produces errors, try examining the exact format 
of the query parameter it sends. The server tries to automatically detect and handle various formats, 
but may need additional configuration.

${paramName} ${message}
`
    }],
    isError: true
  };
}

async function main() {
  console.error("=======================");
  console.error("ActivityWatch MCP Server");
  console.error("=======================");
  console.error("Version: 1.1.0");
  console.error("API Endpoint: http://localhost:5600/api/0");
  console.error("Tools: activitywatch_list_buckets, activitywatch_query_examples, activitywatch_run_query, activitywatch_get_events, activitywatch_get_settings, activitywatch_category_activity");
  console.error("=======================");
  console.error("For help with query format, use the 'activitywatch_query_examples' tool first");
  console.error("'activitywatch_run_query' Example format:");
  console.error("  {");
  console.error("    \"timeperiods\": [\"2024-10-28/2024-10-29\"],");
  console.error("    \"query\": [\"events = query_bucket('aw-watcher-window_UNI-qUxy6XHnLkk'); RETURN = events;\"]");
  console.error("  }");
  console.error("IMPORTANT: The query array must contain a single string with ALL statements joined with semicolons;");
  console.error("the statements should NOT be split into separate array elements.");
  console.error("NOTE: Some MCP clients may wrap the query in an additional array. The server attempts to detect");
  console.error("and handle this automatically but may produce confusing error messages if detection fails.");

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ActivityWatch MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
