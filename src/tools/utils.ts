import axios, { AxiosError } from 'axios';
import moment from 'moment';
export const AW_API_BASE = process.env.AW_API_BASE || "http://127.0.0.1:5600/api/0";

export function toAWTimeperiod(startDate: string, endDate: string): string {
    const startDateMoment = moment(startDate);
    const endDateMoment = moment(endDate);
    if (!startDateMoment.isValid() || !endDateMoment.isValid()) {
        throw new Error('Invalid ISO date format');
    }

    // For today's date, set end date to tomorrow
    // This is critical for today's events to show up
    if (startDateMoment.isSame(moment(), 'day')) {
        endDateMoment.add(1, 'day');
    }

    // Use full ISO format to match Python's isoformat() method
    return `${startDateMoment.toISOString()}/${endDateMoment.toISOString()}`;
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
