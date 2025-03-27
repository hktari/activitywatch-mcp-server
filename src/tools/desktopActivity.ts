import axios from 'axios';
import moment from 'moment';
import { AW_API_BASE, handleApiError, toAWTimeperiod } from './utils.js';

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

            // Construct the query
            const query = `
                events = query_bucket('aw-watcher-window_');
                not_afk = query_bucket('aw-watcher-afk_');
                browser_events = query_bucket('aw-watcher-web-firefox_');

                events = filter_period_intersect(events, not_afk);
                title_events = sort_by_duration(merge_events_by_keys(events, ['app', 'title']));
                app_events = sort_by_duration(merge_events_by_keys(title_events, ['app']));
                cat_events = sort_by_duration(merge_events_by_keys(events, ['$category']));
                app_events = limit_events(app_events, 5);
                title_events = limit_events(title_events, 5);
                duration = sum_durations(events);

                browser_events = split_url_events(browser_events);
                browser_urls = merge_events_by_keys(browser_events, ['url']);
                browser_urls = sort_by_duration(browser_urls);
                browser_urls = limit_events(browser_urls, 5);
                browser_domains = merge_events_by_keys(browser_events, ['$domain']);
                browser_domains = sort_by_duration(browser_domains);
                browser_domains = limit_events(browser_domains, 5);
                browser_duration = sum_durations(browser_events);

                RETURN = {
                    'events': events,
                    'window': {
                        'app_events': app_events,
                        'title_events': title_events,
                        'cat_events': cat_events,
                        'active_events': not_afk,
                        'duration': duration
                    },
                    'browser': {
                        'domains': browser_domains,
                        'urls': browser_urls,
                        'duration': browser_duration
                    }
                };
            `;

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
