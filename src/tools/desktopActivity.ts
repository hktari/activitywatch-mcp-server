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
    async handler(args: { startDate?: string; endDate?: string }) {
        try {
            const startDate = args.startDate || moment().startOf('day').toISOString();
            const endDate = args.endDate || moment().endOf('day').toISOString();
            const timeperiod = toAWTimeperiod(startDate, endDate);

            const buckets: { [id: Bucket['id']]: Bucket } = (await axios.get(`${AW_API_BASE}/buckets`)).data;

            const windowBucket = Object.values(buckets).find(b => b.id.includes('aw-watcher-window'));
            const afkBucket = Object.values(buckets).find(b => b.id.includes('aw-watcher-afk'));

            const categories = await getCategories();

            const query = fullDesktopQuery({
                categories,
                bid_window: windowBucket?.id || '',
                bid_afk: afkBucket?.id || '',
                filter_categories: [],
                bid_browsers: [],
                filter_afk: true,
            });

            const payload = {
                timeperiods: [timeperiod],
                query: [query.join('')]
            };
            
            try {
                const response = await axios.post(`${AW_API_BASE}/query`, payload);

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
