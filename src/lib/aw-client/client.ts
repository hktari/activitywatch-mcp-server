/**
 * A TypeScript implementation of the ActivityWatch client API
 * Based on aw_client/client.py
 */
import axios, { AxiosError, AxiosResponse } from 'axios';
import moment from 'moment';

export const AW_API_BASE = process.env.AW_API_BASE || 'http://127.0.0.1:5600/api/0';

/**
 * Ensures date objects have timezone information
 */
function isDateTzAware(date: Date | string): boolean {
    if (typeof date === 'string') {
        return date.includes('Z') || date.includes('+');
    }
    return date.getTimezoneOffset() !== 0;
}

/**
 * ActivityWatch Client for TypeScript
 */
export class ActivityWatchClient {
    private clientName: string;
    private clientHostname: string;
    private serverAddress: string;

    constructor(
        clientName: string = 'unknown',
        testing: boolean = false,
        host: string | null = null,
        port: string | null = null,
        protocol: string = 'http'
    ) {
        this.clientName = clientName;
        this.clientHostname = typeof window !== 'undefined' ? window.location.hostname : 'node';
        
        // Default settings - in a real implementation, these would be loaded from a config file
        const serverHost = host || '127.0.0.1';
        const serverPort = port || '5600';
        this.serverAddress = `${protocol}://${serverHost}:${serverPort}/api/0`;
    }

    /**
     * Make a GET request to the ActivityWatch API
     */
    private async _get(endpoint: string, params?: Record<string, any>): Promise<AxiosResponse> {
        try {
            return await axios.get(`${this.serverAddress}/${endpoint}`, { params });
        } catch (error) {
            console.error(`Error in GET request to ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Make a POST request to the ActivityWatch API
     */
    private async _post(endpoint: string, data: any, params?: Record<string, any>): Promise<AxiosResponse> {
        try {
            return await axios.post(`${this.serverAddress}/${endpoint}`, data, { params });
        } catch (error) {
            console.error(`Error in POST request to ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Make a DELETE request to the ActivityWatch API
     */
    private async _delete(endpoint: string, data?: any): Promise<AxiosResponse> {
        try {
            return await axios.delete(`${this.serverAddress}/${endpoint}`, { data });
        } catch (error) {
            console.error(`Error in DELETE request to ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Get server info
     */
    async getInfo(): Promise<any> {
        const response = await this._get('info');
        return response.data;
    }

    /**
     * Get a specific event by ID
     */
    async getEvent(bucketId: string, eventId: number): Promise<any> {
        const response = await this._get(`buckets/${bucketId}/events/${eventId}`);
        return response.data;
    }

    /**
     * Get events from a bucket
     */
    async getEvents(
        bucketId: string,
        limit: number = -1,
        start: Date | string | null = null,
        end: Date | string | null = null
    ): Promise<any[]> {
        const params: Record<string, any> = {};
        
        if (limit > 0) {
            params.limit = limit;
        }
        
        // Define startMoment outside both blocks so it's accessible throughout
        let startMoment: moment.Moment | null = null;
        
        if (start) {
            // Ensure proper ISO format with timezone
            startMoment = moment(start);
            if (!startMoment.isValid()) {
                throw new Error('Invalid start date');
            }
            params.start = startMoment.toISOString();
        }
        
        if (end) {
            // Ensure proper ISO format with timezone
            const endMoment = moment(end);
            if (!endMoment.isValid()) {
                throw new Error('Invalid end date');
            }
            // Ensure that when querying for today's events, the end date is set to tomorrow
            if (startMoment && startMoment.isSame(moment(), 'day')) {
                endMoment.add(1, 'day');
            }
            params.end = endMoment.toISOString();
        }
        
        const response = await this._get(`buckets/${bucketId}/events`, params);
        return response.data;
    }

    /**
     * Insert a single event into a bucket
     */
    async insertEvent(bucketId: string, event: any): Promise<any> {
        const response = await this._post(`buckets/${bucketId}/events`, event);
        return response.data;
    }

    /**
     * Insert multiple events into a bucket
     */
    async insertEvents(bucketId: string, events: any[]): Promise<any> {
        const response = await this._post(`buckets/${bucketId}/events`, events);
        return response.data;
    }

    /**
     * Get all buckets
     */
    async getBuckets(): Promise<Record<string, any>> {
        const response = await this._get('buckets');
        return response.data;
    }

    /**
     * Create a new bucket
     */
    async createBucket(bucketId: string, eventType: string): Promise<any> {
        const data = {
            client: this.clientName,
            hostname: this.clientHostname,
            type: eventType,
        };
        const response = await this._post(`buckets/${bucketId}`, data);
        return response.data;
    }

    /**
     * Delete a bucket
     */
    async deleteBucket(bucketId: string, force: boolean = false): Promise<any> {
        const params: Record<string, any> = {};
        if (force) {
            params.force = 1;
        }
        const response = await this._delete(`buckets/${bucketId}`, { params });
        return response.data;
    }

    /**
     * Execute a query against the ActivityWatch server
     * 
     * @param query Query string to execute
     * @param timeperiods List of time periods in [start, end] format
     * @param name Optional name for the query (used for caching)
     * @param cache Whether to use caching
     */
    async query(
        query: string,
        timeperiods: [Date | string, Date | string][],
        name?: string,
        cache: boolean = false
    ): Promise<any> {
        const endpoint = 'query/';
        const params: Record<string, any> = {};
        
        if (cache) {
            if (!name) {
                throw new Error('You are not allowed to do caching without a query name');
            }
            params.name = name;
            params.cache = cache ? 1 : 0;
        }

        // Check that dates have timezone information
        for (const [start, end] of timeperiods) {
            if (!isDateTzAware(start) || !isDateTzAware(end)) {
                throw new Error('start/end dates need to have timezone information');
            }
        }

        const data = {
            timeperiods: timeperiods.map(([start, end]) => {
                const startIso = moment(start).toISOString();
                const endIso = moment(end).toISOString();
                return `${startIso}/${endIso}`;
            }),
            query: query.split('\n')
        };

        const response = await this._post(endpoint, data, params);
        return response.data;
    }

    /**
     * Get settings from the ActivityWatch server
     */
    async getSetting(key?: string): Promise<any> {
        const endpoint = key ? `settings/${key}` : 'settings';
        const response = await this._get(endpoint);
        return response.data;
    }

    /**
     * Set a setting on the ActivityWatch server
     */
    async setSetting(key: string, value: any): Promise<void> {
        await this._post(`settings/${key}`, value);
    }
}

/**
 * Default ActivityWatch client instance for easy importing
 */
export const aw = new ActivityWatchClient('aw-client-ts');
