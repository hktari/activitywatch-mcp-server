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
                description: "Time periods to query. Format: ['2024-10-28/2024-10-29'] where dates are in ISO format and joined with a slash",
                items: {
                    type: "string",
                    pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9]{4}-[0-9]{2}-[0-9]{2}$",
                    description: "Time period in format 'start-date/end-date. to query today's data set 'start-date' to today's date and 'end-date' to tomorrow's date'"
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
        timeperiods?: string[];
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
            const browserBuckets = buckets.filter((b: Bucket) => b.type === 'web.tab.current');
            const stopwatchBuckets = buckets.filter((b: Bucket) => b.type === 'stopwatch');

            if (!windowBucketId || !afkBucketId) {
                throw new Error('Required buckets not found. Make sure aw-watcher-window and aw-watcher-afk are running.');
            }

            // Step 3: Create query with the categories
            const query = categoryQuery({
                bid_window: windowBucketId,
                bid_afk: afkBucketId,
                bid_browsers: browserBuckets.map((bucket: Bucket) => bucket.id),
                bid_stopwatch: stopwatchBuckets.map((bucket: Bucket) => bucket.id),
                categories: categories,
                filter_afk: true,
                include_audible: true,
            });

            // Step 4: Prepare timeperiods
            const startDate = args.startDate || moment().startOf('day').toISOString();
            const endDate = args.endDate || moment().endOf('day').toISOString();
            
            // Create time periods array
            let timeperiods: [Date, Date][] = [];
            
            if (args.timeperiods && args.timeperiods.length > 0) {
                // Use provided timeperiods
                timeperiods = args.timeperiods.map(period => {
                    const [start, end] = period.split('/');
                    return [new Date(start), new Date(end)];
                });
            } else {
                // Use startDate and endDate parameters
                // Note: For today's data, the client will automatically set end date to tomorrow
                timeperiods = [[new Date(startDate), new Date(endDate)]];
            }
            
            // Step 5: Execute query
            const queryStr = query.join('\n');
            const queryResult = await aw.query(queryStr, timeperiods);

            if (!queryResult || !queryResult.length || !queryResult[0].cat_events) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "No category data found."
                        }
                    ],
                    isError: false
                };
            }

            // Step 6: Process results
            const categories_data = queryResult[0].cat_events.reduce((acc: any, event: any) => {
                const category = event.$category || 'Uncategorized';
                if (category === 'Uncategorized' && !args.includeUncategorized) {
                    return acc;
                }

                if (!acc[category]) {
                    acc[category] = {
                        duration: 0,
                        events: []
                    };
                }

                acc[category].duration += event.duration;
                if (args.format !== "summary") {
                    if (acc[category].events.length < (args.limit || 5)) {
                        acc[category].events.push({
                            title: event.data.title || event.data.app,
                            app: event.data.app,
                            duration: event.duration,
                            url: event.data.url
                        });
                    }
                }

                return acc;
            }, {});

            return {
                timeperiod: timeperiods[0][0].toISOString() + '/' + timeperiods[0][1].toISOString(),
                categories: categories_data
            };
        } catch (error) {
            return handleApiError(error);
        }
    }
};
