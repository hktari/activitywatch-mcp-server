import axios from 'axios';
import moment from 'moment';
import queries from '../lib/queries.js';
import { AW_API_BASE, handleApiError, getCategories, toAWTimeperiod, Bucket } from './utils.js';

export const activitywatch_category_activity_tool = {
    name: "activitywatch_category_activity",
    description: "Get activities by category from ActivityWatch",
    inputSchema: {
        type: "object",
        properties: {
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
            startDate: {
                type: "string",
                description: "Start date in ISO format (e.g. '2024-02-01'). If not provided, defaults to start of current day"
            },
            endDate: {
                type: "string",
                description: "End date in ISO format (e.g. '2024-02-28'). If not provided, defaults to end of current day"
            },
            format: {
                type: "string",
                enum: ["detailed", "summary"],
                default: "detailed",
                description: "Format of the output"
            },
            limit: {
                type: "number",
                default: 5,
                description: "Maximum number of activities to return per category"
            },
            includeUncategorized: {
                type: "boolean",
                default: true,
                description: "Whether to include uncategorized activities"
            }
        }
    },
    async handler(args: {
        timeperiods?: string[];
        startDate?: string;
        endDate?: string;
        format?: "detailed" | "summary";
        limit?: number;
        includeUncategorized?: boolean;
    }) {
        try {
            // Step 1: Get categories from settings
            const categories = await getCategories();

            // Step 2: Get required buckets
            const bucketsResponse = await axios.get(`${AW_API_BASE}/0/buckets`);
            const buckets: Bucket[] = Object.values(bucketsResponse.data);

            const windowBucketId = buckets.find(b => b.type === 'currentwindow')?.id;
            const afkBucketId = buckets.find(b => b.type === 'afkstatus')?.id;
            const browserBuckets = buckets.filter(b => b.type === 'web.tab.current');
            const stopwatchBucketId = buckets.find(b => b.type === 'stopwatch')?.id;

            if (!windowBucketId || !afkBucketId) {
                throw new Error('Required buckets not found (window or AFK)');
            }

            // Step 3: Create query with the categories
            const query = queries.categoryQuery({
                bid_window: windowBucketId,
                bid_afk: afkBucketId,
                bid_browsers: browserBuckets.map(bucket => bucket.id),
                bid_stopwatch: stopwatchBucketId,
                categories: categories,
                filter_categories: [],
                filter_afk: true,
                always_active_pattern: undefined
            });

            // Default to current day
            const startDate = args.startDate || moment().startOf('day').toISOString();
            const endDate = args.endDate || moment().endOf('day').toISOString();
            
            const timeperiod = toAWTimeperiod(startDate, endDate);
            // Step 5: Execute query
            const queryResult = await axios.post(`${AW_API_BASE}/query`, {
                timeperiods: [timeperiod],
                query: [query.join('')]
            });

            if (!queryResult.data || !queryResult.data.length || !queryResult.data[0].cat_events) {
                return {
                    timeperiod,
                    categories: {}
                };
            }

            // Step 6: Process results
            const categories_data = queryResult.data[0].cat_events.reduce((acc: any, event: any) => {
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
                timeperiod,
                categories: categories_data
            };
        } catch (error) {
            return handleApiError(error);
        }
    }
};
