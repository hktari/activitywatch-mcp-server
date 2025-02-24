import { z } from 'zod';
import axios, { AxiosError } from 'axios';

const AW_API_BASE = "http://localhost:5600/api/0";

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

export const bucketListTool = {
  name: "list-buckets",
  description: "List all ActivityWatch buckets with optional type filtering",
  inputSchema: inputSchema,
  // Properly structure the returned content for MCP
  handler: async (args: { type?: string; includeData?: boolean }) => {
    try {
      const response = await axios.get(`${AW_API_BASE}/buckets`);
      const buckets: Record<string, Bucket> = response.data;

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

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedBuckets, null, 2)
          }
        ]
      };
    } catch (error) {
      let errorMessage: string;
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          errorMessage = `Failed to fetch buckets: ${axiosError.message} (Status: ${axiosError.response.status})`;
        } else {
          errorMessage = `Failed to fetch buckets: ${axiosError.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = `Failed to fetch buckets: ${error.message}`;
      } else {
        errorMessage = 'Failed to fetch buckets: Unknown error';
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
};
