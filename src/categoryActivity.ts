import axios from 'axios';

// Base URL for ActivityWatch API
const AW_API_BASE = process.env.AW_API_BASE || "http://127.0.0.1:5600/api/0";

// Interfaces
export interface Category {
  name: string[];
  rule: {
    type: string;
    regex?: string;
    ignore_case?: boolean;
  };
}

export interface ActivityEvent {
  timestamp: string;
  duration: number;
  data: {
    app: string;
    title: string;
    [key: string]: any;
  };
}

interface CategoryActivitySummary {
  categories: {
    [key: string]: {
      subcategories: {
        [key: string]: {
          activities: {
            name: string;
            duration: number;
          }[];
          totalDuration: number;
        };
      };
      totalDuration: number;
    };
  };
  uncategorized: {
    activities: {
      name: string;
      duration: number;
    }[];
    totalDuration: number;
  };
}

// Get categories from ActivityWatch settings
async function getCategories(): Promise<Category[]> {
  try {
    const response = await axios.get(`${AW_API_BASE}/settings`);

    if (response.data && response.data.classes) {
      return response.data.classes.map((cls: any) => ({
        name: cls.name,
        rule: cls.rule
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

// Categorize an event based on app name and title
function categorizeEvent(event: ActivityEvent, categories: Category[]): string[] {
  // Default to uncategorized
  let matchedCategory: string[] = ['Uncategorized'];
  let maxSpecificity = 0;

  // Check each category for a match
  for (const category of categories) {
    if (category.rule.type === 'regex' && category.rule.regex) {
      const regex = new RegExp(category.rule.regex, category.rule.ignore_case ? 'i' : '');

      // Check if app name or title matches the regex
      const appMatch = regex.test(event.data.app);
      const titleMatch = regex.test(event.data.title);

      if (appMatch || titleMatch) {
        // Calculate specificity based on the match
        const specificity = (appMatch ? 2 : 0) + (titleMatch ? 1 : 0);

        // If this category is more specific, use it
        if (specificity > maxSpecificity) {
          matchedCategory = category.name;
          maxSpecificity = specificity;
        }
        else if (specificity === maxSpecificity) {
          console.warn(`Event matches multiple categories. Returning ${category.name} over ${matchedCategory}`);
          matchedCategory = category.name;
        }
      }
    }
  }

  return matchedCategory;
}

// Get available buckets from ActivityWatch
async function getBuckets() {
  try {
    const response = await axios.get(`${AW_API_BASE}/buckets`);
    return response.data;
  } catch (error) {
    console.error('Error fetching buckets:', error);
    throw new Error(`Failed to fetch buckets: ${error}`);
  }
}

// Find window, AFK, web, and VSCode bucket IDs
async function findBucketIds() {
  const buckets = await getBuckets();

  let windowBucketId = null;
  let afkBucketId = null;
  let webBucketIds: string[] = [];
  let vscodeBucketIds: string[] = [];

  // Find the first window and AFK buckets, and all web and vscode buckets
  for (const bucketId in buckets) {
    if (bucketId.startsWith('aw-watcher-window_')) {
      windowBucketId = bucketId;
    } else if (bucketId.startsWith('aw-watcher-afk_')) {
      afkBucketId = bucketId;
    } else if (bucketId.startsWith('aw-watcher-web-')) {
      webBucketIds.push(bucketId);
    } else if (bucketId.startsWith('aw-watcher-vscode_')) {
      vscodeBucketIds.push(bucketId);
    }
  }

  return { windowBucketId, afkBucketId, webBucketIds, vscodeBucketIds };
}

// Main function to get activities by category
async function getActivitiesByCategory(
  timeperiods: string[],
  format: 'detailed' | 'summary' = 'summary',
  includeUncategorized: boolean = true,
  limit: number = 5
): Promise<any> {
  try {
    // Get categories from settings
    const categories = await getCategories();

    // Get bucket IDs
    const { windowBucketId, afkBucketId, webBucketIds, vscodeBucketIds } = await findBucketIds();

    if (!windowBucketId || !afkBucketId) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "Could not find required buckets" })
        }]
      };
    }

    // Prepare query for window events when not AFK
    let queryString = `window_events = query_bucket('${windowBucketId}'); ` +
      `afk_events = query_bucket('${afkBucketId}'); ` +
      "not_afk = filter_keyvals(afk_events, 'status', ['not-afk']); " +
      "active_events = filter_period_intersect(window_events, not_afk); ";

    // Add web buckets if available
    if (webBucketIds.length > 0) {
      webBucketIds.forEach((bucketId, index) => {
        queryString += `web_events_${index} = query_bucket('${bucketId}'); `;
      });

      // Combine all web events
      if (webBucketIds.length > 1) {
        queryString += "web_events = concat_events(" +
          webBucketIds.map((_, index) => `web_events_${index}`).join(", ") +
          "); ";
      } else {
        queryString += "web_events = web_events_0; ";
      }

      // Filter web events when not AFK and add to active events
      queryString += "not_afk_web = filter_period_intersect(web_events, not_afk); " +
        "active_events = concat_events(active_events, not_afk_web); ";
    }

    // Add VSCode buckets if available
    if (vscodeBucketIds.length > 0) {
      vscodeBucketIds.forEach((bucketId, index) => {
        queryString += `vscode_events_${index} = query_bucket('${bucketId}'); `;
      });

      // Combine all VSCode events
      if (vscodeBucketIds.length > 1) {
        queryString += "vscode_events = concat_events(" +
          vscodeBucketIds.map((_, index) => `vscode_events_${index}`).join(", ") +
          "); ";
      } else {
        queryString += "vscode_events = vscode_events_0; ";
      }

      // Filter VSCode events when not AFK and add to active events
      queryString += "not_afk_vscode = filter_period_intersect(vscode_events, not_afk); " +
        "active_events = concat_events(active_events, not_afk_vscode); ";
    }

    // Return the active events
    queryString += "RETURN = active_events;";

    const queryData = {
      query: [queryString],
      timeperiods: timeperiods
    };

    // Query the ActivityWatch API
    const response = await axios.post(`${AW_API_BASE}/query/`, queryData);

    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "No data returned from query" })
        }]
      };
    }

    // Get the events from the first timeperiod
    const events = response.data[0] as ActivityEvent[];

    if (format === "detailed") {
      // For detailed format, categorize each event and return
      const categorizedEvents = events.map(event => ({
        ...event,
        category: categorizeEvent(event, categories)
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(categorizedEvents)
        }]
      };
    } else {
      // For summary format, aggregate by category
      const summary: CategoryActivitySummary = {
        categories: {},
        uncategorized: {
          totalDuration: 0,
          activities: []
        }
      };

      // Process each event
      for (const event of events) {
        const category = categorizeEvent(event, categories);
        const isUncategorized = category.length === 1 && category[0] === "Uncategorized";

        if (isUncategorized && !includeUncategorized) {
          continue;
        }

        // Extract app name for activity
        const activityName = event.data.app;

        if (isUncategorized) {
          // Add to uncategorized
          const existingActivity = summary.uncategorized.activities.find(a => a.name === activityName);

          if (existingActivity) {
            existingActivity.duration += event.duration;
          } else if (summary.uncategorized.activities.length < limit) {
            summary.uncategorized.activities.push({
              name: activityName,
              duration: event.duration
            });
          }

          summary.uncategorized.totalDuration += event.duration;
        } else {
          // Add to categorized
          const mainCategory = category[0];
          const subCategory = category.length > 1 ? category[1] : 'General';

          // Initialize category if it doesn't exist
          if (!summary.categories[mainCategory]) {
            summary.categories[mainCategory] = {
              subcategories: {},
              totalDuration: 0
            };
          }

          // Initialize subcategory if it doesn't exist
          if (!summary.categories[mainCategory].subcategories[subCategory]) {
            summary.categories[mainCategory].subcategories[subCategory] = {
              activities: [],
              totalDuration: 0
            };
          }

          // Add activity to subcategory
          const existingActivity = summary.categories[mainCategory].subcategories[subCategory].activities.find(
            a => a.name === activityName
          );

          if (existingActivity) {
            existingActivity.duration += event.duration;
          } else if (summary.categories[mainCategory].subcategories[subCategory].activities.length < limit) {
            summary.categories[mainCategory].subcategories[subCategory].activities.push({
              name: activityName,
              duration: event.duration
            });
          }

          // Update durations
          summary.categories[mainCategory].subcategories[subCategory].totalDuration += event.duration;
          summary.categories[mainCategory].totalDuration += event.duration;
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(summary)
        }]
      };
    }
  } catch (error) {
    console.error('Error getting activities by category:', error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ error: `Error: ${error}` })
      }]
    };
  }
}

// Export the tool
export const activitywatch_category_activity_tool = {
  name: "activitywatch_category_activity",
  description: "Get activities grouped by category from ActivityWatch",
  inputSchema: {
    type: "object",
    properties: {
      timeperiods: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Array of time periods in the format 'YYYY-MM-DD/YYYY-MM-DD'"
      },
      format: {
        type: "string",
        enum: ["detailed", "summary"],
        description: "Format of the output, either 'detailed' for all events with categories or 'summary' for aggregated data"
      },
      includeUncategorized: {
        type: "boolean",
        description: "Whether to include uncategorized activities in the results"
      },
      limit: {
        type: "number",
        description: "Maximum number of activities to return per category"
      }
    },
    required: ["timeperiods"]
  },
  handler: getActivitiesByCategory
};
