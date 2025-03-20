import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import { activitywatch_category_activity_tool } from './categoryActivity.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('activitywatch_category_activity_tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return categorized activities in summary format', async () => {
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
            id: 2,
            name: ["Comms"],
            rule: {
              regex: "OUTLOOK",
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

    // Mock buckets response
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
          },
          {
            data: {
              app: "OUTLOOK.EXE",
              title: "Inbox - user@example.com"
            },
            duration: 1800,
            timestamp: "2025-03-19T07:01:32.273000+00:00"
          },
          {
            data: {
              app: "firefox.exe",
              title: "GitHub - Repository"
            },
            duration: 1200,
            timestamp: "2025-03-19T07:04:33.547000+00:00"
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
    expect(mockedAxios.post).toHaveBeenCalledWith("http://localhost:5600/api/0/query/", {
      query: [expect.stringContaining("window_events = query_bucket")],
      timeperiods: ["2025-03-19/2025-03-20"]
    });

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
    
    // Check that uncategorized activities exist
    expect(parsedContent.uncategorized).toHaveProperty('activities');
    expect(Array.isArray(parsedContent.uncategorized.activities)).toBe(true);
  });

  test('should return categorized activities in detailed format', async () => {
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

    // Mock buckets response
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
