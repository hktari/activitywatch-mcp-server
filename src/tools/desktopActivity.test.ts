import { describe, expect, test, beforeEach } from '@jest/globals';
import moment from 'moment';
import { activitywatch_desktop_activity_tool } from './desktopActivity.js';

describe('activitywatch_desktop_activity_tool', () => {
    beforeEach(() => {
        process.env.NODE_ENV = 'test';
    });

    test('returns desktop activity for current day when no dates provided', async () => {
        const result = await activitywatch_desktop_activity_tool.handler({});
        
        expect(result.isError).toBe(false);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        
        const data = JSON.parse(result.content[0].text);
        expect(Array.isArray(data)).toBe(true);
    });

    test('validates today\'s desktop activity data structure and content', async () => {
        // Today's data
        const result = await activitywatch_desktop_activity_tool.handler({});
        
        expect(result.isError).toBe(false);
        expect(result.content).toHaveLength(1);
        
        const data = JSON.parse(result.content[0].text);
        expect(Array.isArray(data)).toBe(true);
        
        // Validate response structure has expected properties
        const firstItem = data[0];
        expect(firstItem).toHaveProperty('events');
        expect(Array.isArray(firstItem.events)).toBe(true);
        expect(firstItem.events.length).toBeGreaterThan(0);
        
        // Validate event structure based on the provided example
        const event = firstItem.events[0];
        expect(event).toHaveProperty('data');
        expect(event).toHaveProperty('duration');
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('timestamp');
        
        // Validate data structure
        expect(event.data).toHaveProperty('$category');
        expect(event.data).toHaveProperty('app');
        expect(event.data).toHaveProperty('title');
        
        // Ensure all events have timestamps for today
        const today = moment().startOf('day');
        const tomorrow = moment().add(1, 'day').startOf('day');
        
        // At least one event should be from today
        const hasEventsFromToday = firstItem.events.some((event: any) => {
            const eventTime = moment(event.timestamp);
            return eventTime.isSameOrAfter(today) && eventTime.isBefore(tomorrow);
        });
        
        expect(hasEventsFromToday).toBe(true);
    });

    test('returns desktop activity for specific date range', async () => {
        const startDate = moment().subtract(1, 'day').startOf('day').toISOString();
        const endDate = moment().endOf('day').toISOString();

        const result = await activitywatch_desktop_activity_tool.handler({
            startDate,
            endDate
        });
        
        expect(result.isError).toBe(false);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        
        const data = JSON.parse(result.content[0].text);
        expect(Array.isArray(data)).toBe(true);
    });

    test('returns desktop activity for last week', async () => {
        const startDate = moment().subtract(7, 'days').startOf('day').toISOString();
        const endDate = moment().endOf('day').toISOString();

        const result = await activitywatch_desktop_activity_tool.handler({
            startDate,
            endDate
        });
        
        expect(result.isError).toBe(false);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        
        const data = JSON.parse(result.content[0].text);
        expect(Array.isArray(data)).toBe(true);
    });
});
