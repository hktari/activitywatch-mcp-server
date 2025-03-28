import { aw } from '../lib/aw-client/index.js';
import { handleApiError } from './utils.js';

const AW_API_BASE = process.env.AW_API_BASE || "http://127.0.0.1:5600/api/0";

const inputSchema = {
  type: "object",
  properties: {
    bucketId: {
      type: "string",
      description: "ID of the bucket to fetch events from"
    },
    limit: {
      type: "number",
      description: "Maximum number of events to return (default: 100)"
    },
    start: {
      type: "string",
      description: "Start date/time in ISO format (e.g. '2024-02-01T00:00:00Z')"
    },
    end: {
      type: "string",
      description: "End date/time in ISO format (e.g. '2024-02-28T23:59:59Z')"
    }
  },
  required: ["bucketId"]
};

export const activitywatch_get_events_tool = {
  name: "activitywatch_get_events",
  description: "Get raw events from an ActivityWatch bucket",
  inputSchema: inputSchema,
  handler: async (args: { bucketId: string; limit?: number; start?: string; end?: string }) => {
    try {
      // Use the aw-client to fetch events
      const events = await aw.getEvents(
        args.bucketId,
        args.limit || 100,
        args.start || null,
        args.end || null
      );
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(events, null, 2)
          }
        ],
        isError: false
      };
    } catch (error) {
      return handleApiError(error);
    }
  }
};
