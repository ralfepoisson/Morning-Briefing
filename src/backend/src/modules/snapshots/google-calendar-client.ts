import { describeFetchFailure } from '../../shared/fetch-error.js';

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  location: string;
  url: string;
  isAllDay: boolean;
  timeLabel: string;
};

export interface GoogleCalendarClient {
  listEvents(accessToken: string, calendarId: string, day: Date): Promise<GoogleCalendarEvent[]>;
}

export class GoogleCalendarClientImpl implements GoogleCalendarClient {
  async listEvents(accessToken: string, calendarId: string, day: Date): Promise<GoogleCalendarEvent[]> {
    const range = getDayRange(day);
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', range.start.toISOString());
    url.searchParams.set('timeMax', range.end.toISOString());
    url.searchParams.set('maxResults', '20');

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
    } catch (error) {
      throw new Error(describeFetchFailure('Google Calendar request', url, error));
    }

    if (!response.ok) {
      throw new Error(`Google Calendar request failed with status ${response.status}.`);
    }

    const payload = await response.json() as GoogleCalendarEventsResponse;

    if (!payload || !Array.isArray(payload.items)) {
      throw new Error('Google Calendar returned an invalid events payload.');
    }

    return payload.items.map(function mapEvent(item) {
      return {
        id: typeof item.id === 'string' ? item.id : '',
        title: typeof item.summary === 'string' && item.summary.trim() ? item.summary.trim() : 'Untitled event',
        location: typeof item.location === 'string' ? item.location : '',
        url: typeof item.htmlLink === 'string' ? item.htmlLink : '',
        isAllDay: isAllDayEvent(item.start),
        timeLabel: formatTimeLabel(item.start)
      };
    });
  }
}

type GoogleCalendarEventsResponse = {
  items?: Array<{
    id?: unknown;
    summary?: unknown;
    location?: unknown;
    htmlLink?: unknown;
    start?: {
      date?: unknown;
      dateTime?: unknown;
    } | null;
  }>;
};

function getDayRange(day: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())),
    end: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1))
  };
}

function isAllDayEvent(start: { date?: unknown; dateTime?: unknown } | null | undefined): boolean {
  return !!(start && typeof start.date === 'string' && start.date);
}

function formatTimeLabel(start: { date?: unknown; dateTime?: unknown } | null | undefined): string {
  if (!start) {
    return 'Time TBD';
  }

  if (typeof start.date === 'string' && start.date) {
    return 'All day';
  }

  if (typeof start.dateTime === 'string') {
    const match = start.dateTime.match(/T(\d{2}:\d{2})/);

    if (match) {
      return match[1];
    }
  }

  return 'Time TBD';
}
