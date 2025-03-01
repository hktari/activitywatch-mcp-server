import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosError } from 'axios';
import { queryTool } from './query.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('queryTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a simple query successfully', async () => {
    const mockResponse = {
      data: {
        "2024-02-01_2024-02-07": [
          { "duration": 3600, "app": "Firefox" },
          { "duration": 1800, "app": "Visual Studio Code" }
        ]
      }
    };

    mockedAxios.post.mockResolvedValueOnce(mockResponse);

    const result = await queryTool.handler({
      timeperiods: ['2024-02-01', '2024-02-07'],
      query: ['afk_events = query_bucket("aw-watcher-afk_hostname");', 'RETURN = afk_events;']
    });
    
    expect(result!.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result!.content[0].text);
    expect(parsedContent).toBeDefined();
    expect(parsedContent["2024-02-01_2024-02-07"]).toHaveLength(2);
  });

  it('should include name parameter when provided', async () => {
    const mockResponse = { data: { result: "success" } };
    mockedAxios.post.mockResolvedValueOnce(mockResponse);

    await queryTool.handler({
      timeperiods: ['2024-02-01', '2024-02-07'],
      query: ['RETURN = "test";'],
      name: 'my-test-query'
    });
    
    // Verify that the URL included the name parameter
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('?name=my-test-query'),
      {
        query: [
          ['RETURN = "test";']
        ],
        timeperiods: ['2024-02-01/2024-02-07']
      }
    );
  });

  it('should handle query errors with response data', async () => {
    // Mock axios.isAxiosError to return true for our mock error
    const originalIsAxiosError = axios.isAxiosError;
    
    // Create a mock error with the expected structure
    const mockAxiosError = {
      isAxiosError: true,
      message: 'Bad request',
      response: {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
        data: { error: 'Query syntax error' }
      }
    };
    
    // Override axios.isAxiosError for this test
    // This approach avoids TypeScript errors with direct mocking
    jest.spyOn(axios, 'isAxiosError').mockImplementation(() => true);
    
    // Reject with our custom error object
    mockedAxios.post.mockRejectedValueOnce(mockAxiosError);

    const result = await queryTool.handler({
      timeperiods: ['2024-02-01', '2024-02-07'],
      query: ['invalid query syntax']
    });
    
    expect(result!.isError).toBe(true);
    expect(result!.content[0].text).toContain('Query failed');
    expect(result!.content[0].text).toContain('400');
    expect(result!.content[0].text).toContain('Query syntax error');
    
    // Restore the original function after the test
    jest.spyOn(axios, 'isAxiosError').mockRestore();
  });

  it('should handle network errors', async () => {
    // Mock network error
    const networkError = {
      isAxiosError: true,
      message: 'Network Error',
      // No response property to simulate network error
    };
    
    // Override axios.isAxiosError for this test
    jest.spyOn(axios, 'isAxiosError').mockImplementation(() => true);
    
    mockedAxios.post.mockRejectedValueOnce(networkError);

    const result = await queryTool.handler({
      timeperiods: ['2024-02-01', '2024-02-07'],
      query: ['RETURN = "test";']
    });
    
    expect(result!.isError).toBe(true);
    expect(result!.content[0].text).toBe('Query failed: Network Error');
    
    // Restore the original function
    jest.spyOn(axios, 'isAxiosError').mockRestore();
  });
});
