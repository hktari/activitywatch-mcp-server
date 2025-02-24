import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { bucketListTool } from "./bucketList.js";
import { queryTool } from "./query.js";

// Create server instance
const server = new Server({
  name: "activitywatch-server",
  version: "1.0.0"
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
        name: bucketListTool.name,
        description: bucketListTool.description,
        inputSchema: bucketListTool.inputSchema
      },
      {
        name: queryTool.name,
        description: queryTool.description,
        inputSchema: queryTool.inputSchema
      }
    ]
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Default empty object if arguments is undefined
  const args = request.params.arguments || {};
  
  if (request.params.name === bucketListTool.name) {
    // Cast to the expected type for the bucket list tool
    return await bucketListTool.handler({
      type: typeof args.type === 'string' ? args.type : undefined,
      includeData: Boolean(args.includeData)
    });
  } else if (request.params.name === queryTool.name) {
    // For the query tool, we need to ensure we have the required properties
    if (!args.timeperiods || !Array.isArray(args.timeperiods) || 
        !args.query || !Array.isArray(args.query)) {
      return {
        content: [{
          type: "text",
          text: "Error: Missing required parameters (timeperiods and query must be arrays)"
        }],
        isError: true
      };
    }
    
    return await queryTool.handler({
      timeperiods: args.timeperiods as string[],
      query: args.query as string[],
      name: typeof args.name === 'string' ? args.name : undefined
    });
  }
  
  throw new Error(`Tool not found: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ActivityWatch MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
