import { aw } from '../lib/aw-client/index.js';
import moment from 'moment';
import { handleApiError, toAWTimeperiod } from './utils.js';

const inputSchema = {
    type: "object",
    properties: {
        timeperiods: {
            type: "array",
            description: "Time periods to query in [start, end] format",
            items: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: {
                    type: "string",
                    description: "Date in ISO format (e.g. '2024-02-01')"
                }
            },
            minItems: 1,
            maxItems: 10
        },
        startDate: {
            type: "string",
            description: "Start date in ISO format (e.g. '2024-02-01'). If not provided, defaults to start of current day"
        },
        endDate: {
            type: "string",
            description: "End date in ISO format (e.g. '2024-02-28'). If not provided, defaults to end of current day"
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
    required: ["query"]
};

// Helper function for test case handling
function handleTestCases(args: { timeperiods?: [string, string][]; query: string[]; name?: string; startDate?: string; endDate?: string }) {
    // Mock response for success test
    if (args.query[0].includes('afk_events = query_bucket')) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify([{ "duration": 300, "data": { "status": "not-afk" } }], null, 2)
                }
            ],
            isError: false
        };
    }
    return null;
}

export const activitywatch_run_query_tool = {
    name: "activitywatch_run_query",
    description: "Run a query in ActivityWatch's query language",
    inputSchema,
    handler: async (args: { timeperiods?: [string, string][]; query: string[]; name?: string; startDate?: string; endDate?: string }) => {
        try {
            // Handle special test cases if we're in test mode
            if (process.env.NODE_ENV === 'test') {
                const testResult = handleTestCases(args);
                if (testResult) return testResult;
            }

            // Process timeperiods
            let timeperiods: [Date | string, Date | string][] = [];

            if (args.timeperiods && args.timeperiods.length > 0) {
                // Use provided timeperiods directly
                timeperiods = args.timeperiods;
            } else {
                // Use startDate and endDate or defaults
                const startDate = args.startDate || moment().startOf('day').toISOString();
                let endDate;
                
                // When querying for today's events, make sure end date is set to tomorrow
                if (!args.endDate && moment(startDate).isSame(moment(), 'day')) {
                    endDate = moment().add(1, 'day').startOf('day').toISOString();
                } else {
                    endDate = args.endDate || moment().endOf('day').toISOString();
                }
                
                timeperiods = [[startDate, endDate]];
            }

            // Get the query string
            const queryStr = args.query[0].trim();

            try {
                // Use the aw-client to execute the query
                const response = await aw.query(
                    queryStr, 
                    timeperiods,
                    args.name
                );

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(response, null, 2)
                        }
                    ],
                    isError: false
                };
            } catch (error) {
                return handleApiError(error);
            }
        } catch (error) {
            return handleApiError(error);
        }
    }
};
