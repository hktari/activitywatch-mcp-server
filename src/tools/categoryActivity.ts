import moment from 'moment';
import { handleApiError } from './utils.js';
import { aw, DesktopQueryParams, categoryQuery, getCategories } from '../lib/aw-client/index.js';

// Define a bucket interface for type safety
interface Bucket {
    id: string;
    type: string;
    hostname: string;
    [key: string]: any;
}

// Helper function to format durations
function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
}

// Format the response based on the requested format
function formatResponse(queryResult: any, args: {
    format?: "detailed" | "summary";
    limit?: number;
    includeUncategorized?: boolean;
    timeperiod?: string;
}): any {
    if (!queryResult || !queryResult.length || !queryResult[0].cat_events) {
        return {
            content: [{ type: "text", text: "No category data found." }],
            isError: false
        };
    }

    // Process results
    const categories_data = queryResult[0].cat_events.reduce((acc: any, event: any) => {
        const category = event.data.$category || ['Uncategorized'];
        const categoryKey = Array.isArray(category) ? category.join(' > ') : category;
        
        if (categoryKey === 'Uncategorized' && args.includeUncategorized === false) {
            return acc;
        }

        if (!acc[categoryKey]) {
            acc[categoryKey] = {
                duration: 0,
                events: []
            };
        }

        acc[categoryKey].duration += event.duration;
        
        if (args.format !== "summary") {
            if (acc[categoryKey].events.length < (args.limit || 5)) {
                acc[categoryKey].events.push({
                    title: event.data.title || event.data.app,
                    app: event.data.app,
                    duration: event.duration,
                    url: event.data.url
                });
            }
        }

        return acc;
    }, {});

    // For summary format, create a text-based output
    if (args.format === "summary") {
        const lines: string[] = [];
        lines.push("--- Category Activity Summary ---");
        if (args.timeperiod) {
            lines.push(`Time period: ${args.timeperiod}`);
        }
        lines.push("");
        
        // Sort categories by duration
        const sortedCategories = Object.entries(categories_data)
            .sort(([, a]: [string, any], [, b]: [string, any]) => b.duration - a.duration);
        
        for (const [category, data] of sortedCategories) {
            lines.push(`${category}: ${formatDuration((data as any).duration)}`);
        }
        
        return {
            content: [{ type: "text", text: lines.join('\n') }],
            isError: false
        };
    }
    
    // For detailed format, return structured data
    return {
        content: [{
            type: "text",
            text: JSON.stringify({
                timeperiod: args.timeperiod,
                categories: categories_data
            })
        }],
        isError: false
    };
}

export const activitywatch_category_activity_tool = {
    name: "activitywatch_category_activity",
    description: "Get activities by category from ActivityWatch",
    inputSchema: {
        type: "object",
        properties: {
            startDate: {
                type: "string",
                description: "Start date in ISO format (e.g. '2024-02-01'). If not provided, defaults to start of current day"
            },
            endDate: {
                type: "string",
                description: "End date in ISO format (e.g. '2024-02-28'). If not provided, defaults to end of current day"
            },
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
            limit: {
                type: "number",
                description: "Maximum number of activities to return per category",
                default: 5
            },
            format: {
                type: "string",
                enum: ["detailed", "summary"],
                description: "Format of the output",
                default: "detailed"
            },
            includeUncategorized: {
                type: "boolean",
                description: "Whether to include uncategorized activities",
                default: true
            }
        }
    },
    async handler(args: {
        startDate?: string;
        endDate?: string;
        timeperiods?: [string, string][];
        limit?: number;
        format?: "detailed" | "summary";
        includeUncategorized?: boolean;
    }) {
        try {
            // Step 1: Get the categories
            const categories = await getCategories();

            // Step 2: Get required buckets
            const bucketsResponse = await aw.getBuckets();
            const buckets: Bucket[] = Object.values(bucketsResponse);

            const windowBucketId = buckets.find((b: Bucket) => b.type === 'currentwindow')?.id;
            const afkBucketId = buckets.find((b: Bucket) => b.type === 'afkstatus')?.id;

            if (!windowBucketId || !afkBucketId) {
                throw new Error('Required buckets not found. Make sure aw-watcher-window and aw-watcher-afk are running.');
            }

            // Step 3: Create query with the categories
            const queryParams: DesktopQueryParams = {
                bid_window: windowBucketId,
                bid_afk: afkBucketId,
                bid_browsers: [],
                categories: categories,
                filter_afk: true,
                include_audible: true,
            };
            
            const query = categoryQuery(queryParams);

            // Step 4: Prepare timeperiods
            let timeperiods: [Date | string, Date | string][] = [];
            let timeperiodStr: string = '';
            
            if (args.timeperiods && args.timeperiods.length > 0) {
                // Use provided timeperiods directly
                timeperiods = args.timeperiods;
                timeperiodStr = args.timeperiods.map(([start, end]) => `${start}/${end}`).join(', ');
            } else {
                // Use startDate and endDate parameters
                const startDate = args.startDate || moment().startOf('day').toISOString();
                
                // When querying for today's events, make sure end date is set to tomorrow
                let endDate = args.endDate;
                if (!endDate && moment(startDate).isSame(moment(), 'day')) {
                    endDate = moment().add(1, 'day').startOf('day').toISOString();
                } else {
                    endDate = endDate || moment().endOf('day').toISOString();
                }
                
                timeperiods = [[startDate, endDate]];
                timeperiodStr = `${startDate}/${endDate}`;
            }
            
            // Step 5: Execute query
            const queryStr = query.join('\n');
            const queryResult = await aw.query(queryStr, timeperiods);

            // Step 6: Format and return the results
            return formatResponse(queryResult, {
                format: args.format,
                limit: args.limit,
                includeUncategorized: args.includeUncategorized,
                timeperiod: timeperiodStr
            });
            
        } catch (error) {
            return handleApiError(error);
        }
    }
};
