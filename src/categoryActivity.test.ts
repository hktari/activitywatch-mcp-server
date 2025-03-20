import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import { activitywatch_category_activity_tool } from './categoryActivity.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Define the type for the query data
interface QueryData {
  query: string[];
  timeperiods: string[];
}

describe('activitywatch_category_activity_tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return categorized activities in summary format with multiple bucket types', async () => {
    // Mock settings response with categories
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        classes: [
          {
            id: 1,
            name: ["Work", "Programming"],
            rule: {
              ignore_case: true,
              regex: "Code|VSCode|Visual Studio Code|GitHub|Stack Overflow",
              type: "regex"
            },
            data: {}
          },
          {
            id: 2,
            name: ["Comms"],
            rule: {
              regex: "OUTLOOK|Gmail|Slack",
              type: "regex"
            },
            data: {}
          },
          {
            id: 3,
            name: ["Research", "Documentation"],
            rule: {
              regex: "Firefox|Chrome|Documentation|Manual",
              type: "regex"
            },
            data: {}
          },
          {
            id: 5,
            name: ["Uncategorized"],
            rule: {
              type: "none"
            },
            data: {}
          }
        ]
      }
    });

    // Mock buckets response with window, afk, web, and vscode buckets
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        'aw-watcher-window_test': { type: 'window' },
        'aw-watcher-afk_test': { type: 'afk' },
        'aw-watcher-web-firefox_test': { type: 'web.tab.current' },
        'aw-watcher-vscode_test': { type: 'app.editor.activity' }
      }
    });

    // Mock query response with activities from different sources
    mockedAxios.post.mockResolvedValueOnce({
      data: [
        [
          // Window events
          {
            data: {
              app: "Code.exe",
              title: "index.ts - Project"
            },
            duration: 3600,
            timestamp: "2025-03-19T07:13:29.598000+00:00"
          },
          {
            data: {
              app: "OUTLOOK.EXE",
              title: "Inbox - user@example.com"
            },
            duration: 1800,
            timestamp: "2025-03-19T07:01:32.273000+00:00"
          },
          // Web events
          {
            data: {
              app: "Firefox",
              title: "GitHub - Repository",
              url: "https://github.com/example/repo"
            },
            duration: 1200,
            timestamp: "2025-03-19T07:04:33.547000+00:00"
          },
          {
            data: {
              app: "Firefox",
              title: "Stack Overflow - Question",
              url: "https://stackoverflow.com/questions/12345"
            },
            duration: 900,
            timestamp: "2025-03-19T08:15:22.123000+00:00"
          },
          // VSCode events
          {
            data: {
              app: "Code.exe",
              title: "index.ts - Project",
              file: "/path/to/index.ts",
              project: "my-project"
            },
            duration: 2400,
            timestamp: "2025-03-19T09:30:45.789000+00:00"
          }
        ]
      ]
    });

    // Call the tool with test parameters
    const result = await activitywatch_category_activity_tool.handler(
      ["2025-03-19/2025-03-20"],
      "summary",
      true,
      5
    );

    // Verify axios was called correctly
    expect(mockedAxios.get).toHaveBeenCalledWith("http://localhost:5600/api/0/settings");
    expect(mockedAxios.get).toHaveBeenCalledWith("http://localhost:5600/api/0/buckets");
    
    // Verify the query includes all bucket types
    expect(mockedAxios.post).toHaveBeenCalledWith("http://localhost:5600/api/0/query/", {
      query: [expect.stringContaining("window_events = query_bucket")],
      timeperiods: ["2025-03-19/2025-03-20"]
    });
    
    const queryData = mockedAxios.post.mock.calls[0][1] as QueryData;
    const queryString = queryData.query[0];
    expect(queryString).toContain("web_events_0 = query_bucket");
    expect(queryString).toContain("vscode_events_0 = query_bucket");

    // Verify the response structure
    expect(result).toHaveProperty('content');
    
    // Parse the response content
    const content = result.content[0].text;
    const parsedContent = JSON.parse(content);
    
    // Check the structure of the response
    expect(parsedContent).toHaveProperty('categories');
    expect(parsedContent).toHaveProperty('uncategorized');
    
    // Check that Work category exists with Programming subcategory
    expect(parsedContent.categories).toHaveProperty('Work');
    expect(parsedContent.categories.Work.subcategories).toHaveProperty('Programming');
    
    // Check that Comms category exists
    expect(parsedContent.categories).toHaveProperty('Comms');
    
    // Check that Research category exists
    expect(parsedContent.categories).toHaveProperty('Research');
    
    // Check that uncategorized activities exist
    expect(parsedContent.uncategorized).toHaveProperty('activities');
    expect(Array.isArray(parsedContent.uncategorized.activities)).toBe(true);
  });

  test('should handle missing web and vscode buckets gracefully', async () => {
    // Mock settings response with categories
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        classes: [
          {
            id: 1,
            name: ["Work", "Programming"],
            rule: {
              ignore_case: true,
              regex: "Code|VSCode|Visual Studio Code",
              type: "regex"
            },
            data: {}
          },
          {
            id: 5,
            name: ["Uncategorized"],
            rule: {
              type: "none"
            },
            data: {}
          }
        ]
      }
    });

    // Mock buckets response with only window and afk buckets
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        'aw-watcher-window_test': { type: 'window' },
        'aw-watcher-afk_test': { type: 'afk' }
      }
    });

    // Mock query response with activities
    mockedAxios.post.mockResolvedValueOnce({
      data: [
        [
          {
            data: {
              app: "Code.exe",
              title: "index.ts - Project"
            },
            duration: 3600,
            timestamp: "2025-03-19T07:13:29.598000+00:00"
          }
        ]
      ]
    });

    // Call the tool with test parameters
    const result = await activitywatch_category_activity_tool.handler(
      ["2025-03-19/2025-03-20"],
      "detailed"
    );

    // Verify the query doesn't include web or vscode buckets
    const queryData = mockedAxios.post.mock.calls[0][1] as QueryData;
    const queryString = queryData.query[0];
    expect(queryString).not.toContain("web_events");
    expect(queryString).not.toContain("vscode_events");

    // Verify the response structure
    expect(result).toHaveProperty('content');
    
    // Parse the response content
    const content = result.content[0].text;
    const parsedContent = JSON.parse(content);
    
    // Check that it's an array of events
    expect(Array.isArray(parsedContent)).toBe(true);
    
    // Check that each event has a category property
    parsedContent.forEach((event: any) => {
      expect(event).toHaveProperty('category');
      expect(Array.isArray(event.category)).toBe(true);
    });
  });

  test('should handle errors from the API', async () => {
    // Mock settings API error
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    // Call the tool with test parameters
    const result = await activitywatch_category_activity_tool.handler(
      ["2025-03-19/2025-03-20"]
    );

    // Verify the error response
    expect(result).toHaveProperty('content');
    expect(result.content[0].text).toContain('Error:');
  });
});
