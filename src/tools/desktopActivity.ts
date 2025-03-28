import axios from 'axios';
import moment from 'moment';
import { handleApiError, toAWTimeperiod } from './utils.js';
import { aw, DesktopQueryParams, fullDesktopQuery, getCategories } from '../lib/aw-client/index.js';

// --- Interfaces (based on observed Python usage and AW structure) ---
interface AwEvent {
    duration: number; // Duration in seconds
    data: {
        $category?: string[];
        title?: string;
        [key: string]: any;
    };
    timestamp?: string;
    id?: number;
}

interface QueryResultPeriod {
    window?: {
        cat_events?: AwEvent[];
        title_events?: AwEvent[];
    };
    // Add other potential properties from the actual query result if known
    timestamp?: string;
    duration?: number;
}

// --- Helper Functions ---

/**
 * Formats duration in seconds to a human-readable string (e.g., "1h 05m 30s").
 */
function formatDuration(totalSeconds: number): string {
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
        // console.warn('Invalid duration input:', totalSeconds);
        return "0h 00m 00s"; // Return zero or an indicator for invalid input
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    // Pad minutes and seconds with leading zeros
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${hours}h ${paddedMinutes}m ${paddedSeconds}s`;
}

/**
 * Aggregates event durations by a key, sorts them, and formats the top N items.
 * Mimics the behavior of Python's print_top with tabulate.
 */
function getTopItems(
    events: AwEvent[] | undefined,
    getKey: (event: AwEvent) => string,
    title: string,
    limit: number = 10
): string[] {
    const output: string[] = [];
    if (!events || events.length === 0) {
        output.push(`--- Top ${limit} ${title} ---`);
        output.push("  (No data available)");
        output.push(''); // Add blank line
        return output;
    }

    // Aggregate duration by key
    const durationMap: Map<string, number> = new Map();
    for (const event of events) {
        // Ensure duration is a valid number, default to 0 if not
        const duration = typeof event.duration === 'number' && !isNaN(event.duration) ? event.duration : 0;
        const key = getKey(event);
        if (key) { // Ensure key is valid
            durationMap.set(key, (durationMap.get(key) || 0) + duration);
        }
    }

    // Sort by duration
    const sortedItems = Array.from(durationMap.entries())
        .sort(([, durationA], [, durationB]) => durationB - durationA);

    const topN = sortedItems.slice(0, limit);
    const numItems = sortedItems.length;

    output.push(`--- Top ${Math.min(limit, numItems)} ${title}${numItems > limit ? ` (out of ${numItems})` : ''} ---`);

    if (topN.length === 0) {
        output.push("  (No items found)");
    } else {
        // Simple table formatting
        const PADDING = 2;
        const durationHeader = 'Duration';
        const keyHeader = 'Key';
        // Calculate max lengths for alignment
        const maxDurationLength = Math.max(durationHeader.length, ...topN.map(([, duration]) => formatDuration(duration).length));
        const maxKeyLength = Math.max(keyHeader.length, ...topN.map(([key]) => key ? key.length : 0));

        // Headers
        output.push(`  ${durationHeader.padEnd(maxDurationLength + PADDING)}${keyHeader.padEnd(maxKeyLength)}`);
        // Separator line
        output.push(`  ${'- '.repeat(maxDurationLength).padEnd(maxDurationLength + PADDING)}${'- '.repeat(maxKeyLength)}`);
        // Data rows
        for (const [key, duration] of topN) {
            const formattedKey = key || '(empty)'; // Handle null/undefined keys
            output.push(`  ${formatDuration(duration).padEnd(maxDurationLength + PADDING)}${formattedKey.padEnd(maxKeyLength)}`);
        }
    }
    output.push(''); // Add a blank line for spacing

    return output;
}


// --- Main Formatting Function ---

/**
 * Formats the complex query response from the desktop activity query into
 * a human-readable text summary, including top categories, titles, and total duration.
 */
function formatQueryResponseAsSummary(response: any, limit: number = 10): { type: string, text: string }[] {
    const outputLines: string[] = [];

    // Basic validation of the response structure
    if (!Array.isArray(response) || response.length === 0) {
        return [{ type: "text", text: "No data or invalid format received in the query response." }];
    }

    // The Python code iterates through periods, let's assume response is QueryResultPeriod[]
    const periods = response as QueryResultPeriod[];

    for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        outputLines.push(`--- Period ${i + 1} ---`);

        // Safely access nested properties
        const catEvents = period?.window?.cat_events;
        const titleEvents = period?.window?.title_events;

        // --- Categories ---
        outputLines.push(...getTopItems(
            catEvents,
            (e: AwEvent) => e.data?.$category?.join(' > ') || 'Uncategorized',
            "Categories",
            limit
        ));

        // --- Titles ---
        outputLines.push(...getTopItems(
            titleEvents,
            (e: AwEvent) => e.data?.title || 'No Title',
            "Titles",
            limit
        ));

        // --- Total Duration ---
        // Python code used title_events for this calculation
        const totalDurationSeconds = (titleEvents || []).reduce((sum, e) => {
            const duration = typeof e.duration === 'number' && !isNaN(e.duration) ? e.duration : 0;
            return sum + duration;
        }, 0);
        outputLines.push(`Total Active Duration: ${formatDuration(totalDurationSeconds)}`);
        outputLines.push(''); // Add space before the next period or end
    }

    // Remove the final blank line if it exists
    if (outputLines[outputLines.length - 1] === '') {
        outputLines.pop();
    }

    return [{ type: "text", text: outputLines.join('\n') }];
}

export const activitywatch_desktop_activity_tool = {
    name: "activitywatch_desktop_activity",
    description: "Get a comprehensive view of desktop activity including window, browser, and AFK data",
    inputSchema: {
        type: "object",
        properties: {
            format: {
                type: "string",
                description: "Format of the output. 'detailed' for detailed output, 'summary' for summary output"
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
    async handler(args: { format?: string; startDate?: string; endDate?: string }) {
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

                if (args.format === 'detailed') {
                    return { content: [{ type: "json", text: JSON.stringify(response) }], isError: false };
                } else {
                    return { content: formatQueryResponseAsSummary(response), isError: false };
                }
            } catch (error) {
                return handleApiError(error);
            }
        } catch (error) {
            return handleApiError(error);
        }
    }
};

interface ToolResponse {
    content: { type: "text"; text: string }[];
    isError: boolean;
}