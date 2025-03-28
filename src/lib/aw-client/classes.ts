/**
 * Default categories and rule implementation
 * Based on aw_client/classes.py
 */
import { aw } from './client.js';

export type CategoryId = string[];
export type Rule = {
    type: 'regex' | 'none';
    regex?: string;
    ignore_case?: boolean;
};

export type Category = [CategoryId, Rule];

/**
 * Default categories from the ActivityWatch client
 */
export const defaultCategories: Category[] = [
    [["Work"], { "type": "regex", "regex": "Google Docs|libreoffice|ReText" }],
    [
        ["Work", "Programming"],
        {
            "type": "regex",
            "regex": "GitHub|Stack Overflow|BitBucket|Gitlab|vim|Spyder|kate|Ghidra|Scite"
        }
    ],
    [
        ["Work", "Programming", "ActivityWatch"],
        { "type": "regex", "regex": "ActivityWatch|aw-", "ignore_case": true }
    ],
    [["Work", "Image"], { "type": "regex", "regex": "Gimp|Inkscape" }],
    [["Work", "Video"], { "type": "regex", "regex": "Kdenlive" }],
    [["Work", "Audio"], { "type": "regex", "regex": "Audacity" }],
    [["Work", "3D"], { "type": "regex", "regex": "Blender" }],
    [["Media", "Games"], { "type": "regex", "regex": "Minecraft|RimWorld" }],
    [["Media", "Video"], { "type": "regex", "regex": "YouTube|Plex|VLC" }],
    [
        ["Media", "Social Media"],
        {
            "type": "regex",
            "regex": "reddit|Facebook|Twitter|Instagram|devRant",
            "ignore_case": true
        }
    ],
    [
        ["Media", "Music"],
        { "type": "regex", "regex": "Spotify|Deezer", "ignore_case": true }
    ],
    [
        ["Comms", "IM"],
        {
            "type": "regex",
            "regex": "Messenger|Telegram|Signal|WhatsApp|Rambox|Slack|Riot|Discord|Nheko"
        }
    ],
    [
        ["Comms", "Email"],
        { "type": "regex", "regex": "Gmail|Thunderbird|mutt|alpine" }
    ],
];

/**
 * Get categories from server-side settings.
 * Might throw if not set yet, in which case it uses default categories as a fallback.
 */
export async function getCategories(): Promise<Category[]> {
    try {
        const settingsData = await aw.getSetting('classes');
        
        // Map settings into the expected format of categories
        if (settingsData && Array.isArray(settingsData)) {
            return settingsData.map(cls => [
                cls.name,
                cls.rule
            ]);
        }
        
        console.warn('Failed to get properly formatted categories, using default categories as fallback');
        return defaultCategories;
    } catch (error) {
        console.warn('Failed to get categories from server, using default categories as fallback');
        return defaultCategories;
    }
}
