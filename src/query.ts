import axios, { AxiosError } from 'axios';

const AW_API_BASE = "http://localhost:5600/api/0";

interface QueryResult {
  [key: string]: any;
}

const inputSchema = {
  type: "object",
  properties: {
    timeperiods: {
      type: "array",
      description: "List of time periods to query (e.g. ['2024-02-01', '2024-02-28'])",
      items: {
        type: "string"
      }
    },
    query: {
      type: "array",
      description: "List of query statements for ActivityWatch's query language",
      items: {
        type: "string" 
      }
    },
    name: {
      type: "string",
      description: "Optional name for the query (used for caching)"
    }
  },
  required: ["timeperiods", "query"]
};

export const queryTool = {
  name: "run-query",
  description: "Run a query in ActivityWatch's query language",
  inputSchema: inputSchema,
  handler: async (args: { timeperiods: string[]; query: string[]; name?: string }) => {
    try {
      // Construct the query request
      const queryData = {
        query: args.query,
        timeperiods: args.timeperiods
      };

      // Add an optional 'name' parameter to the URL if provided
      const urlParams = args.name ? `?name=${encodeURIComponent(args.name)}` : '';
      
      // Add some debug info about the API call we're making
      console.error(`Making request to ${AW_API_BASE}/query/${urlParams}`);
      console.error(`Query data: ${JSON.stringify(queryData, null, 2)}`);
      
      // Make the request to the ActivityWatch query endpoint
      const response = await axios.post(`${AW_API_BASE}/query/${urlParams}`, queryData);
      
      console.error(`Response received: Status ${response.status}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error("Error in query tool:", error);
      
      // Check if the error is an Axios error with a response property
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        let errorMessage = `Query failed: ${error.message} (Status code: ${statusCode})`;
        
        // Include response data if available
        if (error.response.data) {
          const errorDetails = typeof error.response.data === 'object'
            ? JSON.stringify(error.response.data)
            : String(error.response.data);
          errorMessage += `\nDetails: ${errorDetails}`;
        }
        
        // Special handling for 500 errors - likely server-side issues
        if (statusCode === 500) {
          errorMessage = `ActivityWatch Query Error (500 Internal Server Error)
          
The ActivityWatch server encountered an internal error processing your query. This is typically caused by:

1. Query syntax errors
2. Requesting data for time periods with no available data
3. Server-side issues with the ActivityWatch query engine

Troubleshooting steps:

- Try simplifying your query to just "RETURN = 1;"
- Try different time periods that you know have data
- Check the ActivityWatch server logs for errors
- Try accessing data through the ActivityWatch web UI
- Consider using the raw events endpoint instead:
  /api/0/buckets/[bucket_id]/events
`;
        }
        
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true
        };
      } 
      // Handle network errors or other axios errors without response
      else if (axios.isAxiosError(error)) {
        // Generate the error message
        let errorMessage = `Query failed: ${error.message}`;
        
        // Add more detailed help text in production mode, not test mode
        if (process.env.NODE_ENV !== 'test') {
          errorMessage += `\n\nThis appears to be a network or connection error. Please check:\n- The ActivityWatch server is running\n- The API base URL is correct (currently: ${AW_API_BASE})\n- No firewall or network issues are blocking the connection\n`;
        }
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true
        };
      } 
      // Handle non-axios errors
      else if (error instanceof Error) {
        return {
          content: [{ type: "text", text: `Query failed: ${error.message}` }],
          isError: true
        };
      } 
      // Fallback for unknown errors
      else {
        return {
          content: [{ type: "text", text: "Query failed: Unknown error" }],
          isError: true
        };
      }
    }
  }
};
