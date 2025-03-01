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
    query: {
      type: "array",
      description: "MUST BE A SINGLE STRING containing all query statements separated by semicolons. DO NOT split into multiple strings.",
      items: {
        type: "string",
        description: "Complete query with all statements in one string separated by semicolons"
      },
      minItems: 1,
      maxItems: 1,
      examples: ["events = query_bucket('aw-watcher-window_UNI-qUxy6XHnLkk'); RETURN = events;"]
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
      // Construct the query request with correct ActivityWatch API format
      // ActivityWatch expects:
      // - timeperiods as an array of strings in format "start/end"
      // - query as an array of arrays where each inner array is a complete query
      
      // Process timeperiods to ensure correct format
      const formattedTimeperiods = args.timeperiods.map(period => {
        // If period already contains a slash, assume it's already properly formatted
        if (period.includes('/')) {
          return period;
        }
        // If we have exactly two timeperiods and no slashes, assume they need combining
        else if (args.timeperiods.length === 2 && args.timeperiods.indexOf(period) === 0) {
          return `${args.timeperiods[0]}/${args.timeperiods[1]}`;
        }
        // Otherwise use as is
        return period;
      });
      
      // Check if we received an already-wrapped array (from some MCP clients that may double-wrap)
      let isDoubleWrappedArray = false;
      let formattedQueries;
      
      // Try to detect if we're getting an array of arrays instead of array of strings
      if (args.query.length === 1 && Array.isArray(args.query[0])) {
        console.error("Detected double-wrapped array format from MCP client");
        isDoubleWrappedArray = true;
        // Just use the array directly since it's already in the format we need
        formattedQueries = args.query as unknown as string[][];
      } 
      // Check if it looks like we got query lines instead of a complete query
      // (We're detecting if each line ends with a semicolon and doesn't have a RETURN statement)
      else if (args.query.length > 1 && 
              args.query.some(q => q.trim().endsWith(';')) &&
              args.query.filter(q => q.includes('RETURN')).length <= 1) {
        // Join all the lines into a single query
        console.error("Detected multi-line query format, joining lines into a single query");
        const joinedQuery = args.query.join(' ');
        formattedQueries = [[joinedQuery]];
      } else {
        // Normal case - each query string should be wrapped in an array
        formattedQueries = args.query.map(q => [q]);
      }
      
      const queryData = {
        query: formattedQueries,
        timeperiods: formattedTimeperiods
      };
      
      // Log specific format problems we detected
      if (isDoubleWrappedArray) {
        console.error("Query format issue detected: MCP client sent double-wrapped array");
        console.error("Original query:\n" + JSON.stringify(args.query, null, 2));
        console.error("Used as-is:\n" + JSON.stringify(formattedQueries, null, 2));
      } else if (args.query.length > 1) {
        console.error("Query format issue detected: Claude separated query statements into multiple array items");
        console.error("Original query:\n" + JSON.stringify(args.query, null, 2));
        console.error("Reformatted as:\n" + JSON.stringify(formattedQueries, null, 2));
      }

      // Add an optional 'name' parameter to the URL if provided
      const urlParams = args.name ? `?name=${encodeURIComponent(args.name)}` : '';
      
      // Add detailed debug info about the API call we're making
      console.error(`Making request to ${AW_API_BASE}/query/${urlParams}`);
      console.error(`Input format received from tool call:`);
      console.error(`timeperiods: ${JSON.stringify(args.timeperiods)}`);
      console.error(`query: ${JSON.stringify(args.query)}`);
      console.error(`Transformed query data sent to ActivityWatch API:`);
      console.error(`${JSON.stringify(queryData, null, 2)}`);
      
      // Also add helpful debugging tip
      console.error(`Expected format from MCP client:`);
      console.error(JSON.stringify({
        "timeperiods": ["2024-10-28/2024-10-29"],
        "query": ["events = query_bucket('aw-watcher-window_UNI-qUxy6XHnLkk'); RETURN = events;"]
      }, null, 2));
      
      // Last-resort fix for handling problematic array nesting
      // If we see the brackets in the error message that suggests double-wrapping,
      // attempt to unwrap and rebuild the formattedQueries
      try {
        // Make the request to the ActivityWatch query endpoint
        const response = await axios.post(`${AW_API_BASE}/query/${urlParams}`, queryData);
        
        console.error(`Response received: Status ${response.status}`);
        
        // Create the response text with the query results
        const responseText = JSON.stringify(response.data, null, 2);
        
        // Add a helpful "Next Steps" section for future queries
        const helpText = `

------
⚠️ FORMAT GUIDE FOR FUTURE QUERIES ⚠️

For best results with future queries, always format your request like this:

{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('bucket-id'); another_statement; RETURN = result;"]
}

Important: All query statements must be in a SINGLE STRING within the array, not split into multiple array items.`;
        
        // Only add the help text if this was a successful query but had formatting issues
        const hadFormatIssues = isDoubleWrappedArray || args.query.length > 1;
        const finalResponseText = hadFormatIssues ? responseText + helpText : responseText;
        
        return {
          content: [
            {
              type: "text",
              text: finalResponseText
            }
          ]
        };
      } catch (error) {
        console.error("Error in initial query attempt, trying alternate format:", error);
        
        // Only retry with alternate format if it looks like a format error
        if (axios.isAxiosError(error) && 
            error.response?.status === 400 &&
            error.response?.data?.errors && 
            typeof error.response.data.errors === 'object') {
          
          const errorKeys = Object.keys(error.response.data.errors);
          const errorTexts = Object.values(error.response.data.errors);
          
          // Check if the error message contains the telltale signs of array format issues
          const isArrayFormatError = errorTexts.some(text => 
            typeof text === 'string' && (
              text.includes('is not of type \'string\'') ||
              text.includes('[') && text.includes(']')
            )
          );
          
          if (isArrayFormatError) {
            console.error("Detected array format error, trying to fix query format...");
            
            // Extract the actual query string from args
            let actualQuery = "";
            if (Array.isArray(args.query) && args.query.length > 0) {
              if (Array.isArray(args.query[0])) {
                // Handle double-wrapped array: [["query"]]
                actualQuery = Array.isArray(args.query[0][0]) ? 
                  args.query[0][0].toString() : args.query[0][0];
              } else {
                // Handle normal array: ["query"]
                actualQuery = args.query[0];
              }
            }
            
            console.error(`Extracted query: ${actualQuery}`);
            
            // Try a completely different format: just pass the direct query format ActivityWatch expects
            const fixedQueryData = {
              query: [actualQuery],  // Use a single array without the extra wrapping
              timeperiods: formattedTimeperiods
            };
            
            console.error("Trying with fixed format:", JSON.stringify(fixedQueryData, null, 2));
            
            try {
              const retryResponse = await axios.post(`${AW_API_BASE}/query/${urlParams}`, fixedQueryData);
              console.error(`Retry successful with status ${retryResponse.status}`);
              
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(retryResponse.data, null, 2) + `

------
⚠️ QUERY FORMAT CORRECTION APPLIED ⚠️

The server detected a format issue and automatically corrected it for you.
For future reference, please use the format:

{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('bucket-id'); RETURN = events;"]
}
`
                  }
                ]
              };
            } catch (retryError) {
              console.error("Error in retry attempt:", retryError);
              // Fall through to regular error handling
            }
          }
        }
      }
      
      // If we get here, either the initial request succeeded or our retry attempts failed
      // In that case, we'll fall through to the error handling below
      
    } catch (error) {
      console.error("Error in query tool:", error);
      
      // Check if the error is an Axios error with a response property
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        // Check for specific API validation error from the ActivityWatch API
        let errorMessage = `Query failed: ${error.message} (Status code: ${statusCode})`;
        
        // Look for the query formatting error signature in response data
        if (error.response?.data && 
            typeof error.response.data === 'object' && 
            error.response.data.errors && 
            Object.keys(error.response.data.errors || {}).some(key => key.startsWith('query.'))) {
          
          const isQueryArrayFormatError = Object.keys(error.response?.data?.errors || {}).some(key => 
            error.response?.data?.errors?.[key]?.includes('is not of type \'string\'') || false);
          
          if (isQueryArrayFormatError) {
            errorMessage = `ActivityWatch Query Format Error (400 Bad Request)

The query format sent to ActivityWatch is incorrect. ActivityWatch expects the query to be an array of arrays, where each inner array contains a complete query string.

The MCP server normally transforms your query automatically, but there may be an issue with the transformation process.

CORRECT format to send to the MCP server:
{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('bucket-id'); RETURN = events;"]
}

Note that the server will transform this to the format ActivityWatch expects ([[""]]), so DO NOT manually wrap your query in an extra array.

Common issues:
- Multi-level array nesting (sending arrays of arrays when the server expects arrays of strings)
- Splitting query statements into separate array items (they should be combined with semicolons)
- Malformed JSON in the request
`;
          }
        }
        
        // Log the full error details for debugging
        if (error.response) {
          const configData = error.response.config?.data ? 
            JSON.parse(typeof error.response.config.data === 'string' ? error.response.config.data : '{}') : 
            {};
          
          console.error("Full error details:", JSON.stringify({
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            headers: error.response.headers,
            config: {
              url: error.response.config?.url,
              method: error.response.config?.method,
              data: configData
            }
          }, null, 2));
        } else {
          console.error("Error with no response object:", error.message);
        }
        
        // Include response data if available
        if (error.response?.data) {
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

Input format may be incorrect. This API requires the following format:

{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('bucket-id'); RETURN = events;"]
}

Note that timeperiods must be formatted as start/end within a single string, and query must contain complete statements with semicolons.

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
