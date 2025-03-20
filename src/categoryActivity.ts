import axios from 'axios';

// Base URL for ActivityWatch API
const AW_API_BASE = process.env.AW_API_BASE || "http://127.0.0.1:5600/api/0";

// Interfaces
export interface Category {
  name: string | string[];
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
  bucket: string;
  sourceType: string;
}

interface CategoryActivitySummary {
  categories: {
    [key: string]: {
      subcategories: {
        [key: string]: {
          activities: {
            name: string;
            duration: number;
            formattedDuration: string;
          }[];
          totalDuration: number;
          formattedTotalDuration: string;
        };
      };
      totalDuration: number;
      formattedTotalDuration: string;
    };
  };
  uncategorized: {
    activities: {
      name: string;
      duration: number;
      formattedDuration: string;
    }[];
    totalDuration: number;
    formattedTotalDuration: string;
  };
}

// Helper function to format duration in seconds to hours and minutes
function formatDuration(durationInSeconds: number): string {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
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

// Categorize an event based on all data properties
function categorizeEvent(event: ActivityEvent, categories: Category[]): string[] {
  // Default to uncategorized
  let matchedCategory: string[] = ['Uncategorized'];
  let maxSpecificity = 0;

  // Check each category for a match
  for (const category of categories) {
    if (category.rule.type === 'regex' && category.rule.regex) {
      const regex = new RegExp(category.rule.regex, category.rule.ignore_case ? 'i' : '');
      let specificity = 0;

      // Check all properties in the data object for matches
      for (const key in event.data) {
        if (event.data[key] && typeof event.data[key] === 'string') {
          if (regex.test(event.data[key])) {
            // Different properties have different weights
            if (key === 'app') {
              specificity += 3; // Highest priority
            } else if (key === 'title' || key === 'project') {
              specificity += 2; // Medium priority
            } else {
              specificity += 1; // Lower priority for other fields
            }
          }
        }
      }

      if (specificity > 0) {
        // If this category is more specific, use it
        if (specificity > maxSpecificity) {
          // Handle category names with slashes (e.g., "Work/Programming/Hisense")
          matchedCategory = typeof category.name === 'string' ? 
            category.name.split('/') : 
            Array.isArray(category.name) ? category.name : ['Uncategorized'];
          
          maxSpecificity = specificity;
        }
        else if (specificity === maxSpecificity) {
          const currentCategoryStr = matchedCategory.join('/');
          const newCategoryStr = typeof category.name === 'string' ? 
            category.name : 
            Array.isArray(category.name) ? category.name.join('/') : 'Uncategorized';
            
          console.warn(`Event matches multiple categories with same specificity. Returning ${newCategoryStr} over ${currentCategoryStr}`);
          
          matchedCategory = typeof category.name === 'string' ? 
            category.name.split('/') : 
            Array.isArray(category.name) ? category.name : ['Uncategorized'];
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

    // Create an array to store all events
    let allEvents: ActivityEvent[] = [];

    // Helper function to query events for a bucket
    const queryEventsForBucket = async (bucketId: string, sourceType: string): Promise<void> => {
      // Base query to get active events (not AFK)
      let queryString = 
        `events = query_bucket('${bucketId}'); ` +
        `afk_events = query_bucket('${afkBucketId}'); ` +
        "not_afk = filter_keyvals(afk_events, 'status', ['not-afk']); " +
        "active_events = filter_period_intersect(events, not_afk); ";
      
      // Add merge operation based on source type
      if (sourceType === 'window') {
        // For window events, merge by app
        queryString += "merged_events = merge_events_by_keys(active_events, ['app']); ";
        queryString += "sorted_events = sort_by_duration(merged_events); ";
        queryString += `limited_events = limit_events(sorted_events, ${limit}); `;
        queryString += "RETURN = limited_events;";
      } else if (sourceType === 'web') {
        // For web events, merge by title and url
        queryString += "merged_events = merge_events_by_keys(active_events, ['title', 'url']); ";
        queryString += "sorted_events = sort_by_duration(merged_events); ";
        queryString += `limited_events = limit_events(sorted_events, ${limit}); `;
        queryString += "RETURN = limited_events;";
      } else if (sourceType === 'vscode') {
        // For vscode events, merge by file and project
        queryString += "merged_events = merge_events_by_keys(active_events, ['file', 'project']); ";
        queryString += "sorted_events = sort_by_duration(merged_events); ";
        queryString += `limited_events = limit_events(sorted_events, ${limit}); `;
        queryString += "RETURN = limited_events;";
      } else {
        // Fallback - just return the active events sorted and limited
        queryString += "sorted_events = sort_by_duration(active_events); ";
        queryString += `limited_events = limit_events(sorted_events, ${limit}); `;
        queryString += "RETURN = limited_events;";
      }

      const queryData = {
        query: [queryString],
        timeperiods: timeperiods
      };

      const response = await axios.post(`${AW_API_BASE}/query/`, queryData);
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Add sourceType to each event in the array
        const eventsWithSource = response.data[0].map((event: ActivityEvent) => ({
          ...event,
          bucket: bucketId,
          sourceType: sourceType,
          formattedDuration: formatDuration(event.duration)
        }));
        allEvents = [...allEvents, ...eventsWithSource];
      }
    };

    // Query window events
    await queryEventsForBucket(windowBucketId, 'window');

    // Query web events
    for (const bucketId of webBucketIds) {
      await queryEventsForBucket(bucketId, 'web');
    }

    // Query VSCode events
    for (const bucketId of vscodeBucketIds) {
      await queryEventsForBucket(bucketId, 'vscode');
    }

    // If no events were found, return an error
    if (allEvents.length === 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "No data returned from queries" })
        }]
      };
    }

    if (format === "detailed") {
      // For detailed format, categorize each event and return
      const categorizedEvents = allEvents.map(event => ({
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
          formattedTotalDuration: '0m',
          activities: []
        }
      };

      // Process each event
      for (const event of allEvents) {
        const category = categorizeEvent(event, categories);
        const isUncategorized = category.length === 1 && category[0] === "Uncategorized";

        if (isUncategorized && !includeUncategorized) {
          continue;
        }

        // Extract name for activity based on source type
        let activityName = "";
        if (event.sourceType === 'window') {
          activityName = event.data.app || "Unknown App";
        } else if (event.sourceType === 'web') {
          activityName = event.data.title || event.data.url || "Unknown Web Page";
        } else if (event.sourceType === 'vscode') {
          activityName = event.data.file || event.data.project || "Unknown File";
        } else {
          activityName = event.data.app || event.data.title || "Unknown Activity";
        }

        if (isUncategorized) {
          // Add to uncategorized
          const existingActivity = summary.uncategorized.activities.find(a => a.name === activityName);

          if (existingActivity) {
            existingActivity.duration += event.duration;
            existingActivity.formattedDuration = formatDuration(existingActivity.duration);
          } else if (summary.uncategorized.activities.length < limit) {
            summary.uncategorized.activities.push({
              name: activityName,
              duration: event.duration,
              formattedDuration: formatDuration(event.duration)
            });
          }

          summary.uncategorized.totalDuration += event.duration;
          summary.uncategorized.formattedTotalDuration = formatDuration(summary.uncategorized.totalDuration);
        } else {
          // Add to categorized
          const mainCategory = category[0];
          const subCategory = category.length > 1 ? category[1] : 'General';

          // Initialize category if it doesn't exist
          if (!summary.categories[mainCategory]) {
            summary.categories[mainCategory] = {
              subcategories: {},
              totalDuration: 0,
              formattedTotalDuration: '0m'
            };
          }

          // Initialize subcategory if it doesn't exist
          if (!summary.categories[mainCategory].subcategories[subCategory]) {
            summary.categories[mainCategory].subcategories[subCategory] = {
              activities: [],
              totalDuration: 0,
              formattedTotalDuration: '0m'
            };
          }

          // Add activity to subcategory
          const existingActivity = summary.categories[mainCategory].subcategories[subCategory].activities.find(
            a => a.name === activityName
          );

          if (existingActivity) {
            existingActivity.duration += event.duration;
            existingActivity.formattedDuration = formatDuration(existingActivity.duration);
          } else if (summary.categories[mainCategory].subcategories[subCategory].activities.length < limit) {
            summary.categories[mainCategory].subcategories[subCategory].activities.push({
              name: activityName,
              duration: event.duration,
              formattedDuration: formatDuration(event.duration)
            });
          }

          // Update durations
          summary.categories[mainCategory].subcategories[subCategory].totalDuration += event.duration;
          summary.categories[mainCategory].subcategories[subCategory].formattedTotalDuration = formatDuration(summary.categories[mainCategory].subcategories[subCategory].totalDuration);
          summary.categories[mainCategory].totalDuration += event.duration;
          summary.categories[mainCategory].formattedTotalDuration = formatDuration(summary.categories[mainCategory].totalDuration);
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
  description: "Get activities by category from ActivityWatch",
  inputSchema: {
    type: "object",
    properties: {
      timeperiods: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Array of timeperiods in the format 'YYYY-MM-DD/YYYY-MM-DD'"
      },
      format: {
        type: "string",
        enum: ["detailed", "summary"],
        default: "summary",
        description: "Format of the output"
      },
      includeUncategorized: {
        type: "boolean",
        default: true,
        description: "Whether to include uncategorized activities"
      },
      limit: {
        type: "number",
        default: 5,
        description: "Maximum number of activities to return per category"
      }
    },
    required: ["timeperiods"]
  },
  handler: getActivitiesByCategory
};
