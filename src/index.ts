import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosError } from "axios";

// Create server instance
const server = new Server({
  name: "activitywatch-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Register tools using setRequestHandler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "test-connection",
      description: "Test connection to ActivityWatch server",
      inputSchema: {
        type: "object",
        properties: {}
      }
    }]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "test-connection") {
    try {
      const response = await axios.get("http://localhost:5600/api/0/info");
      return {
        content: [{
          type: "text",
          text: `Successfully connected to ActivityWatch ${response.data.version}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof AxiosError 
        ? error.message 
        : 'An unknown error occurred';
        
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Failed to connect to ActivityWatch: ${errorMessage}`
        }]
      };
    }
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Connect transport
const transport = new StdioServerTransport();
server.connect(transport).catch(error => {
  console.error("Failed to connect transport:", error);
  process.exit(1);
});
