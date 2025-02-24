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
      
      // Make the request to the ActivityWatch query endpoint
      const response = await axios.post(`${AW_API_BASE}/query/${urlParams}`, queryData);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error) {
      let errorMessage: string;
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          errorMessage = `Query failed: ${axiosError.message} (Status: ${axiosError.response.status})`;
          
          // Include response data if available for better error context
          if (axiosError.response.data) {
            const errorDetails = typeof axiosError.response.data === 'object' 
              ? JSON.stringify(axiosError.response.data) 
              : String(axiosError.response.data);
            errorMessage += `\nDetails: ${errorDetails}`;
          }
        } else {
          errorMessage = `Query failed: ${axiosError.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = `Query failed: ${error.message}`;
      } else {
        errorMessage = 'Query failed: Unknown error';
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
};
