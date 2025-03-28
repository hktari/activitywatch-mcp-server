import { aw } from '../lib/aw-client/index.js';
import { handleApiError } from './utils.js';

export interface SettingsResponse {
  [key: string]: any;
}

const inputSchema = {
  type: "object",
  properties: {
    key: {
      type: "string",
      description: "Optional: Get a specific settings key instead of all settings"
    }
  }
};


export const activitywatch_get_settings_tool = {
  name: "activitywatch_get_settings",
  description: "Get ActivityWatch settings. Can retrieve all settings or a specific key if provided.",
  inputSchema: inputSchema,
  
  handler: async (args: { key?: string }) => {
    try {
      // Use the aw-client to fetch settings
      const settings = await aw.getSetting(args.key);
      
      // Format the settings data nicely
      const formattedSettings = JSON.stringify(settings, null, 2);
      
      let resultText = formattedSettings;
      
      // Add helpful guidance if we're not in test mode
      if (process.env.NODE_ENV !== 'test') {
        if (args.key) {
          resultText += `\n\nShowing settings for key: "${args.key}"\n`;
          resultText += `To get all settings, use activitywatch_get_settings without a key parameter.`;
        } else {
          resultText += `\n\nShowing all ActivityWatch settings.\n`;
          resultText += `To get a specific setting, use activitywatch_get_settings with a key parameter.`;
          
          // Add example of a specific key if there are any settings
          if (settings && typeof settings === 'object' && Object.keys(settings).length > 0) {
            const exampleKey = Object.keys(settings)[0];
            resultText += `\nFor example: activitywatch_get_settings with key = "${exampleKey}"`;
          }
        }
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
