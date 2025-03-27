import axios from 'axios';
import moment from 'moment';
import { AW_API_BASE, Bucket, getCategories, handleApiError, toAWTimeperiod } from './utils.js';
import { fullDesktopQuery } from '../lib/queries.js';

export const activitywatch_desktop_activity_tool = {
    name: "activitywatch_desktop_activity",
    description: "Get a comprehensive view of desktop activity including window, browser, and AFK data",
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
            }
        }
    },
    async handler(args: { timeperiods?: string[]; startDate?: string; endDate?: string }) {
        try {
            // Default to current day if no timeperiods provided
            if (!args.timeperiods || args.timeperiods.length === 0) {
                const startDate = args.startDate || moment().startOf('day').toISOString();
                const endDate = args.endDate || moment().endOf('day').toISOString();
                args.timeperiods = [toAWTimeperiod(startDate, endDate)];
            }

            const buckets: { [id: Bucket['id']]: Bucket } = (await axios.get(`${AW_API_BASE}/buckets`)).data;

            const windowBucket = Object.values(buckets).find(b => b.id.includes('aw-watcher-window'));
            const afkBucket = Object.values(buckets).find(b => b.id.includes('aw-watcher-afk'));

            const categories = await getCategories();

            // TODO: test
            const query = fullDesktopQuery({
                categories,
                bid_window: windowBucket?.id || '',
                bid_afk: afkBucket?.id || '',
                filter_categories: [],
                bid_browsers: [],
                filter_afk: true,
            });

            try {
                const response = await axios.post(`${AW_API_BASE}/query`, {
                    timeperiods: args.timeperiods,
                    query: [query]
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(response.data, null, 2)
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
