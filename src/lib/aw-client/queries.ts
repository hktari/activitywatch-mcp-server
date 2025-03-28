/**
 * Common queries for ActivityWatch
 * Based on aw_client/queries.py
 */
import { Category, getCategories } from './classes.js';

/**
 * Base query parameters
 */
export interface QueryParamsBase {
    bid_browsers?: string[];
    bid_stopwatch?: string[];
    categories?: Category[];
    filter_categories?: string[][];
    filter_afk?: boolean;
    include_audible?: boolean;
}

/**
 * Desktop query parameters
 */
export interface DesktopQueryParams extends QueryParamsBase {
    bid_window: string;
    bid_afk: string;
    always_active_pattern?: string;
}

/**
 * Android query parameters
 */
export interface AndroidQueryParams extends QueryParamsBase {
    bid_android: string;
}

/**
 * Type guard for desktop parameters
 */
export function isDesktopParams(params: QueryParamsBase): params is DesktopQueryParams {
    return 'bid_window' in params;
}

/**
 * Type guard for android parameters
 */
export function isAndroidParams(params: QueryParamsBase): params is AndroidQueryParams {
    return 'bid_android' in params;
}

/**
 * Escape double quotes in a string
 */
export function escapeDoubleQuote(s: string): string {
    return s.replace(/"/g, '\\"');
}

/**
 * Browser application names for different browsers
 */
export const browserAppnames: Record<string, string[]> = {
    "chrome": [
        // Chrome
        "Google Chrome",
        "Google-chrome",
        "chrome.exe",
        "google-chrome-stable",
        // Chromium
        "Chromium",
        "Chromium-browser",
        "Chromium-browser-chromium",
        "chromium.exe",
        // Pre-releases
        "Google-chrome-beta",
        "Google-chrome-unstable",
        // Brave (should this be merged with the brave entry?)
        "Brave-browser",
    ],
    "firefox": [
        "Firefox",
        "Firefox.exe",
        "firefox",
        "firefox.exe",
        "Firefox Developer Edition",
        "firefoxdeveloperedition",
        "Firefox-esr",
        "Firefox Beta",
        "Nightly",
        "org.mozilla.firefox",
    ],
    "opera": ["opera.exe", "Opera"],
    "brave": ["brave.exe"],
    "edge": [
        "msedge.exe",  // Windows
        "Microsoft Edge",  // macOS
    ],
    "vivaldi": ["Vivaldi-stable", "Vivaldi-snapshot", "vivaldi.exe"],
};

// Default limit for number of events
export const defaultLimit = 100;

/**
 * Convert a query string to an array of lines
 */
export function querystrToArray(querystr: string): string[] {
    return querystr
        .split(';')
        .map(s => s.trim())
        .filter(s => s)
        .map(s => s + ';');
}

/**
 * Find browser buckets
 */
function browserInBuckets(browser: string, browserbuckets: string[]): string | null {
    for (const bucket of browserbuckets) {
        if (bucket.includes(browser)) {
            return bucket;
        }
    }
    return null;
}

/**
 * Get browsers with buckets
 */
export function browsersWithBuckets(browserbuckets: string[]): [string, string][] {
    const browsersWithBuckets: [string, string][] = [];
    
    for (const browserName in browserAppnames) {
        const bucketId = browserInBuckets(browserName, browserbuckets);
        if (bucketId) {
            browsersWithBuckets.push([browserName, bucketId]);
        }
    }
    
    return browsersWithBuckets;
}

/**
 * Generate browser events query code
 */
export function browserEvents(params: DesktopQueryParams): string {
    if (!params.bid_browsers || params.bid_browsers.length === 0) {
        return "";
    }
    
    let code = "browser_events = [];";
    
    for (const [browserName, bucketId] of browsersWithBuckets(params.bid_browsers)) {
        const browserAppNamesStr = JSON.stringify(browserAppnames[browserName]);
        code += `
        events_${browserName} = flood(query_bucket("${bucketId}"));
        window_${browserName} = filter_keyvals(events, "app", ${browserAppNamesStr});
        events_${browserName} = filter_period_intersect(events_${browserName}, window_${browserName});
        events_${browserName} = split_url_events(events_${browserName});
        browser_events = concat(browser_events, events_${browserName});
        browser_events = sort_by_timestamp(browser_events);
        `;
    }
    
    return code;
}

/**
 * Generate canonical events query
 */
export function canonicalEvents(params: DesktopQueryParams | AndroidQueryParams): string {
    // Load categories if not provided
    if (!params.categories || params.categories.length === 0) {
        // Note: in actual use, you'd want to await this, but for the query creation we'll need 
        // to ensure categories are loaded before calling this function
        params.categories = [];
    }
    
    // Format categories for the query
    const categoriesStr = params.categories ? JSON.stringify(params.categories) : '';
    const categoryFilterStr = JSON.stringify(params.filter_categories || []);
    
    // Get appropriate bucket ID
    const bidWindow = isDesktopParams(params) ? params.bid_window : params.bid_android;
    
    // Build query lines
    const queryLines = [
        // Fetch window/app events
        `events = flood(query_bucket(find_bucket("${bidWindow}")));`,
    ];
    
    // On Android, merge events to avoid overload of events
    if (isAndroidParams(params)) {
        queryLines.push('events = merge_events_by_keys(events, ["app"]);');
    }
    
    // Fetch not-afk events
    if (isDesktopParams(params)) {
        queryLines.push(`
        not_afk = flood(query_bucket(find_bucket("${params.bid_afk}")));
        not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);
        `);
        
        // Handle always active pattern if specified
        if (isDesktopParams(params) && params.always_active_pattern) {
            queryLines.push(`
            not_treat_as_afk = filter_keyvals_regex(events, "app", "${params.always_active_pattern}");
            not_afk = period_union(not_afk, not_treat_as_afk);
            not_treat_as_afk = filter_keyvals_regex(events, "title", "${params.always_active_pattern}");
            not_afk = period_union(not_afk, not_treat_as_afk);
            `);
        }
    }
    
    // Fetch browser events
    if (isDesktopParams(params) && params.bid_browsers && params.bid_browsers.length > 0) {
        queryLines.push(browserEvents(params));
        
        // Include audible browser events as not-afk
        if (params.include_audible) {
            queryLines.push(`
            audible_events = filter_keyvals(browser_events, "audible", [true]);
            not_afk = period_union(not_afk, audible_events);
            `);
        }
    }
    
    // Filter events when user was AFK
    if (isDesktopParams(params) && params.filter_afk) {
        queryLines.push('events = filter_period_intersect(events, not_afk);');
    }
    
    // Categorize events
    if (params.categories && params.categories.length > 0) {
        queryLines.push(`events = categorize(events, ${categoriesStr});`);
    }
    
    // Filter by categories
    if (params.filter_categories && params.filter_categories.length > 0) {
        queryLines.push(`events = filter_keyvals(events, "$category", ${categoryFilterStr});`);
    }
    
    return queryLines.join('\n');
}

/**
 * Generate a query that returns events categorized by category
 */
export function categoryQuery(params: DesktopQueryParams | AndroidQueryParams): string[] {
    // First get the canonical events
    const eventsQuery = canonicalEvents(params);
    
    // Add the category-specific queries
    const query = `
    ${eventsQuery}
    cat_events = sort_by_duration(merge_events_by_keys(events, ["$category"]));
    
    RETURN = {
        "events": events,
        "cat_events": cat_events
    };
    `;
    
    return querystrToArray(query);
}

/**
 * Generate full desktop query
 */
export function fullDesktopQuery(params: DesktopQueryParams): string[] {
    // Escape special characters
    params.bid_window = escapeDoubleQuote(params.bid_window);
    params.bid_afk = escapeDoubleQuote(params.bid_afk);
    
    if (params.bid_browsers) {
        params.bid_browsers = params.bid_browsers.map(b => escapeDoubleQuote(b));
    }
    
    // Build the base query
    let query = `
    ${canonicalEvents(params)}
    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "title"]));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));
    app_events  = limit_events(app_events, ${defaultLimit});
    title_events  = limit_events(title_events, ${defaultLimit});
    duration = sum_durations(events);
    `;
    
    // Add browser-related query parts if browser buckets exist
    if (params.bid_browsers && params.bid_browsers.length > 0) {
        query += `
        browser_events = split_url_events(browser_events);
        browser_urls = merge_events_by_keys(browser_events, ["url"]);
        browser_urls = sort_by_duration(browser_urls);
        browser_urls = limit_events(browser_urls, ${defaultLimit});
        browser_domains = merge_events_by_keys(browser_events, ["$domain"]);
        browser_domains = sort_by_duration(browser_domains);
        browser_domains = limit_events(browser_domains, ${defaultLimit});
        browser_duration = sum_durations(browser_events);
        `;
    } else {
        query += `
        browser_events = [];
        browser_urls = [];
        browser_domains = [];
        browser_duration = 0;
        `;
    }
    
    // Add the return statement
    query += `
    RETURN = {
        "events": events,
        "window": {
            "app_events": app_events,
            "title_events": title_events,
            "cat_events": cat_events,
            "active_events": not_afk,
            "duration": duration
        },
        "browser": {
            "domains": browser_domains,
            "urls": browser_urls,
            "duration": browser_duration
        }
    };
    `;
    
    // Convert to array of lines for the query API
    return querystrToArray(query);
}
