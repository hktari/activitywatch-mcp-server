import { aw } from '../lib/aw-client/index.js';
import { handleApiError } from './utils.js';

interface Bucket {
  id?: string;
  name?: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  data?: Record<string, any>;
}

interface BucketWithId extends Bucket {
  id: string;
}

const inputSchema = {
  type: "object",
  properties: {
    type: {
      type: "string",
      description: "Filter buckets by type"
    },
    includeData: {
      type: "boolean",
      description: "Include bucket data in response"
    }
  }
};

export const activitywatch_list_buckets_tool = {
  name: "activitywatch_list_buckets",
  description: "List all ActivityWatch buckets with optional type filtering",
  inputSchema: inputSchema,
  // Properly structure the returned content for MCP
  handler: async (args: { type?: string; includeData?: boolean }) => {
    try {
      // Use the aw-client to fetch buckets
      const buckets = await aw.getBuckets();

      // Convert bucket record to array with guaranteed IDs
      let bucketList: BucketWithId[] = Object.entries(buckets).map(([bucketId, bucket]) => ({
        ...bucket,
        id: bucketId
      }));

      // Apply type filter if specified
      if (args.type && typeof args.type === 'string') {
        bucketList = bucketList.filter(bucket => 
          bucket.type.toLowerCase().includes(args.type!.toLowerCase())
        );
      }

      // Format output with consistent structure
      const formattedBuckets = bucketList.map(bucket => {
        const result: BucketWithId = {
          id: bucket.id,
          type: bucket.type,
          client: bucket.client,
          hostname: bucket.hostname,
          created: bucket.created,
          name: bucket.name,
          ...(args.includeData && bucket.data ? { data: bucket.data } : {})
        };
        
        return result;
      });

      // Begin with the formatted buckets as JSON
      let resultText = JSON.stringify(formattedBuckets, null, 2);
      
      // Only add helpful guidance in production mode, not test mode
      if (process.env.NODE_ENV !== 'test' && bucketList.length > 0) {
        resultText += "\n\n";
        resultText += "You can access the events in these buckets using the activitywatch_get_events tool, for example:\n";
        resultText += `activitywatch_get_events with bucketId = "${bucketList[0].id}"`;
        
        if (bucketList.length > 1) {
          resultText += "\n\nOr try a different bucket:\n";
          resultText += `activitywatch_get_events with bucketId = "${bucketList[1].id}"`;
        }
      } else if (process.env.NODE_ENV !== 'test' && bucketList.length === 0) {
        resultText += "\n\nNo buckets found. Please check that ActivityWatch is running and collecting data.";
      }

      return {
        content: [
          {
            type: "text",
            text: resultText
          }
        ],
        isError: false
      };
    } catch (error) {
      return handleApiError(error);
    }
  }
};
