import axios, { AxiosError } from 'axios';
import moment from 'moment';
import { Category } from '../lib/queries.js';

export const AW_API_BASE = process.env.AW_API_BASE || "http://127.0.0.1:5600/api/0";

export interface Bucket {
    id: string;
    type: string;
    client: string;
    hostname: string;
    created: string;
    name: string | null;
}

export interface QueryResult {
    content: Array<{ type: string; text: string }>;
    isError: boolean;
}

interface CategoryRule {
    type: 'regex' | 'none';
    regex?: string;
    ignore_case?: boolean;
}

interface CategoryData {
    color?: string;
    score?: number;
}

interface CategoryClass {
    id: number;
    name: string[];
    rule: CategoryRule;
    data: CategoryData;
}

interface ViewElement {
    size: number;
    type: string;
}

interface View {
    id: string;
    name: string;
    elements: ViewElement[];
}

interface Settings {
    classes: CategoryClass[];
    durationDefault: number;
    initialTimestamp: string;
    landingpage: string;
    newReleaseCheckData: {
        howOftenToCheck: number;
        isEnabled: boolean;
        nextCheckTime: string;
        timesChecked: number;
    };
    requestTimeout: number;
    startOfDay: string;
    startOfWeek: string;
    theme: string;
    userSatisfactionPollData: {
        isEnabled: boolean;
        nextPollTime: string;
        timesPollIsShown: number;
    };
    views: View[];
}

// Get categories from ActivityWatch settings
export async function getCategories(): Promise<Category[]> {
    try {
        const response = await axios.get<Settings>(`${AW_API_BASE}/settings`);

        if (response.data && response.data.classes) {
            return response.data.classes.map((cls) => [
                cls.name,
                {
                    type: cls.rule.type,
                    regex: cls.rule.regex
                }
            ]);
        }

        return [];
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

export function toAWTimeperiod(startDate: string, endDate: string): string {
    const startDateMoment = moment(startDate);
    const endDateMoment = moment(endDate);
    if (!startDateMoment.isValid() || !endDateMoment.isValid()) {
        throw new Error('Invalid ISO date format');
    }

    if (startDateMoment.isSame(moment(), 'day')) {
        endDateMoment.add(1, 'day');
    }

    return `${startDateMoment.format('YYYY-MM-DD')}/${endDateMoment.format('YYYY-MM-DD')}`;
}

export function handleApiError(error: any) {
    console.error('API Error:', error);

    let errorMessage = 'An unknown error occurred';

    if (error instanceof AxiosError && error.response) {
        errorMessage = `API Error: ${error.response.status} - ${error.response.statusText}`;
        if (error.response.data && error.response.data.message) {
            errorMessage += `\nDetails: ${error.response.data.message}`;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
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
