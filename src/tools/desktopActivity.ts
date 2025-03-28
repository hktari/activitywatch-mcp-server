import moment from 'moment';
import { handleApiError } from './utils.js';
import { aw, DesktopQueryParams, fullDesktopQuery, getCategories } from '../lib/aw-client/index.js';

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
            
            // Create timeperiod in the format expected by the AW client
            const startMoment = moment(startDate);
            const endMoment = moment(endDate);
            
            // Fetch categories
            const categories = await getCategories();

            // Host identifier - should be extracted from bucket names in production
            const hostname = "nb235988";
            const bid_window = `aw-watcher-window_${hostname}`;
            const bid_afk = `aw-watcher-afk_${hostname}`;
            
            // Create query parameters
            const queryParams: DesktopQueryParams = {
                categories: categories,
                bid_window: bid_window,
                bid_afk: bid_afk,
                bid_browsers: [],
                filter_categories: [],
                filter_afk: true,
                include_audible: true
            };
            
            // Generate the query
            const query = fullDesktopQuery(queryParams);
            
            // Convert to string for logging (optional)
            const queryStr = query.join('\n');
            console.debug('Query:', queryStr);
            
            try {
                // Execute query with our reimplemented client
                // Note: For today's data, the client will automatically set end date to tomorrow
                const response = await aw.query(
                    queryStr, 
                    [[startMoment.toDate(), endMoment.toDate()]]
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
