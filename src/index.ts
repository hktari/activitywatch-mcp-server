import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { bucketListTool } from "./bucketList.js";

// Create server instance with both required arguments
const server = new Server(
  {
    name: "activitywatch-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {} // Enable tools capability
    }
  }
);

// Register the bucket list tool using setRequestHandler
server.setRequestHandler({
  method: bucketListTool.name,
  params: bucketListTool.inputSchema
}, bucketListTool.handler);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ActivityWatch MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});