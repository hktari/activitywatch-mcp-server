import axios from 'axios';

const AW_API_BASE = "http://localhost:5600/api/0";

export const activitywatch_direct_query_tool = {
  name: "activitywatch_direct_query",
  description: "Run a direct query in ActivityWatch - simpler format with no transformations",
  inputSchema: {
    type: "object",
    properties: {
      timeperiods: {
        type: "array",
        description: "Time periods to query. Format: ['2024-10-28/2024-10-29'] where dates are in ISO format and joined with a slash",
        items: {
          type: "string",
          pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9]{4}-[0-9]{2}-[0-9]{2}$",
          description: "Time period in format 'start-date/end-date'"
        },
        minItems: 1,
        maxItems: 10,
        examples: ["2024-10-28/2024-10-29"]
      },
      queryText: {
        type: "string",
        description: "A single string containing all query statements separated by semicolons.",
        examples: ["events = query_bucket('aw-watcher-window_UNI-qUxy6XHnLkk'); RETURN = events;"]
      },
      name: {
        type: "string",
        description: "Optional name for the query (used for caching)"
      }
    },
    required: ["timeperiods", "queryText"]
  },
  handler: async (args: { timeperiods: string[]; queryText: string; name?: string }) => {
    try {
      console.error("DirectQuery received args:", JSON.stringify(args, null, 2));
      
      // Construct the query request with minimal transformation
      // ActivityWatch expects:
      // - timeperiods as an array of strings in format "start/end"
      // - query as an array of arrays
      
      const queryData = {
        query: [[args.queryText]],  // Direct format that AW expects
        timeperiods: args.timeperiods
      };
      
      console.error("Sending to ActivityWatch API:", JSON.stringify(queryData, null, 2));
      
      // Add an optional 'name' parameter to the URL if provided
      const urlParams = args.name ? `?name=${encodeURIComponent(args.name)}` : '';
      
      // Make the request to the ActivityWatch query endpoint
      const response = await axios.post(`${AW_API_BASE}/query/${urlParams}`, queryData);
      
      console.error(`Response received: Status ${response.status}`);
      
      // Return the successful response
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error("Error in direct query tool:", error);
      
      let errorMessage = "Query failed: ";
      
      if (axios.isAxiosError(error) && error.response) {
        errorMessage += `${error.message} (Status code: ${error.response.status})`;
        if (error.response.data) {
          errorMessage += `\nDetails: ${JSON.stringify(error.response.data)}`;
        }
      } else {
        errorMessage += error instanceof Error ? error.message : String(error);
      }
      
      return {
        content: [{ type: "text", text: errorMessage }],
        isError: true
      };
    }
  }
};
